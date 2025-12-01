// facely/lib/api/routine.ts
import { z } from "zod";
import { API_BASE } from "./config";
import { requestJSON, DEFAULT_REQUEST_TIMEOUT_MS } from "./client";
import { buildAuthHeaders } from "./authHeaders";

export const ScoresSchema = z.object({
  jawline: z.number().min(0).max(100),
  facial_symmetry: z.number().min(0).max(100),
  skin_quality: z.number().min(0).max(100),
  cheekbones: z.number().min(0).max(100),
  eyes_symmetry: z.number().min(0).max(100),
  nose_harmony: z.number().min(0).max(100),
  sexual_dimorphism: z.number().min(0).max(100),
});
export type Scores = z.infer<typeof ScoresSchema>;

/**
 * Routine schema mirrors the backend's strict contract.
 * Keep in sync with scorer-node/src/schemas/RoutineSchema.ts.
 */
const TaskSchema = z
  .object({
    headline: z.string(),
    category: z.string(),
    protocol: z.string(),
  })
  .strict();

const DaySchema = z
  .object({
    day: z.number().int().min(1).max(15),
    components: z.array(TaskSchema).min(1).max(5),
  })
  .strict();

const RoutineSchema = z
  .object({
    routineId: z.string().uuid(),
    createdAt: z.string().datetime(),
    version: z.literal("v1"),
    dayCount: z.number().int().min(1).max(15),
    taskCount: z.number().int().min(1).max(5),
    days: z.array(DaySchema).min(1).max(15),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.days.length !== value.dayCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayCount"],
        message: `dayCount (${value.dayCount}) must equal days.length (${value.days.length}).`,
      });
    }

    const maxTasksPerDay = value.days.reduce(
      (max, day) => Math.max(max, day.components.length),
      0
    );
    if (maxTasksPerDay > value.taskCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taskCount"],
        message: `taskCount (${value.taskCount}) must be >= max components per day (${maxTasksPerDay}).`,
      });
    }
  });

type RoutineBase = z.infer<typeof RoutineSchema>;
export type Routine = RoutineBase & {
  /**
   * Client-only mirrors for local stores (never sent back to server).
   */
  fetchedAt?: string;
  startDate?: string;
};

const ROUTINE_URL = `${API_BASE}/routine`;
let inflight = false;

/**
 * Fetches a routine via the shared API client so retries/timeouts stay consistent.
 */
export async function fetchRoutine(
  scores: Scores,
  contextHint?: string
): Promise<Routine> {
  if (inflight) throw new Error("network_error:inflight");
  inflight = true;

  try {
    const body = JSON.stringify({ scores, context_hint: contextHint ?? null });
    const parsed = await requestJSON<RoutineBase>(ROUTINE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders({ includeLegacy: true }),
      },
      body,
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      context: "Routine request failed",
      schema: RoutineSchema,
    });
    const now = new Date().toISOString();
    return {
      ...parsed,
      fetchedAt: now,
      startDate: parsed.createdAt,
    };
  } finally {
    inflight = false;
  }
}
