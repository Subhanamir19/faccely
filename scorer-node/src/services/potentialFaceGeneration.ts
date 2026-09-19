// scorer-node/src/services/potentialFaceGeneration.ts
//
// Phase 2 generation pipeline. Given a `potential_faces` row id, this service:
//   1. loads the row + its baseline scan
//   2. downloads the baseline frontal image from the `face-scans` bucket
//   3. calls the configured GPT Image model for one fast mobile-preview candidate
//   4. uploads the candidate to the `potential-faces` bucket
//   5. transitions the row to `ready` and writes an audit-log entry
//
// The prompt (v5) turns the advanced analysis into per-person "now → change
// to" instructions, ranked by how visibly each fix changes the photo, and
// pins a studio look (white background, soft frontal light, black crew-neck).

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

export const PROMPT_VERSION = "v5";
const MODEL = PROVIDERS.openai.imageModel;
const SIZE: "1024x1024" | "1024x1536" | "1536x1024" | "auto" = "1024x1024";
// "medium" smears skin texture; "high" is the floor for pore-level detail.
const QUALITY: "low" | "medium" | "high" | "xhigh" | "max" | "auto" = "high";
const OUTPUT_FORMAT = "jpeg";
// Below ~90 JPEG blocking erases the fine skin texture "high" produced.
const OUTPUT_COMPRESSION = 95;
const CANDIDATE_COUNT = 1;
export type PotentialFacePromptMode = "conservative" | "balanced" | "aggressive";

/** Shared with the /generate/potential-face-dev route so dev tests match production. */
export const POTENTIAL_FACE_IMAGE_SETTINGS = {
  size: SIZE,
  quality: QUALITY,
  outputFormat: OUTPUT_FORMAT,
  outputCompression: OUTPUT_COMPRESSION,
} as const;

/** How many sub-metrics from the advanced_result we target per stage. */
const TARGET_METRIC_COUNT = 5;

/** Capped Stage-1 delta — a believable improvement that doesn't drift identity. */
const TARGET_DELTA = 25;
const TARGET_CEILING = 85;

/** Sub-metrics at or above this score are listed as "keep as is" in the prompt. */
const STRENGTH_THRESHOLD = 72;

/** Advanced-analysis verdicts meaning the feature wasn't visible; never targeted. */
const UNSEEN_VERDICTS = new Set(["Obscured"]);

interface SubMetricSpec {
  /** Plain-language feature name used in the prompt. */
  label: string;
  /**
   * How much a fix changes the photo at a glance, 0–1. Soft tissue, skin and
   * grooming read strongly and are low identity risk; bone-level metrics read
   * weakly and drift identity fastest when pushed.
   */
  weight: number;
  /** Concrete visual description of the fixed feature. */
  goal: string;
}

/**
 * Whitelist of sub-metric keys we will target in the image. Keys NOT in this
 * map are skipped at picker time when they are hard to represent safely from a
 * frontal image (e.g. jawline.ramus, which needs the side view).
 *
 * Goals describe the finished look in concrete visual terms. Avoid words like
 * "smoother", "perfect" or "subtle": image models read the first two as
 * permission to airbrush and the last as permission to change nothing.
 */
const SUB_METRIC_SPECS: Record<string, SubMetricSpec> = {
  // cheekbones
  "cheekbones.face_fat_score": {
    label: "Facial fat",
    weight: 1.0,
    goal: "a clearly leaner face, as after real fat loss: fullness under the cheekbones and along the jaw gone, a visible shadow hollow under each cheekbone, no puffiness in the cheeks or under the chin",
  },
  "cheekbones.bone_structure_score": {
    label: "Cheekbone definition",
    weight: 0.75,
    goal: "clearly visible cheekbones: a light highlight along the top of each cheekbone and a defined shadow line beneath it",
  },
  "cheekbones.width_score": {
    label: "Cheekbone width",
    weight: 0.5,
    goal: "cheekbones that read higher and wider, framing the midface",
  },
  "cheekbones.maxilla_score": {
    label: "Midface support",
    weight: 0.5,
    goal: "a fuller, more forward midface under the eyes so the under-eye area looks supported rather than hollow or flat",
  },
  "cheekbones.fwhr_score": {
    label: "Face proportions",
    weight: 0.3,
    goal: "a slightly broader-looking midface relative to face height, coming from leaner cheeks and clearer cheekbones rather than a wider skull",
  },
  // jawline
  "jawline.development_score": {
    label: "Jawline",
    weight: 0.95,
    goal: "a sharp, clearly visible jawline: a crisp edge running from below the ear to the chin, soft tissue under the jaw removed, clean separation between jaw and neck",
  },
  "jawline.gonial_angle_score": {
    label: "Jaw corners",
    weight: 0.65,
    goal: "sharper, more angular jaw corners below each ear, reading closer to 110°",
  },
  "jawline.projection_score": {
    label: "Chin",
    weight: 0.6,
    goal: "a stronger chin: a squarer, slightly more forward chin point and a clean chin-to-neck angle",
  },
  // eyes
  "eyes.brow_volume_score": {
    label: "Eyebrows",
    weight: 0.7,
    goal: "fuller, well-groomed eyebrows with a clean shape and stray hairs removed, in the same natural position and color",
  },
  "eyes.eye_type_score": {
    label: "Eye area",
    weight: 0.45,
    goal: "a more focused eye area: less upper-lid show, no under-eye puffiness or dark circles, same eye shape and color",
  },
  "eyes.canthal_tilt_score": {
    label: "Eye corners",
    weight: 0.35,
    goal: "outer eye corners sitting level with or slightly above the inner corners, with less droop at the outer upper lid",
  },
  "eyes.symmetry_score": {
    label: "Eye balance",
    weight: 0.3,
    goal: "left and right eye areas looking more even in size and height",
  },
  // skin
  "skin.quality_score": {
    label: "Skin clarity",
    weight: 0.9,
    goal: "clear, healthy skin: acne, blemishes, scars and dark under-eye circles gone, while every pore and the fine natural texture stay fully visible",
  },
  "skin.color_score": {
    label: "Skin tone",
    weight: 0.8,
    goal: "an even, healthy skin tone: redness, blotches and dark spots reduced, natural color variation kept",
  },
  // haircut
  "haircut.styling_score": {
    label: "Haircut",
    weight: 0.9,
    goal: "a fresh, well-cut hairstyle from a skilled barber, shaped to suit this face: tidy sides, clean outline, intentional volume and texture on top, same hair color and natural texture",
  },
  "haircut.facial_hair_score": {
    label: "Facial hair",
    weight: 0.8,
    goal: "well-groomed facial hair with sharp, clean edges and even length that follow and sharpen the jaw, or a clean shave if the growth is patchy",
  },
  "haircut.density_score": {
    label: "Hair fullness",
    weight: 0.6,
    goal: "fuller-looking hair with better coverage on top and at the front, same hairline position and hair color",
  },
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

    const prompt = buildPotentialFacePrompt({
      targetedMetrics,
      strengths: pickStrengths(advancedResult),
    });

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
  verdict: string;
  observation: string;
  spec: SubMetricSpec;
}

/** A strong feature the prompt tells the model to leave alone. */
export interface PotentialFaceStrength {
  label: string;
  verdict: string;
}

/**
 * Walk advanced_result and collect every whitelisted `*_score` field with its
 * verdict label and commentary sentence (both written per person by
 * explainAdvancedBytes).
 */
function collectSubMetrics(advanced: Record<string, unknown>): AdvancedSubMetric[] {
  const out: AdvancedSubMetric[] = [];

  for (const [groupKey, groupVal] of Object.entries(advanced)) {
    if (!groupVal || typeof groupVal !== "object") continue;
    const group = groupVal as Record<string, unknown>;
    for (const [subKey, subVal] of Object.entries(group)) {
      if (!subKey.endsWith("_score")) continue;
      if (typeof subVal !== "number" || !Number.isFinite(subVal)) continue;
      const spec = SUB_METRIC_SPECS[`${groupKey}.${subKey}`];
      if (!spec) continue;
      const base = subKey.replace(/_score$/, "");
      out.push({
        group: groupKey,
        sub_metric: subKey,
        score: subVal,
        verdict: textField(group[`${base}_verdict`]),
        observation: toObservation(textField(group[base])),
        spec,
      });
    }
  }

  return out;
}

/**
 * Pick the sub-metrics whose fix changes the photo most: weight × headroom,
 * so a weak jawline outranks a slightly weaker but barely visible FWHR.
 * Targets are clamped to baseline + TARGET_DELTA, capped at TARGET_CEILING.
 */
export function pickTargetedMetrics(
  advanced: Record<string, unknown>
): TargetedMetric[] {
  const candidates = collectSubMetrics(advanced).filter((c) => {
    if (c.score >= STRENGTH_THRESHOLD) return false;
    if (UNSEEN_VERDICTS.has(c.verdict)) return false;
    // A clean shave is a valid style; "fixing" it would mean adding a beard.
    if (c.sub_metric === "facial_hair_score" && c.verdict === "Clean Shaven") return false;
    return true;
  });

  candidates.sort((a, b) => impact(b) - impact(a));
  return candidates.slice(0, TARGET_METRIC_COUNT).map((c) => {
    const metric: TargetedMetric = {
      group: c.group,
      sub_metric: c.sub_metric,
      baseline_score: Math.round(c.score),
      target_score: Math.min(TARGET_CEILING, Math.round(c.score) + TARGET_DELTA),
    };
    if (c.verdict) metric.verdict = c.verdict;
    if (c.observation) metric.observation = c.observation;
    return metric;
  });
}

/** Features already strong enough that the edit must leave them alone. */
export function pickStrengths(advanced: Record<string, unknown>): PotentialFaceStrength[] {
  return collectSubMetrics(advanced)
    .filter(
      (c) =>
        (c.score >= STRENGTH_THRESHOLD && !UNSEEN_VERDICTS.has(c.verdict)) ||
        (c.sub_metric === "facial_hair_score" && c.verdict === "Clean Shaven")
    )
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ label: c.spec.label, verdict: c.verdict }));
}

function impact(c: AdvancedSubMetric): number {
  return c.spec.weight * (100 - c.score);
}

function textField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Keep only the observation half of an advanced-analysis sentence. The
 * commentary usually ends with advice after a dash ("— getting leaner is the
 * most direct way…"), which is noise to an image model.
 */
function toObservation(commentary: string): string {
  const observed = commentary.split(/\s[—–-]\s/)[0]?.trim() ?? "";
  if (!observed) return "";
  const clipped = observed.length > 220 ? `${observed.slice(0, 217).trimEnd()}...` : observed;
  return clipped.replace(/[.\s]+$/, "");
}

/* -------------------------------------------------------------------------- */
/*   Prompt v5                                                                */
/* -------------------------------------------------------------------------- */

const CHANGE_STRENGTH: Record<PotentialFacePromptMode, string> = {
  conservative: "Make every change clearly visible but moderate.",
  balanced: "Make every change obvious at first glance.",
  aggressive:
    "Push every change to the strongest version that still looks like this real person. The before/after difference must be striking, even at thumbnail size.",
};

export function buildPotentialFacePrompt(opts?: {
  improvements?: string;
  mode?: PotentialFacePromptMode;
  targetedMetrics?: TargetedMetric[];
  strengths?: PotentialFaceStrength[];
}): string {
  const mode = opts?.mode ?? "aggressive";
  const targeted = opts?.targetedMetrics ?? [];
  const strengths = opts?.strengths ?? [];
  const customDirection = opts?.improvements?.trim();

  const changeLines = targeted.map((m, i) => {
    const spec = SUB_METRIC_SPECS[`${m.group}.${m.sub_metric}`];
    const label = spec?.label ?? `${m.group} ${m.sub_metric.replace(/_score$/, "")}`;
    const now = [m.verdict, m.observation].filter(Boolean).join(": ");
    const goal = spec?.goal ?? "a clearly improved version of this feature";
    return `${i + 1}. ${label}${now ? ` (now: ${now})` : ""}. Change to: ${goal}.`;
  });

  return [
    "Edit this photo into a studio portrait of the same person at their realistic peak: leaner, better groomed, clearer skin, a better haircut. The result must look like an unretouched photograph from a professional photo shoot, not a render.",
    "",
    "IDENTITY (must not change): eye color, eye shape and eye spacing, nose shape, lip shape, ethnicity, age, gender presentation, natural hair color and texture, moles, freckles and marks, overall skull and bone layout. A close friend must recognize this person instantly.",
    strengths.length > 0
      ? `\nALREADY STRONG (keep exactly as is): ${strengths
          .map((s) => (s.verdict ? `${s.label} (${s.verdict})` : s.label))
          .join(", ")}.`
      : null,
    "",
    changeLines.length > 0
      ? `CHANGES (most important first):\n${changeLines.join("\n")}`
      : "CHANGES: a clearly leaner face, a sharper jawline, clear even-toned skin, groomed eyebrows and a fresh haircut that suits the face.",
    "Also: tidy the eyebrows and remove under-eye puffiness.",
    customDirection ? `Additional direction: ${customDirection}` : null,
    CHANGE_STRENGTH[mode],
    "",
    "PHOTO STYLE (match exactly): plain seamless pure white studio background, evenly lit, no gradient, no vignette, no shadow on the wall. Large soft frontal key light with gentle fill, like a professional model-agency digital; soft natural shadows under the cheekbones and jaw that show structure. Neutral white balance, true-to-life color. Head and upper shoulders, facing the camera straight on at eye level, centered, top of the hair near the top edge, shoulders cropped at the bottom edge. Full-frame camera, 85mm lens, f/8, the whole face in sharp focus. Wearing a plain black crew-neck t-shirt. Neutral relaxed expression, lips closed, eyes looking into the lens.",
    "",
    "SKIN: real photographic human skin at full resolution. Visible pores on the nose, cheeks and forehead; fine skin texture and slight natural tonal variation; faint fine hair on the cheeks; slight natural redness around the nostrils; natural texture under the eyes; existing freckles and marks kept. Healthy with a natural matte finish and small natural highlights on the forehead and nose. Skin detail as sharp as the eyelashes.",
    "HAIR: individual strands visible, a few natural flyaways, same color as the source.",
    "",
    "NEVER: a different person; a change of eye color, ethnicity or age; retouched, filtered or waxy skin; a doll-like or CGI face; a visible surgery look; warped ears, teeth or eyes; text or watermark.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/*   Cost estimation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort cost estimate from GPT Image usage blocks. Returns null if
 * the response shape isn't what we expect — Phase 8 will add proper telemetry.
 *
 * Pricing (Sept 2026; gpt-image-2 and gpt-image-2.5-sunburst share rates): output image tokens
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
