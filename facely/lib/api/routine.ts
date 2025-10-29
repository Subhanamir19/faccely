// src/lib/api/routine.ts
import { z } from "zod";
import { API_BASE } from "./config";

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

const TaskSchema = z.object({
  headline: z.string(),
  category: z.string(),
  protocol: z.string(),
});
const DaySchema = z.object({
  day: z.number().int().positive(),
  components: z.array(TaskSchema).min(1),
});
export const RoutineSchema = z.object({
  routineId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  fetchedAt: z.string().datetime().optional(),
  days: z.array(DaySchema).min(1),
});
export type Routine = z.infer<typeof RoutineSchema>;

const ROUTINE_URL = `${API_BASE}/routine`;
const FETCH_TIMEOUT_MS = 60_000;
let inflight = false;

function isAbortError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if (typeof DOMException !== "undefined" && e instanceof DOMException) return e.name === "AbortError";
  return (e as any).name === "AbortError";
}

export async function fetchRoutine(scores: Scores, contextHint?: string): Promise<Routine> {
  if (inflight) throw new Error("inflight");
  inflight = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const body = JSON.stringify({ scores, context_hint: contextHint ?? null });

    const res = await fetch(ROUTINE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`validation_failed:${text.slice(0, 400)}`);
    }

    const json = await res.json();
    const parsed = RoutineSchema.safeParse(json);
    if (!parsed.success) throw new Error("routine_shape_invalid");

    const now = new Date().toISOString();
    return {
      ...parsed.data,
      fetchedAt: parsed.data.fetchedAt ?? now,
      startDate: parsed.data.startDate ?? now,
    };
  } catch (err) {
    if (isAbortError(err)) throw new Error("network_error:Aborted");
    const msg = err instanceof Error && err.message ? err.message : "unknown";
    throw new Error(`network_error:${msg}`);
  } finally {
    inflight = false;
    clearTimeout(timeout);
  }
}
