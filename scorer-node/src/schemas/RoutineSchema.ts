// scorer-node/src/schemas/RoutineSchema.ts
import { z } from "zod";

export const RoutineComponentSchema = z.object({
  headline: z.string(),
  category: z.string(),
  protocol: z.string(),
}).strict();

export const RoutineDaySchema = z.object({
  day: z.number().int().min(1).max(5),
  components: z.array(RoutineComponentSchema).length(5),
}).strict();

export const RoutineSchema = z.object({
  days: z.array(RoutineDaySchema).length(5),
}).strict();

export type RoutineComponent = z.infer<typeof RoutineComponentSchema>;
export type RoutineDay = z.infer<typeof RoutineDaySchema>;
export type Routine = z.infer<typeof RoutineSchema>;
