// facely/lib/exerciseDurations.ts
// Timer duration (in seconds) for each exercise.

export const EXERCISE_DURATIONS: Record<string, number> = {
  "jawline-1":               30,
  "alternating-cheek-puffs": 30,
  "chin-tucks":              30,
  "fish-face":               30,
  "gua-sha":                 120,
  "hunter-eyes-1":           30,
  "hunter-eyes-2":           30,
  "jaw-resistance":          45,
  "lymphatic-drainage":      60,
  "neck-lift-1":             30,
  "neck-lift-2":             30,
  "nose-massage":            30,
  "slim-nose-massage":       30,
  "neck-curls":              45,
  "towel-chewing":           60,
  "midface-exercise":        30,
  "lowerface-exercise":      45,
};

export function getExerciseDuration(exerciseId: string): number {
  return EXERCISE_DURATIONS[exerciseId] ?? 30;
}
