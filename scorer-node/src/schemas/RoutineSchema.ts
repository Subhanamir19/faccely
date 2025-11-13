import { z } from "zod";

export const RoutineComponentSchema = z
  .object({
    headline: z.string(),
    category: z.string(),
    protocol: z.string(),
  })
  .strict();

export const RoutineDaySchema = z
  .object({
    day: z.number().int().min(1).max(15),
    components: z.array(RoutineComponentSchema).min(1).max(5),
  })
  .strict();

export const RoutineSchema = z
  .object({
    routineId: z.string().uuid(),
    createdAt: z.string().datetime(),
    version: z.literal("v1"),
    dayCount: z.number().int().min(1).max(15),
    taskCount: z.number().int().min(1).max(5),
    days: z.array(RoutineDaySchema).min(1).max(15),
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

    const maxTasksPerDay = value.days.reduce((max, day) => Math.max(max, day.components.length), 0);
    if (maxTasksPerDay > value.taskCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taskCount"],
        message: `taskCount (${value.taskCount}) must be >= max components per day (${maxTasksPerDay}).`,
      });
    }
  });

export type RoutineComponent = z.infer<typeof RoutineComponentSchema>;
export type RoutineDay = z.infer<typeof RoutineDaySchema>;
export type Routine = z.infer<typeof RoutineSchema>;
