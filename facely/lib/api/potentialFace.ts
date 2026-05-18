// facely/lib/api/potentialFace.ts
// Client wrappers for the /potential-face/* backend endpoints.
//
// Mirrors the shape returned by `serialize()` in
// scorer-node/src/routes/potentialFace.ts. Keep these types in sync if the
// backend response shape changes.

import { API_BASE } from "./config";
import { fetchWithRetry, ApiResponseError, buildApiError } from "./client";
import { buildAuthHeadersAsync } from "./authHeaders";

/* -------------------------------------------------------------------------- */
/*   Types                                                                    */
/* -------------------------------------------------------------------------- */

export type PotentialFaceStatus = "pending" | "ready" | "failed" | "unlocked";

export interface TargetedMetric {
  /** Top-level group key from advanced_result (cheekbones | jawline | eyes | skin). */
  group: string;
  /** Sub-metric key with the `_score` suffix (e.g. "undereye_score"). */
  sub_metric: string;
  baseline_score: number;
  target_score: number;
}

export interface PotentialFace {
  id: string;
  stage: number;
  status: PotentialFaceStatus;
  baselineScanId: string;
  primaryImageUrl: string | null;
  alternateImageUrl: string | null;
  promptVersion: string;
  targetedMetrics: TargetedMetric[];
  regeneratedCount: number;
  errorReason: string | null;
  generatedAt: string | null;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  weeklyQuota?: {
    used: number;
    limit: number;
    remaining: number;
    weekStart: string;
  };
}

export interface UnlockPerMetric {
  group: string;
  sub_metric: string;
  baseline: number;
  current: number | null;
  delta: number | null;
  passed: boolean;
}

export interface UnlockEvaluation {
  shouldUnlock: boolean;
  reason:
    | "ok"
    | "no_active_stage"
    | "active_not_ready"
    | "awaiting_baseline_age"
    | "awaiting_advanced_analysis"
    | "metrics_insufficient"
    | "adherence_insufficient";
  active: PotentialFace | null;
  windowDays: number;
  metrics: {
    total: number;
    passed: number;
    ratio: number;
    threshold: number;
    perMetric: UnlockPerMetric[];
  };
  adherence: {
    daysEngaged: number;
    daysInWindow: number;
    ratio: number;
    threshold: number;
  };
}

/* -------------------------------------------------------------------------- */
/*   Endpoints                                                                */
/* -------------------------------------------------------------------------- */

const BASE = `${API_BASE}/potential-face`;

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers = await buildAuthHeadersAsync({ includeLegacy: true });
  return { Accept: "application/json", ...headers, ...(extra ?? {}) };
}

/**
 * GET /potential-face/current — returns the user's active stage, or null when
 * no row exists yet (fresh account before the first scan).
 */
export async function fetchCurrentPotentialFace(opts?: {
  /** Suppress success log when polling. */
  quiet?: boolean;
  signal?: AbortSignal;
}): Promise<PotentialFace | null> {
  const headers = await authHeaders();
  const res = await fetchWithRetry(`${BASE}/current`, {
    method: "GET",
    headers,
    quiet: opts?.quiet,
    signal: opts?.signal,
  });

  if (!res.ok) throw await buildApiError(res, "Fetch potential face failed");

  const payload = (await res.json().catch(() => null)) as {
    potentialFace?: PotentialFace | null;
  } | null;

  if (!payload || !("potentialFace" in payload)) {
    throw new ApiResponseError(res.status, "Invalid potential-face response", payload);
  }
  return payload.potentialFace ?? null;
}

/**
 * POST /potential-face/generate — explicitly kick a Stage 1 generation.
 * Idempotent server-side. Used as a retry path; the normal flow has the
 * backend auto-trigger generation right after /analyze/advanced-explain.
 */
export async function requestPotentialFaceGeneration(
  scanId: string,
  opts?: { force?: boolean }
): Promise<{ enqueued: boolean; potentialFace: PotentialFace }> {
  if (!scanId) {
    throw new Error("requestPotentialFaceGeneration: scanId is required");
  }
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const res = await fetchWithRetry(`${BASE}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ scanId, force: opts?.force === true }),
  });

  // 200 = no-op (already ready), 202 = enqueued — both are success
  if (res.status !== 200 && res.status !== 202) {
    throw await buildApiError(res, "Generate potential face failed");
  }

  const payload = (await res.json().catch(() => null)) as
    | { enqueued: boolean; potentialFace: PotentialFace }
    | null;
  if (!payload?.potentialFace) {
    throw new ApiResponseError(res.status, "Invalid generate response", payload);
  }
  return payload;
}

/**
 * POST /potential-face/use-alternate — "doesn't look like me" retry. One-shot
 * server-side; the second call returns 409 `regeneration_exhausted`.
 */
export async function usePotentialFaceAlternate(
  potentialFaceId: string
): Promise<PotentialFace> {
  if (!potentialFaceId) {
    throw new Error("usePotentialFaceAlternate: potentialFaceId is required");
  }
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const res = await fetchWithRetry(`${BASE}/use-alternate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ potentialFaceId }),
  });

  if (!res.ok) throw await buildApiError(res, "Swap to alternate failed");

  const payload = (await res.json().catch(() => null)) as { potentialFace?: PotentialFace } | null;
  if (!payload?.potentialFace) {
    throw new ApiResponseError(res.status, "Invalid use-alternate response", payload);
  }
  return payload.potentialFace;
}

/**
 * POST /potential-face/check-unlock — runs the server-side unlock gate. The
 * client doesn't need to call this every render; once per app foreground (or
 * after an accepted re-scan) is enough. The response always includes a fresh
 * evaluation snapshot so the dashboard can render diagnostics.
 */
export async function checkPotentialFaceUnlock(): Promise<{
  unlocked: boolean;
  evaluation: UnlockEvaluation;
  nextStage: PotentialFace | null;
}> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const res = await fetchWithRetry(`${BASE}/check-unlock`, {
    method: "POST",
    headers,
    body: "{}",
  });

  if (!res.ok) throw await buildApiError(res, "Check unlock failed");

  const payload = (await res.json().catch(() => null)) as {
    unlocked: boolean;
    evaluation: UnlockEvaluation;
    nextStage: PotentialFace | null;
  } | null;

  if (!payload || typeof payload.unlocked !== "boolean" || !payload.evaluation) {
    throw new ApiResponseError(res.status, "Invalid check-unlock response", payload);
  }
  return payload;
}
