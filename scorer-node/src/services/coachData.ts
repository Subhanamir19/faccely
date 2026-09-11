import {
  getScansForUser,
  type ScanRecord,
} from "../supabase/scans.js";
import { getAnalysisForScan } from "../supabase/analyses.js";
import { getUserProfile } from "../supabase/users.js";
import { getMemory } from "../supabase/coachMemory.js";
import { supabase } from "../supabase/client.js";
import { metricKeys, type MetricKey } from "../validators.js";
import type {
  CoachChartBlock,
  CoachMetricCardBlock,
} from "../schemas/CoachSchema.js";

/* ============================================================================
 * Coach data layer — every number Coach is allowed to say.
 *
 * The central rule of the feature is that the model never invents a figure. It
 * is enforced structurally rather than by asking nicely:
 *
 *   - Lookup functions return real rows and nothing else.
 *   - Block builders take only the prose from the model. Scores, deltas and
 *     chart points are filled in here, from the database.
 *
 * So a metric card cannot carry a wrong score even if the model tries, because
 * the model is never the one supplying it. What remains — a figure typed into
 * a sentence — is caught afterwards by coachNumberGuard.ts.
 * ========================================================================== */

const MS_PER_DAY = 86_400_000;

/* -------------------------------------------------------------------------- */
/*   Shapes returned to the model                                             */
/* -------------------------------------------------------------------------- */

export interface ScanHistoryEntry {
  scanId: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Short axis label, e.g. "Sep 10". */
  label: string;
  scores: Partial<Record<MetricKey, number>>;
}

export interface SubmetricEntry {
  /** Advanced-analysis group: cheekbones, jawline, eyes, skin, haircut. */
  group: string;
  /** Sub-metric within the group, e.g. "gonial_angle". */
  key: string;
  score: number | null;
  verdict: string | null;
  comment: string;
  /** Top-level metric this rolls up into, when there is one. */
  parent: MetricKey | null;
}

export interface RoutineAdherence {
  daysCompleted: number;
  daysInWindow: number;
  /** 0-1. Completed days over days in the window. */
  ratio: number;
  currentStreak: number;
  /** Consecutive missed days ending today. 0 when today is done. */
  daysSinceLastCompletion: number;
}

export interface CoachProfile {
  age: number | null;
  gender: string | null;
  ethnicity: string | null;
  scanCount: number;
  firstScanDate: string | null;
  latestScanDate: string | null;
  /** Facts learned in conversation, e.g. { braces: "in braces until 2027" }. */
  memory: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

/** "Sep 10" — short enough for a phone axis, unambiguous within a year. */
function toAxisLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pull the known metric scores out of a scan's free-form `scores` JSON.
 *
 * Scans are stored as `Record<string, unknown>` because the scoring model has
 * changed shape over time. Anything that is not a recognised metric key with a
 * finite 0-100 number is dropped rather than passed along, so an old row cannot
 * put a malformed value in front of the model.
 */
function extractScores(scan: ScanRecord): Partial<Record<MetricKey, number>> {
  const out: Partial<Record<MetricKey, number>> = {};

  for (const key of metricKeys) {
    const raw = (scan.scores as Record<string, unknown>)[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      out[key] = Math.round(value);
    }
  }

  return out;
}

/** Advanced-analysis group to the top-level metric it rolls up into. */
const SUBMETRIC_PARENTS: Record<string, MetricKey | null> = {
  cheekbones: "cheekbones",
  jawline: "jawline",
  eyes: "eyes_symmetry",
  skin: "skin_quality",
  // Grooming has no score of its own in the 7-metric model.
  haircut: null,
};

/* -------------------------------------------------------------------------- */
/*   Lookups                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Recent scans, oldest first.
 *
 * Oldest-first because every consumer is chronological — charts read left to
 * right and deltas read forwards — so the reversal happens once here.
 */
export async function getScanHistory(
  userId: string,
  limit = 6
): Promise<ScanHistoryEntry[]> {
  const scans = await getScansForUser(userId, limit);

  return scans
    .map((scan) => ({
      scanId: scan.id,
      date: scan.created_at.slice(0, 10),
      label: toAxisLabel(scan.created_at),
      scores: extractScores(scan),
    }))
    .reverse();
}

/**
 * The sub-metric breakdown for a scan, flattened.
 *
 * `advanced_result` is stored as nested groups of parallel fields —
 * `gonial_angle`, `gonial_angle_score`, `gonial_angle_verdict`. Flattening it
 * here means the prompt sees one uniform list instead of a bespoke shape, and a
 * new sub-metric added to the analysis prompt appears automatically without a
 * change in this file.
 *
 * Returns an empty array when advanced analysis has not run for the scan yet —
 * a normal state right after a scan, not an error.
 */
export async function getSubmetrics(
  userId: string,
  scanId?: string
): Promise<SubmetricEntry[]> {
  let targetScanId = scanId;

  if (!targetScanId) {
    const [latest] = await getScansForUser(userId, 1);
    if (!latest) return [];
    targetScanId = latest.id;
  } else {
    // Confirm the scan belongs to this user before reading its analysis;
    // `analyses` is keyed by scan id alone and carries no owner of its own.
    const { data, error } = await supabase
      .from("scans")
      .select("id")
      .eq("user_id", userId)
      .eq("id", targetScanId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to verify scan ${targetScanId}: ${error.message}`);
    }
    if (!data) return [];
  }

  const analysis = await getAnalysisForScan(targetScanId);
  const advanced = analysis?.advanced_result;
  if (!advanced || typeof advanced !== "object") return [];

  const entries: SubmetricEntry[] = [];

  for (const [group, rawFields] of Object.entries(advanced)) {
    if (!rawFields || typeof rawFields !== "object") continue;
    const fields = rawFields as Record<string, unknown>;

    for (const [field, value] of Object.entries(fields)) {
      // The comment field is the bare name; `_score` and `_verdict` hang off it.
      if (field.endsWith("_score") || field.endsWith("_verdict")) continue;
      if (typeof value !== "string" || value.trim() === "") continue;

      const score = Number(fields[`${field}_score`]);
      const verdict = fields[`${field}_verdict`];

      entries.push({
        group,
        key: field,
        score: Number.isFinite(score) ? Math.round(score) : null,
        verdict: typeof verdict === "string" && verdict ? verdict : null,
        comment: value.trim(),
        parent: SUBMETRIC_PARENTS[group] ?? null,
      });
    }
  }

  return entries;
}

/**
 * Whether the user has actually been doing the work.
 *
 * This is the difference between "do more jaw exercises" and "you have done
 * three of the last fourteen days — that is why nothing has moved". Coach
 * cannot give the second answer without this lookup.
 */
export async function getRoutineAdherence(
  userId: string,
  days = 14
): Promise<RoutineAdherence> {
  const today = new Date();
  const windowStart = toDateString(new Date(today.getTime() - (days - 1) * MS_PER_DAY));

  const { data, error } = await supabase
    .from("user_task_history")
    .select("date, completed_once")
    .eq("user_id", userId)
    .gte("date", windowStart)
    .lte("date", toDateString(today))
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch routine adherence for user ${userId}: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ date: string; completed_once: boolean }>;
  const completedDates = new Set(
    rows.filter((row) => row.completed_once).map((row) => row.date)
  );

  // Walk backwards from today. Today not yet being done does not break a
  // streak — the day is still in progress — so the walk starts at yesterday
  // when today is missing.
  let currentStreak = 0;
  let daysSinceLastCompletion = 0;
  let cursor = new Date(today.getTime());

  if (!completedDates.has(toDateString(cursor))) {
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
    daysSinceLastCompletion = 1;
  }

  while (completedDates.has(toDateString(cursor))) {
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }

  if (currentStreak === 0) {
    // Nothing recent: count back to the most recent completed day, capped at
    // the window so this cannot walk forever on a dormant account.
    let probe = new Date(today.getTime());
    daysSinceLastCompletion = 0;
    while (
      daysSinceLastCompletion < days &&
      !completedDates.has(toDateString(probe))
    ) {
      daysSinceLastCompletion += 1;
      probe = new Date(probe.getTime() - MS_PER_DAY);
    }
  }

  return {
    daysCompleted: completedDates.size,
    daysInWindow: days,
    ratio: completedDates.size / days,
    currentStreak,
    daysSinceLastCompletion,
  };
}

/**
 * Who the user is, as far as the backend knows.
 *
 * Onboarding goals live only in the app's local store today, so they are not
 * here. Until that changes, Coach learns goals through conversation and keeps
 * them in `coach_memory`.
 */
export async function getProfile(userId: string): Promise<CoachProfile> {
  const [profile, scans, memoryRows] = await Promise.all([
    getUserProfile(userId),
    getScansForUser(userId, 100),
    getMemory(userId),
  ]);

  const memory: Record<string, string> = {};
  for (const row of memoryRows) {
    memory[row.key] = row.value;
  }

  // getScansForUser returns newest first.
  const latest = scans[0] ?? null;
  const first = scans.length > 0 ? scans[scans.length - 1] : null;

  return {
    age: profile?.age ?? null,
    gender: profile?.gender ?? null,
    ethnicity: profile?.ethnicity ?? null,
    scanCount: scans.length,
    firstScanDate: first ? first.created_at.slice(0, 10) : null,
    latestScanDate: latest ? latest.created_at.slice(0, 10) : null,
    memory,
  };
}

/* -------------------------------------------------------------------------- */
/*   Block builders                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Build a metric card. The model supplies `note` and nothing else.
 *
 * Score and delta are read from the two most recent scans here, so a card can
 * never show a figure the user's own history does not contain.
 *
 * Returns null when the metric has never been scored — the caller drops the
 * block rather than rendering an empty card.
 */
export async function buildMetricCard(
  userId: string,
  metric: MetricKey,
  note: string
): Promise<CoachMetricCardBlock | null> {
  const scans = await getScansForUser(userId, 2);
  if (scans.length === 0) return null;

  const current = extractScores(scans[0])[metric];
  if (current === undefined) return null;

  const previous = scans.length > 1 ? extractScores(scans[1])[metric] : undefined;

  return {
    type: "metric_card",
    metric,
    score: current,
    ...(previous === undefined ? {} : { delta: current - previous }),
    note: note.trim().slice(0, 200),
  };
}

/**
 * Build a chart from real scan history. The model chooses which metrics to
 * plot and writes the caption; every point comes from the database.
 *
 * Returns null when there are fewer than two scans, because a trend line
 * through a single point invites a conclusion the data does not support.
 */
export async function buildChart(
  userId: string,
  options: {
    metrics: MetricKey[];
    chart?: CoachChartBlock["chart"];
    limit?: number;
    caption?: string;
  }
): Promise<CoachChartBlock | null> {
  const limit = Math.min(Math.max(options.limit ?? 6, 2), 24);
  const history = await getScanHistory(userId, limit);
  if (history.length < 2) return null;

  const metrics = options.metrics.slice(0, 4);
  if (metrics.length === 0) return null;

  const series = metrics
    .map((metric) => ({
      label: metric,
      points: history
        .filter((entry) => entry.scores[metric] !== undefined)
        .map((entry) => ({ x: entry.label, y: entry.scores[metric] as number })),
    }))
    .filter((s) => s.points.length >= 2);

  if (series.length === 0) return null;

  // Pad the visible range so a 4-point move is not flattened by a 0-100 axis,
  // while still keeping the axis inside the range scores can occupy.
  const values = series.flatMap((s) => s.points.map((p) => p.y));
  const yMin = Math.max(0, Math.floor(Math.min(...values) / 10) * 10 - 5);
  const yMax = Math.min(100, Math.ceil(Math.max(...values) / 10) * 10 + 5);

  return {
    type: "chart",
    chart: options.chart ?? "line",
    series,
    yMin,
    yMax,
    ...(options.caption ? { caption: options.caption.slice(0, 160) } : {}),
  };
}
