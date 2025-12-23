import { z } from "zod";
import { ScoresSchema } from "../validators.js";

export const ProgramExerciseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.enum(["primary", "secondary", "universal", "support", "multi"]),
    intensity: z.enum(["high", "medium", "low"]),
    targets: z.array(z.string().min(1)).min(1),
    protocol: z.string().min(1),
    durationSeconds: z.number().int().positive(),
    order: z.number().int().min(1),
    poseFrames: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const ProgramDaySchema = z
  .object({
    dayNumber: z.number().int().min(1).max(70),
    weekNumber: z.number().int().min(1),
    phase: z.enum(["foundation", "development", "peak"]),
    focusAreas: z.array(z.string().min(1)).min(1),
    isRecovery: z.boolean(),
    exercises: z.array(ProgramExerciseSchema).length(5),
  })
  .strict();

export const ProgramSchema = z
  .object({
    programId: z.string().uuid(),
    createdAt: z.string().datetime(),
    version: z.enum(["v1", "v2"]),
    scoresSnapshot: ScoresSchema,
    dayCount: z.number().int().min(70).max(70),
    exerciseCount: z.number().int().min(5).max(6),
    days: z.array(ProgramDaySchema).length(70),
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

    const maxExercises = value.days.reduce(
      (max, d) => Math.max(max, d.exercises.length),
      0
    );
    if (maxExercises > value.exerciseCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exerciseCount"],
        message: `exerciseCount (${value.exerciseCount}) must cover max per-day exercises (${maxExercises}).`,
      });
    }
  });

export type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
export type ProgramDay = z.infer<typeof ProgramDaySchema>;
export type Program = z.infer<typeof ProgramSchema>;
