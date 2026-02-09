// lib/verdictColor.ts
// Maps sub-metric verdict labels to quality tiers and returns
// the corresponding color + glow for the UI.
//
// The CATEGORY_OPTIONS arrays are ordered from BEST → WORST.
// We normalize each verdict's position to a 0-1 range and bucket
// it into one of five visual tiers.

type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism";

// ── Tier colors ──────────────────────────────────────────────────
// Each tier has a text color and a subtle glow variant.

export type VerdictTier = "elite" | "great" | "good" | "average" | "poor";

export type VerdictStyle = {
  tier: VerdictTier;
  color: string;
  glow: string;
};

const TIER_STYLES: Record<VerdictTier, Omit<VerdictStyle, "tier">> = {
  elite: {
    color: "#7DFF6A",   // bright lime-green
    glow: "rgba(125,255,106,0.18)",
  },
  great: {
    color: "#A8F059",   // yellow-green
    glow: "rgba(168,240,89,0.14)",
  },
  good: {
    color: "#C8DA45",   // warm chartreuse
    glow: "rgba(200,218,69,0.12)",
  },
  average: {
    color: "#F5C842",   // amber / warm yellow
    glow: "rgba(245,200,66,0.12)",
  },
  poor: {
    color: "#F08C5A",   // warm coral-orange
    glow: "rgba(240,140,90,0.14)",
  },
};

// ── Category options (mirrored from scorer-node/src/explainer.ts) ─
// Ordered BEST → WORST so index 0 is the best possible verdict.

const CATEGORY_OPTIONS: Record<MetricKey, readonly (readonly string[])[]> = {
  eyes_symmetry: [
    ["Hunter Eyes", "Almond Eyes", "Upturned Eyes", "Neutral Eyes", "Slightly Hooded", "Prey Eyes", "Downturned Eyes", "Bulging Eyes", "Sanpaku Eyes"],
    ["Perfectly Symmetrical", "Well-Centered", "Minimal Asymmetry", "Slight Asymmetry", "Eye Larger", "Noticeable Asymmetry", "Size Difference", "Uneven Height", "Different Shapes"],
    ["Positive Tilt", "Neutral-Positive", "Neutral Tilt", "Minimal Tilt", "Negative Tilt", "Severe Negative"],
    ["Vibrant Striking", "Rich Color", "Clear Bright", "Moderate Vibrancy", "Soft Color", "Dull Muted", "Bloodshot Sclera", "Faded Color"],
  ],
  jawline: [
    ["Razor Sharp", "Well-Defined", "Chiseled", "Moderate Definition", "Minimal Definition", "Undefined", "Double Chin", "Weak Jawline"],
    ["Perfectly Symmetrical", "Balanced", "Slight Asymmetry", "Noticeable Asymmetry", "Side Weaker", "Crooked Jaw"],
    ["Best Angle(95–102°)", "Optimal Angle(103–108°)", "Defined(109–113°)", "Moderate Angle(114–118°)", "Obtuse Angle(119–124°)", "Severely Rounded (125–132°)", "Invisible Corner (>133°)"],
    ["Strong Projection", "Good Projection", "Well-Proportioned", "Moderate Projection", "Adequate Projection", "Weak Projection", "Recessed", "Severely Recessed"],
  ],
  cheekbones: [
    ["High Prominence", "Well-Defined", "Sculpted", "Moderate Prominence", "Visible", "Low Cheekbones", "Flat Midface", "Undefined"],
    ["Very Lean", "Lean Defined", "Athletic", "Moderate Fullness", "Slight Fullness", "High Fullness", "Puffy Cheeks", "Chipmunk Cheeks"],
    ["Well-Developed", "Adequate Development", "Forward Grown", "Moderate Development", "Acceptable Structure", "Underdeveloped", "Recessed", "Severely Recessed"],
    ["Wide Proportional", "Ideal Width", "Well-Spaced", "Moderate Width", "Standard Spacing", "Narrow Width", "Too Wide", "Pinched"],
  ],
  nose_harmony: [
    ["Straight Nose", "Roman Nose", "Well-Defined", "Refined Nose", "Standard Shape", "Moderate Definition", "Bulbous", "Crooked", "Hooked", "Flat Wide", "Upturned"],
    ["Perfectly Straight", "Minimal Deviation", "Well-Aligned", "Slight Curve", "Mostly Straight", "Noticeably Crooked", "Deviated Septum", "Severely Curved", "Off-Center"],
    ["Perfectly Balanced", "Proportional", "Golden Ratio", "Slightly Long", "Slightly Short", "Acceptable Balance", "Too Long", "Too Short", "Too Wide", "Too Narrow"],
    ["Sharp Tip", "Well-Defined", "Projected Tip", "Moderate Tip", "Round Tip", "Bulbous Tip", "Drooping Tip", "Undefined Tip", "Boxy Tip"],
  ],
  skin_quality: [
    ["Flawless", "Excellent Clarity", "Clean Clear", "Good Clarity", "Acceptable Clarity", "Poor Clarity", "Blemished", "Very Rough", "Severely Damaged"],
    ["Glass Skin", "Very Smooth", "Polished", "Moderately Smooth", "Normal Texture", "Rough Texture", "Textured", "Very Rough", "Damaged"],
    ["Perfectly Even", "Consistent Tone", "Balanced Color", "Mostly Even", "Slight Discoloration", "Uneven Tone", "Discolored", "Blotchy", "Severe Discoloration"],
    ["Youthful", "Fresh Appearance", "Age-Defying", "Age-Appropriate", "Slight Aging", "Aged Appearance", "Significant Aging", "Premature Aging", "Severely Aged"],
  ],
  facial_symmetry: [
    ["Perfectly Aligned", "Well-Balanced", "Minimal Asymmetry", "Slight Asymmetry", "Minor Imbalance", "Noticeable Asymmetry", "Significant Imbalance", "Side Drooping"],
    ["Perfectly Centered", "Excellent Alignment", "Balanced Axis", "Slightly Off", "Minor Shift", "Noticeably Off", "Crooked Features", "Asymmetrical Halves"],
    ["Perfectly Level", "Minimal Tilt", "Even Placement", "Slight Tilt", "Minor Difference", "Noticeable Tilt", "Uneven Eyes", "Eye Droop"],
    ["Perfectly Centered", "Excellent Alignment", "Symmetrical Position", "Slightly Off", "Mostly Centered", "Noticeably Off", "Deviated", "Crooked Nose"],
  ],
  sexual_dimorphism: [
    ["High Dominance", "Strong Masculine", "Average Masculinity", "Moderate Presence", "Low Masculinity", "Weak Appearance", "Feminine Features"],
    ["High Testosterone", "Balanced Hormones", "Normal Markers", "Adequate Balance", "Low Markers", "Imbalanced", "Hormonal Issues"],
    ["Sharp Contours", "Strong Definition", "Chiseled", "Weak Contours", "Soft Rounded", "Undefined", "Puffy"],
    ["Minimal Softness", "Low Softness", "Appropriate Firmness", "Normal Padding", "High Softness", "Very Soft", "Puffy Bloated", "Baby Face"],
  ],
};

// ── Slug helper (matches explainer.ts normalization) ─────────────

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ── Lookup caches ────────────────────────────────────────────────
// Built once at module init. Maps slug → normalized position (0..1).

type PositionMap = Map<string, number>;

const metricSubPositions: Record<MetricKey, PositionMap[]> = {} as any;

for (const metric of Object.keys(CATEGORY_OPTIONS) as MetricKey[]) {
  const subs = CATEGORY_OPTIONS[metric];
  metricSubPositions[metric] = subs.map((options) => {
    const map = new Map<string, number>();
    const count = options.length;
    options.forEach((label, idx) => {
      // 0 = best, 1 = worst
      const pos = count <= 1 ? 0 : idx / (count - 1);
      map.set(slug(label), pos);
    });
    return map;
  });
}

function positionToTier(pos: number): VerdictTier {
  if (pos <= 0.15) return "elite";
  if (pos <= 0.35) return "great";
  if (pos <= 0.55) return "good";
  if (pos <= 0.75) return "average";
  return "poor";
}

// ── Public API ───────────────────────────────────────────────────

const DEFAULT_STYLE: VerdictStyle = {
  tier: "good",
  color: "rgba(255,255,255,0.92)",
  glow: "transparent",
};

/**
 * Returns the visual style for a verdict label.
 *
 * @param metric   e.g. "eyes_symmetry"
 * @param subIndex 0..3  (which of the 4 sub-metrics)
 * @param verdict  the label string returned by the server (e.g. "Neutral Eyes")
 */
export function getVerdictStyle(
  metric: string,
  subIndex: number,
  verdict: string | undefined | null
): VerdictStyle {
  if (!verdict || !verdict.trim()) return DEFAULT_STYLE;

  const key = metric as MetricKey;
  const positionMaps = metricSubPositions[key];
  if (!positionMaps || !positionMaps[subIndex]) return DEFAULT_STYLE;

  const posMap = positionMaps[subIndex];
  const slugged = slug(verdict);

  // Direct lookup
  let pos = posMap.get(slugged);

  // Fuzzy: try prefix match
  if (pos === undefined) {
    for (const [s, p] of posMap) {
      if (s.startsWith(slugged) || slugged.startsWith(s)) {
        pos = p;
        break;
      }
    }
  }

  if (pos === undefined) return DEFAULT_STYLE;

  const tier = positionToTier(pos);
  return { tier, ...TIER_STYLES[tier] };
}

/**
 * Convenience: returns just the color string for a verdict.
 */
export function getVerdictColor(
  metric: string,
  subIndex: number,
  verdict: string | undefined | null
): string {
  return getVerdictStyle(metric, subIndex, verdict).color;
}