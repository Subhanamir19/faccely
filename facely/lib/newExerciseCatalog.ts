import type { Scores } from "@/lib/api/scores";
import { getExerciseDetail } from "@/lib/exerciseDetails";
import { getExerciseGuide } from "@/lib/exerciseGuideData";

export type ExerciseScoreField = keyof Scores;
export type ExerciseTargetArea = "jawline" | "cheekbones" | "eyes" | "nose" | "skin" | "all";
export type ExerciseIntensity = "high" | "medium" | "low";
export type ExerciseMediaType = "video" | "videoSequence" | "image" | "imageSequence";

export type NewExerciseCatalogEntry = {
  id: string;
  title: string;
  fileName: string;
  source: any;
  mediaType: ExerciseMediaType;
  guideId: string;
  poseLabels?: string[];
  targets: ExerciseTargetArea[];
  intensity: ExerciseIntensity;
  scoreFields: ExerciseScoreField[];
  weight: number;
  defaultDuration: number;
  movementFamily: string;
  instruction: string;
};

const ALL_SCORE_FIELDS: ExerciseScoreField[] = [
  "jawline",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "facial_symmetry",
  "skin_quality",
  "sexual_dimorphism",
];

export const NEW_EXERCISE_CATALOG: NewExerciseCatalogEntry[] = [
  {
    id: "alternating-cheek-puffs",
    title: "Alternating Cheek Puffs",
    fileName: "alternating-cheek-puffs-.mp4",
    source: require("../assets/new-exercises-videos/alternating-cheek-puffs-.mp4"),
    mediaType: "video",
    guideId: "alternating-cheek-puffs",
    targets: ["cheekbones"],
    intensity: "medium",
    scoreFields: ["cheekbones", "facial_symmetry"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "cheek-puffs",
    instruction: "Seal your lips, fill one cheek with air, then push the air to the other cheek without opening your mouth.",
  },
  {
    id: "chi-ball-training",
    title: "Chin Ball Training",
    fileName: "chi-ball-training.mp4",
    source: require("../assets/new-exercises-videos/chi-ball-training.mp4"),
    mediaType: "video",
    guideId: "chin-training",
    targets: ["jawline"],
    intensity: "medium",
    scoreFields: ["jawline", "sexual_dimorphism"],
    weight: 7,
    defaultDuration: 45,
    movementFamily: "chin-resistance",
    instruction: "Place the ball under your chin, press your chin down into it, then release with control while keeping your shoulders low.",
  },
  {
    id: "chin-forcing-while-laying-down",
    title: "Lying Chin Forcing",
    fileName: "chin-forcing-while-laying-down .mp4",
    source: require("../assets/new-exercises-videos/chin-forcing-while-laying-down .mp4"),
    mediaType: "video",
    guideId: "neck-curls",
    targets: ["jawline"],
    intensity: "high",
    scoreFields: ["jawline", "sexual_dimorphism"],
    weight: 4,
    defaultDuration: 45,
    movementFamily: "neck-strength",
    instruction: "Lie on your back, tuck your chin slightly, lift your head a few inches, then lower it slowly.",
  },
  {
    id: "chin-massage",
    title: "Chin Massage",
    fileName: "chin-massage.mp4",
    source: require("../assets/new-exercises-videos/chin-massage.mp4"),
    mediaType: "video",
    guideId: "lymphatic-drainage",
    targets: ["jawline", "all"],
    intensity: "low",
    scoreFields: ALL_SCORE_FIELDS,
    weight: 7,
    defaultDuration: 60,
    movementFamily: "lymphatic-massage",
    instruction: "Place both thumbs under your chin and glide outward along the jawline toward the ears with even pressure.",
  },
  {
    id: "chin-tucks-v2",
    title: "Chin Tucks V2",
    fileName: "chin-tucks-pose1.png + chin-tucks-pose2.png",
    source: [
      require("../assets/new-exercises-videos/chin-tucks-pose1.png"),
      require("../assets/new-exercises-videos/chin-tucks-pose2.png"),
    ],
    mediaType: "imageSequence",
    guideId: "chin-tucks",
    targets: ["jawline"],
    intensity: "medium",
    scoreFields: ["jawline"],
    weight: 7,
    defaultDuration: 30,
    movementFamily: "chin-tuck",
    instruction: "Keep your eyes level, slide your chin straight backward to make a double chin, pause, then return to neutral.",
  },
  {
    id: "asymmetry-chin-tucks",
    title: "Asymmetry Chin Tucks",
    fileName: "chin tucks for assymetry pose 1.mp4 + downward-chin-forcing.mp4",
    source: [
      require("../assets/new-exercises-videos/chin tucks for assymetry pose 1.mp4"),
      require("../assets/new-exercises-videos/downward-chin-forcing.mp4"),
    ],
    mediaType: "videoSequence",
    guideId: "chin-tucks-with-head-tilt",
    poseLabels: ["Pose 1 - Asymmetry Chin Tuck", "Pose 2 - Downward Chin Forcing"],
    targets: ["jawline"],
    intensity: "medium",
    scoreFields: ["facial_symmetry"],
    weight: 7,
    defaultDuration: 60,
    movementFamily: "asymmetry-chin-tuck",
    instruction: "Start with the asymmetry chin tuck, then move into the downward chin press with slow, even control.",
  },
  {
    id: "downward-chin-forcing",
    title: "Downward Chin Forcing",
    fileName: "downward-chin-forcing.mp4",
    source: require("../assets/new-exercises-videos/downward-chin-forcing.mp4"),
    mediaType: "video",
    guideId: "chin-tucks",
    targets: ["jawline"],
    intensity: "medium",
    scoreFields: ["jawline", "sexual_dimorphism"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "chin-resistance",
    instruction: "Place your fingers under your chin, press the chin downward against your fingers, then release slowly.",
  },
  {
    id: "eyebrows-lifting",
    title: "Eyebrows Lifting",
    fileName: "eyebrows-lifting.mp4",
    source: require("../assets/new-exercises-videos/eyebrows-lifting.mp4"),
    mediaType: "video",
    guideId: "hunter-eyes-1",
    targets: ["eyes"],
    intensity: "medium",
    scoreFields: ["eyes_symmetry"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "eye-lift",
    instruction: "Place fingertips above your brows, gently hold the skin, then lift your eyebrows upward and relax.",
  },
  {
    id: "fish-face-v2",
    title: "Fish Face V2",
    fileName: "FISH-FACE-POSE1.png + FISH-FACE-POSE2.png",
    source: [
      require("../assets/new-exercises-videos/FISH-FACE-POSE1.png"),
      require("../assets/new-exercises-videos/FISH-FACE-POSE2.png"),
    ],
    mediaType: "imageSequence",
    guideId: "fish-face",
    targets: ["cheekbones", "jawline"],
    intensity: "low",
    scoreFields: ["cheekbones", "jawline"],
    weight: 7,
    defaultDuration: 30,
    movementFamily: "cheek-sculpt",
    instruction: "Suck both cheeks inward, keep your lips lightly pursed, hold the fish-face shape, then release.",
  },
  {
    id: "forward-pulling-neck",
    title: "Forward Pulling Neck",
    fileName: "forward-pulling-neck.mp4",
    source: require("../assets/new-exercises-videos/forward-pulling-neck.mp4"),
    mediaType: "video",
    guideId: "neck-lift-2",
    targets: ["jawline"],
    intensity: "medium",
    scoreFields: ["jawline"],
    weight: 5,
    defaultDuration: 30,
    movementFamily: "neck-extension",
    instruction: "Keep your shoulders down, glide your head and neck forward, pause briefly, then pull back to neutral.",
  },
  {
    id: "jaw-forcing",
    title: "Jaw Forcing",
    fileName: "jaw-forcing.mp4",
    source: require("../assets/new-exercises-videos/jaw-forcing.mp4"),
    mediaType: "video",
    guideId: "jaw-resistance",
    targets: ["jawline"],
    intensity: "high",
    scoreFields: ["jawline", "sexual_dimorphism"],
    weight: 4,
    defaultDuration: 45,
    movementFamily: "jaw-resistance",
    instruction: "Place your fist or palm under your jaw, open slightly against resistance, then close with control.",
  },
  {
    id: "mewing",
    title: "Mewing",
    fileName: "mewing.png",
    source: require("../assets/new-exercises-videos/mewing.png"),
    mediaType: "image",
    guideId: "mewing",
    targets: ["jawline", "cheekbones", "nose"],
    intensity: "low",
    scoreFields: ["jawline", "cheekbones", "nose_harmony", "facial_symmetry"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "tongue-posture",
    instruction: "Rest your full tongue against the roof of your mouth, close your lips, and breathe through your nose.",
  },
  {
    id: "midface-lift",
    title: "Midface Lift",
    fileName: "midface-lift.png",
    source: require("../assets/new-exercises-videos/midface-lift.png"),
    mediaType: "image",
    guideId: "midface-exercise",
    targets: ["cheekbones", "nose"],
    intensity: "medium",
    scoreFields: ["cheekbones", "nose_harmony", "facial_symmetry"],
    weight: 7,
    defaultDuration: 30,
    movementFamily: "midface-lift",
    instruction: "Place fingertips beside the nose or upper cheeks, press upward gently, and hold the lifted position.",
  },
  {
    id: "neck-massage",
    title: "Neck Massage",
    fileName: "neck-massage.mp4",
    source: require("../assets/new-exercises-videos/neck-massage.mp4"),
    mediaType: "video",
    guideId: "lymphatic-drainage",
    targets: ["jawline", "all"],
    intensity: "low",
    scoreFields: ALL_SCORE_FIELDS,
    weight: 7,
    defaultDuration: 60,
    movementFamily: "lymphatic-massage",
    instruction: "Use both hands to stroke from under the jaw down the sides of the neck toward the collarbone.",
  },
  {
    id: "neck-pull",
    title: "Neck Pull",
    fileName: "neck-pull.mp4",
    source: require("../assets/new-exercises-videos/neck-pull.mp4"),
    mediaType: "video",
    guideId: "sternocleidomastoid-stretch",
    targets: ["jawline"],
    intensity: "low",
    scoreFields: ["jawline"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "neck-mobility",
    instruction: "Hold one side of your neck or shoulder area, tilt your head away, and keep the stretch gentle.",
  },
  {
    id: "orbicularis-muscles-eye",
    title: "Orbicularis Eye Muscles",
    fileName: "orbicularis-muscles-eye.mp4",
    source: require("../assets/new-exercises-videos/orbicularis-muscles-eye.mp4"),
    mediaType: "video",
    guideId: "hunter-eyes-2",
    targets: ["eyes"],
    intensity: "medium",
    scoreFields: ["eyes_symmetry"],
    weight: 5,
    defaultDuration: 30,
    movementFamily: "eye-squint",
    instruction: "Place fingers near the outer eye area, softly squint the lower eyelids, then relax without wrinkling your forehead.",
  },
  {
    id: "side-tongue",
    title: "Side Tongue Stretch",
    fileName: "side-tongue.mp4",
    source: require("../assets/new-exercises-videos/side-tongue.mp4"),
    mediaType: "video",
    guideId: "side-tongue",
    targets: ["cheekbones", "nose"],
    intensity: "medium",
    scoreFields: ["cheekbones", "nose_harmony", "facial_symmetry"],
    weight: 5,
    defaultDuration: 30,
    movementFamily: "tongue-posture",
    instruction: "Close your lips, press your tongue into one cheek, hold briefly, then switch to the other side.",
  },
  {
    id: "slim-nose-side",
    title: "Slim Nose Side",
    fileName: "slim-nose-side.mp4",
    source: require("../assets/new-exercises-videos/slim-nose-side.mp4"),
    mediaType: "video",
    guideId: "nose-massage",
    targets: ["nose"],
    intensity: "low",
    scoreFields: ["nose_harmony"],
    weight: 5,
    defaultDuration: 30,
    movementFamily: "nose-slimming",
    instruction: "Place a fingertip on the side of your nose, massage downward in small controlled strokes, then switch sides.",
  },
  {
    id: "slim-nose1",
    title: "Slim Nose 1",
    fileName: "slim-nose1.mp4",
    source: require("../assets/new-exercises-videos/slim-nose1.mp4"),
    mediaType: "video",
    guideId: "slim-nose-massage",
    targets: ["nose"],
    intensity: "medium",
    scoreFields: ["nose_harmony"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "nose-slimming",
    instruction: "Place both index fingers beside the nose bridge and glide downward with light, even pressure.",
  },
  {
    id: "slim-nose2",
    title: "Slim Nose 2",
    fileName: "slim-nose2.mp4",
    source: require("../assets/new-exercises-videos/slim-nose2.mp4"),
    mediaType: "video",
    guideId: "slim-nose-massage",
    targets: ["nose"],
    intensity: "medium",
    scoreFields: ["nose_harmony"],
    weight: 6,
    defaultDuration: 30,
    movementFamily: "nose-slimming",
    instruction: "Place fingertips on both sides of the nose and trace down the bridge together with symmetrical pressure.",
  },
  {
    id: "tongue-nose-touching",
    title: "Tongue Nose Touching",
    fileName: "tongue-nose-touching.mp4",
    source: require("../assets/new-exercises-videos/tongue-nose-touching.mp4"),
    mediaType: "video",
    guideId: "nose-tongue-touch",
    targets: ["jawline", "cheekbones", "nose"],
    intensity: "low",
    scoreFields: ["jawline", "cheekbones", "nose_harmony", "facial_symmetry"],
    weight: 7,
    defaultDuration: 30,
    movementFamily: "tongue-posture",
    instruction: "Open your mouth slightly, extend your tongue upward toward the nose, hold briefly, then relax.",
  },
  {
    id: "upward-chin-stretch",
    title: "Upward Chin Stretch",
    fileName: "upward-chin-stretch .mp4",
    source: require("../assets/new-exercises-videos/upward-chin-stretch .mp4"),
    mediaType: "video",
    guideId: "chin-stretch",
    targets: ["jawline"],
    intensity: "high",
    scoreFields: ["jawline", "sexual_dimorphism"],
    weight: 4,
    defaultDuration: 45,
    movementFamily: "chin-stretch",
    instruction: "Tilt your head upward, push the lower lip forward, feel the chin stretch, then return slowly.",
  },
];

export const LEGACY_EXERCISE_ID_MAP: Record<string, string> = {
  "jawline-1": "neck-pull",
  "chin-tucks": "chin-tucks-v2",
  "fish-face": "fish-face-v2",
  "gua-sha": "neck-massage",
  "hunter-eyes-1": "eyebrows-lifting",
  "hunter-eyes-2": "orbicularis-muscles-eye",
  "jaw-resistance": "jaw-forcing",
  "lymphatic-drainage": "chin-massage",
  "neck-lift-1": "forward-pulling-neck",
  "neck-lift-2": "forward-pulling-neck",
  "nose-massage": "slim-nose-side",
  "slim-nose-massage": "slim-nose1",
  "neck-curls": "chin-forcing-while-laying-down",
  "towel-chewing": "jaw-forcing",
  "chin-training": "chi-ball-training",
  "midface-exercise": "midface-lift",
  "lowerface-exercise": "downward-chin-forcing",
  "chin-stretch": "upward-chin-stretch",
  "neck-stretch": "neck-pull",
  "tongue-touching": "tongue-nose-touching",
  "nose-tongue-touch": "tongue-nose-touching",
  "side-tongue": "side-tongue",
};

const CATALOG_BY_ID = new Map(NEW_EXERCISE_CATALOG.map((entry) => [entry.id, entry]));

const TARGET_LABELS: Record<ExerciseTargetArea, string> = {
  jawline: "Jawline",
  cheekbones: "Cheekbones",
  eyes: "Eyes",
  nose: "Nose",
  skin: "Skin",
  all: "Full face",
};

function formatTargetAreas(targets: ExerciseTargetArea[]) {
  if (targets.includes("all")) return TARGET_LABELS.all;
  const uniqueTargets = Array.from(new Set(targets));
  return uniqueTargets.map((target) => TARGET_LABELS[target]).join(" + ");
}

function formatIntensity(intensity: ExerciseIntensity) {
  return intensity.charAt(0).toUpperCase() + intensity.slice(1);
}

export function resolveExerciseId(exerciseId: string): string {
  return CATALOG_BY_ID.has(exerciseId) ? exerciseId : LEGACY_EXERCISE_ID_MAP[exerciseId] ?? exerciseId;
}

export function isLegacyExerciseId(exerciseId: string): boolean {
  return !!LEGACY_EXERCISE_ID_MAP[exerciseId];
}

export function getLegacyIdsForExercise(exerciseId: string): string[] {
  const resolved = resolveExerciseId(exerciseId);
  return Object.entries(LEGACY_EXERCISE_ID_MAP)
    .filter(([, nextId]) => nextId === resolved)
    .map(([legacyId]) => legacyId);
}

export function getNewExerciseEntry(exerciseId: string): NewExerciseCatalogEntry | undefined {
  return CATALOG_BY_ID.get(resolveExerciseId(exerciseId));
}

export function getNewExerciseTitle(exerciseId: string): string {
  return getNewExerciseEntry(exerciseId)?.title ?? exerciseId;
}

export function getNewExerciseInstruction(exerciseId: string): string {
  const entry = getNewExerciseEntry(exerciseId);
  if (!entry) return "";
  const detail = getExerciseDetail(entry.guideId);
  const guide = getExerciseGuide(entry.guideId);
  return entry.instruction ?? guide?.howTo[0] ?? guide?.tips[0] ?? detail?.benefits ?? "";
}

export function getNewExerciseTimingLabel(exerciseId: string): string {
  const entry = getNewExerciseEntry(exerciseId);
  if (!entry) return "";
  const detail = getExerciseDetail(entry.guideId);
  const guide = getExerciseGuide(entry.guideId);
  return guide?.holdTime ?? detail?.reps ?? `${entry.defaultDuration}s`;
}

export function getNewExerciseMeta(exerciseId: string): string {
  const entry = getNewExerciseEntry(exerciseId);
  if (!entry) return "";
  return `${formatTargetAreas(entry.targets)} - ${entry.defaultDuration}s set - ${formatIntensity(entry.intensity)}`;
}

export function getNewExercisePoseLabels(exerciseId: string): string[] {
  return getNewExerciseEntry(exerciseId)?.poseLabels ?? [];
}

export function getNewExerciseGuideId(exerciseId: string): string {
  return getNewExerciseEntry(exerciseId)?.guideId ?? resolveExerciseId(exerciseId);
}
