// scorer-node/src/explainer.ts
import OpenAI from "openai";
import crypto from "crypto";
import { Scores, metricKeys, type MetricKey } from "./validators.js";
import { PROVIDERS, CACHE_LIMITS } from "./config/index.js";
import { withRetry } from "./lib/retry.js";

/**
 * Explainer goals
 * - Deterministic per image (or image pair) + scores
 * - Four ultra-concise lines per metric (mapped to UI sub-metrics)
 * - Pairs must actually use both views
 * - Strict JSON output only
 */

const MODEL = PROVIDERS.openai.explainerModel;
const PROMPT_VERSION_EXPLAIN = "exp.v3.2"; // bumped

const CACHE_TTL_MS = CACHE_LIMITS.explain.ttlMs; // 30d default
const CACHE_MAX_ITEMS = CACHE_LIMITS.explain.maxItems;

/* --------------------------------- Cache ---------------------------------- */

type ExplainerPayload = Record<MetricKey, string[]>;
type CacheEntry = { value: ExplainerPayload; ts: number };

const memCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ExplainerPayload>>();

function sha256Hex(s: string | Buffer) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function lruGet(key: string): ExplainerPayload | null {
  const now = Date.now();
  const hit = memCache.get(key);
  if (!hit) return null;
  if (now - hit.ts > CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  memCache.delete(key);
  memCache.set(key, { ...hit, ts: now });
  return hit.value;
}

function lruSet(key: string, value: ExplainerPayload) {
  if (memCache.size >= CACHE_MAX_ITEMS) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, { value, ts: Date.now() });
}

/* --------------------------- Submetric order map -------------------------- */
/* Must match the mobile UI exactly (2×2 grid order). */

const SUBMETRIC_ORDER: Record<MetricKey, readonly [string, string, string, string]> = {
  eyes_symmetry: ["Shape", "Symmetry", "Canthal Tilt", "Color Vibrancy"],
  jawline: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  nose_harmony: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  skin_quality: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  sexual_dimorphism: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
};

type SubmetricOptions = Record<MetricKey, readonly (readonly string[])[]>;

const CATEGORY_OPTIONS: SubmetricOptions = {
  eyes_symmetry: [
    [
      "Hunter Eyes",
      "Almond Eyes",
      "Upturned Eyes",
      "Neutral Eyes",
      "Slightly Hooded",
      "Prey Eyes",
      "Downturned Eyes",
      "Bulging Eyes",
      "Sanpaku Eyes",
    ],
    [
      "Perfectly Symmetrical",
      "Well-Centered",
      "Minimal Asymmetry",
      "Slight Asymmetry",
      "Eye Larger",
      "Noticeable Asymmetry",
      "Size Difference",
      "Uneven Height",
      "Different Shapes",
    ],
    ["Positive Tilt", "Neutral-Positive", "Neutral Tilt", "Minimal Tilt", "Negative Tilt", "Severe Negative"],
    [
      "Vibrant Striking",
      "Rich Color",
      "Clear Bright",
      "Moderate Vibrancy",
      "Soft Color",
      "Dull Muted",
      "Bloodshot Sclera",
      "Faded Color",
    ],
  ],
  jawline: [
    [
      "Razor Sharp",
      "Well-Defined",
      "Chiseled",
      "Moderate Definition",
      "Minimal Definition",
      "Undefined",
      "Double Chin",
      "Weak Jawline",
    ],
    [
      "Perfectly Symmetrical",
      "Balanced",
      "Slight Asymmetry",
      "Noticeable Asymmetry",
      "Side Weaker",
      "Crooked Jaw",
    ],
    [
      "Best Angle(95–102°)",
      "Optimal Angle(103–108°)",
      "Defined(109–113°)",
      "Moderate Angle(114–118°)",
      "Obtuse Angle(119–124°)",
      "Severely Rounded (125–132°)" ,
      "Invisible Corner (>133°)",
    ],
    [
      "Strong Projection",
      "Good Projection",
      "Well-Proportioned",
      "Moderate Projection",
      "Adequate Projection",
      "Weak Projection",
      "Recessed",
      "Severely Recessed",
    ],
  ],
  cheekbones: [
    [
      "High Prominence",
      "Well-Defined",
      "Sculpted",
      "Moderate Prominence",
      "Visible",
      "Low Cheekbones",
      "Flat Midface",
      "Undefined",
    ],
    [
      "Very Lean",
      "Lean Defined",
      "Athletic",
      "Moderate Fullness",
      "Slight Fullness",
      "High Fullness",
      "Puffy Cheeks",
      "Chipmunk Cheeks",
    ],
    [
      "Well-Developed",
      "Adequate Development",
      "Forward Grown",
      "Moderate Development",
      "Acceptable Structure",
      "Underdeveloped",
      "Recessed",
      "Severely Recessed",
    ],
    [
      "Wide Proportional",
      "Ideal Width",
      "Well-Spaced",
      "Moderate Width",
      "Standard Spacing",
      "Narrow Width",
      "Too Wide",
      "Pinched",
    ],
  ],
  nose_harmony: [
    [
      "Straight Nose",
      "Roman Nose",
      "Well-Defined",
      "Refined Nose",
      "Standard Shape",
      "Moderate Definition",
      "Bulbous",
      "Crooked",
      "Hooked",
      "Flat Wide",
      "Upturned",
    ],
    [
      "Perfectly Straight",
      "Minimal Deviation",
      "Well-Aligned",
      "Slight Curve",
      "Mostly Straight",
      "Noticeably Crooked",
      "Deviated Septum",
      "Severely Curved",
      "Off-Center",
    ],
    [
      "Perfectly Balanced",
      "Proportional",
      "Golden Ratio",
      "Slightly Long",
      "Slightly Short",
      "Acceptable Balance",
      "Too Long",
      "Too Short",
      "Too Wide",
      "Too Narrow",
    ],
    [
      "Sharp Tip",
      "Well-Defined",
      "Projected Tip",
      "Moderate Tip",
      "Round Tip",
      "Bulbous Tip",
      "Drooping Tip",
      "Undefined Tip",
      "Boxy Tip",
    ],
  ],
  skin_quality: [
    [
      "Flawless",
      "Excellent Clarity",
      "Clean Clear",
      "Good Clarity",
      "Acceptable Clarity",
      "Poor Clarity",
      "Blemished",
      "Very Rough",
      "Severely Damaged",
    ],
    [
      "Glass Skin",
      "Very Smooth",
      "Polished",
      "Moderately Smooth",
      "Normal Texture",
      "Rough Texture",
      "Textured",
      "Very Rough",
      "Damaged",
    ],
    [
      "Perfectly Even",
      "Consistent Tone",
      "Balanced Color",
      "Mostly Even",
      "Slight Discoloration",
      "Uneven Tone",
      "Discolored",
      "Blotchy",
      "Severe Discoloration",
    ],
    [
      "Youthful",
      "Fresh Appearance",
      "Age-Defying",
      "Age-Appropriate",
      "Slight Aging",
      "Aged Appearance",
      "Significant Aging",
      "Premature Aging",
      "Severely Aged",
    ],
  ],
  facial_symmetry: [
    [
      "Perfectly Aligned",
      "Well-Balanced",
      "Minimal Asymmetry",
      "Slight Asymmetry",
      "Minor Imbalance",
      "Noticeable Asymmetry",
      "Significant Imbalance",
      "Side Drooping",
    ],
    [
      "Perfectly Centered",
      "Excellent Alignment",
      "Balanced Axis",
      "Slightly Off",
      "Minor Shift",
      "Noticeably Off",
      "Crooked Features",
      "Asymmetrical Halves",
    ],
    [
      "Perfectly Level",
      "Minimal Tilt",
      "Even Placement",
      "Slight Tilt",
      "Minor Difference",
      "Noticeable Tilt",
      "Uneven Eyes",
      "Eye Droop",
    ],
    [
      "Perfectly Centered",
      "Excellent Alignment",
      "Symmetrical Position",
      "Slightly Off",
      "Mostly Centered",
      "Noticeably Off",
      "Deviated",
      "Crooked Nose",
    ],
  ],
  sexual_dimorphism: [
    [
      "High Dominance",
      "Strong Masculine",
      "Average Masculinity",
      "Moderate Presence",
      "Low Masculinity",
      "Weak Appearance",
      "Feminine Features",
    ],
    [
      "High Testosterone",
      "Balanced Hormones",
      "Normal Markers",
      "Adequate Balance",
      "Low Markers",
      "Imbalanced",
      "Hormonal Issues",
    ],
    [
      "Sharp Contours",
      "Strong Definition",
      "Chiseled",
      "Weak Contours",
      "Soft Rounded",
      "Undefined",
      "Puffy",
    ],
    [
      "Minimal Softness",
      "Low Softness",
      "Appropriate Firmness",
    
      "Normal Padding",
      "High Softness",
      "Very Soft",
      "Puffy Bloated",
      "Baby Face",
    ],
  ],
};

/* -------------------------- Prompt discipline lists ----------------------- */

const METRIC_CHECKLIST = {
  jawline: `["edge","angle","under-jaw","chin","corner"]`,
  facial_symmetry: `["left/right","tilt","height","width","offset"]`,
  eyes_symmetry: `["left/right","tilt","height","spacing","set"]`,
  cheekbones: `["projection","height","lift","contour"]`,
  nose_harmony: `["proportion","bridge","straight","blend","profile"]`,
  skin_quality: `["texture","even","clarity","reflect","shadow","light"]`,
  sexual_dimorphism: `["brow","jaw","lips","contour","cheek"]`,
};

function formatCategoryRules(): string {
  const lines: string[] = [
    "Label discipline:",
    "- For EACH sub-metric choose EXACTLY one label from the allowed list.",
    "- Return only the label text (case-sensitive). No extra words, punctuation, or commentary.",
    "- If uncertain, pick the closest fitting label from the list. Never invent new labels.",
    "Allowed options per sub-metric:",
  ];

  for (const metric of metricKeys) {
    const submetrics = SUBMETRIC_ORDER[metric];
    const options = CATEGORY_OPTIONS[metric];
    const metricLabel = metric === "sexual_dimorphism" ? "masculinity cues" : metric.replace(/_/g, " ");
    lines.push(`- ${metricLabel}:`);
    if (submetrics && options) {
      submetrics.forEach((sub, idx) => {
        const opts = options[idx] ?? [];
        if (!opts.length) return;
        lines.push(`  - ${sub}: ${opts.join(" | ")}`);
      });
    }
  }

  return lines.join("\n");
}

const CATEGORY_RULES = formatCategoryRules();

let explainResponseFormatLogged = false;


/* ------------------------------ System prompt ----------------------------- */

const SYSTEM_PROMPT_BASE = `
You are a facial aesthetics reviewer. Write observations like a careful stylist: neutral, concise, practical.

Output EXACTLY FOUR short lines per metric, mapped to the following sub-metrics and order:
- eyes_symmetry: ["Shape","Symmetry","Canthal Tilt","Color Vibrancy"]
- jawline: ["Sharpness","Symmetry","Gonial Angle","Projection"]
- cheekbones: ["Definition","Face Fat","Maxilla Development","Bizygomatic Width"]
- nose_harmony: ["Nose Shape","Straightness","Nose Balance","Nose Tip Type"]
- skin_quality: ["Clarity","Smoothness","Evenness","Youthfulness"]
- facial_symmetry: ["Horizontal Alignment","Vertical Balance","Eye-Line Level","Nose-Line Centering"]
- sexual_dimorphism (write as "masculinity cues"): ["Face Power","Hormone Balance","Contour Strength","Softness Level"]

${CATEGORY_RULES}

Reasoning discipline (think silently before writing; do NOT output this section):
- Translate each provided score into its qualitative tier (Developing, Improving, Sharp, Elite) before writing.
- Identify the strongest visible cue supporting that tier and the clearest refinement direction.

Rules
- Describe only what is visible in the image(s). Present tense. No causes, routines, medical, identity or ethnicity claims.
- Keep language simple and respectful. Everyday words only. Avoid jargon like "dimorphism", "malar", "gonial", "dorsum".
- Each line ≤ 110 characters. Include at least one checklist token relevant to the metric.
- If a sub-metric is already ideal, write a clear confirmation (e.g., "well centered", "clean edge"), not generic praise.
- If a refinement helps, state ONE precise direction (edge/angle/height/spacing/texture/light) without prescribing products.
- Symmetry: name the side and dimension if relevant (e.g., "left height slightly higher").
- Camera hygiene is allowed only if visibility is impaired (e.g., uneven light softens edge).
- No emojis. No markdown. No advice phrased as commands. Neutral suggestions only.
- STRICT JSON ONLY with this shape:
{
  "jawline": [s1,s2,s3,s4],
  "facial_symmetry": [s1,s2,s3,s4],
  "skin_quality": [s1,s2,s3,s4],
  "cheekbones": [s1,s2,s3,s4],
  "eyes_symmetry": [s1,s2,s3,s4],
  "nose_harmony": [s1,s2,s3,s4],
  "sexual_dimorphism": [s1,s2,s3,s4]
}

Checklist tokens (use ≥1 per line):
- jawline: ${METRIC_CHECKLIST.jawline}
- facial_symmetry: ${METRIC_CHECKLIST.facial_symmetry}
- eyes_symmetry: ${METRIC_CHECKLIST.eyes_symmetry}
- cheekbones: ${METRIC_CHECKLIST.cheekbones}
- nose_harmony: ${METRIC_CHECKLIST.nose_harmony}
- skin_quality: ${METRIC_CHECKLIST.skin_quality}
- masculinity cues: ${METRIC_CHECKLIST.sexual_dimorphism}
`.trim();

/* ----------------------------- Single-image ------------------------------- */

export async function explainImageBytes(
  client: OpenAI,
  bytes: Buffer,
  mime: string,
  scores: Scores
): Promise<Record<MetricKey, string[]>> {
  const img64 = bytes.toString("base64");

  const tierGuide = `
Use score ranges only to calibrate language strength (do NOT output scores):
- 0–40 developing, 41–64 improving, 65–79 sharp, 80–100 elite.
Before writing each metric, silently match the score to its tier and note the clearest visual evidence.
Each line must point to that evidence or the sharpest refinement, not generic praise.
Keep wording neutral and specific regardless of tier.
`.trim();

  const userText = `
You are given one face image and numeric metric scores (0–100).

${tierGuide}

For EACH metric, write FOUR lines in the fixed sub-metric order listed in the system prompt.
Use the image to pick concrete visible traits, not generic praise. JSON only.

Scores JSON:
${JSON.stringify(scores)}
`.trim();

  const key = cacheKeySingleExplain(bytes, scores);

  const cached = lruGet(key);
  if (cached) return cached;

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {

    const response_format: { type: "json_object"; json_schema?: unknown } = {
      type: "json_object",
    };
    if (!explainResponseFormatLogged) {
      console.log("[RF-CHECK]", {
        type: response_format.type,
        hasSchema: !!response_format.json_schema,
      });
      explainResponseFormatLogged = true;
    }
    const resp = await withRetry(
      () => client.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1300,
        response_format,

        messages: [
          { role: "system", content: SYSTEM_PROMPT_BASE },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mime};base64,${img64}` } },
            ],
          },
        ],
      }),
      {
        maxAttempts: 2,
        baseDelayMs: 1500,
        onRetry: (attempt, err, delay) => {
          console.warn(`[explain-single] retry ${attempt}: ${(err as Error).message}, waiting ${Math.round(delay)}ms`);
        },
      }
    );

    const parsed = normalizeResponse(resp.choices?.[0]?.message?.content);
    lruSet(key, parsed);
    return parsed;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

/* ------------------------------- Pair-image ------------------------------- */

export async function explainImagePairBytes(
  client: OpenAI,
  frontalBytes: Buffer,
  frontalMime: string,
  sideBytes: Buffer,
  sideMime: string,
  scores: Scores
): Promise<Record<MetricKey, string[]>> {
  const f64 = frontalBytes.toString("base64");
  const s64 = sideBytes.toString("base64");

  const tierGuide = `
Use score ranges only to calibrate language strength (do NOT output scores):
- 0–40 developing, 41–64 improving, 65–79 sharp, 80–100 elite.
Before writing each metric, silently match the score to its tier and note the clearest visual evidence.
Each line must point to that evidence or the sharpest refinement, not generic praise.
Keep wording neutral and specific regardless of tier.
`.trim();

  const userText = `
You are given TWO images of the SAME face: first = frontal, second = right-side profile, plus metric scores.

${tierGuide}

Pair discipline:
- Use BOTH views. If a cue is profile-only (e.g., bridge blend, under-jaw angle), mention that cue once with "(profile)".
- For symmetry, name side and dimension (e.g., "left tilt", "right height").
- Write FOUR lines per metric in the fixed sub-metric order from the system prompt. JSON only.

Scores JSON:
${JSON.stringify(scores)}
`.trim();

  const key = cacheKeyPairExplain(frontalBytes, sideBytes, scores);

  const cached = lruGet(key);
  if (cached) return cached;

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {

    const response_format: { type: "json_object"; json_schema?: unknown } = {
      type: "json_object",
    };
    if (!explainResponseFormatLogged) {
      console.log("[RF-CHECK]", {
        type: response_format.type,
        hasSchema: !!response_format.json_schema,
      });
      explainResponseFormatLogged = true;
    }

    const resp = await withRetry(
      () => client.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1500,
        response_format,

        messages: [
          { role: "system", content: SYSTEM_PROMPT_BASE },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${frontalMime};base64,${f64}` } }, // frontal
              { type: "image_url", image_url: { url: `data:${sideMime};base64,${s64}` } },     // profile
            ],
          },
        ],
      }),
      {
        maxAttempts: 2,
        baseDelayMs: 1500,
        onRetry: (attempt, err, delay) => {
          console.warn(`[explain-pair] retry ${attempt}: ${(err as Error).message}, waiting ${Math.round(delay)}ms`);
        },
      }
    );

    const parsed = normalizeResponse(resp.choices?.[0]?.message?.content);
    lruSet(key, parsed);
    return parsed;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

/* --------------------------------- Keys ----------------------------------- */

function cacheKeySingleExplain(image: Buffer, scores: Scores) {
  const imgHash = sha256Hex(image);
  const scoreHash = sha256Hex(JSON.stringify(scores));
  return sha256Hex(`EXP|SINGLE|${MODEL}|${PROMPT_VERSION_EXPLAIN}|${imgHash}|${scoreHash}`);
}

function cacheKeyPairExplain(frontal: Buffer, side: Buffer, scores: Scores) {
  const fHash = sha256Hex(frontal);
  const sHash = sha256Hex(side);
  const scoreHash = sha256Hex(JSON.stringify(scores));
  return sha256Hex(`EXP|PAIR|${MODEL}|${PROMPT_VERSION_EXPLAIN}|${fHash}|${sHash}|${scoreHash}`);
}

/* ------------------------------- Utilities -------------------------------- */

function normalizeResponse(raw: string | null | undefined): Record<MetricKey, string[]> {
  let data: any;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    data = JSON.parse(cleaned || "{}");
  }

  function clampWords(value: string): string {
    const words = value.trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(" ");
  }

  function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  const optionLookup = metricKeys.reduce((acc, metric) => {
    const subOptions = CATEGORY_OPTIONS[metric] ?? [];
    acc[metric] = subOptions.map((options) => {
      const map: Record<string, string> = {};
      for (const option of options) {
        const key = slug(option);
        if (key) map[key] = option;
      }
      return map;
    });
    return acc;
  }, {} as Record<MetricKey, Array<Record<string, string>>>);

  function optClean(value: unknown): string {
    if (typeof value !== "string") return "";
    return clampWords(value);
  }

  function canonicalize(value: unknown, metric: MetricKey, index: number): string {
    const cleaned = optClean(value);
    if (!cleaned) return "";
    const key = slug(cleaned);
    if (!key) return "";
    const map = optionLookup[metric]?.[index];
    if (!map) return cleaned;

    if (map[key]) return map[key];

    const entries = Object.entries(map);

    for (const [slugged, label] of entries) {
      if (slugged.startsWith(key) || key.startsWith(slugged)) {
        return label;
      }
    }

    let bestLabel = "";
    let bestScore = Number.POSITIVE_INFINITY;

    for (const [slugged, label] of entries) {
      const distance = levenshtein(slugged, key);
      const norm = distance / Math.max(slugged.length, key.length, 1);
      if (norm < bestScore) {
        bestScore = norm;
        bestLabel = label;
      }
    }

    if (bestScore <= 0.35 && bestLabel) {
      return bestLabel;
    }

    return cleaned;
  }

  const out: Record<MetricKey, string[]> = {} as Record<MetricKey, string[]>;

  for (const metric of metricKeys) {
    const values = Array.isArray(data?.[metric]) ? data[metric] : [];
    const normalized: string[] = [];
    for (let i = 0; i < 4; i++) {
      normalized.push(canonicalize(values[i], metric, i));
     }
    out[metric] = normalized;
  }

  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Advanced-explain  — one natural-language sentence per sub-metric
 * Output shape:
 *   { cheekbones:{width,maxilla,bone_structure,face_fat},
 *     jawline:{development,gonial_angle,projection},
 *     eyes:{canthal_tilt,eye_type,brow_volume,symmetry},
 *     skin:{color,quality} }
 * ─────────────────────────────────────────────────────────────────────────── */

// Bump this string whenever the advanced prompt or JSON shape changes — it
// busts any in-process cached responses that were built under the old schema.
const PROMPT_VERSION_ADVANCED = "adv.v2.1";

const ADVANCED_VERDICT_OPTIONS = `
VERDICT LABELS — for each sub-metric also return a "verdict" field as described below.

LABEL-BASED sub-metrics: pick EXACTLY ONE label from the allowed list (1–3 words, case-sensitive).

cheekbones.width_verdict:          Ideal Width | Well Spaced | Moderate Width | Narrow | Too Wide
cheekbones.maxilla_verdict:        Well Developed | Forward Set | Adequate | Underdeveloped | Recessed
cheekbones.bone_structure_verdict: Sculpted | Well Defined | Defined | Moderate | Flat
cheekbones.face_fat_verdict:       Very Lean | Lean | Athletic | Moderate | Full | Puffy
jawline.development_verdict:       Razor Sharp | Well Defined | Chiseled | Moderate | Minimal | Weak
jawline.projection_verdict:        Strong | Good Projection | Proportional | Moderate | Weak | Recessed
eyes.eye_type_verdict:             Hunter | Almond | Upturned | Neutral | Slightly Hooded | Downturned | Prey Eyes
eyes.brow_volume_verdict:          Full | Well Defined | Adequate | Moderate | Sparse | Thin
eyes.symmetry_verdict:             Symmetrical | Well Balanced | Minimal Asymmetry | Slight Asymmetry | Noticeable
skin.color_verdict:                Even Tone | Clear | Mostly Even | Slight Uneven | Uneven | Discolored
skin.quality_verdict:              Flawless | Very Smooth | Smooth | Moderate | Rough | Damaged

NUMERICAL sub-metrics: return a measured value, not a label.

eyes.canthal_tilt_verdict:
  - Estimate the outer-corner tilt angle in degrees from the image.
  - Positive = outer corner tilts upward. Negative = downward. Zero = level.
  - Format: signed integer followed by ° symbol. Examples: +5°, +2°, 0°, -3°, -7°
  - Realistic range: -8° to +8°. Do NOT exceed this range.

jawline.gonial_angle_verdict:
  - Estimate the gonial angle (jaw corner angle) in degrees from the image.
  - Format: integer followed by ° symbol. Examples: 98°, 108°, 118°, 128°
  - Realistic range: 90° to 140°. Ideal is 95–115°. Do NOT exceed this range.
`.trim();

const ADVANCED_SYSTEM_PROMPT = `
You are a calibrated facial-aesthetics analyst. Score and describe each sub-metric based strictly on what is visible in the image.

SCORING RULES — follow exactly:
- Scores are 0–100. The realistic population distribution is: most people 35–65, above average 66–74, strong 75–84, exceptional 85+.
- Do NOT inflate scores. An average feature scores 45–55. A feature must be visibly pronounced to score above 70.
- Sub-metric scores within each category must average close to the provided category score. If category score is 55, sub-metric scores must average near 55, not 65+.
- When uncertain, score lower rather than higher. Optimism is a calibration error.

COMMENTARY RULES:
- One sentence per sub-metric (15–80 words). Present tense. Clinical, neutral tone.
- No medical advice, no ethnicity or identity claims, no emojis, no markdown.
- Lead with the dominant visible cue. Add one concrete direction only if improvement is realistic.
- If a feature is genuinely strong, confirm it plainly without filler praise.

${ADVANCED_VERDICT_OPTIONS}

Return STRICT JSON with this exact shape and no other text:

{
  "cheekbones": {
    "width":                "<sentence>", "width_score":          <integer 0-100>, "width_verdict":          "<label>",
    "maxilla":              "<sentence>", "maxilla_score":        <integer 0-100>, "maxilla_verdict":        "<label>",
    "bone_structure":       "<sentence>", "bone_structure_score": <integer 0-100>, "bone_structure_verdict": "<label>",
    "face_fat":             "<sentence>", "face_fat_score":       <integer 0-100>, "face_fat_verdict":       "<label>"
  },
  "jawline": {
    "development":          "<sentence>", "development_score":    <integer 0-100>, "development_verdict":    "<label>",
    "gonial_angle":         "<sentence>", "gonial_angle_score":   <integer 0-100>, "gonial_angle_verdict":   "<label>",
    "projection":           "<sentence>", "projection_score":     <integer 0-100>, "projection_verdict":     "<label>"
  },
  "eyes": {
    "canthal_tilt":         "<sentence>", "canthal_tilt_score":   <integer 0-100>, "canthal_tilt_verdict":   "<label>",
    "eye_type":             "<sentence>", "eye_type_score":       <integer 0-100>, "eye_type_verdict":       "<label>",
    "brow_volume":          "<sentence>", "brow_volume_score":    <integer 0-100>, "brow_volume_verdict":    "<label>",
    "symmetry":             "<sentence>", "symmetry_score":       <integer 0-100>, "symmetry_verdict":       "<label>"
  },
  "skin": {
    "color":                "<sentence>", "color_score":          <integer 0-100>, "color_verdict":          "<label>",
    "quality":              "<sentence>", "quality_score":        <integer 0-100>, "quality_verdict":        "<label>"
  }
}
`.trim();

export type AdvancedExplainResult = {
  cheekbones: {
    width: string; width_score: number; width_verdict: string;
    maxilla: string; maxilla_score: number; maxilla_verdict: string;
    bone_structure: string; bone_structure_score: number; bone_structure_verdict: string;
    face_fat: string; face_fat_score: number; face_fat_verdict: string;
  };
  jawline: {
    development: string; development_score: number; development_verdict: string;
    gonial_angle: string; gonial_angle_score: number; gonial_angle_verdict: string;
    projection: string; projection_score: number; projection_verdict: string;
  };
  eyes: {
    canthal_tilt: string; canthal_tilt_score: number; canthal_tilt_verdict: string;
    eye_type: string; eye_type_score: number; eye_type_verdict: string;
    brow_volume: string; brow_volume_score: number; brow_volume_verdict: string;
    symmetry: string; symmetry_score: number; symmetry_verdict: string;
  };
  skin: {
    color: string; color_score: number; color_verdict: string;
    quality: string; quality_score: number; quality_verdict: string;
  };
};

export async function explainAdvancedBytes(
  client: OpenAI,
  bytes: Buffer,
  mime: string,
  scores: Scores
): Promise<AdvancedExplainResult> {
  const img64 = bytes.toString("base64");

  const userText = `
Category scores (0–100) — your sub-metric scores MUST average close to these per category:
- cheekbones: ${scores.cheekbones ?? "?"}
- jawline: ${scores.jawline ?? "?"}
- eyes_symmetry: ${scores.eyes_symmetry ?? "?"}
- skin_quality: ${scores.skin_quality ?? "?"}

Analyze the image. For each sub-metric return a score (integer) and one sentence.
Remember: most people score 35–65. Do not inflate. JSON only.
`.trim();

  const resp = await withRetry(
    () =>
      client.chat.completions.create({
        model: MODEL,
        temperature: 0.45,
        top_p: 0.9,
        max_tokens: 1150,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ADVANCED_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: `data:${mime};base64,${img64}` } },
            ],
          },
        ],
      }),
    {
      maxAttempts: 2,
      baseDelayMs: 1200,
      onRetry: (attempt, err, delay) => {
        console.warn(
          `[explain-advanced] retry ${attempt}: ${(err as Error).message}, waiting ${Math.round(delay)}ms`
        );
      },
    }
  );

  const raw = resp.choices?.[0]?.message?.content ?? "{}";
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = JSON.parse(raw.replace(/```json|```/g, "").trim() || "{}");
  }

  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
  const num = (v: unknown): number =>
    typeof v === "number" && isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : 50;
  // Clamp verdict to 30 chars and ensure it's a non-empty string; fall back to "".
  const vrd = (v: unknown): string => {
    if (typeof v !== "string" || !v.trim()) return "";
    return v.trim().slice(0, 30);
  };

  return {
    cheekbones: {
      width:                str(data?.cheekbones?.width,                ""),
      width_score:          num(data?.cheekbones?.width_score),
      width_verdict:        vrd(data?.cheekbones?.width_verdict),
      maxilla:              str(data?.cheekbones?.maxilla,              ""),
      maxilla_score:        num(data?.cheekbones?.maxilla_score),
      maxilla_verdict:      vrd(data?.cheekbones?.maxilla_verdict),
      bone_structure:       str(data?.cheekbones?.bone_structure,       ""),
      bone_structure_score: num(data?.cheekbones?.bone_structure_score),
      bone_structure_verdict: vrd(data?.cheekbones?.bone_structure_verdict),
      face_fat:             str(data?.cheekbones?.face_fat,             ""),
      face_fat_score:       num(data?.cheekbones?.face_fat_score),
      face_fat_verdict:     vrd(data?.cheekbones?.face_fat_verdict),
    },
    jawline: {
      development:          str(data?.jawline?.development,       ""),
      development_score:    num(data?.jawline?.development_score),
      development_verdict:  vrd(data?.jawline?.development_verdict),
      gonial_angle:         str(data?.jawline?.gonial_angle,      ""),
      gonial_angle_score:   num(data?.jawline?.gonial_angle_score),
      gonial_angle_verdict: vrd(data?.jawline?.gonial_angle_verdict),
      projection:           str(data?.jawline?.projection,        ""),
      projection_score:     num(data?.jawline?.projection_score),
      projection_verdict:   vrd(data?.jawline?.projection_verdict),
    },
    eyes: {
      canthal_tilt:         str(data?.eyes?.canthal_tilt,      ""),
      canthal_tilt_score:   num(data?.eyes?.canthal_tilt_score),
      canthal_tilt_verdict: vrd(data?.eyes?.canthal_tilt_verdict),
      eye_type:             str(data?.eyes?.eye_type,          ""),
      eye_type_score:       num(data?.eyes?.eye_type_score),
      eye_type_verdict:     vrd(data?.eyes?.eye_type_verdict),
      brow_volume:          str(data?.eyes?.brow_volume,       ""),
      brow_volume_score:    num(data?.eyes?.brow_volume_score),
      brow_volume_verdict:  vrd(data?.eyes?.brow_volume_verdict),
      symmetry:             str(data?.eyes?.symmetry,          ""),
      symmetry_score:       num(data?.eyes?.symmetry_score),
      symmetry_verdict:     vrd(data?.eyes?.symmetry_verdict),
    },
    skin: {
      color:           str(data?.skin?.color,         ""),
      color_score:     num(data?.skin?.color_score),
      color_verdict:   vrd(data?.skin?.color_verdict),
      quality:         str(data?.skin?.quality,       ""),
      quality_score:   num(data?.skin?.quality_score),
      quality_verdict: vrd(data?.skin?.quality_verdict),
    },
  };
}

function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aLen][bLen];
}
