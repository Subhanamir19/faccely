import { getNewExerciseEntry } from "@/lib/newExerciseCatalog";

export function getExerciseVideo(exerciseId: string): any {
  const entry = getNewExerciseEntry(exerciseId);
  if (!entry || entry.mediaType !== "video") return null;
  return entry.source;
}

export function getExerciseMedia(exerciseId: string): {
  source: any;
  mediaType: "video" | "image" | "imageSequence";
} | null {
  const entry = getNewExerciseEntry(exerciseId);
  return entry ? { source: entry.source, mediaType: entry.mediaType } : null;
}
