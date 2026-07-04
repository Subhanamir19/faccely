import type {
  DashboardMetric,
  LatestAdvanced,
} from "@/lib/api/insights";

export type NextFocusCategory =
  | "Hormone Support"
  | "Structure"
  | "Soft Tissue"
  | "Eyes"
  | "Skin"
  | "Grooming"
  | "Lifestyle";

export type NextFocusRecommendation = {
  id: string;
  rank: number;
  title: string;
  category: NextFocusCategory;
  action: string;
  reason: string;
  evidence: string;
  score: number;
};

type MetricLookup = Record<string, DashboardMetric | undefined>;

type Signal = {
  key: string;
  weight: number;
  source: "score" | "advanced";
};

type RecommendationDef = {
  id: string;
  title: string;
  category: NextFocusCategory;
  action: string;
  reason: string;
  signals: Signal[];
  baseWeight: number;
};

type AdvancedLookup = Record<string, number | undefined>;

export type SelectNextFocusInput = {
  scanId: string | null;
  metrics: DashboardMetric[];
  latestAdvanced: LatestAdvanced | null;
  previousAdvanced?: LatestAdvanced | null;
  limit?: number;
};

const RECOMMENDATION_LIBRARY: RecommendationDef[] = [
  {
    id: "testosterone-support",
    title: "Testosterone Support",
    category: "Hormone Support",
    action: "Prioritize training, recovery, protein, and mineral support.",
    reason: "This supports stronger facial-structure cues without claiming a measured hormone level.",
    signals: [
      { source: "score", key: "sexual_dimorphism", weight: 1 },
      { source: "advanced", key: "jawline.development", weight: 0.45 },
      { source: "advanced", key: "jawline.projection", weight: 0.25 },
    ],
    baseWeight: 0.86,
  },
  {
    id: "control-estrogen-signals",
    title: "Control Estrogen Signals",
    category: "Hormone Support",
    action: "Focus on leanness, sleep consistency, and lower-puffiness habits.",
    reason: "Selected when softer lower-face or puffiness markers are more visible.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 1 },
      { source: "score", key: "sexual_dimorphism", weight: 0.55 },
      { source: "advanced", key: "jawline.development", weight: 0.35 },
    ],
    baseWeight: 0.74,
  },
  {
    id: "igf1-support",
    title: "Increase IGF-1 Support",
    category: "Hormone Support",
    action: "Anchor meals around animal protein, minerals, and recovery.",
    reason: "Useful when structure-building markers are the bigger bottleneck.",
    signals: [
      { source: "advanced", key: "cheekbones.maxilla", weight: 0.9 },
      { source: "advanced", key: "cheekbones.bone_structure", weight: 0.7 },
      { source: "advanced", key: "jawline.ramus", weight: 0.5 },
    ],
    baseWeight: 0.78,
  },
  {
    id: "release-fascia",
    title: "Release Fascia",
    category: "Soft Tissue",
    action: "Use fascia release, face massage, and mobility work around tight areas.",
    reason: "Best when contour and symmetry markers suggest soft-tissue restriction.",
    signals: [
      { source: "score", key: "facial_symmetry", weight: 0.6 },
      { source: "advanced", key: "jawline.development", weight: 0.35 },
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.3 },
    ],
    baseWeight: 0.64,
  },
  {
    id: "neck-thickness",
    title: "Improve Neck Thickness",
    category: "Structure",
    action: "Add neck-focused strength work with controlled progression.",
    reason: "Supports the lower-face frame when jaw and structure markers have room.",
    signals: [
      { source: "score", key: "jawline", weight: 0.7 },
      { source: "score", key: "sexual_dimorphism", weight: 0.45 },
      { source: "advanced", key: "jawline.ramus", weight: 0.35 },
    ],
    baseWeight: 0.72,
  },
  {
    id: "zygomatic-prominence",
    title: "Zygomatic Prominence",
    category: "Structure",
    action: "Focus on cheekbone definition, leanness, and midface support.",
    reason: "Targets the visible width and projection of the cheekbone area.",
    signals: [
      { source: "score", key: "cheekbones", weight: 0.8 },
      { source: "advanced", key: "cheekbones.width", weight: 0.8 },
      { source: "advanced", key: "cheekbones.bone_structure", weight: 0.5 },
    ],
    baseWeight: 0.92,
  },
  {
    id: "orbicularis-oculi",
    title: "Train Orbicularis Oculi",
    category: "Eyes",
    action: "Add eye-area control work and tight-lid drills.",
    reason: "Selected when eye shape, tilt, or symmetry has clear room to improve.",
    signals: [
      { source: "score", key: "eyes_symmetry", weight: 0.75 },
      { source: "advanced", key: "eyes.eye_type", weight: 0.7 },
      { source: "advanced", key: "eyes.canthal_tilt", weight: 0.45 },
    ],
    baseWeight: 0.8,
  },
  {
    id: "eye-asymmetry",
    title: "Eye Asymmetry",
    category: "Eyes",
    action: "Prioritize balanced eye-area control, brow relaxation, and front-facing habits.",
    reason: "Selected when left-right eye balance is one of the clearest improvement areas.",
    signals: [
      { source: "advanced", key: "eyes.symmetry", weight: 1 },
      { source: "score", key: "eyes_symmetry", weight: 0.75 },
      { source: "score", key: "facial_symmetry", weight: 0.3 },
    ],
    baseWeight: 0.84,
  },
  {
    id: "coloring",
    title: "Improve Coloring",
    category: "Skin",
    action: "Prioritize even tone, morning light, hydration, and skin-support foods.",
    reason: "Color and tone consistency are high-visibility refinement points.",
    signals: [
      { source: "advanced", key: "skin.color", weight: 1 },
      { source: "score", key: "skin_quality", weight: 0.35 },
    ],
    baseWeight: 0.72,
  },
  {
    id: "release-body-fat",
    title: "Release Body Fat",
    category: "Soft Tissue",
    action: "Push the leanness protocol before adding more structure work.",
    reason: "Lower face fat can hide cheekbone, jawline, and angularity gains.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 1 },
      { source: "score", key: "cheekbones", weight: 0.35 },
      { source: "score", key: "jawline", weight: 0.35 },
    ],
    baseWeight: 0.94,
  },
  {
    id: "gut-clearance",
    title: "Gut Clearance",
    category: "Lifestyle",
    action: "Use simple meals, walking after food, and lower-bloat food choices.",
    reason: "Best used when puffiness and skin markers both need attention.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.65 },
      { source: "advanced", key: "skin.quality", weight: 0.45 },
      { source: "advanced", key: "skin.color", weight: 0.25 },
    ],
    baseWeight: 0.62,
  },
  {
    id: "masseter-strength",
    title: "Strengthen Masseter",
    category: "Structure",
    action: "Use controlled chewing and jaw-resistance work.",
    reason: "Helps when lower-face strength and definition are limiting the frame.",
    signals: [
      { source: "score", key: "jawline", weight: 0.75 },
      { source: "advanced", key: "jawline.development", weight: 0.8 },
      { source: "score", key: "sexual_dimorphism", weight: 0.3 },
    ],
    baseWeight: 0.88,
  },
  {
    id: "forward-growth",
    title: "Forward Growth",
    category: "Structure",
    action: "Prioritize tongue posture, nasal breathing, and maxilla-focused work.",
    reason: "Selected when profile and midface projection markers have room.",
    signals: [
      { source: "advanced", key: "cheekbones.maxilla", weight: 1 },
      { source: "advanced", key: "jawline.projection", weight: 0.75 },
      { source: "score", key: "cheekbones", weight: 0.35 },
    ],
    baseWeight: 0.9,
  },
  {
    id: "eyebrows",
    title: "Eyebrows",
    category: "Grooming",
    action: "Refine brow fullness, shape, and grooming consistency.",
    reason: "Brows frame the eye area and can change face read quickly.",
    signals: [
      { source: "advanced", key: "eyes.brow_volume", weight: 1 },
      { source: "score", key: "eyes_symmetry", weight: 0.25 },
    ],
    baseWeight: 0.65,
  },
  {
    id: "hairstyle-adjustment",
    title: "Hairstyle Adjustment",
    category: "Grooming",
    action: "Choose a cut that balances face length, width, and forehead exposure.",
    reason: "A high-leverage visual change when harmony or FWHR needs balancing.",
    signals: [
      { source: "advanced", key: "cheekbones.fwhr", weight: 0.65 },
      { source: "score", key: "facial_symmetry", weight: 0.35 },
      { source: "score", key: "cheekbones", weight: 0.25 },
    ],
    baseWeight: 0.5,
  },
  {
    id: "fwhr",
    title: "Improve FWHR",
    category: "Structure",
    action: "Work on midface width, leanness, and structure-support habits.",
    reason: "Targets the facial width-to-height read from the scan.",
    signals: [
      { source: "advanced", key: "cheekbones.fwhr", weight: 1 },
      { source: "advanced", key: "cheekbones.width", weight: 0.5 },
      { source: "score", key: "cheekbones", weight: 0.25 },
    ],
    baseWeight: 0.78,
  },
  {
    id: "harmony",
    title: "Improve Harmony",
    category: "Structure",
    action: "Balance the weakest region instead of overtraining one strong area.",
    reason: "Useful when multiple features are close but no single one dominates.",
    signals: [
      { source: "score", key: "facial_symmetry", weight: 0.55 },
      { source: "score", key: "nose_harmony", weight: 0.55 },
      { source: "score", key: "cheekbones", weight: 0.25 },
      { source: "score", key: "jawline", weight: 0.25 },
    ],
    baseWeight: 0.76,
  },
  {
    id: "puffiness",
    title: "Fix Puffiness",
    category: "Soft Tissue",
    action: "Use drainage, sodium-potassium balance, and morning movement.",
    reason: "Puffiness can blur contours even when structure is present.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.9 },
      { source: "advanced", key: "skin.quality", weight: 0.3 },
      { source: "score", key: "facial_symmetry", weight: 0.2 },
    ],
    baseWeight: 0.86,
  },
  {
    id: "skin-texture",
    title: "Fix Skin Texture",
    category: "Skin",
    action: "Focus on barrier basics, texture control, and consistent cleansing.",
    reason: "Texture has high visual impact and is directly measured in the scan.",
    signals: [
      { source: "advanced", key: "skin.quality", weight: 1 },
      { source: "score", key: "skin_quality", weight: 0.55 },
    ],
    baseWeight: 0.9,
  },
  {
    id: "deblot",
    title: "Deblot",
    category: "Lifestyle",
    action: "Run the anti-bloat protocol before judging structure changes.",
    reason: "A fast cleanup layer when face fat, puffiness, or skin signals are dragging the scan.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.85 },
      { source: "advanced", key: "skin.color", weight: 0.25 },
      { source: "score", key: "facial_symmetry", weight: 0.25 },
    ],
    baseWeight: 0.82,
  },
  {
    id: "train-structure",
    title: "Train the Structure",
    category: "Structure",
    action: "Make structure-focused exercises the base of the next routine.",
    reason: "Best when several bone and lower-face markers are below target.",
    signals: [
      { source: "advanced", key: "cheekbones.bone_structure", weight: 0.65 },
      { source: "advanced", key: "jawline.development", weight: 0.55 },
      { source: "advanced", key: "jawline.ramus", weight: 0.45 },
      { source: "score", key: "jawline", weight: 0.3 },
    ],
    baseWeight: 0.84,
  },
  {
    id: "dry-lips",
    title: "Dry Lips",
    category: "Skin",
    action: "Add hydration, balm, and skin-barrier support around the mouth.",
    reason: "A refinement layer that helps the lower face read cleaner.",
    signals: [
      { source: "score", key: "skin_quality", weight: 0.55 },
      { source: "advanced", key: "skin.quality", weight: 0.45 },
      { source: "advanced", key: "skin.color", weight: 0.2 },
    ],
    baseWeight: 0.42,
  },
  {
    id: "nose-fat",
    title: "Nose Fat",
    category: "Soft Tissue",
    action: "Pair nose work with leanness and debloating protocols.",
    reason: "Selected when nose harmony and soft-tissue markers both need attention.",
    signals: [
      { source: "score", key: "nose_harmony", weight: 0.85 },
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.35 },
    ],
    baseWeight: 0.58,
  },
  {
    id: "cortisol-control",
    title: "Cortisol Control",
    category: "Hormone Support",
    action: "Prioritize sleep, morning light, walking, and recovery consistency.",
    reason: "A safer support focus when puffiness and skin markers suggest recovery needs.",
    signals: [
      { source: "advanced", key: "skin.quality", weight: 0.45 },
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.45 },
      { source: "score", key: "skin_quality", weight: 0.25 },
    ],
    baseWeight: 0.6,
  },
  {
    id: "bone-mass",
    title: "Gain Bone Mass",
    category: "Structure",
    action: "Use mineral, protein, and structure-training protocols together.",
    reason: "Targets the underlying facial frame when bone-structure markers are low.",
    signals: [
      { source: "advanced", key: "cheekbones.bone_structure", weight: 1 },
      { source: "advanced", key: "jawline.ramus", weight: 0.55 },
      { source: "advanced", key: "cheekbones.maxilla", weight: 0.45 },
    ],
    baseWeight: 0.82,
  },
  {
    id: "angularity",
    title: "Angularity",
    category: "Structure",
    action: "Cut lower-third softness and sharpen jaw-to-cheek transitions.",
    reason: "High leverage when lower-third face fat is reducing sharpness.",
    signals: [
      { source: "advanced", key: "cheekbones.face_fat", weight: 0.75 },
      { source: "advanced", key: "jawline.gonial_angle", weight: 0.65 },
      { source: "advanced", key: "jawline.development", weight: 0.45 },
    ],
    baseWeight: 0.96,
  },
];

export function selectNextFocusRecommendations({
  scanId,
  metrics,
  latestAdvanced,
  previousAdvanced,
  limit = 6,
}: SelectNextFocusInput): NextFocusRecommendation[] {
  const scanSalt = scanId ?? "latest";
  const metricLookup = Object.fromEntries(metrics.map((m) => [m.key, m])) as MetricLookup;
  const advancedLookup = flattenAdvanced(latestAdvanced);
  const previousLookup = flattenAdvanced(previousAdvanced ?? null);

  const ranked = RECOMMENDATION_LIBRARY.map((def) => {
    const signalScores = def.signals
      .map((signal) => resolveSignalScore(signal, metricLookup, advancedLookup, previousLookup))
      .filter((score): score is number => Number.isFinite(score));

    const gapAverage = signalScores.length
      ? signalScores.reduce((sum, score) => sum + score, 0) / signalScores.length
      : 0.18;
    const evidence = strongestEvidence(def.signals, metricLookup, advancedLookup);
    const stableTieBreak = (hashText(`${scanSalt}:${def.id}`) % 17) / 1000;
    const score = Math.round((gapAverage * def.baseWeight + evidence.confidence * 0.08 + stableTieBreak) * 1000) / 10;

    return {
      id: def.id,
      rank: 0,
      title: def.title,
      category: def.category,
      action: def.action,
      reason: def.reason,
      evidence: evidence.label,
      score,
    };
  })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return spreadCategories(ranked, Math.max(5, Math.min(6, limit))).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

function resolveSignalScore(
  signal: Signal,
  metricLookup: MetricLookup,
  advancedLookup: AdvancedLookup,
  previousLookup: AdvancedLookup,
): number | null {
  const value = signal.source === "score"
    ? metricLookup[signal.key]?.current
    : advancedLookup[signal.key];

  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const gap = clamp01((82 - value) / 82);
  const previous = signal.source === "advanced" ? previousLookup[signal.key] : undefined;
  const regressionBoost =
    typeof previous === "number" && previous - value > 2
      ? clamp01((previous - value) / 40) * 0.18
      : 0;

  return clamp01(gap * signal.weight + regressionBoost);
}

function flattenAdvanced(advanced: LatestAdvanced | null): AdvancedLookup {
  if (!advanced) return {};
  const raw = advanced as any;
  return {
    "cheekbones.width": numeric(raw.cheekbones?.width_score),
    "cheekbones.maxilla": numeric(raw.cheekbones?.maxilla_score),
    "cheekbones.bone_structure": numeric(raw.cheekbones?.bone_structure_score),
    "cheekbones.face_fat": numeric(raw.cheekbones?.face_fat_score),
    "cheekbones.fwhr": numeric(raw.cheekbones?.fwhr_score),
    "jawline.development": numeric(raw.jawline?.development_score),
    "jawline.gonial_angle": numeric(raw.jawline?.gonial_angle_score),
    "jawline.projection": numeric(raw.jawline?.projection_score),
    "jawline.ramus": numeric(raw.jawline?.ramus_score),
    "eyes.canthal_tilt": numeric(raw.eyes?.canthal_tilt_score),
    "eyes.eye_type": numeric(raw.eyes?.eye_type_score),
    "eyes.brow_volume": numeric(raw.eyes?.brow_volume_score),
    "eyes.symmetry": numeric(raw.eyes?.symmetry_score),
    "skin.color": numeric(raw.skin?.color_score),
    "skin.quality": numeric(raw.skin?.quality_score),
  };
}

function strongestEvidence(
  signals: Signal[],
  metricLookup: MetricLookup,
  advancedLookup: AdvancedLookup,
): { label: string; confidence: number } {
  const candidates = signals
    .map((signal) => {
      const value = signal.source === "score"
        ? metricLookup[signal.key]?.current
        : advancedLookup[signal.key];
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      return {
        label: `${labelForSignal(signal.key)} ${Math.round(value)}/100`,
        priority: (100 - value) * signal.weight,
      };
    })
    .filter((entry): entry is { label: string; priority: number } => !!entry)
    .sort((a, b) => b.priority - a.priority);

  if (!candidates.length) {
    return { label: "Based on your latest scan profile", confidence: 0.25 };
  }

  return {
    label: candidates[0].label,
    confidence: clamp01(candidates[0].priority / 100),
  };
}

function spreadCategories(
  ranked: NextFocusRecommendation[],
  limit: number,
): NextFocusRecommendation[] {
  const selected: NextFocusRecommendation[] = [];
  const categoryCounts = new Map<NextFocusCategory, number>();

  for (const item of ranked) {
    if (selected.length >= limit) break;
    const count = categoryCounts.get(item.category) ?? 0;
    if (count >= 2 && selected.length < limit - 1) continue;
    selected.push(item);
    categoryCounts.set(item.category, count + 1);
  }

  if (selected.length < limit) {
    for (const item of ranked) {
      if (selected.length >= limit) break;
      if (selected.some((current) => current.id === item.id)) continue;
      selected.push(item);
    }
  }

  return selected;
}

function labelForSignal(key: string): string {
  const labels: Record<string, string> = {
    jawline: "Jawline",
    facial_symmetry: "Symmetry",
    skin_quality: "Skin quality",
    cheekbones: "Cheekbones",
    eyes_symmetry: "Eye area",
    nose_harmony: "Nose harmony",
    sexual_dimorphism: "Facial structure",
    "cheekbones.width": "Cheekbone width",
    "cheekbones.maxilla": "Maxilla",
    "cheekbones.bone_structure": "Bone structure",
    "cheekbones.face_fat": "Face fat",
    "cheekbones.fwhr": "FWHR",
    "jawline.development": "Jaw development",
    "jawline.gonial_angle": "Gonial angle",
    "jawline.projection": "Chin projection",
    "jawline.ramus": "Ramus height",
    "eyes.canthal_tilt": "Canthal tilt",
    "eyes.eye_type": "Eye type",
    "eyes.brow_volume": "Brow volume",
    "eyes.symmetry": "Eye symmetry",
    "skin.color": "Skin color",
    "skin.quality": "Skin texture",
  };
  return labels[key] ?? key;
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}
