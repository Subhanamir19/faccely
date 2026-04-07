// Static mapping from exercise id → task icon (area-based placeholder until
// per-exercise pose images are added).

const ICON_JAWLINE            = require("../assets/TASK-ICONS/JAWLINE.jpeg");
const ICON_CHEEKBONES         = require("../assets/TASK-ICONS/CHEEKBONES.jpeg");
const ICON_EYES               = require("../assets/TASK-ICONS/EYES.jpeg");
const ICON_NOSE               = require("../assets/TASK-ICONS/NOSE.jpeg");
const ICON_CHEEKBONES_JAWLINE = require("../assets/TASK-ICONS/face-cheekbones-jawline.jpeg");
const ICON_ALL                = require("../assets/TASK-ICONS/face-all.jpeg");

export const EXERCISE_ICONS: Record<string, any> = {
  // Jawline
  "jawline-1":      ICON_CHEEKBONES_JAWLINE,
  "chin-tucks":     ICON_JAWLINE,
  "jaw-resistance": ICON_JAWLINE,
  "neck-lift-1":    ICON_JAWLINE,
  "neck-lift-2":    ICON_JAWLINE,
  "neck-curls":     ICON_JAWLINE,
  "towel-chewing":  ICON_CHEEKBONES_JAWLINE,

  // Cheekbones
  "alternating-cheek-puffs": ICON_CHEEKBONES,
  "fish-face":      ICON_CHEEKBONES_JAWLINE,

  // Eyes
  "hunter-eyes-1":  ICON_EYES,
  "hunter-eyes-2":  ICON_EYES,

  // Nose
  "nose-massage":      ICON_NOSE,
  "slim-nose-massage": ICON_NOSE,

  // All areas
  "lymphatic-drainage": ICON_ALL,
  "gua-sha":            ICON_ALL,

  // Midface & Lower Face
  "midface-exercise":   ICON_CHEEKBONES,
  "lowerface-exercise": ICON_JAWLINE,
};

export function getExerciseIcon(exerciseId: string): any {
  return EXERCISE_ICONS[exerciseId] ?? ICON_ALL;
}
