// scorer-node/src/routes/routine.ts
import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";

import { RoutineSchema } from "../schemas/RoutineSchema.js";
import { generateRoutine } from "../utils/generateRoutine.js";
import { ScoresSchema } from "../validators.js";

export const router = Router();

let openaiClient: OpenAI | undefined;
export function setRoutineOpenAIClient(o: OpenAI) {
  openaiClient = o;
}


const RequestSchema = z.object({
  scores: ScoresSchema,
  context_hint: z.string().optional(),
}).strict();

router.post("/", async (req, res) => {
  console.log("[/routine] start");
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
  }
  try {
    const data = await generateRoutine(parsed.data.scores, parsed.data.context_hint, openaiClient ?? undefined);
    if (!data || !Array.isArray(data.days)) {
      throw new Error("invalid routine payload");
    }

    const days = data.days;
    const routinePayload = {
      routineId: randomUUID(),
      createdAt: new Date().toISOString(),
      version: "v1" as const,
      dayCount: days.length,
      taskCount: days.reduce(
        (max, day) => Math.max(max, Array.isArray(day.components) ? day.components.length : 0),
        0
      ),
      days,
    };

    const validated = RoutineSchema.parse(routinePayload);
    console.log("[/routine] success");
    return res.status(200).json(validated);
  } catch (err: any) {
    console.log("[/routine] fail", err?.message || err);
    return res.status(502).json({ error: "routine_generation_failed", detail: err?.message || "unknown" });
  }
});
