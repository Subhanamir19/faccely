export type MetricKey =
  | "jawline" | "facial_symmetry" | "skin_quality" | "cheekbones"
  | "eyes_symmetry" | "nose_harmony" | "sexual_dimorphism";

export type Scores = Record<MetricKey, number>;

export const METRIC_LABELS: Record<MetricKey, string> = {
  jawline: "Jawline",
  facial_symmetry: "Facial symmetry",
  skin_quality: "Skin quality",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eyes symmetry",
  nose_harmony: "Nose harmony",
  sexual_dimorphism: "Sexual dimorphism",
};

export const ORDER: MetricKey[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

export const isScores = (x: any): x is Scores =>
  x &&
  ORDER.every(
    (k) => typeof x[k] === "number" && x[k] >= 0 && x[k] <= 100
  );
