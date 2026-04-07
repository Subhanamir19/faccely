// facely/lib/taskBuilder.ts
// Builds the daily routine — 5 facial exercises + 2 protocols, both score/goal-driven.

import {
  selectDailyTasks,
  type SelectionInput,
  type TaskPick,
  type ScoreField,
} from "./taskSelection";
import { PROTOCOL_CATALOG, type ProtocolType, type ProtocolEntry } from "./protocolCatalog";

export type RoutineTaskPick = TaskPick & {
  protocolType: "facial_exercise";
  overloadTier: number;   // 0 = base, 1 = week 2, 2 = week 4
  overloadLabel: string;  // "Base" | "Week 2" | "Week 4"
};

export type BuildInput = SelectionInput & {
  skinScore?: number | null;
};

export type ProtocolSelectionInput = {
  dateStr: string;
  scores: Partial<Record<ScoreField, number>> | null;
  goals: string[] | null;
  /** IDs of protocols completed in the past 2 days — used for freshness rotation */
  recentProtocolIds?: string[];
};

export type ProtocolPick = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  reason: string;
};

// ---------------------------------------------------------------------------
// Progressive overload tier (UI label only)
// ---------------------------------------------------------------------------

function computeOverloadTier(streak: number): number {
  if (streak >= 14) return 2;
  if (streak >= 7)  return 1;
  return 0;
}

const OVERLOAD_LABELS = ["Base", "Week 2", "Week 4"] as const;

function getOverloadLabel(tier: number): string {
  return OVERLOAD_LABELS[tier] ?? "Base";
}

// ---------------------------------------------------------------------------
// Protocol selection — score/goal-aware
// ---------------------------------------------------------------------------

const BENCHMARK = 80;

const GOAL_TO_SCORE_FIELDS_PROTO: Partial<Record<string, ScoreField[]>> = {
  jawline:    ["jawline", "sexual_dimorphism"],
  cheekbones: ["cheekbones"],
  symmetry:   ["facial_symmetry"],
  skin:       ["skin_quality"],
  eyes:       ["eyes_symmetry"],
  overall:    ["jawline", "cheekbones", "eyes_symmetry", "nose_harmony",
               "facial_symmetry", "skin_quality", "sexual_dimorphism"],
};

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/**
 * A protocol is eligible if at least one trigger condition is satisfied,
 * or if it is marked always=true.
 */
function isEligible(
  entry: ProtocolEntry,
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
): boolean {
  if (entry.always) return true;

  if (entry.scoreTrigger && scores) {
    const val = scores[entry.scoreTrigger.field];
    if (typeof val === "number" && val > 0 && val < entry.scoreTrigger.below) return true;
  }

  if (entry.goalTrigger && goals?.length) {
    if (goals.some((g) => entry.goalTrigger!.includes(g))) return true;
  }

  return false;
}

/**
 * Score a single protocol entry for the given user context.
 *
 * Priority stack (additive):
 *   +2..3  scoreTrigger fired (scaled by how severe the gap is)
 *   +1     goalTrigger matched
 *   +0.5   always (baseline) + score-gap bonus
 *   +0.3   goal-field alignment bonus
 *   ×0.4   freshness penalty if completed in the last 2 days
 *   +tiny  deterministic day-hash tiebreaker to rotate tied entries
 */
function scoreProtocol(
  entry: ProtocolEntry,
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
  dateSlot: number,
  recentIds: Set<string>,
): number {
  let rank = 0;

  // Score-trigger: boost proportional to how far below the threshold the user is
  if (entry.scoreTrigger && scores) {
    const val = scores[entry.scoreTrigger.field];
    if (typeof val === "number" && val > 0 && val < entry.scoreTrigger.below) {
      const severity = (entry.scoreTrigger.below - val) / entry.scoreTrigger.below;
      rank += 2 + severity;
    }
  }

  // Goal-trigger: direct goal match
  if (entry.goalTrigger && goals?.length) {
    if (goals.some((g) => entry.goalTrigger!.includes(g))) {
      rank += 1;
    }
  }

  // Always: give a base rank + bonus for how misaligned the user's scores are
  if (entry.always) {
    rank += 0.5;
    if (scores) {
      let totalGap = 0, count = 0;
      for (const f of entry.scoreFields) {
        const v = scores[f];
        if (typeof v === "number" && v > 0) {
          totalGap += Math.max(0, BENCHMARK - v) / BENCHMARK;
          count++;
        }
      }
      if (count > 0) rank += (totalGap / count) * 0.5;
    }
  }

  // Goal-field alignment bonus (even for entries without explicit goalTrigger)
  if (goals?.length) {
    const goalFields = new Set<ScoreField>();
    for (const g of goals) {
      const mapped = GOAL_TO_SCORE_FIELDS_PROTO[g];
      if (mapped) mapped.forEach((f) => goalFields.add(f));
    }
    if (entry.scoreFields.some((f) => goalFields.has(f))) rank += 0.3;
  }

  // Freshness penalty — halve rank if seen in the last 2 days
  if (recentIds.has(entry.id)) rank *= 0.4;

  // Deterministic per-entry tiebreaker so tied protocols rotate across days
  const idHash = entry.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  rank += ((dateSlot + idHash) % 7) * 0.01;

  return rank;
}

function pickBestFromPool(
  pool: ProtocolEntry[],
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
  dateSlot: number,
  recentIds: Set<string>,
): ProtocolEntry {
  return pool
    .map((e) => ({ entry: e, rank: scoreProtocol(e, scores, goals, dateSlot, recentIds) }))
    .sort((a, b) => b.rank - a.rank)[0].entry;
}

/**
 * Selects 1 lifestyle/skincare protocol + 1 dietary protocol for the day.
 * Both are chosen based on the user's scores, goals, and recent history.
 */
export function buildDailyProtocols(input: ProtocolSelectionInput): ProtocolPick[] {
  const { dateStr, scores, goals, recentProtocolIds = [] } = input;
  const dateSlot = dayOfYear(dateStr);
  const recentIds = new Set(recentProtocolIds);

  const dietaryPool = PROTOCOL_CATALOG.filter(
    (p) => p.type === "dietary" && isEligible(p, scores, goals),
  );
  const dietaryFallback = PROTOCOL_CATALOG.filter((p) => p.type === "dietary");

  const pool = dietaryPool.length > 0 ? dietaryPool : dietaryFallback;
  const ranked = pool
    .map((e) => ({ entry: e, rank: scoreProtocol(e, scores, goals, dateSlot, recentIds) }))
    .sort((a, b) => b.rank - a.rank);

  const first  = ranked[0].entry;
  const second = ranked.find((r) => r.entry.id !== first.id)?.entry ?? ranked[0].entry;

  return [first, second].map((e) => ({
    id:       e.id,
    name:     e.name,
    type:     e.type,
    quantity: e.quantity,
    reason:   e.reason,
  }));
}

// ---------------------------------------------------------------------------
// buildDailyRoutine — returns exactly 5 exercises
// ---------------------------------------------------------------------------

export function buildDailyRoutine(input: BuildInput): RoutineTaskPick[] {
  const tier  = computeOverloadTier(input.currentStreak);
  const label = getOverloadLabel(tier);
  const picks = selectDailyTasks(input);

  return picks.map((p) => ({
    ...p,
    protocolType: "facial_exercise" as const,
    overloadTier:  tier,
    overloadLabel: label,
  }));
}
