// src/lib/api/routine.ts
import { z } from "zod";
import { API_BASE } from "./config";

/* ---------------------- Shared types & schemas ---------------------- */
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

const Task = z.object({
  headline: z.string(),
  category: z.string(),
  protocol: z.string(),
});
const Day = z.object({
  day: z.number().int().min(1).max(5),
  components: z.array(Task).length(5),
});
export const RoutineSchema = z.object({
  days: z.array(Day).length(5),
});
export type Routine = z.infer<typeof RoutineSchema>;

/* --------------------------- HTTP helper ---------------------------- */
const ROUTINE_URL = `${API_BASE}/routine`;
const FETCH_TIMEOUT_MS = 60_000;

let inflight = false;

function mapError(status: number): Error {
  if (status === 400 || status === 422) return new Error("validation_failed");
  if (status === 503) return new Error("retry_later");
  return new Error(`server_error:${status}`);
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return (error as { name?: string }).name === "AbortError";
}

/* ---------------------------- Public API ---------------------------- */
export async function fetchRoutine(
  scores: Scores,
  contextHint?: string
): Promise<Routine> {
  if (inflight) {
    throw new Error("inflight");
  }

  inflight = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const body = JSON.stringify({
      scores,
      context_hint: contextHint ?? null,
    });

    let res: Response;
    try {
      res = await fetch(ROUTINE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error("network_error:Aborted");
      }
      const message =
        error instanceof Error && error.message ? error.message : "unknown";
      throw new Error(`network_error:${message}`);
    }

    if (!res.ok) {
      throw mapError(res.status);
    }

    const json = await res.json();
    const parsed = RoutineSchema.safeParse(json);
    if (!parsed.success) {
      // keep it short; the UI can show a friendly toast
      throw new Error("routine_shape_invalid");
    }
    return parsed.data;
  } finally {
    inflight = false;
    clearTimeout(timeout);
  }
}
