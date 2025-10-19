// scorer-node/src/explainer.ts
import OpenAI from "openai";
import crypto from "crypto";
import { Scores, metricKeys, type MetricKey } from "./validators.js";

/**
 * Explainer goals
 * - Deterministic per image (or image pair) + scores
 * - Four ultra-concise lines per metric (mapped to UI sub-metrics)
 * - Pairs must actually use both views
 * - Strict JSON output only
 */

const MODEL = process.env.OPENAI_EXPLAINER_MODEL || "gpt-4o-mini";
const PROMPT_VERSION_EXPLAIN = "exp.v4.0"; // json schema + severity bands

const CACHE_TTL_MS = Number(process.env.EXPLAINER_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24 * 30); // 30d
const CACHE_MAX_ITEMS = Number(process.env.EXPLAINER_CACHE_MAX_ITEMS ?? 5000);

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

function formatCategoryRules(allowed: SubmetricOptions): string {
  const lines: string[] = [
    "Label discipline:",
    "- For EACH sub-metric choose EXACTLY one label from the allowed list.",
    "- Return only the label text (case-sensitive). No extra words, punctuation, or commentary.",
    "- If uncertain, pick the harsher label within the list. Never invent new labels.",
    "Allowed options per sub-metric:",
  ];

  for (const metric of metricKeys) {
    const submetrics = SUBMETRIC_ORDER[metric];
    const metricLabel = metric === "sexual_dimorphism" ? "masculinity cues" : metric.replace(/_/g, " ");
    lines.push(`- ${metricLabel}:`);
    if (submetrics) {
      submetrics.forEach((sub, idx) => {
        const opts = optionsForSlot(metric, idx, allowed);
        if (!opts.length) return;
        lines.push(`  - ${sub}: ${opts.join(" | ")}`);
      });
    }
  }

  return lines.join("\n");
}

/* ------------------------------ System prompt ----------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type SeverityBandRule = {
  minScore: number;
  window: number;
};

const SEVERITY_BAND_RULES: readonly SeverityBandRule[] = [
  { minScore: 85, window: 2 },
  { minScore: 70, window: 3 },
  { minScore: 55, window: 4 },
  { minScore: 40, window: 5 },
  { minScore: 0, window: Number.MAX_SAFE_INTEGER },
];

function bandOptions(options: readonly string[], score: number): readonly string[] {
  const list = Array.from(options);
  const len = list.length;
  if (len === 0) return list;

  const severityIndex = clamp(Math.round(((100 - score) / 100) * (len - 1)), 0, len - 1);
  const rule =
    SEVERITY_BAND_RULES.find((band) => score >= band.minScore) ??
    SEVERITY_BAND_RULES[SEVERITY_BAND_RULES.length - 1];
  const span = Math.min(len, Math.max(1, rule.window));
  const start = clamp(severityIndex - (span - 1), 0, len - span);
  const sliced = list.slice(start, start + span);
  if (sliced.length) return sliced;
  return [list[severityIndex]];
}

function buildAllowedOptions(scores: Scores): SubmetricOptions {
  return metricKeys.reduce((acc, metric) => {
    const metricScore = scores[metric] ?? 50;
    const originalOptions = CATEGORY_OPTIONS[metric] ?? [];
    acc[metric] = originalOptions.map((options) => bandOptions(options, metricScore));
    return acc;
  }, {} as SubmetricOptions);
}

function optionsForSlot(
  metric: MetricKey,
  index: number,
  allowed: SubmetricOptions
): readonly string[] {
  const band = allowed[metric]?.[index] ?? [];
  if (band.length) return band;
  const fallback = CATEGORY_OPTIONS[metric]?.[index] ?? [];
  return fallback;
}

function buildResponseSchema(allowed: SubmetricOptions) {
  const properties: Record<string, unknown> = {};

  for (const metric of metricKeys) {
    const items: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 4; i++) {
      const options = Array.from(new Set(optionsForSlot(metric, i, allowed)));
      items.push({ type: "string", enum: options });
    }

    properties[metric] = {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items,
      additionalItems: false,
    };
  }

  return {
    name: "explainer_labels_v4",
    schema: {
      type: "object",
      additionalProperties: false,
      required: metricKeys,
      properties,
    },
  } as const;
}

function buildSystemPrompt(allowed: SubmetricOptions): string {
  const categoryRules = formatCategoryRules(allowed);
  return `
You are a facial aesthetics reviewer. Write observations like a careful stylist: neutral, concise, practical.

Output EXACTLY FOUR short lines per metric, mapped to the following sub-metrics and order:
- eyes_symmetry: ["Shape","Symmetry","Canthal Tilt","Color Vibrancy"]
- jawline: ["Sharpness","Symmetry","Gonial Angle","Projection"]
- cheekbones: ["Definition","Face Fat","Maxilla Development","Bizygomatic Width"]
- nose_harmony: ["Nose Shape","Straightness","Nose Balance","Nose Tip Type"]
- skin_quality: ["Clarity","Smoothness","Evenness","Youthfulness"]
- facial_symmetry: ["Horizontal Alignment","Vertical Balance","Eye-Line Level","Nose-Line Centering"]
- sexual_dimorphism (write as "masculinity cues"): ["Face Power","Hormone Balance","Contour Strength","Softness Level"]

${categoryRules}


Rules
- Describe only what is visible in the image(s). Present tense. No causes, routines, medical, identity or ethnicity claims.
- Keep language simple and respectful. Everyday words only. Avoid jargon like "dimorphism", "malar", "gonial", "dorsum".
- Only output labels from the allowed lists; the JSON schema will reject any other phrasing.
- Each line  110 characters. Include at least one checklist token relevant to the metric.
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

Checklist tokens (use 1 per line):
- jawline: ${METRIC_CHECKLIST.jawline}
- facial_symmetry: ${METRIC_CHECKLIST.facial_symmetry}
- eyes_symmetry: ${METRIC_CHECKLIST.eyes_symmetry}
- cheekbones: ${METRIC_CHECKLIST.cheekbones}
- nose_harmony: ${METRIC_CHECKLIST.nose_harmony}
- skin_quality: ${METRIC_CHECKLIST.skin_quality}
- masculinity cues: ${METRIC_CHECKLIST.sexual_dimorphism}
`.trim();
}


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

  const allowedOptions = buildAllowedOptions(scores);
  const responseSchema = buildResponseSchema(allowedOptions);
  const systemPrompt = buildSystemPrompt(allowedOptions);

  const key = cacheKeySingleExplain(bytes, scores);

  const cached = lruGet(key);
  if (cached) return cached;

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 1300,
      response_format: {
        type: "json_schema",
        json_schema: responseSchema,
      },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${mime};base64,${img64}` } },
          ],
        },
      ],
    });

    const parsed = normalizeResponse(resp.choices?.[0]?.message?.content, scores, allowedOptions);
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

  const allowedOptions = buildAllowedOptions(scores);
  const responseSchema = buildResponseSchema(allowedOptions);
  const systemPrompt = buildSystemPrompt(allowedOptions);

  const key = cacheKeyPairExplain(frontalBytes, sideBytes, scores);

  const cached = lruGet(key);
  if (cached) return cached;

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: responseSchema,
      },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${frontalMime};base64,${f64}` } }, // frontal
            { type: "image_url", image_url: { url: `data:${sideMime};base64,${s64}` } },     // profile
          ],
        },
      ],
    });

    const parsed = normalizeResponse(resp.choices?.[0]?.message?.content, scores, allowedOptions);
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

function normalizeResponse(
  raw: string | null | undefined,
  scores: Scores,
  allowedOptions: SubmetricOptions
): Record<MetricKey, string[]> {
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
    const slotMaps: Array<Record<string, string>> = [];
    for (let i = 0; i < 4; i++) {
      const slotOptions = optionsForSlot(metric, i, allowedOptions);
      const map: Record<string, string> = {};
      for (const option of slotOptions) {
        const key = slug(option);
        if (key) map[key] = option;
      }
      slotMaps.push(map);
    }
    acc[metric] = slotMaps;
    return acc;
  }, {} as Record<MetricKey, Array<Record<string, string>>>);

  function pickFallback(
    metric: MetricKey,
    index: number,
    score: number,
    allowed: SubmetricOptions
  ): string {
    const options = optionsForSlot(metric, index, allowed);
    if (!options.length) return "";
    const len = options.length;
    const severityIndex = clamp(Math.round(((100 - score) / 100) * (len - 1)), 0, len - 1);
    return options[severityIndex];
  }

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
    if (!map || Object.keys(map).length === 0) return "";

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

    return "";
  }

  const out: Record<MetricKey, string[]> = {} as Record<MetricKey, string[]>;

  for (const metric of metricKeys) {
    const values = Array.isArray(data?.[metric]) ? data[metric] : [];
    const normalized: string[] = [];
    const metricScore = scores[metric] ?? 50;
    for (let i = 0; i < 4; i++) {
      const canonical = canonicalize(values[i], metric, i);
      if (canonical) {
        normalized.push(canonical);
        continue;
      }
      normalized.push(pickFallback(metric, i, metricScore, allowedOptions));
    }
    out[metric] = normalized;
  }

  return out;
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
