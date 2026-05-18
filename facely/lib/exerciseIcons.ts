// Static mapping from exercise id → task icon (area-based placeholder until
// per-exercise pose images are added).
import { getNewExerciseEntry } from "@/lib/newExerciseCatalog";

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

  // Chin
  "chin-training":      ICON_JAWLINE,

  // Chin / Neck / Tongue
  "chin-stretch":       ICON_JAWLINE,
  "neck-stretch":       ICON_JAWLINE,
  "tongue-touching":    ICON_CHEEKBONES_JAWLINE,
  "side-tongue":        ICON_CHEEKBONES,

  // New video catalogue
  "neck-pull": ICON_JAWLINE,
  "chin-tucks-v2": ICON_JAWLINE,
  "fish-face-v2": ICON_CHEEKBONES_JAWLINE,
  "eyebrows-lifting": ICON_EYES,
  "orbicularis-muscles-eye": ICON_EYES,
  "jaw-forcing": ICON_JAWLINE,
  "chin-massage": ICON_ALL,
  "neck-massage": ICON_ALL,
  "forward-pulling-neck": ICON_JAWLINE,
  "slim-nose-side": ICON_NOSE,
  "slim-nose1": ICON_NOSE,
  "slim-nose2": ICON_NOSE,
  "chin-forcing-while-laying-down": ICON_JAWLINE,
  "chi-ball-training": ICON_JAWLINE,
  "midface-lift": ICON_CHEEKBONES,
  "downward-chin-forcing": ICON_JAWLINE,
  "upward-chin-stretch": ICON_JAWLINE,
  "tongue-nose-touching": ICON_CHEEKBONES_JAWLINE,
  "mewing": ICON_CHEEKBONES_JAWLINE,
};

export function getExerciseIcon(exerciseId: string): any {
  const direct = EXERCISE_ICONS[exerciseId];
  if (direct) return direct;

  const entry = getNewExerciseEntry(exerciseId);
  if (entry?.targets.includes("eyes")) return ICON_EYES;
  if (entry?.targets.includes("nose")) return ICON_NOSE;
  if (entry?.targets.includes("cheekbones") && entry.targets.includes("jawline")) return ICON_CHEEKBONES_JAWLINE;
  if (entry?.targets.includes("cheekbones")) return ICON_CHEEKBONES;
  if (entry?.targets.includes("jawline")) return ICON_JAWLINE;
  return ICON_ALL;
}
