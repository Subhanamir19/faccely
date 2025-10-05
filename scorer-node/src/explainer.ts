// C:\SS\scorer-node\src\explainer.ts
import OpenAI from "openai";
import crypto from "crypto";
import { Scores, metricKeys, type MetricKey } from "./validators";

/**
 * Explainer goals
 * - Deterministic per image (or image pair) + scores
 * - Two ultra-concise lines per metric, not generic templates
 * - Pairs must actually use both views
 * - Strict JSON output only
 */

const MODEL = process.env.OPENAI_EXPLAINER_MODEL || "gpt-4o-mini";
const PROMPT_VERSION_EXPLAIN = "exp.v2.0";
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

/* --------------------------- Prompt Constraints --------------------------- */

const METRIC_CHECKLIST = {
  jawline: `["edge","angle","under-jaw","chin center","jaw corner"]`,
  facial_symmetry: `["left/right","tilt","height","width","offset"]`,
  eyes_symmetry: `["left/right","tilt","height","spacing","set"]`,
  cheekbones: `["projection","height","lift","contour"]`,
  nose_harmony: `["proportion","bridge","straight","blend","profile"]`,
  skin_quality: `["texture","even","clarity","reflect","noise","shadow","light"]`,
  sexual_dimorphism: `["brow","jaw","lips","contour","cheek"]`,
};

const SYSTEM_PROMPT_BASE = `
You are a facial aesthetician. Write ultra-concise, plain-English observations.

For each metric, output EXACTLY TWO lines:
• Line 1 — Tier verdict + key visible trait (dominant strength for Strong/Elite, primary limitation for Developing/Emerging).
• Line 2 — A single targeted refinement ONLY if useful; if already ideal, say: "already meets the standard; no adjustment needed."

Hard rules
- Describe only what is visible. Present tense. No causes, products, routines, medical or identity claims.
- No identity/ethnicity/age/health inferences. Neutral, respectful clinical phrasing.
- Use everyday words only. BAN: dimorphism, malar, gonial, dorsum, anthropometry, ratio.
- No filler or hedging: avoid "looks good", "decent", "might", "probably", "consider", "you should".
- Each line ≤ 110 characters. No emojis. No markdown. Output STRICT JSON only with fixed keys.
- Use ≥1 checklist token in EACH line for the relevant metric (see lists below).
- Prefer a contrast word in Line 2 when proposing a change: "however", "but", "whereas", "while".
- Do NOT repeat the same sentence or lever text across multiple metrics; vary wording appropriately.

Tone control by tier
- Developing/Emerging: avoid praise adjectives ("strong", "clean", "sharp", "aligned").
- Strong/Elite: such adjectives MAY appear once, modestly.
- Never insulting; use phrasing like "less defined", "heaviness", "reduced clarity".

Action requirement for low tiers (Developing/Emerging)
- Line 2 MUST select EXACTLY ONE lever and phrase it succinctly:
  1) Contour/definition: sharpen edge/angle/contour; reduce under-jaw softening; clarify jaw corner or chin center.
  2) Volume/redistribution: reduce heaviness; restore lift/height/projection; adjust midface fullness for clearer contour.
  3) Alignment/proportion: even left/right height/tilt/spacing; smooth bridge or profile blend; balance width/offset.
  4) Surface/texture/light: even texture and reflect; reduce shadow bands or noise; prefer even light for clarity.
  5) Openness/visibility: reduce brow heaviness; lift lid set; clear under-eye shadow to steady the set.
  6) Grooming/styling: shape hair/brow/lip lines that clarify contour/edge/height without changing identity.
  7) Camera hygiene (ONLY if visibility is impaired): neutral frontal angle and even light to reveal true edge/contour.

Metric checklists (each line must include ≥1 token)
- jawline: ${METRIC_CHECKLIST.jawline}
- facial_symmetry: ${METRIC_CHECKLIST.facial_symmetry}
- eyes_symmetry: ${METRIC_CHECKLIST.eyes_symmetry}
- cheekbones: ${METRIC_CHECKLIST.cheekbones}
- nose_harmony: ${METRIC_CHECKLIST.nose_harmony}
- skin_quality: ${METRIC_CHECKLIST.skin_quality}
- sexual_dimorphism (write as "masculinity/femininity cues"): ${METRIC_CHECKLIST.sexual_dimorphism}

Symmetry rule
- If asymmetry is visible, NAME the side (“left/right height/tilt/spacing”). Do NOT say “some asymmetry”.

Lighting/occlusion hygiene
- If lighting/angle/makeup clearly soften edges, you may state it once as a visibility note in Line 1 or 2.

Anti-template discipline
- Do not reuse identical phrases across metrics or across different requests. Wording must reflect the actual cues and tiers.

Return STRICT JSON ONLY:
{
  "jawline": [line1, line2],
  "facial_symmetry": [line1, line2],
  "skin_quality": [line1, line2],
  "cheekbones": [line1, line2],
  "eyes_symmetry": [line1, line2],
  "nose_harmony": [line1, line2],
  "sexual_dimorphism": [line1, line2]
}
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
Tier mapping (use EXACT words):
- 0–30 Developing
- 31–60 Emerging
- 61–80 Strong
- 81–100 Elite
`.trim();

  const userText = `
You are given: (a) a single face image, (b) numeric scores (0–100).

${tierGuide}

Requirements:
- Compute the tier word for each metric from the score range above. Do NOT change scores.
- Use the image to pick concrete visible traits so the lines are not generic.
- Each line must include ≥1 checklist token for that metric.
- JSON only, exactly two lines per metric.

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
      max_tokens: 900,
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
  })()
    .finally(() => inFlight.delete(key));

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
Tier mapping (use EXACT words):
- 0–30 Developing
- 31–60 Emerging
- 61–80 Strong
- 81–100 Elite
`.trim();

  const userText = `
You are given TWO images of the SAME face: first = frontal, second = right-side profile, plus numeric scores (0–100).

${tierGuide}

Pair-specific discipline:
- Use BOTH views to decide which visible trait to mention. If a cue is profile-only (e.g., cervicomental angle, bridge blend), prefer Line 1 or 2 to mention that cue.
- When a trait is clearly frontal-only vs profile-only, you MAY include a brief locator token like "(frontal)" or "(profile)" once.
- For symmetry, name specific side and dimension: "left/right height/tilt/spacing".
- Each line must include ≥1 checklist token for that metric.
- JSON only, exactly two lines per metric.

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
      max_tokens: 1100,
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
  })()
    .finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

/* --------------------------------- Keys ----------------------------------- */

function cacheKeySingleExplain(image: Buffer, scores: Scores) {
  // Deterministic key based on image content, scores, model, and prompt version
  const imgHash = sha256Hex(image);
  const scoreHash = sha256Hex(JSON.stringify(scores));
  return sha256Hex(`EXP|SINGLE|${MODEL}|${PROMPT_VERSION_EXPLAIN}|${imgHash}|${scoreHash}`);
}

function cacheKeyPairExplain(frontal: Buffer, side: Buffer, scores: Scores) {
  const fHash = sha256Hex(frontal);
  const sHash = sha256Hex(side);
  const scoreHash = sha256Hex(JSON.stringify(scores));
  // Order matters: frontal then side
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

  const normalizeTwo = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return ["", ""];
    const lines = arr
      .filter((x) => typeof x === "string")
      .map((s) => String(s).trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 2);
    while (lines.length < 2) lines.push("");
    // cap to 110 chars each
    return lines.map((s) => (s.length > 110 ? s.slice(0, 110).trim() : s));
  };

  for (const k of metricKeys) {
    out[k] = normalizeTwo(data?.[k]);
  }

  // Optional: minimal de-duplication guard. If both lines are identical, nudge Line 2.
  for (const k of metricKeys) {
    const [a, b] = out[k];
    if (a && b && a.toLowerCase() === b.toLowerCase()) {
      out[k][1] = b + " (refine)";
    }
  }

  return out;
}
