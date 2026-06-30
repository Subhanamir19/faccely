// scorer-node/src/services/potentialFaceGeneration.ts
//
// Phase 2 generation pipeline. Given a `potential_faces` row id, this service:
//   1. loads the row + its baseline scan
//   2. downloads the baseline frontal image from the `face-scans` bucket
//   3. calls the configured GPT Image model for one fast mobile-preview candidate
//   4. uploads the candidate to the `potential-faces` bucket
//   5. transitions the row to `ready` and writes an audit-log entry
//
// The PROMPT used here is the deliberate v1 placeholder — it is realistic
// enough to evaluate the pipeline end-to-end, but Phase 7 will iterate on it
// against real outputs. Do not over-engineer it now.

import OpenAI, { toFile } from "openai";
import sharp from "sharp";

import { PROVIDERS } from "../config/index.js";
import { getAnalysisForScan } from "../supabase/analyses.js";
import { getScanById } from "../supabase/scans.js";
import { downloadScanImage } from "../supabase/storage.js";
import {
  createPendingPotentialFace,
  getPotentialFaceById,
  getPotentialFaceForUserStage,
  hasWeeklyGenerationCapacity,
  markFailed,
  markReady,
  recordGenerationAttempt,
  resetForRetry,
  type PotentialFaceRecord,
  type TargetedMetric,
} from "../supabase/potentialFaces.js";
import { uploadPotentialFaceImage } from "../supabase/potentialFaceStorage.js";
import { enqueuePotentialFace } from "../queue/jobs.js";

type PotentialFaceGenerationDeps = {
  getPotentialFaceById: typeof getPotentialFaceById;
  getScanById: typeof getScanById;
  getAnalysisForScan: typeof getAnalysisForScan;
  hasWeeklyGenerationCapacity: typeof hasWeeklyGenerationCapacity;
  downloadScanImage: typeof downloadScanImage;
  uploadPotentialFaceImage: typeof uploadPotentialFaceImage;
  markReady: typeof markReady;
  markFailed: typeof markFailed;
  recordGenerationAttempt: typeof recordGenerationAttempt;
};

const defaultDeps: PotentialFaceGenerationDeps = {
  getPotentialFaceById,
  getScanById,
  getAnalysisForScan,
  hasWeeklyGenerationCapacity,
  downloadScanImage,
  uploadPotentialFaceImage,
  markReady,
  markFailed,
  recordGenerationAttempt,
};

let deps: PotentialFaceGenerationDeps = defaultDeps;

export function setPotentialFaceGenerationDepsForTest(
  overrides: Partial<PotentialFaceGenerationDeps> | null
) {
  deps = overrides ? { ...defaultDeps, ...overrides } : defaultDeps;
}

/* -------------------------------------------------------------------------- */
/*   Tunables                                                                 */
/* -------------------------------------------------------------------------- */

export const PROMPT_VERSION = "v4";
const MODEL = PROVIDERS.openai.imageModel;
const SIZE: "1024x1024" | "1024x1536" | "1536x1024" | "auto" = "1024x1024";
const QUALITY: "low" | "medium" | "high" | "auto" = "medium";
const OUTPUT_FORMAT = "jpeg";
const OUTPUT_COMPRESSION = 84;
const CANDIDATE_COUNT = 1;
export type PotentialFacePromptMode = "conservative" | "balanced" | "aggressive";

/** How many sub-metrics from the advanced_result we target per stage. */
const TARGET_METRIC_COUNT = 5;

/** Capped Stage-1 delta — a believable improvement that doesn't drift identity. */
const TARGET_DELTA = 25;
const TARGET_CEILING = 85;

/**
 * Whitelist of sub-metric keys we will target in the image. Keys NOT in this
 * map are skipped at picker time when they are hard to represent safely from a
 * frontal image. The string values here are prompt phrasings used by
 * `buildPromptV1`.
 */
const SUB_METRIC_VISUAL_HINT: Record<string, string> = {
  // cheekbones
  "cheekbones.width_score": "more visible bizygomatic width across the cheekbones",
  "cheekbones.maxilla_score": "stronger forward maxillary projection in the midface",
  "cheekbones.bone_structure_score": "more sculpted cheekbone definition with clearer underlying contour",
  "cheekbones.face_fat_score": "leaner submalar/buccal area for cleaner cheek hollows",
  "cheekbones.fwhr_score": "a more balanced perceived facial width-to-height ratio while preserving identity",
  // jawline
  "jawline.development_score": "sharper jawline definition along the mandibular border",
  "jawline.gonial_angle_score": "crisper gonial angle where the jaw meets the ramus",
  "jawline.projection_score": "stronger anterior chin and jaw projection",
  // eyes
  "eyes.canthal_tilt_score": "cleaner eye framing with a subtly more positive outer-corner lift",
  "eyes.eye_type_score": "more compact, focused eye shape with reduced upper-lid exposure",
  "eyes.brow_volume_score": "fuller, better-groomed eyebrows",
  "eyes.symmetry_score": "better left-right balance in the eye area without changing eye identity",
  // skin
  "skin.color_score": "more even skin tone, reduced redness and discoloration",
  "skin.quality_score": "clearer, smoother skin with reduced blemishes and a healthy texture",
  // haircut
  "haircut.density_score": "a fuller, cleaner hair frame while preserving the person's natural hairline and identity",
  "haircut.styling_score": "a neater haircut shape that better suits the person's face proportions",
  "haircut.facial_hair_score": "cleaner, more intentional facial-hair grooming that supports the jaw and cheek structure",
};

/* -------------------------------------------------------------------------- */
/*   Public entry point                                                       */
/* -------------------------------------------------------------------------- */

export interface GeneratePotentialFaceParams {
  potentialFaceId: string;
  /** True on the worker's last attempt, so failures persist `status='failed'`. */
  isFinalAttempt: boolean;
}

/**
 * Run the full generation pipeline. Throws on any error so the BullMQ worker
 * can drive its retry policy. Side effects (markReady / markFailed / audit
 * log) are written before the throw or return so the row state is always
 * consistent at the moment the worker observes the outcome.
 */
export async function generatePotentialFace(
  openai: OpenAI,
  params: GeneratePotentialFaceParams
): Promise<PotentialFaceRecord | null> {
  const t0 = Date.now();
  const { potentialFaceId, isFinalAttempt } = params;

  const row = await deps.getPotentialFaceById(potentialFaceId);
  if (!row) {
    // Row was deleted between enqueue and worker pickup — nothing to do.
    console.warn("[potential-face:gen] row missing", potentialFaceId);
    return null;
  }
  if (row.status !== "pending") {
    // Already terminal — idempotent skip protects against duplicate jobs.
    console.log("[potential-face:gen] skip: status =", row.status, potentialFaceId);
    return row;
  }

  let generationPhase = "pre_openai";
  let sourceImageBytes: number | null = null;
  let sourceImageWidth: number | null = null;
  let sourceImageHeight: number | null = null;
  let response: unknown = null;
  let providerRequestId: string | null = null;
  let providerUsage: Record<string, unknown> | null = null;
  let responseCandidateCount = 0;

  try {
    const [scan, analysis] = await Promise.all([
      deps.getScanById(row.user_id, row.baseline_scan_id),
      deps.getAnalysisForScan(row.baseline_scan_id),
    ]);
    if (!scan) {
      throw makeFailure("baseline_scan_missing", "Baseline scan not found.");
    }
    const advancedResult = getUsableAdvancedResult(analysis?.advanced_result);
    if (!advancedResult) {
      throw makeFailure(
        "advanced_analysis_missing",
        "Advanced analysis must be saved before potential face generation."
      );
    }
    const targetedMetrics = pickTargetedMetrics(advancedResult);
    if (targetedMetrics.length === 0) {
      throw makeFailure(
        "target_metrics_missing",
        "Advanced analysis did not include any supported visual target metrics."
      );
    }

    const hasCapacity = await deps.hasWeeklyGenerationCapacity(row.user_id);
    if (!hasCapacity) {
      throw makeFailure("weekly_quota_exceeded", "Weekly potential face generation limit reached.");
    }

    const baselineBuffer = await deps.downloadScanImage(scan.front_image_path);
    if (!baselineBuffer.length) {
      throw makeFailure("baseline_image_empty", "Baseline frontal image is empty.");
    }
    const normalizedSourceBuffer = await preparePotentialFaceSourceImage(baselineBuffer);
    const sourceMeta = await readImageTelemetry(normalizedSourceBuffer);
    sourceImageBytes = normalizedSourceBuffer.length;
    sourceImageWidth = sourceMeta.width;
    sourceImageHeight = sourceMeta.height;

    const prompt = buildPromptV1(targetedMetrics);

    response = await openai.images.edit(
      {
        model: MODEL,
        image: await toFile(normalizedSourceBuffer, "baseline.jpg", { type: "image/jpeg" }),
        prompt,
        n: CANDIDATE_COUNT,
        size: SIZE,
        quality: QUALITY,
        output_format: OUTPUT_FORMAT,
        output_compression: OUTPUT_COMPRESSION,
      } as any // GPT image edits return b64_json for this endpoint shape
    );
    generationPhase = "openai_response_received";
    providerRequestId = getProviderRequestId(response);
    providerUsage = getProviderUsage(response);

    const candidates = (response as { data?: Array<{ b64_json?: string }> }).data ?? [];
    responseCandidateCount = candidates.length;
    const primaryB64 = candidates[0]?.b64_json;
    if (!primaryB64) {
      throw makeFailure("no_image_returned", "OpenAI returned no image data.");
    }

    // Upload primary first; alternate is best-effort (we still ship if it fails)
    generationPhase = "uploading_primary";
    const generationId = `${Date.now()}-${row.stage}`;
    const primaryBuffer = Buffer.from(primaryB64, "base64");
    const primaryPath = await deps.uploadPotentialFaceImage({
      userId: row.user_id,
      stage: row.stage,
      variant: "primary",
      buffer: primaryBuffer,
      contentType: "image/jpeg",
      generationId,
    });

    let alternatePath: string | null = null;
    const alternateB64 = candidates[1]?.b64_json;
    if (alternateB64) {
      try {
        const alternateBuffer = Buffer.from(alternateB64, "base64");
        alternatePath = await deps.uploadPotentialFaceImage({
          userId: row.user_id,
          stage: row.stage,
          variant: "alternate",
          buffer: alternateBuffer,
          contentType: "image/jpeg",
          generationId,
        });
      } catch (err) {
        // Soft failure — primary is enough to ship the reveal screen. The
        // "doesn't look like me" retry will simply not be available.
        console.warn(
          "[potential-face:gen] alternate upload failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    generationPhase = "marking_ready";
    const ready = await deps.markReady({
      id: row.id,
      primaryImagePath: primaryPath,
      alternateImagePath: alternatePath,
      targetedMetrics,
      promptVersion: PROMPT_VERSION,
    });

    generationPhase = "recording_success_audit";
    await deps.recordGenerationAttempt({
      userId: row.user_id,
      potentialFaceId: row.id,
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      candidateCount: candidates.length,
      latencyMs: Date.now() - t0,
      costCents: estimateCostCents(response),
      size: SIZE,
      quality: QUALITY,
      requestedCandidateCount: CANDIDATE_COUNT,
      sourceImageBytes,
      sourceImageWidth,
      sourceImageHeight,
      providerRequestId,
      providerUsage,
      generationPhase: "ready",
      success: true,
    });

    console.log("[potential-face:gen] ready", {
      potentialFaceId: row.id,
      userId: row.user_id,
      stage: row.stage,
      latencyMs: Date.now() - t0,
      candidates: candidates.length,
      hasAlternate: alternatePath !== null,
    });

    return ready;
  } catch (err) {
    const reason = (err as { code?: string })?.code ?? "generation_failed";
    const message = err instanceof Error ? err.message : String(err);
    const paidCallCompleted = generationPhase !== "pre_openai";

    await deps.recordGenerationAttempt({
      userId: row.user_id,
      potentialFaceId: row.id,
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      candidateCount: responseCandidateCount,
      latencyMs: Date.now() - t0,
      costCents: response ? estimateCostCents(response) : null,
      success: false,
      size: SIZE,
      quality: QUALITY,
      requestedCandidateCount: CANDIDATE_COUNT,
      sourceImageBytes,
      sourceImageWidth,
      sourceImageHeight,
      providerRequestId,
      providerUsage,
      generationPhase,
      error: `${reason}: ${message}`,
    }).catch(() => undefined);

    if (paidCallCompleted || isFinalAttempt) {
      // No more retries — persist the failure state so the client can react.
      const failed = await deps.markFailed({
        id: row.id,
        errorReason: `${reason}: ${message}`,
      }).catch((markErr) => {
        console.error("[potential-face:gen] markFailed itself failed:", markErr);
        return null;
      });

      if (paidCallCompleted) {
        console.error("[potential-face:gen] paid call completed but finalization failed", {
          potentialFaceId: row.id,
          userId: row.user_id,
          generationPhase,
          providerRequestId,
          reason,
        });
        return failed ?? row;
      }
    }

    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/*   Auto-trigger (called fire-and-forget from /analyze/advanced-explain)     */
/* -------------------------------------------------------------------------- */

/**
 * Ensure the user has a Stage-1 potential face job in flight. Idempotent —
 * safe to call on every advanced-explain. Designed to run async after the
 * advanced_result has been written, so the worker reads the same row when it
 * picks up the job.
 *
 * State semantics:
 *   none      → create pending row, enqueue job
 *   pending   → no-op (job already queued)
 *   ready     → no-op (image already exists)
 *   unlocked  → no-op (user is past Stage 1)
 *   failed    → reset row to pending, force-requeue
 */
export async function ensureStage1Generation(params: {
  userId: string;
  baselineScanId: string;
}): Promise<{ enqueued: boolean; potentialFaceId: string | null; reason: string }> {
  const TARGET_STAGE = 1;
  const existing = await getPotentialFaceForUserStage(params.userId, TARGET_STAGE);

  if (existing && existing.status !== "failed") {
    return {
      enqueued: false,
      potentialFaceId: existing.id,
      reason: `existing_${existing.status}`,
    };
  }

  const hasCapacity = await hasWeeklyGenerationCapacity(params.userId);
  if (!hasCapacity) {
    return {
      enqueued: false,
      potentialFaceId: existing?.id ?? null,
      reason: "weekly_quota_exceeded",
    };
  }

  let row: PotentialFaceRecord;
  let forceRequeue = false;
  if (!existing) {
    row = await createPendingPotentialFace({
      userId: params.userId,
      baselineScanId: params.baselineScanId,
      stage: TARGET_STAGE,
    });
  } else {
    row = await resetForRetry(existing.id);
    forceRequeue = true;
  }

  await enqueuePotentialFace(
    {
      potentialFaceId: row.id,
      baselineScanId: row.baseline_scan_id,
      userId: params.userId,
      stage: row.stage,
    },
    { forceRequeue }
  );

  return {
    enqueued: true,
    potentialFaceId: row.id,
    reason: forceRequeue ? "retry_after_failure" : "fresh_create",
  };
}

/* -------------------------------------------------------------------------- */
/*   Metric picker                                                            */
/* -------------------------------------------------------------------------- */

interface AdvancedSubMetric {
  group: string;
  sub_metric: string; // e.g. "width_score"
  score: number;
}

/**
 * Walk advanced_result, collect every `*_score` numeric field whose key is in
 * the visual-hint whitelist, sort ascending by score, take the bottom N.
 * Targets are clamped to baseline + TARGET_DELTA, capped at TARGET_CEILING.
 */
export function pickTargetedMetrics(
  advanced: Record<string, unknown>
): TargetedMetric[] {
  const candidates: AdvancedSubMetric[] = [];

  for (const [groupKey, groupVal] of Object.entries(advanced)) {
    if (!groupVal || typeof groupVal !== "object") continue;
    for (const [subKey, subVal] of Object.entries(groupVal as Record<string, unknown>)) {
      if (!subKey.endsWith("_score")) continue;
      if (typeof subVal !== "number" || !Number.isFinite(subVal)) continue;
      const compoundKey = `${groupKey}.${subKey}`;
      if (!(compoundKey in SUB_METRIC_VISUAL_HINT)) continue;
      candidates.push({ group: groupKey, sub_metric: subKey, score: subVal });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, TARGET_METRIC_COUNT).map((c) => ({
    group: c.group,
    sub_metric: c.sub_metric,
    baseline_score: Math.round(c.score),
    target_score: Math.min(TARGET_CEILING, Math.round(c.score) + TARGET_DELTA),
  }));
}

/* -------------------------------------------------------------------------- */
/*   Prompt v1 (placeholder — Phase 7 owns the real one)                      */
/* -------------------------------------------------------------------------- */

function buildPromptLegacyV1(targeted: TargetedMetric[]): string {
  const improvements = targeted
    .map((m) => {
      const key = `${m.group}.${m.sub_metric}`;
      return SUB_METRIC_VISUAL_HINT[key] ?? `${m.group} ${m.sub_metric.replace(/_score$/, "")}`;
    })
    .map((line, i) => `(${i + 1}) ${line}`)
    .join(", ");

  return (
    `Photorealistic edit of the same person in this photo. ` +
    `Identity is locked: keep their bone structure, eye color, eye shape, eye spacing, nose, ethnicity, skin tone, natural hair color/texture, age, and gender presentation consistent with the original. ` +
    `This must look unmistakably like the same individual — not a different person who resembles them. ` +
    `Apply the following subtle, realistic improvements only: ${improvements}. ` +
    `Preserve the original photo's lighting, color temperature, neutral expression, head angle, framing, and background — do not add studio lighting, warm color grading, or stylization. ` +
    `Skin must look like real human skin with visible pores and natural micro-imperfections — no plastic or airbrushed finish. ` +
    `Output a portrait visually comparable to the input.`
  );
}

export function buildPromptV1(targetedMetrics: TargetedMetric[] = []): string {
  return buildPotentialFacePrompt({ targetedMetrics });
}

export function buildPotentialFacePrompt(opts?: {
  improvements?: string;
  mode?: PotentialFacePromptMode;
  targetedMetrics?: TargetedMetric[];
}): string {
  const mode = opts?.mode ?? "aggressive";
  const targeted = opts?.targetedMetrics ?? [];
  const targetLines = targeted.map((m, i) => {
    const key = `${m.group}.${m.sub_metric}`;
    const hint = SUB_METRIC_VISUAL_HINT[key] ?? `${m.group} ${m.sub_metric.replace(/_score$/, "")}`;
    return `${i + 1}. ${hint}; baseline score ${m.baseline_score}, target ${m.target_score}.`;
  });
  const transformationStrength =
    mode === "conservative"
      ? "Use a conservative transformation: subtle, realistic changes only."
      : mode === "balanced"
        ? "Use a balanced transformation: visible improvement without identity drift."
        : "Use a strong but believable transformation: clear improvement while preserving identity.";

  const customDirection = opts?.improvements?.trim();

  return [
    "Task: create a photorealistic image edit of the same person as an aspirational potential-face result.",
    "Identity lock: preserve the person's ethnicity, age range, gender presentation, eye color, eye spacing, nose identity, mouth identity, facial moles/marks, natural hair color/texture, and recognizable facial identity. Do not replace the face with a different attractive person.",
    transformationStrength,
    targetLines.length > 0
      ? `Highest-leverage aesthetic targets from the face analysis:\n${targetLines.join("\n")}`
      : "Use general facial-harmony improvements only when no metric targets are provided.",
    customDirection ? `Additional direction: ${customDirection}` : null,
    "Global aesthetic direction: improve facial harmony, feature contrast, perceived forward growth, cheekbone support, jaw definition, eye compactness, and perceived facial width-to-height balance. Keep the result anatomically plausible and coherent with the source face.",
    "Styling: black fitted crew-neck shirt and clean Qoves-style final-result portrait. Keep hair color and natural texture consistent with the source; only improve haircut shape, density appearance, or facial-hair grooming when those targets are listed.",
    "Skin realism: preserve realistic human skin texture from the input, including pores, fine lines, natural unevenness, and micro-imperfections. Reduce obvious blemishes and redness only enough to look healthy. No waxy, plastic, airbrushed, over-smoothed, or synthetic skin.",
    "Composition: eye-level 85mm portrait feel, centered head and shoulders, neutral studio background, soft diffused frontal light with slight top shadow to emphasize structure, natural dynamic range, ultra high fidelity DSLR realism.",
    "Hard negatives: no eye-color change, no ethnicity change, no age jump, no exaggerated surgery look, no cartoon/anime look, no beauty-filter blur, no warped teeth, no distorted ears, no asymmetrical artifacts.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/*   Cost estimation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort cost estimate from GPT Image usage blocks. Returns null if
 * the response shape isn't what we expect — Phase 8 will add proper telemetry.
 *
 * Pricing (as of May 2026 for gpt-image-2 standard): output image tokens
 * ~$30/1M, image input ~$8/1M, text input ~$5/1M. We round to the nearest cent.
 */
function estimateCostCents(response: unknown): number | null {
  const usage = (response as { usage?: Record<string, unknown> })?.usage;
  if (!usage) return null;
  const outputTokens = numericField(usage, "output_tokens");
  const inputTokens = numericField(usage, "input_tokens");
  const inputDetails = (usage as { input_tokens_details?: Record<string, unknown> })
    ?.input_tokens_details;
  const imageInputTokens = inputDetails ? numericField(inputDetails, "image_tokens") ?? 0 : 0;
  const textInputTokens = inputTokens === null ? 0 : Math.max(0, inputTokens - imageInputTokens);

  if (outputTokens === null) return null;

  const dollars =
    (outputTokens / 1_000_000) * 30 +
    (imageInputTokens / 1_000_000) * 8 +
    (textInputTokens / 1_000_000) * 5;
  return Math.round(dollars * 100);
}

async function readImageTelemetry(
  buffer: Buffer
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    return {
      width: typeof meta.width === "number" ? meta.width : null,
      height: typeof meta.height === "number" ? meta.height : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

export async function preparePotentialFaceSourceImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();
  } catch {
    return buffer;
  }
}

function getProviderRequestId(response: unknown): string | null {
  const value = (response as { _request_id?: unknown; request_id?: unknown })?._request_id ??
    (response as { request_id?: unknown })?.request_id;
  return typeof value === "string" && value.trim() ? value : null;
}

function getProviderUsage(response: unknown): Record<string, unknown> | null {
  const usage = (response as { usage?: unknown })?.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  return usage as Record<string, unknown>;
}

function numericField(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* -------------------------------------------------------------------------- */
/*   Internal helpers                                                         */
/* -------------------------------------------------------------------------- */

function makeFailure(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function getUsableAdvancedResult(
  advanced: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!advanced || typeof advanced !== "object" || Array.isArray(advanced)) return null;
  return Object.keys(advanced).length > 0 ? advanced : null;
}
