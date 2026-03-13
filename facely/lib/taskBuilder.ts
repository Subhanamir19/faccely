// facely/lib/taskBuilder.ts
// Builds the daily routine — 5 facial exercises, score-driven selection.
// Also selects 2 daily protocols (1 lifestyle + 1 dietary) based on UTC date.

import {
  selectDailyTasks,
  type SelectionInput,
  type TaskPick,
} from "./taskSelection";
import { PROTOCOL_CATALOG, type ProtocolType } from "./protocolCatalog";

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

// ---------------------------------------------------------------------------
// Daily protocol selection — 1 lifestyle + 1 dietary, deterministic from date
// ---------------------------------------------------------------------------

export type ProtocolPick = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  reason: string;
};

const DAILY_LIFESTYLE_IDS = [
  "sprint-session",
  "facial-icing",
  "high-intensity-exercise",
] as const;

const DAILY_DIETARY_IDS = [
  "lemon-electrolytes",
  "egg-yolk-banana",
  "black-raisins",
  "raw-banana",
  "beef-liver",
  "red-meat",
  "unsalted-cheese",
  "ashwagandha",
  "raw-milk",
] as const;

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export function buildDailyProtocols(dateStr: string): ProtocolPick[] {
  const day = dayOfYear(dateStr);
  const lifestyleId = DAILY_LIFESTYLE_IDS[day % DAILY_LIFESTYLE_IDS.length];
  const dietaryId   = DAILY_DIETARY_IDS[day % DAILY_DIETARY_IDS.length];
  return [lifestyleId, dietaryId].map((id) => {
    const entry = PROTOCOL_CATALOG.find((p) => p.id === id)!;
    return { id: entry.id, name: entry.name, type: entry.type, quantity: entry.quantity, reason: entry.reason };
  });
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
