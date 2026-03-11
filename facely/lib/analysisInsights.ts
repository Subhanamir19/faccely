// lib/analysisInsights.ts
// Pure logic for the redesigned analysis summary view.
// No React, no side effects. All derived from existing scores + label strings.

import type { MetricKey } from "../store/scores";

// ---------------------------------------------------------------------------
// Label → plain English translation map
// Tone: honest and direct. Positive when warranted, clear about weaknesses.
// ---------------------------------------------------------------------------

export const LABEL_TRANSLATIONS: Record<string, string> = {
  // ── eyes_symmetry › Shape ──────────────────────────────────────────────────
  "Hunter Eyes":      "eyes have a strong downward slant — an aesthetically high-value trait",
  "Almond Eyes":      "eyes have a balanced almond shape",
  "Upturned Eyes":    "eyes tilt slightly upward at the corners — a positive trait",
  "Neutral Eyes":     "eye shape is neutral — no strong positive or negative",
  "Slightly Hooded":  "eyes are mildly hooded",
  "Prey Eyes":        "eyes have visible white below the iris — weakens the intensity of the gaze",
  "Downturned Eyes":  "eyes angle downward at the corners — softens and slightly weakens the look",
  "Bulging Eyes":     "eyes appear slightly prominent — reduces sharpness",
  "Sanpaku Eyes":     "white is visible around the iris — noticeably weakens the gaze",

  // ── eyes_symmetry › Symmetry ──────────────────────────────────────────────
  "Perfectly Symmetrical": "eyes are evenly matched",
  "Well-Centered":         "eyes are well centered",
  "Minimal Asymmetry":     "very minor asymmetry between eyes — unlikely to be noticed",
  "Slight Asymmetry":      "a noticeable size or height difference between eyes",
  "Eye Larger":            "one eye appears clearly larger than the other",
  "Noticeable Asymmetry":  "eye asymmetry is visible at a glance",
  "Size Difference":       "a clear size difference between eyes disrupts balance",
  "Uneven Height":         "one eye sits higher than the other",
  "Different Shapes":      "each eye has a noticeably different shape",

  // ── eyes_symmetry › Canthal Tilt ──────────────────────────────────────────
  "Positive Tilt":    "eye corners tilt upward — a strong positive trait",
  "Neutral-Positive": "eyes tilt very slightly upward — generally favorable",
  "Neutral Tilt":     "eye corners are level",
  "Minimal Tilt":     "eyes are nearly level with barely any tilt",
  "Negative Tilt":    "eye corners angle downward — softens the look and can read as sad",
  "Severe Negative":  "a sharp downward angle at the eye corners — significantly affects expression",

  // ── eyes_symmetry › Color Vibrancy ────────────────────────────────────────
  "Vibrant Striking": "eye color is vivid and immediately striking",
  "Rich Color":       "eye color is deep and rich",
  "Clear Bright":     "eyes are clear with good brightness",
  "Moderate Vibrancy":"eye color is average in intensity",
  "Soft Color":       "eye color appears muted",
  "Dull Muted":       "eye color lacks vibrancy — eyes don't draw attention",
  "Bloodshot Sclera": "the whites of the eyes appear red or irritated",
  "Faded Color":      "eye color looks washed out",

  // ── jawline › Sharpness ───────────────────────────────────────────────────
  "Razor Sharp":        "the jawline edge is extremely sharp — a standout feature",
  "Well-Defined":       "jawline definition is strong",
  "Chiseled":           "the jaw has clear angular definition",
  "Moderate Definition":"jawline sharpness is average — there's clear room to improve",
  "Minimal Definition": "jawline sharpness is low — one of the bigger gaps in the score",
  "Undefined":          "the jawline edge is not visible",
  "Double Chin":        "excess fat under the chin obscures the jaw edge",
  "Weak Jawline":       "the jaw edge is barely perceptible",

  // ── jawline › Symmetry ────────────────────────────────────────────────────
  "Balanced":           "jaw symmetry is good",
  "Side Weaker":        "one side of the jaw is noticeably less defined",
  "Crooked Jaw":        "the jaw has a visible misalignment",

  // ── jawline › Gonial Angle ────────────────────────────────────────────────
  "Best Angle(95–102°)":        "jaw angle is in the ideal range — a strong structural trait",
  "Optimal Angle(103–108°)":    "jaw angle is well within the optimal range",
  "Defined(109–113°)":          "jaw angle gives good definition",
  "Moderate Angle(114–118°)":   "jaw angle is average — the corner is less pronounced",
  "Obtuse Angle(119–124°)":     "a wide jaw angle softens the corner appearance",
  "Severely Rounded (125–132°)":"jaw angle is very obtuse — corners are largely invisible",
  "Invisible Corner (>133°)":   "the jaw corner is not visible — a structural limitation",

  // ── jawline › Projection ──────────────────────────────────────────────────
  "Strong Projection":   "chin projects forward well — strong profile definition",
  "Good Projection":     "chin projection is solid",
  "Well-Proportioned":   "chin and jaw projection are balanced",
  "Moderate Projection": "chin projection is average",
  "Adequate Projection": "chin barely meets the projection threshold",
  "Weak Projection":     "the chin projects poorly — a notable weakness in profile",
  "Recessed":            "chin is recessed — visibly affects the profile",
  "Severely Recessed":   "severe chin recession — a significant structural limitation",

  // ── cheekbones › Definition ───────────────────────────────────────────────
  "High Prominence":    "cheekbones are high and clearly visible — a strong trait",
  "Sculpted":           "the cheek area shows clear sculpting",
  "Moderate Prominence":"cheekbone prominence is average — lacks sharpness",
  "Visible":            "cheekbones are present but not prominent",
  "Low Cheekbones":     "cheekbones sit low, reducing facial lift",
  "Flat Midface":       "the midface appears flat — cheekbones are not visible",

  // ── cheekbones › Face Fat ─────────────────────────────────────────────────
  "Very Lean":         "very little facial fat — cheekbones show through clearly",
  "Lean Defined":      "facial fat is low with good definition visible",
  "Athletic":          "lean face with good muscle tone",
  "Moderate Fullness": "moderate facial fat reduces cheekbone visibility",
  "Slight Fullness":   "a small amount of facial fat softens the look slightly",
  "High Fullness":     "higher facial fat is obscuring the cheekbone structure",
  "Puffy Cheeks":      "puffy cheeks significantly hide the cheekbone structure",
  "Chipmunk Cheeks":   "excessive facial fat in the cheeks — strongly masks bone structure",

  // ── cheekbones › Maxilla Development ─────────────────────────────────────
  "Well-Developed":      "the upper jaw is well developed — solid facial foundation",
  "Adequate Development":"upper jaw development is acceptable",
  "Forward Grown":       "the midface has good forward projection — a positive structural trait",
  "Moderate Development":"upper jaw development is average",
  "Acceptable Structure":"upper jaw structure is passable but not strong",
  "Underdeveloped":      "the upper jaw appears underdeveloped — affects midface depth",
  // "Recessed" already defined above

  // ── cheekbones › Bizygomatic Width ───────────────────────────────────────
  "Wide Proportional": "facial width relative to height is ideal",
  "Ideal Width":       "face width is in the optimal range",
  "Well-Spaced":       "cheekbone spacing creates good facial width",
  "Moderate Width":    "face width is average",
  "Standard Spacing":  "cheekbone spacing is average — face reads as slightly narrow",
  "Narrow Width":      "the face appears narrow — reduces visual impact",
  "Too Wide":          "face width is excessive relative to height",
  "Pinched":           "cheekbones sit too close — face appears pinched",

  // ── nose_harmony › Nose Shape ─────────────────────────────────────────────
  "Straight Nose":      "nose has a straight, clean profile",
  "Roman Nose":         "defined nose with a slight bridge curve — a strong feature",
  "Refined Nose":       "nose is fine and well-proportioned",
  "Standard Shape":     "nose shape is average",
  "Moderate Definition":"nose definition is below average",
  "Bulbous":            "the nose tip appears rounded and wide",
  "Crooked":            "the nose has a visible bend",
  "Hooked":             "the nose has a downward hook",
  "Flat Wide":          "the nose is wide and flat — disrupts facial balance",
  "Upturned":           "the nose tip is upturned",

  // ── nose_harmony › Straightness ───────────────────────────────────────────
  "Perfectly Straight":  "nose is perfectly straight along the bridge",
  "Minimal Deviation":   "almost perfectly straight — any curve is barely visible",
  "Well-Aligned":        "nose alignment is good",
  "Slight Curve":        "a slight curve along the bridge",
  "Mostly Straight":     "mostly straight with a minor off-center quality",
  "Noticeably Crooked":  "the nose is visibly crooked from the front",
  "Deviated Septum":     "a septum deviation is visible and affects facial balance",
  "Severely Curved":     "severe nose curvature — significantly disrupts balance",
  "Off-Center":          "the nose sits noticeably off-center",

  // ── nose_harmony › Nose Balance ───────────────────────────────────────────
  "Perfectly Balanced":  "nose length and width are in ideal proportion",
  "Proportional":        "nose proportions are solid",
  "Golden Ratio":        "nose dimensions follow strong proportions",
  "Slightly Long":       "the nose is slightly longer than ideal",
  "Slightly Short":      "the nose is slightly shorter than ideal",
  "Acceptable Balance":  "nose proportions are passable",
  "Too Long":            "the nose is noticeably long relative to the face",
  "Too Short":           "the nose appears too short for the face",
  "Too Wide":            "the nose is wide relative to the face",
  "Too Narrow":          "the nose appears narrow and pinched",

  // ── nose_harmony › Nose Tip Type ──────────────────────────────────────────
  "Sharp Tip":     "a sharp, refined nose tip",
  "Projected Tip": "the nose tip projects well",
  "Moderate Tip":  "the nose tip is average in definition",
  "Round Tip":     "the nose tip is rounded",
  "Bulbous Tip":   "the tip is bulbous — a notable area for improvement",
  "Drooping Tip":  "the tip droops downward",
  "Undefined Tip": "the tip lacks definition",
  "Boxy Tip":      "the tip has a boxy, squared shape",

  // ── skin_quality › Clarity ────────────────────────────────────────────────
  "Flawless":         "skin is clear with no visible blemishes",
  "Excellent Clarity":"skin clarity is excellent",
  "Clean Clear":      "skin is clean and clear",
  "Good Clarity":     "skin clarity is good",
  "Acceptable Clarity":"skin clarity is passable but shows some irregularities",
  "Poor Clarity":     "skin shows clear blemishes or rough patches",
  "Blemished":        "visible blemishes affect the overall skin look",
  "Very Rough":       "skin texture is very rough with many imperfections",
  "Severely Damaged": "skin shows severe damage — a significant area to address",

  // ── skin_quality › Smoothness ─────────────────────────────────────────────
  "Glass Skin":     "skin has a glass-like, ultra-smooth surface",
  "Very Smooth":    "skin is very smooth with minimal texture",
  "Polished":       "skin appears polished and refined",
  "Moderately Smooth":"skin smoothness is average — some texture is visible",
  "Normal Texture": "texture is normal",
  "Rough Texture":  "skin texture is rough and uneven",
  "Textured":       "visible skin texture disrupts a smooth look",
  "Damaged":        "skin shows visible damage",

  // ── skin_quality › Evenness ───────────────────────────────────────────────
  "Perfectly Even":      "skin tone is completely uniform",
  "Consistent Tone":     "skin tone is consistently even",
  "Balanced Color":      "color distribution is balanced",
  "Mostly Even":         "skin tone is mostly even with minor variation",
  "Slight Discoloration":"some discoloration is visible",
  "Uneven Tone":         "uneven skin tone is clearly visible",
  "Discolored":          "noticeable discoloration affects the skin's appearance",
  "Blotchy":             "skin appears blotchy with irregular color patches",
  "Severe Discoloration":"severe discoloration — a significant skin concern",

  // ── skin_quality › Youthfulness ───────────────────────────────────────────
  "Youthful":            "skin appears youthful with no signs of aging",
  "Fresh Appearance":    "skin looks fresh and healthy",
  "Age-Defying":         "skin looks younger than expected",
  "Age-Appropriate":     "skin shows age-appropriate characteristics",
  "Slight Aging":        "minor signs of aging are starting to appear",
  "Aged Appearance":     "visible aging signs affect skin quality",
  "Significant Aging":   "significant aging is visible",
  "Premature Aging":     "skin shows signs of premature aging",
  "Severely Aged":       "severe aging signs are present",

  // ── facial_symmetry › Horizontal Alignment ────────────────────────────────
  "Perfectly Aligned":    "left and right facial halves are evenly matched",
  "Well-Balanced":        "facial balance is strong",
  // "Minimal Asymmetry" already defined
  // "Slight Asymmetry"  already defined
  "Minor Imbalance":      "small imbalances between facial halves",
  // "Noticeable Asymmetry" already defined
  "Significant Imbalance":"strong asymmetry between left and right sides",
  "Side Drooping":        "one side of the face appears to droop",

  // ── facial_symmetry › Vertical Balance ───────────────────────────────────
  // "Perfectly Centered" already defined (nose section — OK, same meaning)
  "Excellent Alignment":  "facial thirds are well balanced top to bottom",
  "Balanced Axis":        "the face has solid vertical balance",
  "Slightly Off":         "vertical balance is slightly off",
  "Minor Shift":          "a small vertical shift in feature placement",
  "Noticeably Off":       "vertical facial balance is noticeably off",
  "Crooked Features":     "features appear off-axis when viewed straight on",
  "Asymmetrical Halves":  "upper and lower face show clear asymmetry",

  // ── facial_symmetry › Eye-Line Level ──────────────────────────────────────
  "Perfectly Level": "both eyes sit at exactly the same height",
  "Minimal Tilt":    "eyes are nearly level with minimal variation",
  "Even Placement":  "eye placement is even",
  "Slight Tilt":     "one eye sits slightly higher — adds a mild tilt",
  "Minor Difference":"a small height difference between eyes",
  "Noticeable Tilt": "clear height difference between eyes is visible",
  "Uneven Eyes":     "eyes are at significantly different heights",
  "Eye Droop":       "one eye appears to droop noticeably",

  // ── facial_symmetry › Nose-Line Centering ────────────────────────────────
  "Perfectly Centered":  "the nose is perfectly centered",
  "Symmetrical Position":"the nose sits symmetrically",
  "Mostly Centered":     "mostly centered with a small offset",
  "Noticeably Off":      "the nose is clearly off-center",
  "Deviated":            "nose deviation is visible and affects balance",
  "Crooked Nose":        "the nose is noticeably crooked on the face",

  // ── sexual_dimorphism › Face Power ────────────────────────────────────────
  "High Dominance":   "face reads as strong and assertive — a powerful trait",
  "Strong Masculine": "clear masculine features — solid facial presence",
  "Average Masculinity":"masculine features are average — neither strong nor soft",
  "Moderate Presence":"some masculine features but not strongly defined",
  "Low Masculinity":  "masculine features are weak — face reads as soft",
  "Weak Appearance":  "face lacks masculine definition",
  "Feminine Features":"facial features lean feminine",

  // ── sexual_dimorphism › Hormone Balance ───────────────────────────────────
  "High Testosterone": "facial structure shows strong masculine development",
  "Balanced Hormones": "hormonal markers appear balanced",
  "Normal Markers":    "facial markers are within normal range",
  "Adequate Balance":  "balance is adequate but not strong",
  "Low Markers":       "facial markers suggest lower masculine development",
  "Imbalanced":        "facial feature balance appears off",
  "Hormonal Issues":   "facial markers suggest hormonal imbalance",

  // ── sexual_dimorphism › Contour Strength ──────────────────────────────────
  "Sharp Contours": "facial contours are sharp and angular",
  "Strong Definition":"strong bone structure shows through the skin",
  // "Chiseled" already defined
  "Weak Contours":  "facial contours lack definition",
  "Soft Rounded":   "contours are rounded and soft — lacks edge",
  // "Undefined" already defined
  "Puffy":          "puffiness obscures facial contours",

  // ── sexual_dimorphism › Softness Level ────────────────────────────────────
  "Minimal Softness":    "the face is lean and sharp",
  "Low Softness":        "low facial softness — bone structure shows through well",
  "Appropriate Firmness":"facial firmness is at a good level",
  "Normal Padding":      "normal facial padding — neither lean nor soft",
  "High Softness":       "higher than ideal softness — partially obscures structure",
  "Very Soft":           "high softness significantly masks facial structure",
  "Puffy Bloated":       "puffiness makes the face appear bloated",
  "Baby Face":           "face reads as very round and youthful — masculine structure is not prominent",
};

// ---------------------------------------------------------------------------
// Sub-metric quality index (position in CATEGORY_OPTIONS = lower → worse)
// Used to identify the weakest sub-metric per metric.
// ---------------------------------------------------------------------------

const SUBMETRIC_QUALITY_ORDER: Record<MetricKey, readonly string[][]> = {
  eyes_symmetry: [
    ["Hunter Eyes","Almond Eyes","Upturned Eyes","Neutral Eyes","Slightly Hooded","Prey Eyes","Downturned Eyes","Bulging Eyes","Sanpaku Eyes"],
    ["Perfectly Symmetrical","Well-Centered","Minimal Asymmetry","Slight Asymmetry","Eye Larger","Noticeable Asymmetry","Size Difference","Uneven Height","Different Shapes"],
    ["Positive Tilt","Neutral-Positive","Neutral Tilt","Minimal Tilt","Negative Tilt","Severe Negative"],
    ["Vibrant Striking","Rich Color","Clear Bright","Moderate Vibrancy","Soft Color","Dull Muted","Bloodshot Sclera","Faded Color"],
  ],
  jawline: [
    ["Razor Sharp","Well-Defined","Chiseled","Moderate Definition","Minimal Definition","Undefined","Double Chin","Weak Jawline"],
    ["Perfectly Symmetrical","Balanced","Slight Asymmetry","Noticeable Asymmetry","Side Weaker","Crooked Jaw"],
    ["Best Angle(95–102°)","Optimal Angle(103–108°)","Defined(109–113°)","Moderate Angle(114–118°)","Obtuse Angle(119–124°)","Severely Rounded (125–132°)","Invisible Corner (>133°)"],
    ["Strong Projection","Good Projection","Well-Proportioned","Moderate Projection","Adequate Projection","Weak Projection","Recessed","Severely Recessed"],
  ],
  cheekbones: [
    ["High Prominence","Well-Defined","Sculpted","Moderate Prominence","Visible","Low Cheekbones","Flat Midface","Undefined"],
    ["Very Lean","Lean Defined","Athletic","Moderate Fullness","Slight Fullness","High Fullness","Puffy Cheeks","Chipmunk Cheeks"],
    ["Well-Developed","Adequate Development","Forward Grown","Moderate Development","Acceptable Structure","Underdeveloped","Recessed","Severely Recessed"],
    ["Wide Proportional","Ideal Width","Well-Spaced","Moderate Width","Standard Spacing","Narrow Width","Too Wide","Pinched"],
  ],
  nose_harmony: [
    ["Straight Nose","Roman Nose","Well-Defined","Refined Nose","Standard Shape","Moderate Definition","Bulbous","Crooked","Hooked","Flat Wide","Upturned"],
    ["Perfectly Straight","Minimal Deviation","Well-Aligned","Slight Curve","Mostly Straight","Noticeably Crooked","Deviated Septum","Severely Curved","Off-Center"],
    ["Perfectly Balanced","Proportional","Golden Ratio","Slightly Long","Slightly Short","Acceptable Balance","Too Long","Too Short","Too Wide","Too Narrow"],
    ["Sharp Tip","Well-Defined","Projected Tip","Moderate Tip","Round Tip","Bulbous Tip","Drooping Tip","Undefined Tip","Boxy Tip"],
  ],
  skin_quality: [
    ["Flawless","Excellent Clarity","Clean Clear","Good Clarity","Acceptable Clarity","Poor Clarity","Blemished","Very Rough","Severely Damaged"],
    ["Glass Skin","Very Smooth","Polished","Moderately Smooth","Normal Texture","Rough Texture","Textured","Very Rough","Damaged"],
    ["Perfectly Even","Consistent Tone","Balanced Color","Mostly Even","Slight Discoloration","Uneven Tone","Discolored","Blotchy","Severe Discoloration"],
    ["Youthful","Fresh Appearance","Age-Defying","Age-Appropriate","Slight Aging","Aged Appearance","Significant Aging","Premature Aging","Severely Aged"],
  ],
  facial_symmetry: [
    ["Perfectly Aligned","Well-Balanced","Minimal Asymmetry","Slight Asymmetry","Minor Imbalance","Noticeable Asymmetry","Significant Imbalance","Side Drooping"],
    ["Perfectly Centered","Excellent Alignment","Balanced Axis","Slightly Off","Minor Shift","Noticeably Off","Crooked Features","Asymmetrical Halves"],
    ["Perfectly Level","Minimal Tilt","Even Placement","Slight Tilt","Minor Difference","Noticeable Tilt","Uneven Eyes","Eye Droop"],
    ["Perfectly Centered","Excellent Alignment","Symmetrical Position","Slightly Off","Mostly Centered","Noticeably Off","Deviated","Crooked Nose"],
  ],
  sexual_dimorphism: [
    ["High Dominance","Strong Masculine","Average Masculinity","Moderate Presence","Low Masculinity","Weak Appearance","Feminine Features"],
    ["High Testosterone","Balanced Hormones","Normal Markers","Adequate Balance","Low Markers","Imbalanced","Hormonal Issues"],
    ["Sharp Contours","Strong Definition","Chiseled","Weak Contours","Soft Rounded","Undefined","Puffy"],
    ["Minimal Softness","Low Softness","Appropriate Firmness","Normal Padding","High Softness","Very Soft","Puffy Bloated","Baby Face"],
  ],
};

// Returns a 0–1 quality score for a label within its sub-metric (1 = best, 0 = worst)
function labelQuality(label: string, metric: MetricKey, subIndex: number): number {
  const order = SUBMETRIC_QUALITY_ORDER[metric]?.[subIndex];
  if (!order) return 0.5;
  const idx = order.indexOf(label);
  if (idx === -1) return 0.5;
  return 1 - idx / (order.length - 1);
}

// ---------------------------------------------------------------------------
// Plain-English insight sentence builder
// Picks the 1–2 most impactful sub-metrics and builds an honest sentence.
// ---------------------------------------------------------------------------

const METRIC_SUBJECT: Record<MetricKey, string> = {
  jawline:           "Your jawline",
  cheekbones:        "Your cheekbones",
  eyes_symmetry:     "Your eyes",
  nose_harmony:      "Your nose",
  skin_quality:      "Your skin",
  facial_symmetry:   "Your facial symmetry",
  sexual_dimorphism: "Your facial masculinity",
};

const SUBMETRIC_NAMES: Record<MetricKey, readonly [string, string, string, string]> = {
  eyes_symmetry:     ["Shape", "Symmetry", "Canthal Tilt", "Color"],
  jawline:           ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones:        ["Definition", "Face Fat", "Midface Structure", "Width"],
  nose_harmony:      ["Shape", "Straightness", "Proportions", "Tip"],
  skin_quality:      ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry:   ["Left/Right Balance", "Vertical Balance", "Eye Level", "Nose Centering"],
  sexual_dimorphism: ["Facial Power", "Structure", "Contour", "Leanness"],
};

export function buildInsightSentence(
  metric: MetricKey,
  labels: (string | undefined)[],
  score: number
): string {
  const subject = METRIC_SUBJECT[metric];

  // Score-based context
  const band =
    score >= 80 ? "elite" :
    score >= 65 ? "good" :
    score >= 50 ? "average" :
    "needs work";

  // Find weakest sub-metric (lowest quality index)
  let weakestIdx = -1;
  let weakestQ = 2;
  let weakestLabel = "";

  labels.forEach((label, i) => {
    if (!label) return;
    const q = labelQuality(label, metric, i);
    if (q < weakestQ) {
      weakestQ = q;
      weakestIdx = i;
      weakestLabel = label;
    }
  });

  // Find strongest sub-metric
  let strongestIdx = -1;
  let strongestQ = -1;
  let strongestLabel = "";

  labels.forEach((label, i) => {
    if (!label) return;
    const q = labelQuality(label, metric, i);
    if (q > strongestQ) {
      strongestQ = q;
      strongestIdx = i;
      strongestLabel = label;
    }
  });

  const weakTranslation = weakestLabel ? LABEL_TRANSLATIONS[weakestLabel] : null;
  const strongTranslation = strongestLabel ? LABEL_TRANSLATIONS[strongestLabel] : null;
  const subNames = SUBMETRIC_NAMES[metric];

  if (band === "elite" || band === "good") {
    // Lead with strength, mention if anything is dragging it
    if (strongTranslation) {
      if (weakestQ < 0.5 && weakestIdx !== strongestIdx && weakTranslation) {
        return `${subject}: ${strongTranslation}. ${subNames[weakestIdx]} is the weak point — ${weakTranslation}.`;
      }
      return `${subject}: ${strongTranslation}. This is already one of your stronger areas.`;
    }
  }

  // Average or below — lead with the weakest
  if (weakTranslation) {
    if (strongestQ > 0.65 && strongestIdx !== weakestIdx && strongTranslation) {
      return `${subject}: ${strongTranslation}, but ${weakTranslation}. ${subNames[weakestIdx]} is what's pulling the score down.`;
    }
    return `${subject}: ${weakTranslation}. This is your clearest opportunity to improve.`;
  }

  // Fallback: generic by band
  const fallbacks: Record<string, string> = {
    elite:   `${subject} is in excellent shape — a real strength.`,
    good:    `${subject} is solid with minor room to improve.`,
    average: `${subject} is average — targeted work here will have impact.`,
    "needs work": `${subject} needs the most attention — the biggest gap in your score.`,
  };
  return fallbacks[band];
}

// ---------------------------------------------------------------------------
// Priority ranking — sorts metrics from most to least opportunity
// "Opportunity" = lowest score first (biggest gap from ideal)
// ---------------------------------------------------------------------------

export const METRIC_LABELS: Record<MetricKey, string> = {
  jawline:           "Jawline",
  cheekbones:        "Cheekbones",
  eyes_symmetry:     "Eyes",
  nose_harmony:      "Nose",
  skin_quality:      "Skin Quality",
  facial_symmetry:   "Symmetry",
  sexual_dimorphism: "Masculinity",
};

export function getMetricPriorities(
  scores: Partial<Record<MetricKey, number>>
): MetricKey[] {
  const keys: MetricKey[] = [
    "jawline","cheekbones","eyes_symmetry","nose_harmony",
    "skin_quality","facial_symmetry","sexual_dimorphism",
  ];
  return [...keys].sort((a, b) => {
    const sa = scores[a] ?? 100;
    const sb = scores[b] ?? 100;
    return sa - sb; // lowest score first
  });
}

// ---------------------------------------------------------------------------
// Archetype — one honest phrase describing the overall face profile
// ---------------------------------------------------------------------------

export function getArchetype(scores: Partial<Record<MetricKey, number>>): string {
  const j  = scores.jawline           ?? 50;
  const c  = scores.cheekbones        ?? 50;
  const e  = scores.eyes_symmetry     ?? 50;
  const n  = scores.nose_harmony      ?? 50;
  const sk = scores.skin_quality      ?? 50;
  const sy = scores.facial_symmetry   ?? 50;
  const sd = scores.sexual_dimorphism ?? 50;

  const avg = (j + c + e + n + sk + sy + sd) / 7;

  if (avg >= 80) return "High-Tier Face";
  if (avg >= 70) return "Above Average";

  // Dominant trait archetypes
  const best = getMetricPriorities(scores).reverse()[0]; // highest scoring
  const worst = getMetricPriorities(scores)[0];          // lowest scoring

  if (j >= 75 && c < 65) return "Strong Jaw, Underdeveloped Midface";
  if (c >= 75 && j < 65) return "High Cheekbones, Weak Jaw";
  if (e >= 75)            return "Eyes-Led Face";
  if (sy >= 75)           return "Balanced but Underdeveloped";
  if (sk >= 75 && avg < 65) return "Good Skin, Structural Gaps";
  if (sd >= 75)           return "Masculine Frame";

  if (avg >= 60) return "Developing — Clear Upside";
  return "Early Stage — High Improvement Potential";
}

// ---------------------------------------------------------------------------
// Overall score (simple average of all available metrics)
// ---------------------------------------------------------------------------

export function getOverallScore(
  scores: Partial<Record<MetricKey, number>>
): number | null {
  const vals = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ---------------------------------------------------------------------------
// Top exercises per metric — the 2 best exercises to recommend
// Sourced from EXERCISE_CATALOG scoreFields mapping.
// ---------------------------------------------------------------------------

export const METRIC_TOP_EXERCISES: Record<MetricKey, string[]> = {
  jawline:           ["chin-tucks", "jaw-resistance"],
  cheekbones:        ["fish-face", "alternating-cheek-puffs"],
  eyes_symmetry:     ["hunter-eyes-1", "hunter-eyes-2"],
  nose_harmony:      ["slim-nose-massage", "nose-massage"],
  skin_quality:      ["lymphatic-drainage", "gua-sha"],
  facial_symmetry:   ["lymphatic-drainage", "alternating-cheek-puffs"],
  sexual_dimorphism: ["jaw-resistance", "towel-chewing"],
};

export const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  "chin-tucks":             "Chin Tucks",
  "jaw-resistance":         "Jaw Resistance Press",
  "fish-face":              "Fish Face",
  "alternating-cheek-puffs":"Side Kisses",
  "hunter-eyes-1":          "Eyelid Isolation",
  "hunter-eyes-2":          "Hunter Eyes Squinch",
  "slim-nose-massage":      "Nose Contouring Massage",
  "nose-massage":           "Nasal Bridge Sculpting",
  "lymphatic-drainage":     "Jawline Sculpting Massage",
  "gua-sha":                "Gua Sha",
  "towel-chewing":          "Towel Resistance Chew",
};
