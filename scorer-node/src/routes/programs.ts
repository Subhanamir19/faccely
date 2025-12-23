import { Router } from "express";
import { z } from "zod";
import { ScoresSchema, type Scores } from "../validators.js";
import { ProgramSchema, type Program, type ProgramDay } from "../schemas/ProgramSchema.js";
import { generateProgramFromScores } from "../program/generateProgram.js";
import {
  getLatestProgram,
  getProgramById,
  getCompletions,
  saveProgram,
  upsertCompletion,
} from "../supabase/programs.js";
import { getScansForUser } from "../supabase/scans.js";

export const programsRouter = Router();

const GenerateBodySchema = z
  .object({
    scores: ScoresSchema.optional(),
  })
  .strict();

const CompletionBodySchema = z
  .object({
    day: z.number().int().min(1).max(70),
    exerciseId: z.string().min(1),
    completed: z.boolean(),
  })
  .strict();

function mapRecordToProgram(record: any): Program {
  const payload: Program = {
    programId: record.id,
    createdAt: record.created_at,
    version: record.version,
    scoresSnapshot: record.scores_snapshot as Scores,
    dayCount: Array.isArray(record.days) ? record.days.length : 70,
    exerciseCount: 5,
    days: record.days as ProgramDay[],
  };
  return ProgramSchema.parse(payload);
}

function mapCompletions(records: Awaited<ReturnType<typeof getCompletions>>) {
  const map: Record<string, boolean> = {};
  for (const row of records) {
    const key = `${row.program_id}:${row.day_number}:${row.exercise_id}`;
    map[key] = !!row.completed;
  }
  return map;
}

programsRouter.get("/current", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  try {
    const latest = await getLatestProgram(userId);
    if (!latest) {
      return res.status(404).json({ error: "program_not_found" });
    }
    const program = mapRecordToProgram(latest);
    const completions = await getCompletions(latest.id);
    return res.json({ program, completions: mapCompletions(completions) });
  } catch (err: any) {
    console.error("[/programs/current] failed", err?.message ?? err);
    return res.status(500).json({ error: "program_fetch_failed" });
  }
});

programsRouter.post("/", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  try {
    const parsed = GenerateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
    }

    let scores: Scores | null = parsed.data.scores ?? null;
    if (!scores) {
      const scans = await getScansForUser(userId, 1);
      if (!scans.length) {
        return res.status(404).json({ error: "no_history_scores" });
      }
      const rawScores = scans[0]?.scores;
      if (!rawScores || typeof rawScores !== "object") {
        return res.status(404).json({ error: "no_history_scores" });
      }
      const parseResult = ScoresSchema.safeParse(rawScores);
      if (!parseResult.success) {
        console.error("[/programs] invalid stored scores", parseResult.error.format());
        return res.status(422).json({ error: "invalid_stored_scores", details: parseResult.error.format() });
      }
      scores = parseResult.data;
    }

    const program = generateProgramFromScores(scores);
    const saved = await saveProgram(userId, program, { source: "history" });
    const normalized = {
      ...program,
      programId: saved.id,
      createdAt: saved.created_at,
    };
    const validated = ProgramSchema.parse(normalized);
    return res.status(201).json({ program: validated, completions: {} });
  } catch (err: any) {
    console.error("[/programs] generate failed", err?.message ?? err, err?.stack);
    return res.status(502).json({ error: "program_generation_failed", detail: err?.message });
  }
});

programsRouter.patch("/:programId/completions", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const programId = typeof req.params?.programId === "string" ? req.params.programId : "";
  if (!programId) return res.status(400).json({ error: "invalid_program_id" });

  const parsed = CompletionBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
  }

  try {
    const record = await getProgramById(userId, programId);
    if (!record) return res.status(404).json({ error: "program_not_found" });

    const program = mapRecordToProgram(record);
    const day = program.days.find((d) => d.dayNumber === parsed.data.day);
    const exists = day?.exercises?.some((e) => e.id === parsed.data.exerciseId);
    if (!exists) {
      return res.status(404).json({ error: "exercise_not_found" });
    }

    await upsertCompletion({
      userId,
      programId,
      dayNumber: parsed.data.day,
      exerciseId: parsed.data.exerciseId,
      completed: parsed.data.completed,
    });

    const completions = await getCompletions(programId);
    return res.json({ program, completions: mapCompletions(completions) });
  } catch (err: any) {
    console.error("[/programs/:id/completions] failed", err?.message ?? err);
    return res.status(500).json({ error: "program_completion_failed" });
  }
});
