// src/lib/api/routine.ts
import { z } from "zod";

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
const BASE =
  (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const URL = `${BASE}/routine`;

function mapError(status: number): Error {
  if (status === 400 || status === 422) return new Error("validation_failed");
  if (status === 503) return new Error("retry_later");
  return new Error(`server_error:${status}`);
}

/* ---------------------------- Public API ---------------------------- */
export async function fetchRoutine(
  scores: Scores,
  contextHint?: string
): Promise<Routine> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30_000);

  const body = JSON.stringify({
    scores,
    context_hint: contextHint ?? null,
  });

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: ac.signal,
  }).catch((e) => {
    throw new Error(`network_error:${e?.message || "unknown"}`);
  });
  clearTimeout(t);

  if (!res.ok) throw mapError(res.status);

  const json = await res.json();
  const parsed = RoutineSchema.safeParse(json);
  if (!parsed.success) {
    // keep it short; the UI can show a friendly toast
    throw new Error("routine_shape_invalid");
  }
  return parsed.data;
}
