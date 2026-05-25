export type BaseScoreKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism";

export type AttractivenessPillarKey =
  | "angularity"
  | "harmony"
  | "structure"
  | "skin";

export type AttractivenessPillar = {
  key: AttractivenessPillarKey;
  label: string;
  score: number;
  tier: string;
  definition: string;
  drivers: string[];
  focus: string;
};

type WeightedInput = {
  key: BaseScoreKey;
  weight: number;
};

const FALLBACK_SCORE = 50;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return FALLBACK_SCORE;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weightedAverage(
  scores: Partial<Record<BaseScoreKey, number>>,
  inputs: WeightedInput[]
): number {
  let total = 0;
  let weightTotal = 0;

  for (const input of inputs) {
    const raw = scores[input.key];
    const value = typeof raw === "number" && Number.isFinite(raw)
      ? clampScore(raw)
      : FALLBACK_SCORE;
    total += value * input.weight;
    weightTotal += input.weight;
  }

  return clampScore(weightTotal > 0 ? total / weightTotal : FALLBACK_SCORE);
}

export function getAttractivenessTier(score: number): string {
  const s = clampScore(score);
  if (s >= 90) return "Elite";
  if (s >= 80) return "Strong";
  if (s >= 70) return "Balanced";
  if (s >= 60) return "Developing";
  if (s >= 45) return "Needs focus";
  return "Priority";
}

export function buildAttractivenessPillars(
  scores: Partial<Record<BaseScoreKey, number>>
): AttractivenessPillar[] {
  const pillars: Omit<AttractivenessPillar, "score" | "tier">[] = [
    {
      key: "angularity",
      label: "Facial Angularity",
      definition: "How sharp and sculpted your face reads at first glance.",
      drivers: ["Jawline", "Cheekbones", "Structure"],
      focus: "Improve lower-face definition and cheekbone contrast.",
    },
    {
      key: "harmony",
      label: "Facial Harmony",
      definition: "How well your features fit together as one balanced system.",
      drivers: ["Symmetry", "Eyes", "Nose balance"],
      focus: "Reduce the feature mismatch that pulls attention first.",
    },
    {
      key: "structure",
      label: "Facial Structure",
      definition: "How strong the underlying bone and contour signal appears.",
      drivers: ["Jaw strength", "Cheekbones", "Eye frame"],
      focus: "Build clearer lower-face and midface structure.",
    },
    {
      key: "skin",
      label: "Skin Quality",
      definition: "How clear, even, and smooth your skin reads in the scan.",
      drivers: ["Clarity", "Tone", "Texture"],
      focus: "Improve texture consistency and visible skin clarity.",
    },
  ];

  const pillarScores: Record<AttractivenessPillarKey, number> = {
    angularity: weightedAverage(scores, [
      { key: "jawline", weight: 0.45 },
      { key: "cheekbones", weight: 0.30 },
      { key: "sexual_dimorphism", weight: 0.15 },
      { key: "skin_quality", weight: 0.10 },
    ]),
    harmony: weightedAverage(scores, [
      { key: "facial_symmetry", weight: 0.30 },
      { key: "eyes_symmetry", weight: 0.20 },
      { key: "nose_harmony", weight: 0.20 },
      { key: "cheekbones", weight: 0.15 },
      { key: "jawline", weight: 0.15 },
    ]),
    structure: weightedAverage(scores, [
      { key: "sexual_dimorphism", weight: 0.40 },
      { key: "jawline", weight: 0.25 },
      { key: "cheekbones", weight: 0.20 },
      { key: "eyes_symmetry", weight: 0.15 },
    ]),
    skin: weightedAverage(scores, [
      { key: "skin_quality", weight: 1 },
    ]),
  };

  return pillars.map((pillar) => {
    const score = pillarScores[pillar.key];
    return {
      ...pillar,
      score,
      tier: getAttractivenessTier(score),
    };
  });
}

