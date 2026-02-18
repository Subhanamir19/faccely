/* Static mapping from exercise id -> task icon image.
 * Icons are grouped by target area (highlighted face region).
 * Keep ids in sync with backend generator (scorer-node/src/program/exerciseCatalog.ts).
 */

const ICON_JAWLINE = require("../assets/TASK-ICONS/JAWLINE.jpeg");
const ICON_CHEEKBONES = require("../assets/TASK-ICONS/CHEEKBONES.jpeg");
const ICON_EYES = require("../assets/TASK-ICONS/EYES.jpeg");
const ICON_NOSE = require("../assets/TASK-ICONS/NOSE.jpeg");
const ICON_EYES_CHEEKBONES = require("../assets/TASK-ICONS/face-eyes-cheekbones.jpeg");
const ICON_CHEEKBONES_JAWLINE = require("../assets/TASK-ICONS/face-cheekbones-jawline.jpeg");
const ICON_CHEEKBONES_JAWLINE_NOSE = require("../assets/TASK-ICONS/face-cheekbones-jawline-nose.jpeg");
const ICON_ALL = require("../assets/TASK-ICONS/face-all.jpeg");

export const EXERCISE_ICONS: Record<string, any> = {
  // Jawline only
  "chin-tucks": ICON_JAWLINE,
  "chin-tucks-with-head-tilt": ICON_JAWLINE,
  "upward-chewing": ICON_JAWLINE,
  "neck-lift": ICON_JAWLINE,
  "jaw-resistance": ICON_JAWLINE,
  "hyoid-stretch": ICON_JAWLINE,
  "sternocleidomastoid-stretch": ICON_JAWLINE,
  "neck-curls": ICON_JAWLINE,
  "resisted-jaw-openings": ICON_JAWLINE,

  // Cheekbones only
  "cps": ICON_CHEEKBONES,
  "alternating-cheek-puffs": ICON_CHEEKBONES,
  "cheekbone-knuckle-massage": ICON_CHEEKBONES,

  // Eyes only
  "hunter-eyes": ICON_EYES,

  // Nose only
  "nose-massage": ICON_NOSE,

  // Eyes + Cheekbones
  "eyes-and-cheeks": ICON_EYES_CHEEKBONES,

  // Cheekbones + Jawline
  "fish-face": ICON_CHEEKBONES_JAWLINE,
  "lion": ICON_CHEEKBONES_JAWLINE,

  // Cheekbones + Jawline + Nose
  "nose-tongue-touch": ICON_CHEEKBONES_JAWLINE_NOSE,

  // All areas
  "thumb-pulling": ICON_ALL,
  "lymphatic-drainage": ICON_ALL,
};

export function getExerciseIcon(exerciseId: string): any {
  return EXERCISE_ICONS[exerciseId] ?? ICON_ALL;
}
