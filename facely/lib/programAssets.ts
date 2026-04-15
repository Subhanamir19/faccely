/* Static mapping from exercise id -> bundled pose frames.
 * Keep ids in sync with backend generator (scorer-node/src/program/exerciseCatalog.ts).
 */

export const POSE_FRAMES: Record<string, any[]> = {
  "cps": [require("../aligned_exercises/CPS-Pose1.png"), require("../aligned_exercises/CPS-Pose2.jpeg")],
  "thumb-pulling": [
    require("../aligned_exercises/Thumb pulling-Pose1.jpeg"),
    require("../aligned_exercises/Thumb pulling-Pose2.jpeg"),
    require("../aligned_exercises/Thumb pulling-Pose3.jpeg"),
  ],
  "chin-tucks": [
    require("../aligned_exercises/Chin tucks-Pose1.jpeg"),
    require("../aligned_exercises/Chin tucks-Pose2.jpeg"),
  ],
  "hunter-eyes": [
    require("../aligned_exercises/Hunter eyes 1-Pose1.jpeg"),
    require("../aligned_exercises/Hunter eyes 1-Pose2.jpeg"),
  ],
  "hyoid-stretch": [
    require("../aligned_exercises/Hyoid stretch-Pose1.jpeg"),
    require("../aligned_exercises/Hyoid stretch-Pose2.jpeg"),
    require("../aligned_exercises/Hyoid stretch-Pose3.jpeg"),
  ],
  "lymphatic-drainage": [
    require("../aligned_exercises/Lymphatic drainage exercise-Pose1.jpeg"),
    require("../aligned_exercises/Lymphatic drainage exercise-Pose2.jpeg"),
  ],
  "upward-chewing": [
    require("../aligned_exercises/Upward chewing-Pose1.jpeg"),
    require("../aligned_exercises/Upward chewing-Pose2.jpeg"),
  ],
  "neck-lift": [
    require("../aligned_exercises/Neck lift-Pose1.jpeg"),
    require("../aligned_exercises/Neck lift-Pose2.jpeg"),
  ],
  "jaw-resistance": [
    require("../aligned_exercises/Jaw resistance-Pose1.jpeg"),
    require("../aligned_exercises/Jaw resistance-Pose2.jpeg"),
  ],
  "eyes-and-cheeks": [
    require("../aligned_exercises/Eyes and cheeks-Pose1.jpeg"),
    require("../aligned_exercises/Eyes and cheeks-Pose2.jpeg"),
  ],
  "alternating-cheek-puffs": [
    require("../aligned_exercises/Alternating cheek puffs-Pose1.jpeg"),
    require("../aligned_exercises/Alternating cheek puffs-Pose2.jpeg"),
  ],
  "nose-massage": [
    require("../aligned_exercises/Nose massage-Pose1.jpeg"),
    require("../aligned_exercises/Nose massage-Pose2.jpeg"),
  ],
  "sternocleidomastoid-stretch": [
    require("../aligned_exercises/Sternocleidomastoid stretch-Pose1.jpeg"),
    require("../aligned_exercises/Sternocleidomastoid stretch-Pose2.jpeg"),
  ],
  "nose-tongue-touch": [
    require("../aligned_exercises/Nose touching with tongue-Pose1.jpeg"),
    require("../aligned_exercises/Nose touching with tongue-Pose2.jpeg"),
  ],
  "fish-face": [
    require("../aligned_exercises/Fish face-Pose1.jpeg"),
    require("../aligned_exercises/Fish face-Pose2.jpeg"),
  ],
  "cheekbone-knuckle-massage": [
    require("../aligned_exercises/Cheekbone knuckle massage-Pose1.jpeg"),
    require("../aligned_exercises/Cheekbone knuckle massage-Pose2.jpeg"),
  ],
  "neck-curls": [
    require("../aligned_exercises/Neck curls-Pose1.jpeg"),
    require("../aligned_exercises/Neck curls-Pose2.jpeg"),
  ],
  "resisted-jaw-openings": [
    require("../aligned_exercises/Resisted jaw openings-Pose1.jpeg"),
    require("../aligned_exercises/Resisted jaw openings-Pose2.jpeg"),
  ],
  "chin-tucks-with-head-tilt": [
    require("../aligned_exercises/Chin tucks with head tilt-Pose1.jpeg"),
    require("../aligned_exercises/Chin tucks with head tilt-Pose2.jpeg"),
  ],
  "lowerface-exercise": [
    require("../excercise-videos/lowerface-pose1.jpeg"),
    require("../excercise-videos/lowerface-pose2.jpeg"),
  ],
  "midface-exercise": [
    require("../excercise-videos/midface-exercise.jpeg"),
  ],
  "chin-stretch": [
    require("../aligned_exercises/chin-stretch-Pose1.jpeg"),
    require("../aligned_exercises/chin-stretch-Pose2.jpeg"),
  ],
  "neck-stretch": [
    require("../aligned_exercises/Neck stretch-Pose1.jpeg"),
    require("../aligned_exercises/Neck stretch-Pose2.jpeg"),
    require("../aligned_exercises/Neck stretch-Pose3.jpeg"),
  ],
  "tongue-touching": [
    require("../aligned_exercises/Tongue touching-Pose1.jpeg"),
    require("../aligned_exercises/Tongue touching-Pose2.jpeg"),
  ],
  "side-tongue": [
    require("../aligned_exercises/Side tongue-Pose1.jpeg"),
    require("../aligned_exercises/Side tongue-Pose2.jpeg"),
  ],
};

// Aliases for renamed exercise IDs — reuse existing frames where available
// New exercises (jawline-1, hunter-eyes-2, neck-lift-2, slim-nose-massage,
// towel-chewing, gua-sha) have no frames yet — will fall back to FALLBACK_FRAME.
(POSE_FRAMES as any)["hunter-eyes-1"]  = POSE_FRAMES["hunter-eyes"];
(POSE_FRAMES as any)["neck-lift-1"]    = POSE_FRAMES["neck-lift"];

export const FALLBACK_FRAME = require("../assets/analysis-images/facial_symmetry.jpg");
