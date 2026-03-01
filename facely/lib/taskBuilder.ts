// facely/lib/taskBuilder.ts
// Builds the full daily routine — facial exercises + protocol add-ons.
// Wraps the existing weighted exercise selection and appends habit protocols.

import {
  selectDailyTasks,
  type SelectionInput,
  type TaskPick,
  type ScoreField,
} from "./taskSelection";
import { PROTOCOL_CATALOG, type ProtocolEntry, type ProtocolType } from "./protocolCatalog";

export type { ProtocolType };

// ---------------------------------------------------------------------------
// Extended pick type — adds protocol metadata to the base TaskPick
// ---------------------------------------------------------------------------

export type RoutineTaskPick = TaskPick & {
  protocolType: ProtocolType | "facial_exercise";
  overloadTier: number;   // 0 = base, 1 = week 2, 2 = week 4
  overloadLabel: string;  // "Base" | "Week 2" | "Week 4"
};

export type BuildInput = SelectionInput & {
  skinScore?: number | null;
};

// ---------------------------------------------------------------------------
// Progressive overload — tier based on current streak
// ---------------------------------------------------------------------------

function computeOverloadTier(streak: number): number {
  if (streak >= 14) return 2;
  if (streak >= 7) return 1;
  return 0;
}

const OVERLOAD_LABELS = ["Base", "Week 2", "Week 4"] as const;

function getOverloadLabel(tier: number): string {
  return OVERLOAD_LABELS[tier] ?? "Base";
}

// ---------------------------------------------------------------------------
// Protocol trigger evaluation
// ---------------------------------------------------------------------------

function isTriggered(
  p: ProtocolEntry,
  scores: Partial<Record<ScoreField, number>> | null,
  goals: string[] | null,
  skinScore: number | null | undefined,
): boolean {
  if (p.always) return true;
  if (p.scoreTrigger) {
    const raw =
      p.scoreTrigger.field === "skin_quality"
        ? (skinScore ?? scores?.skin_quality ?? null)
        : (scores?.[p.scoreTrigger.field] ?? null);
    if (typeof raw === "number" && raw < p.scoreTrigger.below) return true;
  }
  if (p.goalTrigger && Array.isArray(goals)) {
    if (p.goalTrigger.some((g) => goals.includes(g))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Protocol → RoutineTaskPick conversion
// ---------------------------------------------------------------------------

function protocolToRoutinePick(p: ProtocolEntry, tier: number): RoutineTaskPick {
  return {
    exerciseId: p.id,
    name: p.name,
    reason: p.reason,
    targets: p.targets,
    intensity: "low",
    protocolType: p.type,
    overloadTier: tier,
    overloadLabel: getOverloadLabel(tier),
  };
}

// ---------------------------------------------------------------------------
// Exercise → RoutineTaskPick conversion
// ---------------------------------------------------------------------------

function exerciseToRoutinePick(p: TaskPick, tier: number): RoutineTaskPick {
  return {
    ...p,
    protocolType: "facial_exercise",
    overloadTier: tier,
    overloadLabel: getOverloadLabel(tier),
  };
}

// ---------------------------------------------------------------------------
// Select protocol add-ons
// Type ordering: lifestyle → skincare → dietary (variety-first)
// Dietary protocols rotate by day-of-week so users see different options daily.
// ---------------------------------------------------------------------------

const PROTOCOL_TYPE_ORDER: ProtocolType[] = ["lifestyle", "skincare", "dietary"];

function selectProtocols(input: BuildInput, maxCount: number): RoutineTaskPick[] {
  const tier = computeOverloadTier(input.currentStreak);
  const dayOfWeek = new Date().getDay(); // 0–6

  const eligible = PROTOCOL_CATALOG.filter((p) =>
    isTriggered(p, input.scores, input.goals, input.skinScore),
  );

  // Group by type
  const byType = new Map<ProtocolType, ProtocolEntry[]>();
  for (const p of eligible) {
    const arr = byType.get(p.type) ?? [];
    arr.push(p);
    byType.set(p.type, arr);
  }

  const result: RoutineTaskPick[] = [];
  for (const type of PROTOCOL_TYPE_ORDER) {
    if (result.length >= maxCount) break;
    const pool = byType.get(type);
    if (!pool?.length) continue;
    // Rotate dietary by day; pick first for other types
    const pick = type === "dietary" ? pool[dayOfWeek % pool.length] : pool[0];
    result.push(protocolToRoutinePick(pick, tier));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildDailyRoutine(input: BuildInput): RoutineTaskPick[] {
  const tier = computeOverloadTier(input.currentStreak);

  // 1. Facial exercises — scored and weighted by the selection algorithm
  const picks = selectDailyTasks(input);
  const exercises = picks.map((p) => exerciseToRoutinePick(p, tier));

  // 2. Protocol add-ons — 2 per day, one variety-pick per type
  const protocols = selectProtocols(input, 2);

  return [...exercises, ...protocols];
}
