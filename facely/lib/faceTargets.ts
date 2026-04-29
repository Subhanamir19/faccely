// Face target → image / label / intensity helpers shared by the Daily tab
// preview screen and the workout card. Extracted from app/(tabs)/program.tsx
// so both surfaces stay in lockstep.

import type { DailyTask } from "@/store/tasks";

export const CARD_FACE_IMAGES: Record<string, any> = {
  cheekbones: require("../assets/analysis-image-new/midface-vector.png"),
  jawline:    require("../assets/analysis-image-new/lower-face-vector.png"),
  eyes:       require("../assets/analysis-image-new/eyearea-vector.png"),
  nose:       require("../assets/analysis-image-new/nose-vector.png"),
  skin:       require("../assets/analysis-image-new/fullface-vector.png"),
  all:        require("../assets/analysis-image-new/fullface-vector.png"),
};

export const CARD_FACE_LABELS: Record<string, string> = {
  jawline:    "Lower Face",
  cheekbones: "Midface",
  eyes:       "Eye Area",
  nose:       "Nose",
  skin:       "Skin",
  all:        "Full Face",
};

export const CARD_FACE_FOCUS: Record<string, string> = {
  cheekbones: "center 42%",
  jawline:    "center 62%",
  eyes:       "center 26%",
  skin:       "center 36%",
};

export function resolveCardTarget(tasks: { targets: string[] }[]): string {
  const counts: Record<string, number> = {};
  const priority = ["jawline", "cheekbones", "eyes", "skin"];
  for (const task of tasks) {
    for (const t of task.targets) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  for (const p of priority) {
    if (counts[p]) return p;
  }
  return "cheekbones";
}

export function aggregateIntensity(tasks: DailyTask[]): "high" | "medium" | "low" {
  if (!tasks.length) return "medium";
  const counts = { high: 0, medium: 0, low: 0 };
  for (const t of tasks) counts[t.intensity] = (counts[t.intensity] ?? 0) + 1;
  if (counts.high >= 3) return "high";
  if (counts.low >= 3)  return "low";
  return "medium";
}

export function intensityBoostPct(intensity: "high" | "medium" | "low"): number {
  return intensity === "high" ? 3 : intensity === "low" ? 1 : 2;
}
