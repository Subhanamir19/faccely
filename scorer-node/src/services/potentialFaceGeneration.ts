// scorer-node/src/services/potentialFaceGeneration.ts
//
// Phase 2 generation pipeline. Given a `potential_faces` row id, this service:
//   1. loads the row + its baseline scan + the scan's advanced_result
//   2. picks the 5 weakest sub-metrics (excluding non-visual structural keys)
//   3. downloads the baseline frontal image from the `face-scans` bucket
//   4. calls gpt-image-1 (image edit) for two candidates in a single round-trip
//   5. uploads both candidates to the `potential-faces` bucket
//   6. transitions the row to `ready` and writes an audit-log entry
//
// The PROMPT used here is the deliberate v1 placeholder — it is realistic
// enough to evaluate the pipeline end-to-end, but Phase 7 will iterate on it
// against real outputs. Do not over-engineer it now.

import OpenAI, { toFile } from "openai";

import { getScanById } from "../supabase/scans.js";
import { getAnalysisForScan } from "../supabase/analyses.js";
import { downloadScanImage } from "../supabase/storage.js";
import {
  createPendingPotentialFace,
  getPotentialFaceById,
  getPotentialFaceForUserStage,
  markFailed,
  markReady,
  recordGenerationAttempt,
  resetForRetry,
  type PotentialFaceRecord,
  type TargetedMetric,
} from "../supabase/potentialFaces.js";
import { uploadPotentialFaceImage } from "../supabase/potentialFaceStorage.js";
import { enqueuePotentialFace } from "../queue/jobs.js";

/* -------------------------------------------------------------------------- */
/*   Tunables                                                                 */
/* -------------------------------------------------------------------------- */

export const PROMPT_VERSION = "v1";
const MODEL = "gpt-image-1";
const SIZE: "1024x1024" | "1024x1536" | "1536x1024" | "auto" = "1024x1536";
const QUALITY: "low" | "medium" | "high" | "auto" = "medium";
const CANDIDATE_COUNT = 2;

/** How many sub-metrics from the advanced_result we target per stage. */
const TARGET_METRIC_COUNT = 5;

/** Capped Stage-1 delta — a believable improvement that doesn't drift identity. */
const TARGET_DELTA = 25;
const TARGET_CEILING = 85;

/**
 * Whitelist of sub-metric keys we will target in the image. Keys NOT in this
 * map are skipped at picker time (e.g. `fwhr_score`, `canthal_tilt_score`,
 * `eye_type_score`, `symmetry_score`, `ramus_score`) because they are either
 * structural ratios or anatomical features that no realistic short-term
 * transformation can move. The string values here are the v1 prompt phrasings
 * used by `buildPromptV1`. Phase 7 owns the real prompt copy.
 */
const SUB_METRIC_VISUAL_HINT: Record<string, string> = {
  // cheekbones
  "cheekbones.width_score": "more visible bizygomatic width across the cheekbones",
  "cheekbones.maxilla_score": "stronger forward maxillary projection in the midface",
  "cheekbones.bone_structure_score": "more sculpted cheekbone definition with clearer underlying contour",
  "cheekbones.face_fat_score": "leaner submalar/buccal area for cleaner cheek hollows",
  // jawline
  "jawline.development_score": "sharper jawline definition along the mandibular border",
  "jawline.gonial_angle_score": "crisper gonial angle where the jaw meets the ramus",
  "jawline.projection_score": "stronger anterior chin and jaw projection",
  // eyes
  "eyes.brow_volume_score": "fuller, better-groomed eyebrows",
  // skin
  "skin.color_score": "more even skin tone, reduced redness and discoloration",
  "skin.quality_score": "clearer, smoother skin with reduced blemishes and a healthy texture",
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

  const row = await getPotentialFaceById(potentialFaceId);
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

  try {
    const scan = await getScanById(row.user_id, row.baseline_scan_id);
    if (!scan) {
      throw makeFailure("baseline_scan_missing", "Baseline scan not found.");
    }

    const analysis = await getAnalysisForScan(scan.id);
    const advanced = (analysis?.advanced_result ?? null) as Record<string, unknown> | null;
    if (!advanced || Object.keys(advanced).length === 0) {
      throw makeFailure(
        "missing_advanced_analysis",
        "Advanced analysis not yet available for baseline scan."
      );
    }

    const targeted = pickTargetedMetrics(advanced);
    if (targeted.length === 0) {
      throw makeFailure("no_targeted_metrics", "Could not pick any targetable sub-metrics.");
    }

    const baselineBuffer = await downloadScanImage(scan.front_image_path);
    if (!baselineBuffer.length) {
      throw makeFailure("baseline_image_empty", "Baseline frontal image is empty.");
    }

    const prompt = buildPromptV1(targeted);

    const response = await openai.images.edit(
      {
        model: MODEL,
        image: await toFile(baselineBuffer, "baseline.jpg", { type: "image/jpeg" }),
        prompt,
        n: CANDIDATE_COUNT,
        size: SIZE,
        quality: QUALITY,
      } as any // gpt-image-1: response_format is not a parameter; b64_json is always returned
    );

    const candidates = response.data ?? [];
    const primaryB64 = candidates[0]?.b64_json;
    if (!primaryB64) {
      throw makeFailure("no_image_returned", "OpenAI returned no image data.");
    }

    // Upload primary first; alternate is best-effort (we still ship if it fails)
    const generationId = `${Date.now()}-${row.stage}`;
    const primaryBuffer = Buffer.from(primaryB64, "base64");
    const primaryPath = await uploadPotentialFaceImage({
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
        alternatePath = await uploadPotentialFaceImage({
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

    const ready = await markReady({
      id: row.id,
      primaryImagePath: primaryPath,
      alternateImagePath: alternatePath,
      targetedMetrics: targeted,
      promptVersion: PROMPT_VERSION,
    });

    await recordGenerationAttempt({
      userId: row.user_id,
      potentialFaceId: row.id,
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      candidateCount: candidates.length,
      latencyMs: Date.now() - t0,
      costCents: estimateCostCents(response),
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

    await recordGenerationAttempt({
      userId: row.user_id,
      potentialFaceId: row.id,
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      candidateCount: 0,
      latencyMs: Date.now() - t0,
      success: false,
      error: `${reason}: ${message}`,
    }).catch(() => undefined);

    if (isFinalAttempt) {
      // No more retries — persist the failure state so the client can react.
      await markFailed({
        id: row.id,
        errorReason: `${reason}: ${message}`,
      }).catch((markErr) =>
        console.error("[potential-face:gen] markFailed itself failed:", markErr)
      );
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

export function buildPromptV1(targeted: TargetedMetric[]): string {
  const improvements = targeted
    .map((m) => {
      const key = `${m.group}.${m.sub_metric}`;
      return SUB_METRIC_VISUAL_HINT[key] ?? `${m.group} ${m.sub_metric.replace(/_score$/, "")}`;
    })
    .map((line, i) => `(${i + 1}) ${line}`)
    .join(", ");

  return (
    `Photorealistic edit of the same person in this photo. ` +
    `Identity is locked: keep their bone structure, eye color, eye shape, eye spacing, nose, ethnicity, skin tone, hair color, hair pattern, age, and gender presentation EXACTLY as in the original. ` +
    `This must look unmistakably like the same individual — not a different person who resembles them. ` +
    `Apply the following subtle, realistic improvements only: ${improvements}. ` +
    `Preserve the original photo's lighting, color temperature, neutral expression, head angle, framing, and background — do not add studio lighting, warm color grading, or stylization. ` +
    `Skin must look like real human skin with visible pores and natural micro-imperfections — no plastic or airbrushed finish. ` +
    `Output a portrait visually comparable to the input.`
  );
}

/* -------------------------------------------------------------------------- */
/*   Cost estimation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort cost estimate from gpt-image-1's `usage` block. Returns null if
 * the response shape isn't what we expect — Phase 8 will add proper telemetry.
 *
 * Pricing (as of Jan 2026): output image tokens ~$40/1M, image input ~$10/1M,
 * text input ~$5/1M. We round to the nearest cent.
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
    (outputTokens / 1_000_000) * 40 +
    (imageInputTokens / 1_000_000) * 10 +
    (textInputTokens / 1_000_000) * 5;
  return Math.round(dollars * 100);
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
