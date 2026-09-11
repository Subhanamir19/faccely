import {
  getProfile,
  getRoutineAdherence,
  getScanHistory,
  type CoachProfile,
  type RoutineAdherence,
  type ScanHistoryEntry,
} from "./coachData.js";
import { metricKeys, type MetricKey } from "../validators.js";

/* ============================================================================
 * Layer A — the context every Coach turn carries.
 *
 * Two layers feed the model. This is the cheap one: a compact snapshot that is
 * always present, sits at a stable position in the prompt so it can be cached,
 * and costs a few hundred tokens. The expensive layer is the tools, pulled only
 * when a question actually needs them.
 *
 * Stuffing scan history in here instead would make every trivial turn pay for
 * data most turns never use. Keeping it small is what makes a cheap model
 * viable for the majority of questions.
 *
 * It also removes the blank-box problem: with this loaded, Coach can open with
 * something true about the user rather than "how can I help?".
 * ========================================================================== */

export interface CoachContext {
  profile: CoachProfile;
  /** Most recent scores, or null when the user has never scanned. */
  latestScores: Partial<Record<MetricKey, number>> | null;
  latestScanDate: string | null;
  /** Movement since the previous scan, for metrics present in both. */
  deltas: Partial<Record<MetricKey, number>> | null;
  /** The two lowest current scores — the obvious things to work on. */
  weakest: MetricKey[];
  adherence: RoutineAdherence;
  scanCount: number;
  /** Route the floating button was tapped on, when the app sent one. */
  screen: string | null;
}

/**
 * Gather Layer A for one user.
 *
 * Reads run in parallel because this sits directly in front of the user's first
 * token: three sequential round trips would be visible as lag on every message.
 */
export async function buildCoachContext(
  userId: string,
  screen?: string | null
): Promise<CoachContext> {
  const [profile, history, adherence] = await Promise.all([
    getProfile(userId),
    getScanHistory(userId, 2),
    getRoutineAdherence(userId, 14),
  ]);

  // getScanHistory returns oldest first.
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

  return {
    profile,
    latestScores: latest ? latest.scores : null,
    latestScanDate: latest ? latest.date : null,
    deltas: latest && previous ? computeDeltas(previous, latest) : null,
    weakest: latest ? weakestMetrics(latest.scores, 2) : [],
    adherence,
    scanCount: profile.scanCount,
    screen: screen ?? null,
  };
}

function computeDeltas(
  previous: ScanHistoryEntry,
  latest: ScanHistoryEntry
): Partial<Record<MetricKey, number>> {
  const deltas: Partial<Record<MetricKey, number>> = {};

  for (const key of metricKeys) {
    const before = previous.scores[key];
    const after = latest.scores[key];
    if (before !== undefined && after !== undefined) {
      deltas[key] = after - before;
    }
  }

  return deltas;
}

function weakestMetrics(
  scores: Partial<Record<MetricKey, number>>,
  count: number
): MetricKey[] {
  return metricKeys
    .filter((key) => scores[key] !== undefined)
    .sort((a, b) => (scores[a] as number) - (scores[b] as number))
    .slice(0, count);
}

/**
 * Render Layer A as prompt text.
 *
 * Terse `key: value` lines rather than prose — the model reads them equally
 * well and they cost a fraction as much, on every single turn.
 *
 * Absent data is stated rather than omitted. "no scans yet" stops the model
 * assuming scores exist and asking the user to check numbers they do not have.
 */
export function renderCoachContext(context: CoachContext): string {
  const lines: string[] = ["USER CONTEXT"];

  const { profile } = context;
  const who = [
    profile.age !== null ? `age ${profile.age}` : null,
    profile.gender ?? null,
    profile.ethnicity ?? null,
  ].filter(Boolean);
  lines.push(`about: ${who.length > 0 ? who.join(", ") : "not given"}`);

  if (context.latestScores && context.latestScanDate) {
    const scores = metricKeys
      .filter((key) => context.latestScores?.[key] !== undefined)
      .map((key) => {
        const delta = context.deltas?.[key];
        const movement =
          delta === undefined || delta === 0
            ? ""
            : ` (${delta > 0 ? "+" : ""}${delta})`;
        return `${key} ${context.latestScores?.[key]}${movement}`;
      })
      .join(", ");

    lines.push(`latest scan: ${context.latestScanDate} — ${scores}`);
    lines.push(`total scans: ${context.scanCount}`);
    if (context.weakest.length > 0) {
      lines.push(`lowest metrics: ${context.weakest.join(", ")}`);
    }
  } else {
    lines.push("latest scan: none yet — the user has never scanned");
  }

  const { adherence } = context;
  lines.push(
    `routine: ${adherence.daysCompleted}/${adherence.daysInWindow} days done, ` +
      `streak ${adherence.currentStreak}, ` +
      `${adherence.daysSinceLastCompletion} days since last completed`
  );

  const memoryKeys = Object.keys(context.profile.memory);
  if (memoryKeys.length > 0) {
    const facts = memoryKeys
      .map((key) => `${key}: ${context.profile.memory[key]}`)
      .join("; ");
    lines.push(`remembered: ${facts}`);
  }

  if (context.screen) {
    lines.push(
      `opened from: ${context.screen} — assume the question is about what is on that screen`
    );
  }

  return lines.join("\n");
}
