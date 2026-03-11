// facely/lib/taskBuilder.ts
// Builds the daily routine — 5 facial exercises, score-driven selection.
// Protocols are handled separately in the Protocols tab.

import {
  selectDailyTasks,
  type SelectionInput,
  type TaskPick,
} from "./taskSelection";

export type RoutineTaskPick = TaskPick & {
  protocolType: "facial_exercise";
  overloadTier: number;   // 0 = base, 1 = week 2, 2 = week 4
  overloadLabel: string;  // "Base" | "Week 2" | "Week 4"
};

export type BuildInput = SelectionInput & {
  skinScore?: number | null;
};

// ---------------------------------------------------------------------------
// Progressive overload tier (UI label only — no logic change needed)
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
// Main builder — returns exactly 5 exercises
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
