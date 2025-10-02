export const metricImage: Record<
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism",
  any
> = {
  jawline:           require("../assets/analysis-images/jawline.jpg"),
  facial_symmetry:   require("../assets/analysis-images/facial_symmetry.jpg"),
  skin_quality:      require("../assets/analysis-images/skin_quality.jpg"),
  cheekbones:        require("../assets/analysis-images/cheekbones.jpg"),
  eyes_symmetry:     require("../assets/analysis-images/eyes_symmetry.jpg"),
  nose_harmony:      require("../assets/analysis-images/nose_harmony.jpg"),
  sexual_dimorphism: require("../assets/analysis-images/sexual_dimorphism.jpg"),
};
