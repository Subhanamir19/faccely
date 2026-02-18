// facely/lib/taskSelection.ts
// Pure function library for daily task selection.
// No React, no side effects — just data in, picks out.

import type { Scores } from "./api/scores";
import { EXERCISE_GUIDES } from "./exerciseGuideData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreField = keyof Scores;

export type TargetArea = "jawline" | "cheekbones" | "eyes" | "nose" | "all";

export type Intensity = "high" | "medium" | "low";

export type ExerciseEntry = {
  id: string;
  name: string;
  targets: TargetArea[];
  intensity: Intensity;
  scoreFields: ScoreField[];
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
// Exercise catalog — all 19 active exercises with target mappings
// ---------------------------------------------------------------------------

export const EXERCISE_CATALOG: ExerciseEntry[] = [
  // Jawline
  { id: "chin-tucks", name: "Chin Tucks", targets: ["jawline"], intensity: "medium", scoreFields: ["jawline"] },
  { id: "chin-tucks-with-head-tilt", name: "Chin Tucks with Head Tilt", targets: ["jawline"], intensity: "medium", scoreFields: ["jawline"] },
  { id: "upward-chewing", name: "Upward Chewing", targets: ["jawline"], intensity: "high", scoreFields: ["jawline", "sexual_dimorphism"] },
  { id: "neck-lift", name: "Neck Lift", targets: ["jawline"], intensity: "medium", scoreFields: ["jawline"] },
  { id: "jaw-resistance", name: "Jaw Resistance", targets: ["jawline"], intensity: "high", scoreFields: ["jawline", "sexual_dimorphism"] },
  { id: "hyoid-stretch", name: "Hyoid Stretch", targets: ["jawline"], intensity: "low", scoreFields: ["jawline"] },
  { id: "sternocleidomastoid-stretch", name: "SCM Stretch", targets: ["jawline"], intensity: "low", scoreFields: ["jawline"] },
  { id: "neck-curls", name: "Neck Curls", targets: ["jawline"], intensity: "high", scoreFields: ["jawline", "sexual_dimorphism"] },
  { id: "resisted-jaw-openings", name: "Resisted Jaw Openings", targets: ["jawline"], intensity: "medium", scoreFields: ["jawline"] },

  // Cheekbones
  { id: "cps", name: "CPS", targets: ["cheekbones"], intensity: "high", scoreFields: ["cheekbones"] },
  { id: "alternating-cheek-puffs", name: "Alternating Cheek Puffs", targets: ["cheekbones"], intensity: "medium", scoreFields: ["cheekbones"] },
  { id: "cheekbone-knuckle-massage", name: "Cheekbone Knuckle Massage", targets: ["cheekbones"], intensity: "low", scoreFields: ["cheekbones"] },

  // Eyes
  { id: "hunter-eyes", name: "Hunter Eyes 1", targets: ["eyes"], intensity: "medium", scoreFields: ["eyes_symmetry"] },

  // Nose
  { id: "nose-massage", name: "Nose Massage", targets: ["nose"], intensity: "medium", scoreFields: ["nose_harmony"] },

  // Multi-target
  { id: "eyes-and-cheeks", name: "Eyes and Cheeks", targets: ["eyes", "cheekbones"], intensity: "medium", scoreFields: ["eyes_symmetry", "cheekbones"] },
  { id: "fish-face", name: "Fish Face", targets: ["cheekbones", "jawline"], intensity: "low", scoreFields: ["cheekbones", "jawline"] },
  { id: "nose-tongue-touch", name: "Nose Touching with Tongue", targets: ["cheekbones", "jawline", "nose"], intensity: "medium", scoreFields: ["cheekbones", "jawline", "nose_harmony"] },
  { id: "thumb-pulling", name: "Thumb Pulling", targets: ["all"], intensity: "medium", scoreFields: ["jawline", "cheekbones", "eyes_symmetry", "nose_harmony"] },
  { id: "lymphatic-drainage", name: "Lymphatic Drainage", targets: ["all"], intensity: "low", scoreFields: ["jawline", "cheekbones", "eyes_symmetry", "nose_harmony", "facial_symmetry", "skin_quality"] },
];

// ---------------------------------------------------------------------------
// Goal → score field mapping
// ---------------------------------------------------------------------------

const GOAL_TO_SCORE_FIELDS: Record<string, ScoreField[]> = {
  jawline:   ["jawline", "sexual_dimorphism"],
  cheekbones: ["cheekbones"],
  symmetry:  ["facial_symmetry"],
  skin:      ["skin_quality"],
  eyes:      ["eyes_symmetry"],
  overall:   ["jawline", "cheekbones", "eyes_symmetry", "nose_harmony", "facial_symmetry", "skin_quality", "sexual_dimorphism"],
};

// ---------------------------------------------------------------------------
// Experience → allowed intensity
// ---------------------------------------------------------------------------

const BEGINNER_EXPERIENCES = new Set(["new", "tried", "skeptical", "bad"]);

function isBeginnerExperience(exp: string | null): boolean {
  return !exp || BEGINNER_EXPERIENCES.has(exp);
}

// ---------------------------------------------------------------------------
// Fallback universal starter set
// ---------------------------------------------------------------------------

const UNIVERSAL_STARTER: string[] = [
  "chin-tucks",
  "cps",
  "lymphatic-drainage",
  "alternating-cheek-puffs",
  "hunter-eyes",
];

// ---------------------------------------------------------------------------
// Adaptive task count
// ---------------------------------------------------------------------------

const BENCHMARK = 80;

export function determineTaskCount(input: SelectionInput): number {
  if (input.isNewUser || input.consecutiveMissed > 0) return 3;
  if (input.currentStreak >= 3) return 5;
  return 4;
}

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

function getScoreGap(scores: Partial<Record<ScoreField, number>>, fields: ScoreField[]): number {
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
  // Normalize: max gap is 80 (score of 0 vs benchmark 80)
  return (total / count) / BENCHMARK;
}

function goalMatchScore(scoreFields: ScoreField[], goals: string[]): number {
  const goalFields = new Set<ScoreField>();
  for (const g of goals) {
    const mapped = GOAL_TO_SCORE_FIELDS[g];
    if (mapped) mapped.forEach((f) => goalFields.add(f));
  }
  if (goalFields.size === 0) return 0;
  const overlap = scoreFields.filter((f) => goalFields.has(f)).length;
  return overlap > 0 ? 1 : 0;
}

function primaryTarget(scoreFields: ScoreField[], scores: Partial<Record<ScoreField, number>>): { field: ScoreField; value: number } | null {
  let worst: { field: ScoreField; value: number } | null = null;
  for (const f of scoreFields) {
    const v = scores[f];
    if (typeof v === "number" && v > 0) {
      if (!worst || v < worst.value) worst = { field: f, value: v };
    }
  }
  return worst;
}

const FIELD_LABELS: Record<ScoreField, string> = {
  jawline: "jawline",
  facial_symmetry: "symmetry",
  skin_quality: "skin quality",
  cheekbones: "cheekbones",
  eyes_symmetry: "eye symmetry",
  nose_harmony: "nose harmony",
  sexual_dimorphism: "facial structure",
};

const GOAL_LABELS: Record<string, string> = {
  jawline: "jawline",
  cheekbones: "cheekbones",
  symmetry: "symmetry",
  skin: "skin",
  eyes: "eyes",
  overall: "overall improvement",
};

// ---------------------------------------------------------------------------
// Reason text generation
// ---------------------------------------------------------------------------

function generateReason(
  entry: ExerciseEntry,
  tier: SelectionTier,
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
): string {
  if (tier === 1 && scores) {
    const target = primaryTarget(entry.scoreFields, scores);
    const matchedGoal = goals?.find((g) => {
      const mapped = GOAL_TO_SCORE_FIELDS[g];
      return mapped?.some((f) => entry.scoreFields.includes(f));
    });
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
    const matchedGoal = goals.find((g) => {
      const mapped = GOAL_TO_SCORE_FIELDS[g];
      return mapped?.some((f) => entry.scoreFields.includes(f));
    });
    if (matchedGoal) {
      return `Matches your ${GOAL_LABELS[matchedGoal] ?? matchedGoal} goal`;
    }
  }
  return "Great foundational exercise for all face areas";
}

// ---------------------------------------------------------------------------
// Variety check — prevent same-area domination
// ---------------------------------------------------------------------------

function enforceVariety(picks: ScoredExercise[], count: number, allScored: ScoredExercise[]): ScoredExercise[] {
  const maxSameArea = Math.ceil(count / 2);
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
    // Find exercises from this area to potentially swap (lowest ranked)
    const fromArea = result
      .filter((p) => p.entry.targets.includes(area) && !p.entry.targets.includes("all"))
      .sort((a, b) => a.rank - b.rank);

    const excess = cnt - maxSameArea;
    for (let i = 0; i < excess && fromArea.length > 0; i++) {
      const toRemove = fromArea.shift()!;
      const idx = result.indexOf(toRemove);
      if (idx === -1) continue;

      // Find a replacement from different area
      const usedIds = new Set(result.map((r) => r.entry.id));
      const replacement = allScored.find(
        (s) => !usedIds.has(s.entry.id) && !s.entry.targets.includes(area)
      );
      if (replacement) {
        result[idx] = replacement;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main selection function
// ---------------------------------------------------------------------------

type ScoredExercise = { entry: ExerciseEntry; rank: number };

export function selectDailyTasks(input: SelectionInput): TaskPick[] {
  const count = determineTaskCount(input);
  const _hasScores = hasValidScores(input.scores);
  const _hasGoals = hasValidGoals(input.goals);

  // Determine tier
  let tier: SelectionTier;
  if (_hasScores && _hasGoals) tier = 1;
  else if (_hasScores) tier = 2;
  else if (_hasGoals) tier = 3;
  else tier = 4;

  // Tier 4: hardcoded fallback
  if (tier === 4) {
    const starter = UNIVERSAL_STARTER.slice(0, count);
    return starter.map((id) => {
      const entry = EXERCISE_CATALOG.find((e) => e.id === id)!;
      return {
        exerciseId: entry.id,
        name: entry.name,
        reason: generateReason(entry, 4, null, null),
        targets: entry.targets,
        intensity: entry.intensity,
      };
    });
  }

  // Build freshness set
  const recentSet = new Set(input.recentExerciseIds);

  // Filter catalog by experience-appropriate intensity
  let catalog = EXERCISE_CATALOG;
  if (tier === 3 && isBeginnerExperience(input.experience)) {
    catalog = catalog.filter((e) => e.intensity !== "high");
  }

  // Score each exercise
  const scored: ScoredExercise[] = catalog.map((entry) => {
    let rank = 0;

    if (tier === 1 || tier === 2) {
      const gap = getScoreGap(input.scores!, entry.scoreFields);
      const goal = tier === 1 ? goalMatchScore(entry.scoreFields, input.goals!) : 0;
      rank = tier === 1 ? gap * 0.6 + goal * 0.4 : gap;
    } else if (tier === 3) {
      rank = goalMatchScore(entry.scoreFields, input.goals!);
    }

    // Apply freshness multiplier
    const freshness = recentSet.has(entry.id) ? 0.5 : 1;
    rank *= freshness;

    // Small bonus for multi-target exercises (more efficient)
    if (entry.targets.length > 1 && !entry.targets.includes("all")) {
      rank += 0.05;
    }

    return { entry, rank };
  });

  // Sort by rank descending
  scored.sort((a, b) => b.rank - a.rank);

  // Take top N
  let picks = scored.slice(0, count);

  // Enforce variety
  picks = enforceVariety(picks, count, scored);

  // Generate reason text and return
  return picks.map((p) => ({
    exerciseId: p.entry.id,
    name: p.entry.name,
    reason: generateReason(p.entry, tier, input.scores, input.goals),
    targets: p.entry.targets,
    intensity: p.entry.intensity,
  }));
}

// ---------------------------------------------------------------------------
// Utility: compute focus areas summary from picks
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
