// scorer-node/src/services/potentialFaceUnlock.ts
//
// Stage-unlock gate for the Potential Face feature. Evaluates three conditions
// against the user's currently-active stage and reports whether the user has
// earned the next stage. Pure read-only logic — callers (routes, post-scan hook,
// cron) own the side effects of marking unlocked / enqueuing stage+1.
//
// Conditions (ALL must pass):
//   1. ≥ 21 days since the active stage's baseline scan.
//   2. ≥ 60% of the stage's targeted sub-metrics moved beyond the noise floor.
//   3. ≥ 60% daily task-engagement rate over the window.

import { supabase } from "../supabase/client.js";
import { getActivePotentialFace, type PotentialFaceRecord, type TargetedMetric } from "../supabase/potentialFaces.js";
import { getAnalysisForScan } from "../supabase/analyses.js";
import { getScansForUser } from "../supabase/scans.js";

/* -------------------------------------------------------------------------- */
/*   Tunables                                                                 */
/* -------------------------------------------------------------------------- */

/** Minimum age of the baseline scan before unlock is even considered. */
export const UNLOCK_MIN_BASELINE_AGE_DAYS = 21;

/** Fraction of targeted sub-metrics that must improve beyond the noise floor. */
export const UNLOCK_METRIC_PASS_RATIO = 0.6;

/** Fraction of days in the window that must show task engagement. */
export const UNLOCK_TASK_ADHERENCE_RATIO = 0.6;

/**
 * Per-metric noise floor on the 0–100 sub-metric scale. Movements smaller than
 * this are treated as scan jitter, not real progress. Phase 8 measures a real
 * floor empirically; this 4-point literal is the documented v1 starting value.
 */
export const UNLOCK_NOISE_FLOOR_POINTS = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*   Public API                                                               */
/* -------------------------------------------------------------------------- */

export interface UnlockEvaluation {
  /** True only if all three gates pass. */
  shouldUnlock: boolean;
  /** Reason code for short-circuit: 'no_active_stage' | 'awaiting_baseline_age' | 'awaiting_advanced_analysis' | 'metrics_insufficient' | 'adherence_insufficient' | 'ok'. */
  reason: UnlockReason;
  /** The active stage row evaluated, if any. */
  active: PotentialFaceRecord | null;
  /** Window we evaluated metrics/adherence over, in days. */
  windowDays: number;
  /** Metric breakdown — useful for telemetry and the dashboard. */
  metrics: {
    total: number;
    passed: number;
    ratio: number;
    threshold: number;
    perMetric: PerMetricResult[];
  };
  /** Task adherence breakdown. */
  adherence: {
    daysEngaged: number;
    daysInWindow: number;
    ratio: number;
    threshold: number;
  };
}

export type UnlockReason =
  | "ok"
  | "no_active_stage"
  | "active_not_ready"
  | "awaiting_baseline_age"
  | "awaiting_advanced_analysis"
  | "metrics_insufficient"
  | "adherence_insufficient";

export interface PerMetricResult {
  group: string;
  sub_metric: string;
  baseline: number;
  current: number | null;
  delta: number | null;
  passed: boolean;
}

/**
 * Evaluate whether the user has earned the next stage. Read-only.
 */
export async function evaluateUnlock(userId: string): Promise<UnlockEvaluation> {
  const empty = (reason: UnlockReason, active: PotentialFaceRecord | null, windowDays: number): UnlockEvaluation => ({
    shouldUnlock: false,
    reason,
    active,
    windowDays,
    metrics: { total: 0, passed: 0, ratio: 0, threshold: UNLOCK_METRIC_PASS_RATIO, perMetric: [] },
    adherence: { daysEngaged: 0, daysInWindow: 0, ratio: 0, threshold: UNLOCK_TASK_ADHERENCE_RATIO },
  });

  const active = await getActivePotentialFace(userId);
  if (!active) return empty("no_active_stage", null, 0);
  if (active.status !== "ready") return empty("active_not_ready", active, 0);

  // --- Gate 1: baseline age ------------------------------------------------
  const baseline = await fetchBaselineScan(userId, active.baseline_scan_id);
  if (!baseline) {
    // Baseline scan was deleted out from under us. Treat as not-yet-eligible
    // rather than crashing — keeps the cron sweep idempotent.
    return empty("awaiting_baseline_age", active, 0);
  }
  const baselineAgeDays = (Date.now() - new Date(baseline.created_at).getTime()) / MS_PER_DAY;
  if (baselineAgeDays < UNLOCK_MIN_BASELINE_AGE_DAYS) {
    return empty("awaiting_baseline_age", active, Math.floor(baselineAgeDays));
  }

  // --- Gate 2: metric movement --------------------------------------------
  const latestAdvanced = await getLatestAdvancedAnalysis(userId);
  if (!latestAdvanced) {
    return empty("awaiting_advanced_analysis", active, Math.floor(baselineAgeDays));
  }

  const perMetric = (active.targeted_metrics ?? []).map<PerMetricResult>((m) => {
    const current = readSubMetric(latestAdvanced, m.group, m.sub_metric);
    const delta = current === null ? null : current - m.baseline_score;
    const passed = delta !== null && delta > UNLOCK_NOISE_FLOOR_POINTS;
    return {
      group: m.group,
      sub_metric: m.sub_metric,
      baseline: m.baseline_score,
      current,
      delta,
      passed,
    };
  });

  const passedCount = perMetric.filter((p) => p.passed).length;
  const metricRatio = perMetric.length === 0 ? 0 : passedCount / perMetric.length;

  // --- Gate 3: task adherence ---------------------------------------------
  const adherence = await getTaskAdherence(userId, baseline.created_at);

  const allPass =
    metricRatio >= UNLOCK_METRIC_PASS_RATIO &&
    adherence.ratio >= UNLOCK_TASK_ADHERENCE_RATIO;

  let reason: UnlockReason;
  if (allPass) {
    reason = "ok";
  } else if (metricRatio < UNLOCK_METRIC_PASS_RATIO) {
    reason = "metrics_insufficient";
  } else {
    reason = "adherence_insufficient";
  }

  return {
    shouldUnlock: allPass,
    reason,
    active,
    windowDays: Math.floor(baselineAgeDays),
    metrics: {
      total: perMetric.length,
      passed: passedCount,
      ratio: metricRatio,
      threshold: UNLOCK_METRIC_PASS_RATIO,
      perMetric,
    },
    adherence: {
      daysEngaged: adherence.daysEngaged,
      daysInWindow: adherence.daysInWindow,
      ratio: adherence.ratio,
      threshold: UNLOCK_TASK_ADHERENCE_RATIO,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*   Internals                                                                */
/* -------------------------------------------------------------------------- */

interface BaselineScan {
  id: string;
  created_at: string;
}

async function fetchBaselineScan(userId: string, scanId: string): Promise<BaselineScan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, created_at")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`fetchBaselineScan failed: ${error.message}`);
  return (data as BaselineScan | null) ?? null;
}

/**
 * Find the latest advanced_result for a user, walking from newest scan
 * backward. Mirrors the lookup in /insights so behavior stays consistent.
 */
async function getLatestAdvancedAnalysis(userId: string): Promise<Record<string, unknown> | null> {
  const recent = await getScansForUser(userId, 5);
  for (const scan of recent) {
    const analysis = await getAnalysisForScan(scan.id);
    const advanced = (analysis?.advanced_result ?? null) as Record<string, unknown> | null;
    if (advanced && Object.keys(advanced).length > 0) return advanced;
  }
  return null;
}

/**
 * Drill into advanced_result by (group, sub_metric). Returns null when the
 * key is missing or the value isn't a finite number — never throws on shape.
 */
function readSubMetric(
  advanced: Record<string, unknown>,
  group: string,
  subMetric: string
): number | null {
  const groupVal = advanced[group];
  if (!groupVal || typeof groupVal !== "object") return null;
  const raw = (groupVal as Record<string, unknown>)[subMetric];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

interface TaskAdherence {
  daysEngaged: number;
  daysInWindow: number;
  ratio: number;
}

/**
 * Counts days in [baselineDate, today] where the user engaged with their
 * program. We use `completed_once` as the engagement signal: the user marked
 * at least one task complete that day. `all_complete` is too strict for a
 * busy-day-tolerant adherence metric.
 *
 * The denominator is the number of *full* days elapsed since baseline (so
 * partial today doesn't count against the user). Floor to 1 to avoid div-by-0
 * on edge cases.
 */
async function getTaskAdherence(userId: string, baselineCreatedAt: string): Promise<TaskAdherence> {
  const baselineDate = toDateString(new Date(baselineCreatedAt));
  const todayDate = toDateString(new Date());
  const daysInWindow = Math.max(
    1,
    Math.floor(
      (Date.parse(todayDate) - Date.parse(baselineDate)) / MS_PER_DAY
    )
  );

  const { data, error } = await supabase
    .from("user_task_history")
    .select("date, completed_once")
    .eq("user_id", userId)
    .gte("date", baselineDate)
    .lte("date", todayDate);

  if (error) {
    throw new Error(`getTaskAdherence failed: ${error.message}`);
  }

  const daysEngaged = (data ?? []).filter(
    (row) => (row as { completed_once: boolean }).completed_once
  ).length;

  return {
    daysEngaged,
    daysInWindow,
    ratio: daysEngaged / daysInWindow,
  };
}

function toDateString(d: Date): string {
  // YYYY-MM-DD in UTC; matches the `date` column shape stored by the client.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* -------------------------------------------------------------------------- */
/*   Re-exports for callers                                                   */
/* -------------------------------------------------------------------------- */

export type { TargetedMetric };
