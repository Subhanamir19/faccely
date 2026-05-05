// scorer-node/src/supabase/potentialFaces.ts
// Data-access layer for the Potential Face feature.
//
// Concurrency notes:
//  - `(user_id, stage)` is unique. Use upsert with onConflict='ignore' for first-create
//    races; everywhere else we read-then-write under the assumption that a single
//    user's flow is serialized through onboarding/check-unlock.
//  - All writes set `updated_at` via the trigger; we never set it manually.

import { supabase } from "./client.js";

/* -------------------------------------------------------------------------- */
/*   Types                                                                    */
/* -------------------------------------------------------------------------- */

export type PotentialFaceStatus = "pending" | "ready" | "failed" | "unlocked";

export interface TargetedMetric {
  /** Top-level group from advanced analysis (cheekbones | jawline | eyes | skin). */
  group: string;
  /** Sub-metric key as it appears in advanced_result, e.g. "undereye_score". */
  sub_metric: string;
  /** Score at baseline (0–100). */
  baseline_score: number;
  /** Score the generated image is meant to represent (0–100). */
  target_score: number;
}

export interface PotentialFaceRecord {
  id: string;
  user_id: string;
  baseline_scan_id: string;
  stage: number;
  status: PotentialFaceStatus;
  primary_image_path: string | null;
  alternate_image_path: string | null;
  prompt_version: string;
  targeted_metrics: TargetedMetric[];
  regenerated_count: number;
  error_reason: string | null;
  generated_at: string | null;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePendingPotentialFaceInput {
  userId: string;
  baselineScanId: string;
  stage: number;
  promptVersion?: string;
}

export interface MarkReadyInput {
  id: string;
  primaryImagePath: string;
  alternateImagePath: string | null;
  targetedMetrics: TargetedMetric[];
  promptVersion: string;
}

export interface MarkFailedInput {
  id: string;
  errorReason: string;
}

export interface GenerationLogInput {
  userId: string;
  potentialFaceId: string;
  promptVersion: string;
  model: string;
  candidateCount: number;
  latencyMs: number;
  costCents?: number | null;
  size?: string | null;
  quality?: string | null;
  requestedCandidateCount?: number | null;
  sourceImageBytes?: number | null;
  sourceImageWidth?: number | null;
  sourceImageHeight?: number | null;
  providerRequestId?: string | null;
  providerUsage?: Record<string, unknown> | null;
  generationPhase?: string | null;
  success: boolean;
  error?: string | null;
}

export interface WeeklyGenerationQuota {
  used: number;
  limit: number;
  remaining: number;
  weekStart: string;
}

/* -------------------------------------------------------------------------- */
/*   Reads                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns the user's currently-active row: the highest stage that has not yet
 * been unlocked. A 'failed' row at the top is still considered active (so the
 * client can decide whether to retry); 'unlocked' rows are skipped because by
 * definition they have been superseded by stage+1.
 */
export async function getActivePotentialFace(
  userId: string
): Promise<PotentialFaceRecord | null> {
  const { data, error } = await supabase
    .from("potential_faces")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "unlocked")
    .order("stage", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getActivePotentialFace failed: ${error.message}`);
  }
  return (data as PotentialFaceRecord | null) ?? null;
}

export async function getPotentialFaceById(
  id: string
): Promise<PotentialFaceRecord | null> {
  const { data, error } = await supabase
    .from("potential_faces")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`getPotentialFaceById failed: ${error.message}`);
  }
  return (data as PotentialFaceRecord | null) ?? null;
}

export async function getPotentialFaceForUserStage(
  userId: string,
  stage: number
): Promise<PotentialFaceRecord | null> {
  const { data, error } = await supabase
    .from("potential_faces")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", stage)
    .maybeSingle();

  if (error) {
    throw new Error(`getPotentialFaceForUserStage failed: ${error.message}`);
  }
  return (data as PotentialFaceRecord | null) ?? null;
}

/**
 * Highest stage number that exists for the user across any status.
 * Used to compute the next stage for /check-unlock.
 */
export async function getMaxStageForUser(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("potential_faces")
    .select("stage")
    .eq("user_id", userId)
    .order("stage", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getMaxStageForUser failed: ${error.message}`);
  }
  return (data?.stage as number | undefined) ?? 0;
}

/* -------------------------------------------------------------------------- */
/*   Writes — lifecycle transitions                                           */
/* -------------------------------------------------------------------------- */

/**
 * Idempotently create a `pending` row for (user_id, stage). If a row already
 * exists, returns it untouched. On a previously-failed row, callers should use
 * {@link resetForRetry} explicitly rather than this helper.
 */
export async function createPendingPotentialFace(
  input: CreatePendingPotentialFaceInput
): Promise<PotentialFaceRecord> {
  const row = {
    user_id: input.userId,
    baseline_scan_id: input.baselineScanId,
    stage: input.stage,
    status: "pending" as const,
    prompt_version: input.promptVersion ?? "v1",
  };

  // Upsert with onConflict on the unique key. `ignoreDuplicates: true` makes
  // the insert a no-op when a row already exists; we then fetch and return.
  const { error: insertError } = await supabase
    .from("potential_faces")
    .upsert(row, {
      onConflict: "user_id,stage",
      ignoreDuplicates: true,
    });

  if (insertError) {
    throw new Error(`createPendingPotentialFace failed: ${insertError.message}`);
  }

  const existing = await getPotentialFaceForUserStage(input.userId, input.stage);
  if (!existing) {
    throw new Error("createPendingPotentialFace: row missing after upsert");
  }
  return existing;
}

/**
 * Reset a previously-failed row back to `pending` so a worker can retry it.
 * Rejects if the row is not in 'failed' status (caller error).
 */
export async function resetForRetry(id: string): Promise<PotentialFaceRecord> {
  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      status: "pending",
      error_reason: null,
    })
    .eq("id", id)
    .eq("status", "failed")
    .select("*")
    .single();

  if (error) {
    throw new Error(`resetForRetry failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

/**
 * Reset a terminal row for an explicit user-requested paid regeneration.
 * Used when the user rejects a ready image. Clears stored images so the row
 * returns to a normal pending generation state.
 */
export async function resetForRegeneration(id: string): Promise<PotentialFaceRecord> {
  const existing = await getPotentialFaceById(id);
  if (!existing) {
    throw new Error("resetForRegeneration: row not found");
  }
  if (existing.status !== "ready" && existing.status !== "failed") {
    throw new Error(`resetForRegeneration: invalid status ${existing.status}`);
  }

  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      status: "pending",
      primary_image_path: null,
      alternate_image_path: null,
      regenerated_count: existing.regenerated_count + 1,
      generated_at: null,
      error_reason: null,
    })
    .eq("id", id)
    .in("status", ["ready", "failed"])
    .select("*")
    .single();

  if (error) {
    throw new Error(`resetForRegeneration failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

export async function markReady(input: MarkReadyInput): Promise<PotentialFaceRecord> {
  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      status: "ready",
      primary_image_path: input.primaryImagePath,
      alternate_image_path: input.alternateImagePath,
      targeted_metrics: input.targetedMetrics,
      prompt_version: input.promptVersion,
      generated_at: new Date().toISOString(),
      error_reason: null,
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`markReady failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

export async function markFailed(input: MarkFailedInput): Promise<PotentialFaceRecord> {
  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      status: "failed",
      error_reason: input.errorReason.slice(0, 500),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`markFailed failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

/**
 * Atomically swap primary/alternate image paths. Rejects if:
 *  - the row is not 'ready'
 *  - the alternate slot is empty
 *  - the user has already used their one regeneration
 *
 * Uses a conditional update so concurrent calls cannot race past the cap.
 */
export async function swapToAlternate(
  userId: string,
  faceId: string
): Promise<PotentialFaceRecord> {
  const existing = await supabase
    .from("potential_faces")
    .select("*")
    .eq("id", faceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`swapToAlternate(read) failed: ${existing.error.message}`);
  }
  const row = existing.data as PotentialFaceRecord | null;
  if (!row) {
    const err = new Error("not_found") as Error & { code?: string };
    err.code = "POTENTIAL_FACE_NOT_FOUND";
    throw err;
  }
  if (row.status !== "ready") {
    const err = new Error("not_ready") as Error & { code?: string };
    err.code = "POTENTIAL_FACE_NOT_READY";
    throw err;
  }
  if (!row.alternate_image_path) {
    const err = new Error("no_alternate_available") as Error & { code?: string };
    err.code = "POTENTIAL_FACE_NO_ALTERNATE";
    throw err;
  }
  if (row.regenerated_count >= 1) {
    const err = new Error("regeneration_exhausted") as Error & { code?: string };
    err.code = "POTENTIAL_FACE_REGEN_EXHAUSTED";
    throw err;
  }

  // Conditional update on regenerated_count = 0 prevents a race where two
  // concurrent calls would both flip the slot.
  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      primary_image_path: row.alternate_image_path,
      alternate_image_path: row.primary_image_path,
      regenerated_count: 1,
    })
    .eq("id", faceId)
    .eq("regenerated_count", 0)
    .select("*")
    .single();

  if (error) {
    throw new Error(`swapToAlternate(update) failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

export async function markUnlocked(id: string): Promise<PotentialFaceRecord> {
  const { data, error } = await supabase
    .from("potential_faces")
    .update({
      status: "unlocked",
      unlocked_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "ready")
    .select("*")
    .single();

  if (error) {
    throw new Error(`markUnlocked failed: ${error.message}`);
  }
  return data as PotentialFaceRecord;
}

/* -------------------------------------------------------------------------- */
/*   Generation audit log                                                     */
/* -------------------------------------------------------------------------- */

export async function recordGenerationAttempt(
  input: GenerationLogInput
): Promise<void> {
  const legacyPayload = {
    user_id: input.userId,
    potential_face_id: input.potentialFaceId,
    prompt_version: input.promptVersion,
    model: input.model,
    candidate_count: input.candidateCount,
    latency_ms: input.latencyMs,
    cost_cents: input.costCents ?? null,
    success: input.success,
    error: input.error ? input.error.slice(0, 500) : null,
  };

  const payload = {
    ...legacyPayload,
    size: input.size ?? null,
    quality: input.quality ?? null,
    requested_candidate_count: input.requestedCandidateCount ?? null,
    source_image_bytes: input.sourceImageBytes ?? null,
    source_image_width: input.sourceImageWidth ?? null,
    source_image_height: input.sourceImageHeight ?? null,
    provider_request_id: input.providerRequestId ?? null,
    provider_usage: input.providerUsage ?? null,
    generation_phase: input.generationPhase ?? null,
  };

  const { error } = await supabase.from("potential_face_generations").insert(payload);

  if (error) {
    // Audit-log failure must not block the main path — log and continue.
    if (/column .* does not exist|schema cache|Could not find/i.test(error.message)) {
      const fallback = await supabase.from("potential_face_generations").insert(legacyPayload);
      if (!fallback.error) {
        console.warn(
          "[potentialFaces] telemetry columns missing; wrote legacy generation audit row"
        );
        return;
      }
    }
    console.warn("[potentialFaces] recordGenerationAttempt failed:", error.message);
  }
}

/* -------------------------------------------------------------------------- */
/*   Weekly quota                                                             */
/* -------------------------------------------------------------------------- */

const WEEKLY_GENERATION_LIMIT = 2;

function startOfUtcWeek(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // Sun=0, Mon=1
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/**
 * Counts successful user-visible generation uses in the current UTC calendar
 * week. This includes the initial image generation and "use alternate" swaps,
 * because both consume one of the user's two weekly opportunities.
 */
export async function getWeeklyGenerationQuota(
  userId: string,
  limit = WEEKLY_GENERATION_LIMIT
): Promise<WeeklyGenerationQuota> {
  const weekStart = startOfUtcWeek();
  const { count, error } = await supabase
    .from("potential_face_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("success", true)
    .gte("created_at", weekStart.toISOString());

  if (error) {
    throw new Error(`getWeeklyGenerationQuota failed: ${error.message}`);
  }

  const used = count ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    weekStart: weekStart.toISOString(),
  };
}

export async function hasWeeklyGenerationCapacity(userId: string): Promise<boolean> {
  const quota = await getWeeklyGenerationQuota(userId);
  return quota.remaining > 0;
}
