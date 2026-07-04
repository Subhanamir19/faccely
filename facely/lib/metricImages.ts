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
  jawline:           require("../assets/scoring-images/jawline.png"),
  facial_symmetry:   require("../assets/scoring-images/symmetry.png"),
  skin_quality:      require("../assets/scoring-images/skin-quality.png"),
  cheekbones:        require("../assets/scoring-images/cheekbones.png"),
  eyes_symmetry:     require("../assets/scoring-images/eyearea-vector.png"),
  nose_harmony:      require("../assets/scoring-images/nose-vector.png"),
  sexual_dimorphism: require("../assets/scoring-images/masculanity.png"),
};
