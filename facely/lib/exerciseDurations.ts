import { getNewExerciseEntry, resolveExerciseId } from "@/lib/newExerciseCatalog";

export function getExerciseDuration(exerciseId: string): number {
  return getNewExerciseEntry(resolveExerciseId(exerciseId))?.defaultDuration ?? 30;
}
