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
const PROMPT_VERSION_EXPLAIN = "exp.v3.0"; // bumped
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
  eyes_symmetry: ["Symmetry", "Shape", "Canthal Tilt", "Color"],
  jawline: ["Sharpness", "Symmetry", "Gonial Angle", "Projection"],
  cheekbones: ["Definition", "Face Fat", "Maxilla Development", "Bizygomatic Width"],
  nose_harmony: ["Nose Shape", "Straightness", "Nose Balance", "Nose Tip Type"],
  skin_quality: ["Clarity", "Smoothness", "Evenness", "Youthfulness"],
  facial_symmetry: ["Horizontal Alignment", "Vertical Balance", "Eye-Line Level", "Nose-Line Centering"],
  sexual_dimorphism: ["Face Power", "Hormone Balance", "Contour Strength", "Softness Level"],
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

/* ------------------------------ System prompt ----------------------------- */

const SYSTEM_PROMPT_BASE = `
You are a facial aesthetics reviewer. Write observations like a careful stylist: neutral, concise, practical.

Output EXACTLY FOUR short lines per metric, mapped to the following sub-metrics and order:
- eyes_symmetry: ["Symmetry","Shape","Canthal Tilt","Color"]
- jawline: ["Sharpness","Symmetry","Gonial Angle","Projection"]
- cheekbones: ["Definition","Face Fat","Maxilla Development","Bizygomatic Width"]
- nose_harmony: ["Nose Shape","Straightness","Nose Balance","Nose Tip Type"]
- skin_quality: ["Clarity","Smoothness","Evenness","Youthfulness"]
- facial_symmetry: ["Horizontal Alignment","Vertical Balance","Eye-Line Level","Nose-Line Centering"]
- sexual_dimorphism (write as "masculinity cues"): ["Face Power","Hormone Balance","Contour Strength","Softness Level"]

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
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 1300,
      response_format: { type: "json_object" },
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
    });

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
    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 1500,
      response_format: { type: "json_object" },
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
    });

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

  const out: Record<MetricKey, string[]> = {} as any;

  const normalizeFour = (arr: unknown, metric: MetricKey): string[] => {
    if (!Array.isArray(arr)) return ["", "", "", ""];
    const lines = arr
      .filter((x) => typeof x === "string")
      .map((s) => String(s).trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 4);
    while (lines.length < 4) lines.push("");
    // Cap to 110 chars each
    for (let i = 0; i < 4; i++) {
      if (lines[i].length > 110) lines[i] = lines[i].slice(0, 110).trim();
    }
    // Gentle guard: if the model ignored ordering, still return 4 trimmed lines.
    return lines;
  };

  for (const k of metricKeys) {
    out[k] = normalizeFour(data?.[k], k);
  }

  // Minimal de-duplication guard: nudge repeated lines slightly.
  for (const k of metricKeys) {
    const seen = new Set<string>();
    out[k] = out[k].map((line) => {
      const lower = line.toLowerCase();
      if (!line) return line;
      if (seen.has(lower)) return `${line} (refine)`;
      seen.add(lower);
      return line;
    });
  }

  return out;
}
