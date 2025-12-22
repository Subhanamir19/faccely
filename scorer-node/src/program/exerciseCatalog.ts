import { ProgramExercise } from "../schemas/ProgramSchema.js";

export const TARGET_AREAS = ["jawline", "cheekbones", "eyes", "nose"] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

export type ExerciseDef = ProgramExercise & {
  /** Stable, human-friendly id (used by frontend for asset lookups) */
  id: string;
};

type ExerciseSeed = {
  id: string;
  name: string;
  role: ProgramExercise["role"];
  intensity: ProgramExercise["intensity"];
  targets: TargetArea[];
  protocol: string;
  poseFrames: string[];
};

// Helper to coerce typed exercise objects into the shape the generator needs.
function buildExercise(seed: ExerciseSeed): ExerciseDef {
  return {
    ...seed,
    order: 0, // set later per-day
    durationSeconds: 30,
  };
}

export const EXERCISES: ExerciseDef[] = [
  buildExercise({
    id: "cps",
    name: "CPS",
    role: "primary",
    intensity: "high",
    targets: ["cheekbones"],
    protocol: "Keep spine neutral. Puff cheeks upward, hold 1s, release. 12 slow reps.",
    poseFrames: ["CPS-Pose1.png", "CPS-Pose2.jpeg"],
  }),
  buildExercise({
    id: "thumb-pulling",
    name: "Thumb pulling",
    role: "secondary",
    intensity: "medium",
    targets: ["cheekbones", "jawline", "eyes", "nose"],
    protocol: "Plant thumbs on upper palate, pull laterally for 1s, release. 10–12 controlled pulls.",
    poseFrames: ["Thumb pulling-Pose1.jpeg", "Thumb pulling-Pose2.jpeg", "Thumb pulling-Pose3.jpeg"],
  }),
  buildExercise({
    id: "chin-tucks",
    name: "Chin tucks",
    role: "primary",
    intensity: "medium",
    targets: ["jawline"],
    protocol: "Back against wall, tuck chin straight back, hold 3s, release. 10 reps.",
    poseFrames: ["Chin tucks-Pose1.jpeg", "Chin tucks-Pose2.jpeg"],
  }),
  buildExercise({
    id: "hunter-eyes",
    name: "Hunter eyes 1",
    role: "primary",
    intensity: "medium",
    targets: ["eyes"],
    protocol: "Relax brow, gently squint lower eyelids, hold 2s, release. 12 reps.",
    poseFrames: ["Hunter eyes 1-Pose1.jpeg", "Hunter eyes 1-Pose2.jpeg"],
  }),
  buildExercise({
    id: "hyoid-stretch",
    name: "Hyoid stretch",
    role: "support",
    intensity: "low",
    targets: ["jawline"],
    protocol: "Place fingers on hyoid, tilt chin up slightly, glide fingers downward for 10s. Repeat 3x.",
    poseFrames: ["Hyoid stretch-Pose1.jpeg", "Hyoid stretch-Pose2.jpeg", "Hyoid stretch-Pose3.jpeg"],
  }),
  buildExercise({
    id: "lymphatic-drainage",
    name: "Lymphatic drainage",
    role: "universal",
    intensity: "low",
    targets: ["jawline", "cheekbones", "eyes", "nose"],
    protocol: "Light sweeping strokes from center face to ears/collarbone, 60s continuous flow.",
    poseFrames: ["Lymphatic drainage exercise-Pose1.jpeg", "Lymphatic drainage exercise-Pose2.jpeg"],
  }),
  buildExercise({
    id: "upward-chewing",
    name: "Upward chewing",
    role: "secondary",
    intensity: "high",
    targets: ["jawline"],
    protocol: "Close lips, lift chin slightly, mimic chewing upward for 30s with slow, even tempo.",
    poseFrames: ["Upward chewing-Pose1.jpeg", "Upward chewing-Pose2.jpeg"],
  }),
  buildExercise({
    id: "neck-lift",
    name: "Neck lift",
    role: "support",
    intensity: "medium",
    targets: ["jawline"],
    protocol: "Supine, lift head 2–3 inches, hold 3s, lower with control. 8–10 reps.",
    poseFrames: ["Neck lift-Pose1.jpeg", "Neck lift-Pose2.jpeg"],
  }),
  buildExercise({
    id: "jaw-resistance",
    name: "Jaw resistance",
    role: "primary",
    intensity: "high",
    targets: ["jawline"],
    protocol: "Palm under chin, press up while gently opening mouth, hold 2s, close. 10 reps.",
    poseFrames: ["Jaw resistance-Pose1.jpeg", "Jaw resistance-Pose2.jpeg"],
  }),
  buildExercise({
    id: "eyes-and-cheeks",
    name: "Eyes and cheeks",
    role: "primary",
    intensity: "medium",
    targets: ["eyes", "cheekbones"],
    protocol: "Smile softly, lift lower eyelids, hold 2s, release. 12 slow reps.",
    poseFrames: ["Eyes and cheeks-Pose1.jpeg", "Eyes and cheeks-Pose2.jpeg"],
  }),
  buildExercise({
    id: "alternating-cheek-puffs",
    name: "Alternating cheek puffs",
    role: "primary",
    intensity: "medium",
    targets: ["cheekbones"],
    protocol: "Fill one cheek with air, hold 2s, switch sides smoothly. 12–14 total switches.",
    poseFrames: ["Alternating cheek puffs-Pose1.jpeg", "Alternating cheek puffs-Pose2.jpeg"],
  }),
  buildExercise({
    id: "nose-massage",
    name: "Nose massage",
    role: "primary",
    intensity: "medium",
    targets: ["nose"],
    protocol: "Use index fingers to glide down nasal bridge with light pressure, 30s continuous.",
    poseFrames: ["Nose massage-Pose1.jpeg", "Nose massage-Pose2.jpeg"],
  }),
  buildExercise({
    id: "sternocleidomastoid-stretch",
    name: "Sternocleidomastoid stretch",
    role: "support",
    intensity: "low",
    targets: ["jawline"],
    protocol: "Tilt ear to shoulder, rotate chin up, hold 10s each side, repeat 2x per side.",
    poseFrames: ["Sternocleidomastoid stretch-Pose1.jpeg", "Sternocleidomastoid stretch-Pose2.jpeg"],
  }),
  buildExercise({
    id: "nose-tongue-touch",
    name: "Nose tongue touch",
    role: "secondary",
    intensity: "medium",
    targets: ["cheekbones", "jawline", "nose"],
    protocol: "Lift tongue toward nose tip without jutting chin, hold 1s, release. 12 reps.",
    poseFrames: ["Nose touching with tongue-Pose1.jpeg", "Nose touching with tongue-Pose2.jpeg"],
  }),
  buildExercise({
    id: "fish-face",
    name: "Fish face",
    role: "universal",
    intensity: "low",
    targets: ["cheekbones", "jawline"],
    protocol: "Suck in cheeks, hold 2s, smile lightly while held, release. 12 reps.",
    poseFrames: ["Fish face-Pose1.jpeg", "Fish face-Pose2.jpeg"],
  }),
];

export const EXERCISES_BY_ROLE = {
  primary: EXERCISES.filter((e) => e.role === "primary"),
  secondary: EXERCISES.filter((e) => e.role === "secondary"),
  universal: EXERCISES.filter((e) => e.role === "universal"),
  support: EXERCISES.filter((e) => e.role === "support"),
  multi: EXERCISES.filter((e) => e.targets.length > 1 || e.role === "secondary"),
};

export function byTargets(area: TargetArea, role?: ExerciseDef["role"]): ExerciseDef[] {
  return EXERCISES.filter((e) => e.targets.includes(area) && (!role || e.role === role));
}

export const HIGH_INTENSITY_IDS = new Set(["jaw-resistance", "cps", "upward-chewing"]);
export const MEDIUM_INTENSITY_IDS = new Set([
  "chin-tucks",
  "hunter-eyes",
  "nose-massage",
  "thumb-pulling",
  "eyes-and-cheeks",
  "alternating-cheek-puffs",
  "nose-tongue-touch",
  "neck-lift",
]);
