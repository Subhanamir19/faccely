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
};

export const FALLBACK_FRAME = require("../assets/analysis-images/facial_symmetry.jpg");
