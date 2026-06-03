import { getNewExerciseEntry } from "@/lib/newExerciseCatalog";

export function getExerciseVideo(exerciseId: string): any {
  const entry = getNewExerciseEntry(exerciseId);
  if (!entry) return null;
  if (entry.mediaType === "video") return entry.source;
  if (entry.mediaType === "videoSequence" && Array.isArray(entry.source)) return entry.source[0] ?? null;
  return null;
}

export function getExerciseMedia(exerciseId: string): {
  source: any;
  mediaType: "video" | "videoSequence" | "image" | "imageSequence";
} | null {
  const entry = getNewExerciseEntry(exerciseId);
  return entry ? { source: entry.source, mediaType: entry.mediaType } : null;
}
