// Exercise thumbnails shown in compact routine lists.
// The active catalogue lives in assets/new-exercises-videos; keep these
// thumbnails in that same folder so the UI reflects the exercises actually used.
import { getNewExerciseEntry, resolveExerciseId } from "@/lib/newExerciseCatalog";

const FALLBACK_ALL = require("../assets/new-exercises-videos/mewing.png");

export const EXERCISE_ICONS: Record<string, any> = {
  "alternating-cheek-puffs": require("../assets/new-exercises-videos/alternating-cheek-puffs-pose2.png"),
  "chi-ball-training": require("../assets/new-exercises-videos/chi-ball-training-pose2.png"),
  "chin-forcing-while-laying-down": require("../assets/new-exercises-videos/chin-forcing-while-laying-down-pose2.png"),
  "chin-massage": require("../assets/new-exercises-videos/chin-massage-pose2.png"),
  "chin-tucks-v2": require("../assets/new-exercises-videos/chin-tucks-pose2.png"),
  "asymmetry-chin-tucks": require("../assets/new-exercises-videos/downward-chin-forcing-pose2.png"),
  "downward-chin-forcing": require("../assets/new-exercises-videos/downward-chin-forcing-pose2.png"),
  "eyebrows-lifting": require("../assets/new-exercises-videos/eyebrows-lifting-pose2.png"),
  "fish-face-v2": require("../assets/new-exercises-videos/FISH-FACE-POSE2.png"),
  "forward-pulling-neck": require("../assets/new-exercises-videos/forward-pulling-neck-pose2.png"),
  "jaw-forcing": require("../assets/new-exercises-videos/jaw-forcing-pose2.png"),
  "mewing": require("../assets/new-exercises-videos/mewing.png"),
  "midface-lift": require("../assets/new-exercises-videos/midface-lift.png"),
  "neck-massage": require("../assets/new-exercises-videos/neck-massage-pose2.png"),
  "neck-pull": require("../assets/new-exercises-videos/neck-pull-pose2.png"),
  "orbicularis-muscles-eye": require("../assets/new-exercises-videos/orbicularis-muscles-eye-pose2.png"),
  "side-tongue": require("../assets/new-exercises-videos/side-tongue-pose2.png"),
  "slim-nose-side": require("../assets/new-exercises-videos/slim-nose-side-pose2.png"),
  "slim-nose1": require("../assets/new-exercises-videos/slim-nose1-pose2.png"),
  "slim-nose2": require("../assets/new-exercises-videos/slim-nose2-pose2.png"),
  "tongue-nose-touching": require("../assets/new-exercises-videos/tongue-nose-touching-pose2.png"),
  "upward-chin-stretch": require("../assets/new-exercises-videos/upward-chin-stretch-pose2.png"),
};

export function getExerciseIcon(exerciseId: string): any {
  const resolvedId = resolveExerciseId(exerciseId);
  const direct = EXERCISE_ICONS[resolvedId];
  if (direct) return direct;

  const entry = getNewExerciseEntry(resolvedId);
  if (entry) return EXERCISE_ICONS[entry.id] ?? FALLBACK_ALL;
  return FALLBACK_ALL;
}
