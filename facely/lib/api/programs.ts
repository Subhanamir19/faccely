import { z } from "zod";
import { API_BASE } from "./config";
import { requestJSON, DEFAULT_REQUEST_TIMEOUT_MS } from "./client";
import { buildAuthHeadersAsync } from "./authHeaders";

const ProgramExerciseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    role: z.enum(["primary", "secondary", "universal", "support", "multi"]),
    intensity: z.enum(["high", "medium", "low"]),
    targets: z.array(z.string().min(1)).min(1),
    protocol: z.string(),
    durationSeconds: z.number().int(),
    order: z.number().int(),
    poseFrames: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ProgramDaySchema = z
  .object({
    dayNumber: z.number().int(),
    weekNumber: z.number().int(),
    phase: z.enum(["foundation", "development", "peak"]),
    focusAreas: z.array(z.string().min(1)).min(1),
    isRecovery: z.boolean(),
    exercises: z.array(ProgramExerciseSchema).length(5),
  })
  .strict();

const ProgramSchema = z
  .object({
    programId: z.string().uuid(),
    createdAt: z.string(),
    version: z.enum(["v1", "v2"]),
    scoresSnapshot: z.record(z.string(), z.any()),
    dayCount: z.number().int().min(1),
    exerciseCount: z.number().int().min(1),
    days: z.array(ProgramDaySchema),
  })
  .strict();

const ProgramResponseSchema = z.object({
  program: ProgramSchema,
  completions: z.record(z.string(), z.boolean()),
});

export type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
export type ProgramDay = z.infer<typeof ProgramDaySchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type ProgramResponse = z.infer<typeof ProgramResponseSchema>;

const PROGRAMS_BASE = `${API_BASE}/programs`;

export async function fetchCurrentProgram(): Promise<ProgramResponse> {
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  return requestJSON<ProgramResponse>(`${PROGRAMS_BASE}/current`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeaders,
    },
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    context: "Program fetch failed",
    schema: ProgramResponseSchema,
  });
}

export async function generateProgram(): Promise<ProgramResponse> {
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  return requestJSON<ProgramResponse>(PROGRAMS_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({}),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    context: "Program generation failed",
    schema: ProgramResponseSchema,
  });
}

export async function updateProgramCompletion(
  programId: string,
  day: number,
  exerciseId: string,
  completed: boolean
): Promise<ProgramResponse> {
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  return requestJSON<ProgramResponse>(`${PROGRAMS_BASE}/${encodeURIComponent(programId)}/completions`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ day, exerciseId, completed }),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    context: "Program completion update failed",
    schema: ProgramResponseSchema,
  });
}

/**
 * Best-effort sync of task completion to backend.
 * Non-blocking — the client-side tasks store is authoritative.
 */
export async function syncTaskCompletion(
  exerciseId: string,
  completed: boolean,
  date: string
): Promise<void> {
  try {
    const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
    await requestJSON(`${PROGRAMS_BASE}/task-completions`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ exerciseId, completed, date }),
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      context: "Task completion sync",
    });
  } catch (err) {
    // Non-blocking: log but don't throw
    console.warn("[tasks] Sync failed (non-blocking):", err);
  }
}
