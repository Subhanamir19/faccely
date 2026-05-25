import type { DailyTask } from "@/store/tasks";
import type { TargetArea } from "@/lib/taskSelection";

export type RoutineFocus = "lowerFace" | "midface" | "eyeArea" | "fullFace";

export type RoutineFocusCopy = {
  label: string;
  phrase: string;
  intro: string;
  benefitHeadline: string;
  benefitBody: string;
  building: string;
  ready: string;
};

export type RoutineFocusContent = RoutineFocusCopy & {
  key: RoutineFocus;
  image: any;
};

const PREVIEW_IMAGES: Record<RoutineFocus, any> = {
  lowerFace: require("../assets/preview-screen-images/lower-face.png"),
  midface: require("../assets/preview-screen-images/midface.png"),
  eyeArea: require("../assets/preview-screen-images/eye-area.png"),
  fullFace: require("../assets/preview-screen-images/full-face.png"),
};

const COPY: Record<RoutineFocus, RoutineFocusCopy> = {
  lowerFace: {
    label: "Lower Face",
    phrase: "lower face",
    intro: "We are about to sculpt your lower face today",
    benefitHeadline: "Today builds a cleaner lower face.",
    benefitBody: "Each rep supports sharper jawline posture and tighter under-chin control.",
    building: "Building your lower face routine",
    ready: "Your routine is ready!",
  },
  midface: {
    label: "Midface",
    phrase: "midface",
    intro: "We are about to lift your midface today",
    benefitHeadline: "Today builds stronger midface support.",
    benefitBody: "Each rep supports cheek lift, softer folds, and better facial balance.",
    building: "Building your midface routine",
    ready: "Your routine is ready!",
  },
  eyeArea: {
    label: "Eye Area",
    phrase: "eye area",
    intro: "We are about to train your eye area today",
    benefitHeadline: "Today wakes up your eye area.",
    benefitBody: "Each rep supports a more lifted, alert look without overworking the face.",
    building: "Building your eye area routine",
    ready: "Your routine is ready!",
  },
  fullFace: {
    label: "Full Face",
    phrase: "full face",
    intro: "We are about to train your full face today",
    benefitHeadline: "Today balances your full face.",
    benefitBody: "Each rep supports multiple areas so the routine feels complete, not random.",
    building: "Building your full face routine",
    ready: "Your routine is ready!",
  },
};

const MAJOR_AREAS: TargetArea[] = ["jawline", "cheekbones", "eyes", "nose", "skin"];

function focusFromAreas(areas: TargetArea[]): RoutineFocus {
  const unique = Array.from(new Set(areas.filter((area) => area !== "all")));
  if (areas.includes("all") || unique.length >= 3 || unique.includes("skin")) return "fullFace";
  if (unique.includes("eyes")) return "eyeArea";
  if (unique.includes("cheekbones") || unique.includes("nose")) return "midface";
  if (unique.includes("jawline")) return "lowerFace";
  return "fullFace";
}

export function resolveRoutineFocus(
  tasks: Pick<DailyTask, "targets">[],
  selectedAreas?: TargetArea[] | null,
): RoutineFocus {
  if (selectedAreas && selectedAreas.length > 0) return focusFromAreas(selectedAreas);

  const counts = new Map<TargetArea, number>();
  for (const task of tasks) {
    for (const target of task.targets) {
      counts.set(target as TargetArea, (counts.get(target as TargetArea) ?? 0) + 1);
    }
  }

  const activeMajorAreas = MAJOR_AREAS.filter((area) => (counts.get(area) ?? 0) > 0);
  if ((counts.get("all") ?? 0) > 0 || activeMajorAreas.length >= 3 || (counts.get("skin") ?? 0) > 0) {
    return "fullFace";
  }

  const ranked = activeMajorAreas.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  return focusFromAreas(ranked.slice(0, 1));
}

export function getRoutineFocusContent(
  tasks: Pick<DailyTask, "targets">[],
  selectedAreas?: TargetArea[] | null,
): RoutineFocusContent {
  const key = resolveRoutineFocus(tasks, selectedAreas);
  return {
    key,
    image: PREVIEW_IMAGES[key],
    ...COPY[key],
  };
}

