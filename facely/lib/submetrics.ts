// lib/submetrics.ts
// Shared sub-metric definitions and Top-5 selector.
// Trainable-only subset: sub-metrics a user can actually move via routine/protocols/lifestyle.
// Used by the dashboard's Top 5 card. Analysis tab keeps its own full set.

import type { AdvancedAnalysis } from "./api/advancedAnalysis";
import type { LatestAdvanced } from "./api/insights";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubCategory = "CHEEKS" | "JAW" | "EYES" | "SKIN";
export type SubStatus   = "fine" | "neutral" | "alarming";
export type SubSection  = "working" | "okay" | "needs_work";

export type TrainableSubDef = {
  id:         string;
  group:      keyof AdvancedAnalysis;
  key:        string;
  label:      string;
  category:   SubCategory;
  emoji:      string;
  icon:       number | null;
  idealRange: string;
};

export type SubMetricRow = {
  id:         string;
  group:      keyof AdvancedAnalysis;
  key:        string;
  label:      string;
  category:   SubCategory;
  score:      number;
  verdict:    string;
  commentary: string;
  section:    SubSection;
  status:     SubStatus;
  icon:       number | null;
  emoji:      string;
  idealRange: string;
  delta:      number | null; // null when no previous data
};

export type TopFiveResult =
  | { mode: "improving"; rows: SubMetricRow[] }
  | { mode: "toTarget";  rows: SubMetricRow[] }
  | { mode: "none";      rows: [] };

// ---------------------------------------------------------------------------
// Trainable sub-metric definitions
// Excluded (genetic/structural): bone_structure, fwhr, canthal_tilt, eye_type, ramus
// ---------------------------------------------------------------------------

export const TRAINABLE_SUBMETRICS: TrainableSubDef[] = [
  {
    id: "skin.quality", group: "skin", key: "quality",
    label: "Skin Quality", category: "SKIN", emoji: "✨",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/skin--quality.jpeg"),
    idealRange: "Skin should be smooth with small, tight pores and no active breakouts. When light hits it, it should reflect evenly rather than scatter across a rough surface.",
  },
  {
    id: "skin.color", group: "skin", key: "color",
    label: "Skin Color", category: "SKIN", emoji: "🎨",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/SKIN--COLOR.jpeg"),
    idealRange: "Skin tone should be even and consistent with no dark spots, redness, or patchy areas. A clear, uniform complexion across the entire face.",
  },
  {
    id: "cheekbones.face_fat", group: "cheekbones", key: "face_fat",
    label: "Face Fat", category: "CHEEKS", emoji: "🫦",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/face--fat.jpeg"),
    idealRange: "Low enough body fat (~10–14%) for the cheeks to appear hollow under the cheekbones, creating a chiseled shadow beneath them.",
  },
  {
    id: "cheekbones.maxilla", group: "cheekbones", key: "maxilla",
    label: "Maxilla", category: "CHEEKS", emoji: "🦷",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/maxilla--.jpeg"),
    idealRange: "The upper jaw bone should sit forward, giving the cheek area a lifted, full appearance from both the front and side view.",
  },
  {
    id: "jawline.development", group: "jawline", key: "development",
    label: "Jaw Development", category: "JAW", emoji: "💪",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/jawline--development.jpeg"),
    idealRange: "The jaw edge should be clearly visible from the front as a sharp, defined line running from ear to chin — visible even at a distance.",
  },
  {
    id: "jawline.gonial_angle", group: "jawline", key: "gonial_angle",
    label: "Gonial Angle", category: "JAW", emoji: "📐",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/gonial--angle.jpeg"),
    idealRange: "The sharpness of your jaw corner. Ideal is 95–115°. Tighter corners look stronger and more chiseled. Above 125°, the corner blends away and the jaw looks round.",
  },
  {
    id: "jawline.projection", group: "jawline", key: "projection",
    label: "Chin Projection", category: "JAW", emoji: "👤",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/chin--projection.jpeg"),
    idealRange: "The chin should stick out to roughly the same level as the nose tip from a side view. More projection means a stronger, more defined profile.",
  },
  {
    id: "eyes.brow_volume", group: "eyes", key: "brow_volume",
    label: "Brow Volume", category: "EYES", emoji: "🤨",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/eyebrows--densiy.jpeg"),
    idealRange: "Thick, well-groomed brows with a clear arch. The tail should extend past the outer corner of the eye. Full brows frame the face and make the eye area look stronger.",
  },
  {
    id: "eyes.symmetry", group: "eyes", key: "symmetry",
    label: "Eye Symmetry", category: "EYES", emoji: "👁️",
    icon: require("../advanced-analysis-icons/advanced-analysis-icons-new/eyes--symmetry.jpeg"),
    idealRange: "Both eyes should look the same size and height. A difference under 2mm is barely noticeable. Over 3mm becomes clearly visible in normal face-to-face conversation.",
  },
];

// ---------------------------------------------------------------------------
// Classification — mirrors analysis.tsx thresholds
// ---------------------------------------------------------------------------

const T_WORKING  = 72;
const T_OKAY_LOW = 55;

function classifyScore(score: number): { section: SubSection; status: SubStatus } {
  if (score >= T_WORKING)  return { section: "working",    status: "fine"     };
  if (score >= T_OKAY_LOW) return { section: "okay",       status: "neutral"  };
  return                          { section: "needs_work", status: "alarming" };
}

function tierLabel(score: number): string {
  if (score >= 85) return "Exceptional";
  if (score >= 75) return "Strong";
  if (score >= 65) return "Above Avg";
  if (score >= 55) return "Moderate";
  if (score >= 40) return "Below Avg";
  return "Developing";
}

const PERCENT_VERDICT_IDS = new Set(["skin.color", "skin.quality"]);

function resolveVerdict(def: TrainableSubDef, score: number, rawVerdict: string): string {
  if (PERCENT_VERDICT_IDS.has(def.id)) return `${Math.round(score)}%`;
  const cleaned = rawVerdict.trim();
  if (cleaned) return cleaned;
  return tierLabel(score);
}

// ---------------------------------------------------------------------------
// Extract trainable rows from latest_advanced + previous_advanced.
// A row is skipped when its latest score + verdict + commentary are all
// zod-default placeholders (unassessed, e.g. ramus without side image —
// but ramus isn't in trainable set anyway, kept for safety).
// ---------------------------------------------------------------------------

function extractRow(
  def: TrainableSubDef,
  latest: LatestAdvanced,
  previous: LatestAdvanced | null,
): SubMetricRow | null {
  const group = (latest as any)[def.group] as Record<string, any> | null;
  if (!group) return null;

  const score      = typeof group[`${def.key}_score`]   === "number" ? group[`${def.key}_score`] as number : null;
  const commentary = typeof group[def.key]              === "string" ? group[def.key] as string             : "";
  const rawVerdict = typeof group[`${def.key}_verdict`] === "string" ? group[`${def.key}_verdict`] as string : "";

  if (score === null) return null;
  // Unassessed signal: default score with no text — skip
  if (score === 50 && rawVerdict === "" && commentary === "") return null;

  const prevGroup = previous ? (previous as any)[def.group] as Record<string, any> | null : null;
  const prevScore = prevGroup && typeof prevGroup[`${def.key}_score`] === "number"
    ? prevGroup[`${def.key}_score`] as number
    : null;
  const delta = prevScore === null ? null : score - prevScore;

  const { section, status } = classifyScore(score);
  const verdict = resolveVerdict(def, score, rawVerdict);

  return {
    id: def.id, group: def.group, key: def.key,
    label: def.label, category: def.category,
    score, verdict, commentary,
    section, status,
    icon: def.icon, emoji: def.emoji,
    idealRange: def.idealRange,
    delta,
  };
}

// ---------------------------------------------------------------------------
// Top-5 selector
//
// Mode gate:
//   - scan_count < 3                       → "toTarget"
//   - fewer than 3 rows with delta > 0     → "toTarget"
//   - otherwise                            → "improving"
//
// toTarget  = lowest scores ASC, take 5
// improving = positive-delta rows DESC by delta, take 5
// ---------------------------------------------------------------------------

export function pickTopFive(
  latest: LatestAdvanced | null,
  previous: LatestAdvanced | null,
  scanCount: number,
): TopFiveResult {
  if (!latest) return { mode: "none", rows: [] };

  const rows = TRAINABLE_SUBMETRICS
    .map((def) => extractRow(def, latest, previous))
    .filter((r): r is SubMetricRow => r !== null);

  if (rows.length === 0) return { mode: "none", rows: [] };

  const improvingCount = rows.filter((r) => r.delta !== null && r.delta > 0).length;
  const canShowImproving = scanCount >= 3 && improvingCount >= 3;

  if (canShowImproving) {
    const improving = rows
      .filter((r) => r.delta !== null && r.delta > 0)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 5);
    return { mode: "improving", rows: improving };
  }

  const toTarget = rows
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  return { mode: "toTarget", rows: toTarget };
}
