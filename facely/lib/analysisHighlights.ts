// lib/analysisHighlights.ts
// Picks what the analysis reveal shows: one genuine strength (only if one
// exists) and the three or four biggest problems, weighted toward the areas
// the user said they want to improve.

import { hasAssessedHaircut, type AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

export type Group = "cheekbones" | "jawline" | "eyes" | "skin" | "haircut";

/** How a metric is drawn on the face. */
export type Shape =
  | "jawTrace"
  | "jawCorners"
  | "eyeTilt"
  | "eyes"
  | "brows"
  | "cheekWidth"
  | "faceRatio"
  | "midface"
  | "skin"
  | "hairline"
  | "lowerFace"
  | "profile";

type MetricSpec = {
  group: Group;
  key: string;
  label: string;
  shape: Shape;
  /** Soft tissue and grooming respond to a routine; bone mostly reads better. */
  kind: "improvable" | "structural";
  lever: string;
  /** Profile metrics are judged from the side photo. */
  sidePhoto?: boolean;
};

const METRICS: MetricSpec[] = [
  { group: "jawline", key: "development", label: "Jaw development", shape: "jawTrace", kind: "improvable", lever: "Masseter training and lower body fat sharpen it." },
  { group: "jawline", key: "gonial_angle", label: "Jaw angle", shape: "jawCorners", kind: "structural", lever: "A leaner face and better posture make the angle read sharper." },
  { group: "jawline", key: "projection", label: "Jaw projection", shape: "profile", kind: "structural", lever: "Posture and chin tucks change how it projects.", sidePhoto: true },
  { group: "jawline", key: "ramus", label: "Ramus length", shape: "profile", kind: "structural", lever: "Neck posture and leanness change how it reads.", sidePhoto: true },
  { group: "cheekbones", key: "width", label: "Cheekbone width", shape: "cheekWidth", kind: "structural", lever: "Less face fat lets your cheekbones stand out." },
  { group: "cheekbones", key: "maxilla", label: "Maxilla", shape: "midface", kind: "structural", lever: "Tongue posture supports the midface over time." },
  { group: "cheekbones", key: "bone_structure", label: "Bone structure", shape: "cheekWidth", kind: "structural", lever: "Leanness reveals more of the structure you have." },
  { group: "cheekbones", key: "face_fat", label: "Face fat", shape: "midface", kind: "improvable", lever: "Drops with lower body fat and less water retention." },
  { group: "cheekbones", key: "fwhr", label: "Face ratio (fWHR)", shape: "faceRatio", kind: "structural", lever: "Fuller brows and a leaner face shift how the ratio reads." },
  { group: "eyes", key: "canthal_tilt", label: "Canthal tilt", shape: "eyeTilt", kind: "structural", lever: "Brow grooming and under-eye care change how it reads." },
  { group: "eyes", key: "eye_type", label: "Eye shape", shape: "eyes", kind: "structural", lever: "Sleep, under-eye care and brows frame the eyes." },
  { group: "eyes", key: "brow_volume", label: "Brow volume", shape: "brows", kind: "improvable", lever: "Grooming and brow serums fill them in within weeks." },
  { group: "eyes", key: "symmetry", label: "Eye symmetry", shape: "eyes", kind: "structural", lever: "Sleeping position and even chewing help balance." },
  { group: "skin", key: "quality", label: "Skin quality", shape: "skin", kind: "improvable", lever: "Responds to a consistent skincare routine." },
  { group: "skin", key: "color", label: "Skin tone", shape: "skin", kind: "improvable", lever: "Evens out with sun protection and hydration." },
  { group: "haircut", key: "density", label: "Hair density", shape: "hairline", kind: "improvable", lever: "Treatment and the right cut change perceived density." },
  { group: "haircut", key: "styling", label: "Hairstyle", shape: "hairline", kind: "improvable", lever: "A cut matched to your face shape is a fast win." },
  { group: "haircut", key: "facial_hair", label: "Facial hair", shape: "lowerFace", kind: "improvable", lever: "The right beard shape can rebuild your jawline." },
];

export type Highlight = {
  id: string;
  group: Group;
  label: string;
  shape: Shape;
  kind: MetricSpec["kind"];
  lever: string;
  sidePhoto: boolean;
  score: number;
  verdict: string;
  /** First sentence of the analysis line, kept short enough for one screen. */
  detail: string;
  /** The full AI comment for this metric; empty when the analysis has none. */
  remark: string;
  /** Estimated score after following the plan. Shown as an estimate. */
  potential: number;
};

export type RevealHighlights = {
  strength: Highlight | null;
  problems: Highlight[];
  /** Every scored metric, for lookups such as the unlock beat's verdicts. */
  all: Highlight[];
};

const STRENGTH_MIN = 75;
const PROBLEM_MAX = 70;
const GOAL_WEIGHT = 8;
const MAX_PER_GROUP = 2;

// The goals screen's keys, mapped to analysis groups.
const GOAL_GROUPS: Record<string, Group[]> = {
  jawline: ["jawline"],
  cheekbones: ["cheekbones"],
  eyes: ["eyes"],
  skin: ["skin"],
  symmetry: ["eyes"],
  overall: [],
};

function firstSentence(text: string, max = 130): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** A modest, capped estimate: routines move soft tissue more than bone. */
function estimatePotential(score: number, kind: MetricSpec["kind"]): number {
  const room = Math.max(0, 88 - score);
  const gain =
    kind === "improvable"
      ? Math.min(22, Math.max(6, Math.round(room * 0.6)))
      : Math.min(10, Math.max(3, Math.round(room * 0.3)));
  return Math.min(95, score + gain);
}

export function pickHighlights(
  data: AdvancedAnalysis,
  opts: { goals?: string[]; hasSidePhoto: boolean },
): RevealHighlights {
  const groups = data as unknown as Record<Group, Record<string, unknown>>;
  const haircutAssessed = hasAssessedHaircut(data);
  const goalGroups = new Set((opts.goals ?? []).flatMap((g) => GOAL_GROUPS[g] ?? []));

  const all: Highlight[] = [];
  for (const spec of METRICS) {
    if (spec.group === "haircut" && !haircutAssessed) continue;
    if (spec.sidePhoto && !opts.hasSidePhoto) continue;
    const source = groups[spec.group];
    const score = source?.[`${spec.key}_score`];
    const line = String(source?.[spec.key] ?? "");
    const verdict = String(source?.[`${spec.key}_verdict`] ?? "");
    if (typeof score !== "number") continue;
    // The schema fills a missing metric with exactly 50 and no text; skip
    // only that combination. A real score can come without commentary.
    if (score === 50 && !line.trim() && !verdict.trim()) continue;
    all.push({
      id: `${spec.group}.${spec.key}`,
      group: spec.group,
      label: spec.label,
      shape: spec.shape,
      kind: spec.kind,
      lever: spec.lever,
      sidePhoto: !!spec.sidePhoto,
      score: Math.round(score),
      verdict: verdict.trim(),
      detail: firstSentence(line || verdict || spec.lever),
      remark: line.trim(),
      potential: estimatePotential(score, spec.kind),
    });
  }

  const weighted = (h: Highlight) => h.score - (goalGroups.has(h.group) ? GOAL_WEIGHT : 0);
  const ranked = [...all].sort((a, b) => weighted(a) - weighted(b));

  // Spread problems across the face: at most two from one area.
  const problems: Highlight[] = [];
  const perGroup = new Map<Group, number>();
  const take = (h: Highlight) => {
    const n = perGroup.get(h.group) ?? 0;
    if (n >= MAX_PER_GROUP || problems.includes(h)) return;
    perGroup.set(h.group, n + 1);
    problems.push(h);
  };
  for (const h of ranked) if (h.score < PROBLEM_MAX && problems.length < 4) take(h);
  // Always show at least three, even on a strong face: the lowest are still
  // the best places to improve.
  for (const h of ranked) if (problems.length < 3) take(h);
  // A fourth only when it is a real problem, not padding.
  if (problems.length === 4 && problems[3].score >= 60) problems.pop();

  const strength =
    [...all]
      .filter((h) => !problems.includes(h) && h.score >= STRENGTH_MIN)
      .sort((a, b) => b.score - a.score)[0] ?? null;

  return { strength, problems, all };
}

export function severityOf(score: number): "Major" | "Moderate" | "Minor" {
  if (score < 40) return "Major";
  if (score < 55) return "Moderate";
  return "Minor";
}
