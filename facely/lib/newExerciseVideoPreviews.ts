import {
  NEW_EXERCISE_CATALOG,
  getNewExerciseInstruction as getInstructionById,
  getNewExerciseMeta as getMetaById,
  getNewExercisePoseLabels as getPoseLabelsById,
  getNewExerciseTimingLabel as getTimingLabelById,
  getNewExerciseTitle as getTitleById,
  type ExerciseMediaType,
} from "@/lib/newExerciseCatalog";

export type NewExerciseVideoPreview = {
  id: string;
  fileName: string;
  source: any;
  mediaType?: ExerciseMediaType;
  title?: string;
  guideId?: string;
};

export const NEW_EXERCISE_VIDEO_PREVIEWS: NewExerciseVideoPreview[] = NEW_EXERCISE_CATALOG.map((entry) => ({
  id: entry.id,
  fileName: entry.fileName,
  source: entry.source,
  mediaType: entry.mediaType,
  title: entry.title,
  guideId: entry.guideId,
}));

export function getNewExerciseTitle(exercise: NewExerciseVideoPreview): string {
  return getTitleById(exercise.id);
}

export function getNewExerciseInstruction(exercise: NewExerciseVideoPreview): string {
  return getInstructionById(exercise.id);
}

export function getNewExerciseTimingLabel(exercise: NewExerciseVideoPreview): string {
  return getTimingLabelById(exercise.id);
}

export function getNewExerciseMeta(exercise: NewExerciseVideoPreview): string {
  return getMetaById(exercise.id);
}

export function getNewExercisePoseLabels(exerciseId: string): string[] {
  return getPoseLabelsById(exerciseId);
}
