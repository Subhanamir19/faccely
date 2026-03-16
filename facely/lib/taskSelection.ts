// facely/lib/taskSelection.ts
// Pure function library for daily task selection.
// No React, no side effects — just data in, picks out.

import type { Scores } from "./api/scores";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreField = keyof Scores;

export type TargetArea = "jawline" | "cheekbones" | "eyes" | "nose" | "skin" | "all";

export type Intensity = "high" | "medium" | "low";

export type ExerciseEntry = {
  id: string;
  name: string;
  targets: TargetArea[];
  intensity: Intensity;
  scoreFields: ScoreField[];
  weight: number; // 1–7: target appearances per week
};

export type TaskPick = {
  exerciseId: string;
  name: string;
  reason: string;
  targets: TargetArea[];
  intensity: Intensity;
};

export type SelectionInput = {
  scores: Partial<Record<ScoreField, number>> | null;
  goals: string[] | null;
  experience: string | null;
  recentExerciseIds: string[];
  currentStreak: number;
  consecutiveMissed: number;
  isNewUser: boolean;
};

type SelectionTier = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// 15-exercise catalog
// ---------------------------------------------------------------------------

const ALL_FIELDS: ScoreField[] = [
  "jawline", "cheekbones", "eyes_symmetry", "nose_harmony",
  "facial_symmetry", "skin_quality", "sexual_dimorphism",
];

export const EXERCISE_CATALOG: ExerciseEntry[] = [
  // ── Jawline ────────────────────────────────────────────────────────────────
  {
    id: "jawline-1",
    name: "Jawline Exercise 1",
    targets: ["jawline", "cheekbones"],
    intensity: "medium",
    weight: 5,
    scoreFields: ["jawline", "cheekbones"],
  },
  {
    id: "chin-tucks",
    name: "Chin Tucks",
    targets: ["jawline"],
    intensity: "medium",
    weight: 7,
    scoreFields: ["jawline"],
  },
  {
    id: "jaw-resistance",
    name: "Jaw Resistance",
    targets: ["jawline"],
    intensity: "high",
    weight: 4,
    scoreFields: ["jawline", "sexual_dimorphism"],
  },
  {
    id: "neck-lift-1",
    name: "Neck Lift 1",
    targets: ["jawline"],
    intensity: "medium",
    weight: 5,
    scoreFields: ["jawline"],
  },
  {
    id: "neck-lift-2",
    name: "Neck Lift 2",
    targets: ["jawline"],
    intensity: "medium",
    weight: 5,
    scoreFields: ["jawline"],
  },
  {
    id: "neck-curls",
    name: "Neck Curls",
    targets: ["jawline"],
    intensity: "high",
    weight: 4, // overridden by special rule below
    scoreFields: ["jawline", "sexual_dimorphism"],
  },
  {
    id: "towel-chewing",
    name: "Towel Chewing",
    targets: ["jawline", "cheekbones"],
    intensity: "high",
    weight: 5,
    scoreFields: ["jawline", "cheekbones", "sexual_dimorphism"],
  },

  // ── Cheekbones ─────────────────────────────────────────────────────────────
  {
    id: "alternating-cheek-puffs",
    name: "Alternating Cheek Puffs",
    targets: ["cheekbones"],
    intensity: "medium",
    weight: 6,
    scoreFields: ["cheekbones"],
  },
  {
    id: "fish-face",
    name: "Fish Face",
    targets: ["cheekbones", "jawline"],
    intensity: "low",
    weight: 7,
    scoreFields: ["cheekbones", "jawline"],
  },

  // ── Eyes ───────────────────────────────────────────────────────────────────
  {
    id: "hunter-eyes-1",
    name: "Hunter Eyes 1",
    targets: ["eyes"],
    intensity: "medium",
    weight: 6,
    scoreFields: ["eyes_symmetry"],
  },
  {
    id: "hunter-eyes-2",
    name: "Hunter Eyes 2",
    targets: ["eyes"],
    intensity: "medium",
    weight: 5,
    scoreFields: ["eyes_symmetry"],
  },

  // ── Nose ───────────────────────────────────────────────────────────────────
  {
    id: "nose-massage",
    name: "Nose Massage",
    targets: ["nose"],
    intensity: "low",
    weight: 6,
    scoreFields: ["nose_harmony"],
  },
  {
    id: "slim-nose-massage",
    name: "Slim Nose Massage",
    targets: ["nose"],
    intensity: "medium",
    weight: 6,
    scoreFields: ["nose_harmony"],
  },

  // ── All areas ──────────────────────────────────────────────────────────────
  {
    id: "lymphatic-drainage",
    name: "Lymphatic Drainage",
    targets: ["all"],
    intensity: "low",
    weight: 7,
    scoreFields: ALL_FIELDS,
  },
  {
    id: "gua-sha",
    name: "Gua Sha",
    targets: ["all"],
    intensity: "low",
    weight: 5,
    scoreFields: ALL_FIELDS,
  },
];

const EXERCISES_BY_ID = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));

// ---------------------------------------------------------------------------
// Goal → score field mapping
// ---------------------------------------------------------------------------

const GOAL_TO_SCORE_FIELDS: Record<string, ScoreField[]> = {
  jawline:    ["jawline", "sexual_dimorphism"],
  cheekbones: ["cheekbones"],
  symmetry:   ["facial_symmetry"],
  skin:       ["skin_quality"],
  eyes:       ["eyes_symmetry"],
  overall:    ALL_FIELDS,
};

// ---------------------------------------------------------------------------
// Fallback starter set (tier 4 — no scores, no goals)
// ---------------------------------------------------------------------------

const UNIVERSAL_STARTER: string[] = [
  "chin-tucks",
  "lymphatic-drainage",
  "alternating-cheek-puffs",
  "hunter-eyes-1",
  "neck-curls",
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_COUNT = 5;
const BENCHMARK = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasValidScores(scores: Partial<Record<ScoreField, number>> | null): boolean {
  if (!scores) return false;
  return Object.values(scores).some((v) => typeof v === "number" && v > 0);
}

function hasValidGoals(goals: string[] | null): boolean {
  return Array.isArray(goals) && goals.length > 0;
}

/** Compute mean of all available score fields (used for neck-curls rule). */
function computeOverall(scores: Partial<Record<ScoreField, number>> | null): number | null {
  if (!scores) return null;
  const vals = ALL_FIELDS
    .map((f) => scores[f])
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getScoreGap(
  scores: Partial<Record<ScoreField, number>>,
  fields: ScoreField[],
): number {
  let total = 0;
  let count = 0;
  for (const f of fields) {
    const v = scores[f];
    if (typeof v === "number" && v > 0) {
      total += Math.max(0, BENCHMARK - v);
      count++;
    }
  }
  if (count === 0) return 0;
  return (total / count) / BENCHMARK;
}

function goalMatchScore(scoreFields: ScoreField[], goals: string[]): number {
  const goalFields = new Set<ScoreField>();
  for (const g of goals) {
    const mapped = GOAL_TO_SCORE_FIELDS[g];
    if (mapped) mapped.forEach((f) => goalFields.add(f));
  }
  if (!goalFields.size) return 0;
  return scoreFields.some((f) => goalFields.has(f)) ? 1 : 0;
}

function primaryTarget(
  scoreFields: ScoreField[],
  scores: Partial<Record<ScoreField, number>>,
): { field: ScoreField; value: number } | null {
  let worst: { field: ScoreField; value: number } | null = null;
  for (const f of scoreFields) {
    const v = scores[f];
    if (typeof v === "number" && v > 0 && (!worst || v < worst.value)) {
      worst = { field: f, value: v };
    }
  }
  return worst;
}

const FIELD_LABELS: Record<ScoreField, string> = {
  jawline:          "jawline",
  facial_symmetry:  "symmetry",
  skin_quality:     "skin quality",
  cheekbones:       "cheekbones",
  eyes_symmetry:    "eye symmetry",
  nose_harmony:     "nose harmony",
  sexual_dimorphism: "facial structure",
};

const GOAL_LABELS: Record<string, string> = {
  jawline:    "jawline",
  cheekbones: "cheekbones",
  symmetry:   "symmetry",
  skin:       "skin",
  eyes:       "eyes",
  overall:    "overall improvement",
};

function generateReason(
  entry: ExerciseEntry,
  tier: SelectionTier,
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
): string {
  if (tier === 1 && scores) {
    const target = primaryTarget(entry.scoreFields, scores);
    const matchedGoal = goals?.find((g) =>
      GOAL_TO_SCORE_FIELDS[g]?.some((f) => entry.scoreFields.includes(f)),
    );
    if (target && matchedGoal) {
      return `Your ${FIELD_LABELS[target.field]} is ${target.value}/100 — matches your ${GOAL_LABELS[matchedGoal] ?? matchedGoal} goal`;
    }
    if (target) {
      return `Your ${FIELD_LABELS[target.field]} is ${target.value}/100 — this helps close that gap`;
    }
  }
  if (tier === 2 && scores) {
    const target = primaryTarget(entry.scoreFields, scores);
    if (target) {
      return `Your ${FIELD_LABELS[target.field]} is ${target.value}/100 — targets that area`;
    }
  }
  if (tier === 3 && goals) {
    const matchedGoal = goals.find((g) =>
      GOAL_TO_SCORE_FIELDS[g]?.some((f) => entry.scoreFields.includes(f)),
    );
    if (matchedGoal) {
      return `Matches your ${GOAL_LABELS[matchedGoal] ?? matchedGoal} goal`;
    }
  }
  return "Great foundational exercise for all face areas";
}

// ---------------------------------------------------------------------------
// Variety enforcement — prevent same-area domination
// ---------------------------------------------------------------------------

type ScoredExercise = { entry: ExerciseEntry; rank: number };

function enforceVariety(
  picks: ScoredExercise[],
  allScored: ScoredExercise[],
): ScoredExercise[] {
  const maxSameArea = Math.ceil(DAILY_COUNT / 2);
  const result = [...picks];
  const areaCounts = new Map<TargetArea, number>();

  for (const p of result) {
    for (const t of p.entry.targets) {
      if (t === "all") continue;
      areaCounts.set(t, (areaCounts.get(t) ?? 0) + 1);
    }
  }

  for (const [area, cnt] of areaCounts) {
    if (cnt <= maxSameArea) continue;
    const fromArea = result
      .filter((p) => p.entry.targets.includes(area) && !p.entry.targets.includes("all"))
      .sort((a, b) => a.rank - b.rank);
    const excess = cnt - maxSameArea;
    for (let i = 0; i < excess && fromArea.length > 0; i++) {
      const toRemove = fromArea.shift()!;
      const idx = result.indexOf(toRemove);
      if (idx === -1) continue;
      const usedIds = new Set(result.map((r) => r.entry.id));
      const replacement = allScored.find(
        (s) => !usedIds.has(s.entry.id) && !s.entry.targets.includes(area),
      );
      if (replacement) result[idx] = replacement;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Neck Curls special rule
// overall < 70 (or unknown) → every day
// overall ≥ 70             → 4 out of every 7 days (deterministic by day slot)
// ---------------------------------------------------------------------------

function shouldIncludeNeckCurlsToday(
  scores: Partial<Record<ScoreField, number>> | null,
): boolean {
  const overall = computeOverall(scores);
  if (overall === null || overall < 70) return true;
  // Deterministic 4/7 rotation using days since Unix epoch
  const daySlot = Math.floor(Date.now() / 86_400_000) % 7;
  return daySlot < 4;
}

// ---------------------------------------------------------------------------
// Main selection — always returns exactly DAILY_COUNT (5) exercises
// ---------------------------------------------------------------------------

export function selectDailyTasks(input: SelectionInput): TaskPick[] {
  const _hasScores = hasValidScores(input.scores);
  const _hasGoals  = hasValidGoals(input.goals);

  let tier: SelectionTier;
  if (_hasScores && _hasGoals) tier = 1;
  else if (_hasScores)         tier = 2;
  else if (_hasGoals)          tier = 3;
  else                         tier = 4;

  // Tier 4: hardcoded starter set — used for new users (no scores, no goals yet)
  // isNewUser is always true here in practice; keep the guard explicit for clarity.
  if (tier === 4) {
    const newUserReason = input.isNewUser
      ? "Perfect foundation exercise to start building your routine"
      : "Great foundational exercise for all face areas";
    return UNIVERSAL_STARTER.map((id) => {
      const entry = EXERCISES_BY_ID.get(id)!;
      return {
        exerciseId: entry.id,
        name:       entry.name,
        reason:     newUserReason,
        targets:    entry.targets,
        intensity:  entry.intensity,
      };
    });
  }

  const recentSet = new Set(input.recentExerciseIds);
  const forceNeckCurls = shouldIncludeNeckCurlsToday(input.scores);
  const neckCurlsEntry = EXERCISES_BY_ID.get("neck-curls")!;

  // Recovery mode: after 3+ consecutive missed days, progressively penalise
  // high-intensity exercises so the returning user eases back in.
  // missedPenalty goes from 0.8 (3 missed) down to 0.2 (7+ missed).
  const missedPenalty = input.consecutiveMissed >= 3
    ? Math.max(0.2, 1 - (input.consecutiveMissed - 2) * 0.2)
    : 1;

  // Score all exercises except neck-curls (handled separately)
  const scored: ScoredExercise[] = EXERCISE_CATALOG
    .filter((e) => e.id !== "neck-curls")
    .map((entry) => {
      let rank = 0;

      if (tier === 1 || tier === 2) {
        const gap  = getScoreGap(input.scores!, entry.scoreFields);
        const goal = tier === 1 ? goalMatchScore(entry.scoreFields, input.goals!) : 0;
        rank = tier === 1 ? gap * 0.6 + goal * 0.4 : gap;
      } else if (tier === 3) {
        rank = goalMatchScore(entry.scoreFields, input.goals!);
      }

      // Freshness penalty: recently done = half weight
      rank *= recentSet.has(entry.id) ? 0.5 : 1;
      // Weight bonus: higher frequency → more likely selected
      rank *= entry.weight / 7;
      // Small bonus for multi-target (more efficient sessions)
      if (entry.targets.length > 1 && !entry.targets.includes("all")) rank += 0.05;
      // Recovery penalty: high-intensity exercises rank lower after missed days
      if (entry.intensity === "high") rank *= missedPenalty;

      return { entry, rank };
    });

  scored.sort((a, b) => b.rank - a.rank);

  let picks: ScoredExercise[];

  if (forceNeckCurls) {
    // Reserve 1 slot for neck curls, fill remaining 4 from scored pool
    picks = scored.slice(0, DAILY_COUNT - 1);
    picks = enforceVariety(picks, scored);
    picks.push({ entry: neckCurlsEntry, rank: 999 });
  } else {
    // Neck curls competes normally with its weight
    let neckRank = 0;
    if (tier === 1 || tier === 2) {
      neckRank = getScoreGap(input.scores!, neckCurlsEntry.scoreFields);
      if (tier === 1) {
        neckRank = neckRank * 0.6 + goalMatchScore(neckCurlsEntry.scoreFields, input.goals!) * 0.4;
      }
    } else if (tier === 3) {
      neckRank = goalMatchScore(neckCurlsEntry.scoreFields, input.goals!);
    }
    neckRank *= recentSet.has("neck-curls") ? 0.5 : 1;
    neckRank *= neckCurlsEntry.weight / 7;
    // neck-curls is high-intensity — apply recovery penalty in competition mode too
    neckRank *= missedPenalty;

    scored.push({ entry: neckCurlsEntry, rank: neckRank });
    scored.sort((a, b) => b.rank - a.rank);
    picks = scored.slice(0, DAILY_COUNT);
    picks = enforceVariety(picks, scored);
  }

  return picks.map((p) => ({
    exerciseId: p.entry.id,
    name:       p.entry.name,
    reason:     generateReason(p.entry, tier, input.scores, input.goals),
    targets:    p.entry.targets,
    intensity:  p.entry.intensity,
  }));
}

// ---------------------------------------------------------------------------
// Utility: focus area summary for the UI banner
// ---------------------------------------------------------------------------

export function summarizeFocusAreas(picks: TaskPick[]): string {
  const areas = new Set<string>();
  for (const p of picks) {
    for (const t of p.targets) {
      if (t === "all") {
        areas.add("jawline");
        areas.add("cheekbones");
        areas.add("eyes");
        areas.add("nose");
      } else {
        areas.add(t);
      }
    }
  }
  const list = Array.from(areas);
  if (list.length <= 2) return list.join(" & ");
  return list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
}
