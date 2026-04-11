// facely/lib/exerciseVideos.ts
// Static mapping from exercise id → bundled video asset.

export const EXERCISE_VIDEOS: Record<string, any> = {
  "jawline-1":               require("../excercise-videos/Jawline-1.mp4"),
  "alternating-cheek-puffs": require("../excercise-videos/alternating-cheek-puffs.mp4"),
  "chin-tucks":              require("../excercise-videos/chin tucks.mp4"),
  "fish-face":               require("../excercise-videos/fish-face.mp4"),
  "gua-sha":                 require("../excercise-videos/gua-sha.mp4"),
  "hunter-eyes-1":           require("../excercise-videos/hunter eyes-1.mp4"),
  "hunter-eyes-2":           require("../excercise-videos/hunter eyes-2 .mp4"),
  "jaw-resistance":          require("../excercise-videos/jaw resistance.mp4"),
  "lymphatic-drainage":      require("../excercise-videos/jawline massage.mp4"),
  "neck-lift-1":             require("../excercise-videos/neck-lift.mp4"),
  "neck-lift-2":             require("../excercise-videos/neck-lift-jawline.mp4"),
  "nose-massage":            require("../excercise-videos/nose-massage.mp4"),
  "slim-nose-massage":       require("../excercise-videos/nosefat-slimnose.mp4"),
  "neck-curls":              require("../excercise-videos/strong-kneck-jawlinebuilding.mp4"),
  "towel-chewing":           require("../excercise-videos/towel-chewing.mp4"),
  "chin-training":           require("../excercise-videos/chin-training.mp4"),
};

export function getExerciseVideo(exerciseId: string): any {
  return EXERCISE_VIDEOS[exerciseId] ?? null;
}
