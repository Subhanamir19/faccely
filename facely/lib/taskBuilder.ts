// facely/lib/taskBuilder.ts
// Builds the daily routine: facial exercises + targeted diet protocols.

import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import { selectDietProtocols } from "./dietProtocolCatalog";
import type { ProtocolType } from "./protocolCatalog";
import {
  selectDailyTasks,
  getExerciseById,
  type SelectionInput,
  type TaskPick,
  type ScoreField,
} from "./taskSelection";

export type RoutineTaskPick = TaskPick & {
  protocolType: "facial_exercise";
  overloadTier: number;
  overloadLabel: string;
};

/**
 * Build a RoutineTaskPick from a catalog exercise id. Used when the user
 * manually adds an exercise via the Edit sheet.
 */
export function makeRoutineTaskFromId(id: string): RoutineTaskPick | null {
  const e = getExerciseById(id);
  if (!e) return null;
  return {
    exerciseId: e.id,
    name: e.name,
    reason: "Added by you",
    targets: e.targets,
    intensity: e.intensity,
    protocolType: "facial_exercise",
    overloadTier: 0,
    overloadLabel: "Base",
  };
}

export type BuildInput = SelectionInput & {
  skinScore?: number | null;
};

export type ProtocolSelectionInput = {
  dateStr: string;
  scores: Partial<Record<ScoreField, number>> | null;
  goals: string[] | null;
  advanced?: AdvancedAnalysis | null;
  recentProtocolIds?: string[];
};

export type ProtocolPick = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  reason: string;
};

function computeOverloadTier(streak: number): number {
  if (streak >= 14) return 2;
  if (streak >= 7) return 1;
  return 0;
}

const OVERLOAD_LABELS = ["Base", "Week 2", "Week 4"] as const;

function getOverloadLabel(tier: number): string {
  return OVERLOAD_LABELS[tier] ?? "Base";
}

export function buildDailyProtocols(input: ProtocolSelectionInput): ProtocolPick[] {
  return selectDietProtocols(input);
}

export function buildDailyRoutine(input: BuildInput): RoutineTaskPick[] {
  const tier = computeOverloadTier(input.currentStreak);
  const label = getOverloadLabel(tier);
  const picks = selectDailyTasks(input);

  return picks.map((p) => ({
    ...p,
    protocolType: "facial_exercise" as const,
    overloadTier: tier,
    overloadLabel: label,
  }));
}
