import type { ImageStyle } from "react-native";

export const ADVANCED_ANALYSIS_FONT = "DINNextRounded-Regular";
export const ADVANCED_ANALYSIS_FONT_BOLD = "DINNextRounded-Bold";

export type AdvancedAnalysisIconId =
  | "cheekbones.width"
  | "cheekbones.maxilla"
  | "cheekbones.bone_structure"
  | "cheekbones.face_fat"
  | "cheekbones.fwhr"
  | "jawline.development"
  | "jawline.gonial_angle"
  | "jawline.projection"
  | "jawline.ramus"
  | "eyes.canthal_tilt"
  | "eyes.eye_type"
  | "eyes.brow_volume"
  | "eyes.symmetry"
  | "skin.color"
  | "skin.quality"
  | "haircut.density"
  | "haircut.styling"
  | "haircut.facial_hair";

export const ADVANCED_ANALYSIS_ICONS: Record<AdvancedAnalysisIconId, number> = {
  "cheekbones.width": require("../advanced-analysis-icons/newer-version/cheekbone-width-new.png"),
  "cheekbones.maxilla": require("../advanced-analysis-icons/newer-version/maxilla-new.png"),
  "cheekbones.bone_structure": require("../advanced-analysis-icons/newer-version/bonestructure-new.png"),
  "cheekbones.face_fat": require("../advanced-analysis-icons/newer-version/face-fat-new.png"),
  "cheekbones.fwhr": require("../advanced-analysis-icons/newer-version/fwhr-new.png"),
  "jawline.development": require("../advanced-analysis-icons/newer-version/jawline-development.png"),
  "jawline.gonial_angle": require("../advanced-analysis-icons/newer-version/gonial-angle-new.png"),
  "jawline.projection": require("../advanced-analysis-icons/newer-version/chin-projection-new.png"),
  "jawline.ramus": require("../advanced-analysis-icons/newer-version/ramus-new.png"),
  "eyes.canthal_tilt": require("../advanced-analysis-icons/newer-version/canthal-tilt.png"),
  "eyes.eye_type": require("../advanced-analysis-icons/newer-version/eye-type-new.png"),
  "eyes.brow_volume": require("../advanced-analysis-icons/newer-version/eyebrows-new.png"),
  "eyes.symmetry": require("../advanced-analysis-icons/newer-version/eye-symmetry.png"),
  "skin.color": require("../advanced-analysis-icons/newer-version/eye-color.png"),
  "skin.quality": require("../advanced-analysis-icons/newer-version/skin-quality.png"),
  "haircut.density": require("../advanced-analysis-icons/newer-version/hair-density.png"),
  "haircut.styling": require("../advanced-analysis-icons/newer-version/hair-styling.png"),
  "haircut.facial_hair": require("../advanced-analysis-icons/newer-version/facial-hair.png"),
};

type IconFit = {
  scale: number;
  translateX?: number;
  translateY?: number;
};

const DEFAULT_FIT: IconFit = { scale: 1 };

// These transparent PNGs have different alpha bounds. The scale values keep
// narrow/extra-padded illustrations visually balanced without changing the
// surrounding card layouts.
const ICON_FIT: Partial<Record<AdvancedAnalysisIconId, IconFit>> = {
  "cheekbones.maxilla": { scale: 1.26 },
  "cheekbones.bone_structure": { scale: 1.08 },
  "cheekbones.fwhr": { scale: 0.98 },
  "jawline.development": { scale: 1.06 },
  "jawline.gonial_angle": { scale: 1.06 },
  "jawline.projection": { scale: 1.02, translateX: 3 },
  "jawline.ramus": { scale: 1.2 },
  "eyes.eye_type": { scale: 1.22 },
  "eyes.brow_volume": { scale: 1.22, translateY: 2 },
  "eyes.symmetry": { scale: 1.36 },
  "skin.quality": { scale: 1.04 },
  "haircut.density": { scale: 0.9, translateY: 1 },
  "haircut.styling": { scale: 1.18, translateY: 6 },
  "haircut.facial_hair": { scale: 1.12, translateY: 3 },
};

export function getAdvancedAnalysisIcon(id: string): number | null {
  return ADVANCED_ANALYSIS_ICONS[id as AdvancedAnalysisIconId] ?? null;
}

export function getAdvancedAnalysisIconStyle(id: string): ImageStyle {
  const fit = ICON_FIT[id as AdvancedAnalysisIconId] ?? DEFAULT_FIT;
  const transform: Array<
    | { translateX: number }
    | { translateY: number }
    | { scale: number }
  > = [];

  if (fit.translateX) transform.push({ translateX: fit.translateX });
  if (fit.translateY) transform.push({ translateY: fit.translateY });
  if (fit.scale !== 1) transform.push({ scale: fit.scale });

  return transform.length > 0 ? { transform: transform as ImageStyle["transform"] } : {};
}
