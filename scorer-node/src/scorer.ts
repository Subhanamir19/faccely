// C:\SS\scorer-node\src\scorer.ts
import OpenAI from "openai";
import type { Scores, MetricKey } from "./validators.js";
import { normalizeToPngDataUrl } from "./lib/image-normalize.js";
import crypto from "crypto";

/* ------------------------------ Config/Env -------------------------------- */

const MODEL = process.env.OPENAI_SCORES_MODEL || "gpt-4o";
const FALLBACK_MODEL_ENV = process.env.OPENAI_SCORES_MODEL_FALLBACK?.trim();
const FALLBACK_MODEL =
  FALLBACK_MODEL_ENV && FALLBACK_MODEL_ENV.length > 0 ? FALLBACK_MODEL_ENV : "gpt-4o-mini";

const CACHE_TTL_MS = Number(process.env.SCORE_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24 * 30); // 30d
const CACHE_MAX_ITEMS = Number(process.env.SCORE_CACHE_MAX_ITEMS ?? 5000); // simple LRU-ish cap
const PROMPT_VERSION = "v3.3"; // bump to invalidate cache if you change prompts/rules

/* ------------------------------- Shared keys ------------------------------ */
const SCORE_KEYS: MetricKey[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

/* --------------------------------- Utils ---------------------------------- */
function preview(buf?: Buffer) {
  if (!buf) return "nil";
  const head = buf.slice(0, 12).toString("hex");
  return `${buf.length}B ${head}`;
}

// Aliases we accept from older/looser prompts; mapped to canonical schema keys.
const KEY_ALIASES: Record<string, keyof Scores> = {
  symmetry: "facial_symmetry",
  eyes: "eyes_symmetry",
  nose: "nose_harmony",
};

function sha256Hex(s: string | Buffer) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function cacheKeySingle(dataUrl: string): string {
  return sha256Hex(
    `SINGLE|${MODEL}|${PROMPT_VERSION}|${dataUrl.length}|${sha256Hex(dataUrl)}`
  );
}
function cacheKeyPair(frontal: string, side: string): string {
  return sha256Hex(
    `PAIR|${MODEL}|${PROMPT_VERSION}|${frontal.length}|${sha256Hex(
      frontal
    )}|${side.length}|${sha256Hex(side)}`
  );
}

/* ------------------------------ In-memory cache --------------------------- */
/** Very small LRU-ish cache with TTL and size cap. Pluggable later with Redis. */
type CacheEntry = { value: Scores; ts: number };
const memCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Scores>>(); // in-flight de-duplication

let scoresResponseFormatLogged = false;

const MODEL_SEQUENCE: string[] = Array.from(
  new Set(
    [MODEL, FALLBACK_MODEL]
      .map((m) => m?.trim())
      .filter((m): m is string => !!m && m.length > 0)
  )
);

function cacheGet(key: string): Scores | null {
  const now = Date.now();
  const hit = memCache.get(key);
  if (!hit) return null;
  if (now - hit.ts > CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  // refresh recency
  memCache.delete(key);
  memCache.set(key, { ...hit, ts: now });
  return hit.value;
}

function cacheSet(key: string, value: Scores) {
  // size cap
  if (memCache.size >= CACHE_MAX_ITEMS) {
    // delete oldest entry (first inserted)
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, { value, ts: Date.now() });
}

/* --------------------------- System prompts ------------------------------- */
const SCHEMA_KEYS_SENTENCE = `Keys must be exactly: ${SCORE_KEYS.join(
  ", "
)}. Values are integers 0–100. Do not include any other fields or commentary.`;

const ANTI_FIVE_SENTENCE = `
IMPORTANT OUTPUT DISCIPLINE:
- Do NOT quantize to 5-point steps (…, 55, 60, 65, …). Avoid step patterns and round-number bias.
- Scores must be integers 0–100, but do not preferentially choose numbers ending in 0 or 5.
- If your internal estimate lands near a multiple of 5, choose the nearest NON-5 integer instead (e.g., 63 or 68 instead of 65).
`.trim();

const RANGE_DISCIPLINE = `
RANGE DISCIPLINE (NO REGRESSION TO THE MEAN):
- Use the FULL 0–100 range where evidence warrants it. Do NOT cluster around 60–75 without strong cues.
- Low scores are allowed when visible cues are weak/negative; high scores are allowed when cues are strong/clear.
- If all metrics would land in a narrow band (e.g., 60–75) without strong justification, widen the spread to reflect the strongest and weakest signals actually observed.
- Never "balance" a low metric by inflating an unrelated metric. Each metric is independent and evidence-based.
`.trim();

const CATEGORY_GUIDE = `
CATEGORIZATION GUIDE (decide the qualitative tier, then pick the specific score):
- 0–35 "Needs attention": Strong negative or absent cues that dominate the observation.
- 36–55 "Developing": Mixed signals; definition emerging but offset by notable inconsistencies.
- 56–75 "Refined": Solid, reliable cues with only light softness or minor imbalance.
- 76–100 "Elite": Clearly distinguished cues with professional-grade definition and harmony.
Do NOT collapse around the middle; pick the tier that best matches visible evidence.
Within a tier, spread scores so the strongest and weakest metrics stay differentiated.
`.trim();

const TIER_ANCHORS = `
CALIBRATION ANCHORS (determine the tier first, then pick an integer inside it):
- jawline:
  * 15–30: Blurred mandibular edge, heavy under-jaw softness, gonial corner hidden.
  * 31–50: Edge partially defined but softened by submental fold or shallow chin line.
  * 51–72: Visible jaw trace with minor waviness or light fullness under the chin.
  * 73–90: Crisp mandibular edge, clean cervicomental angle, distinct chin corner.
- facial_symmetry:
  * 15–30: Clear tilt or offset across eyes, nose, or mouth; contour imbalance obvious.
  * 31–50: Noticeable but moderate cant, eyebrow height mismatch, or nasal drift.
  * 51–72: Mostly aligned features with small height/width offsets.
  * 73–90: Balanced feature heights, centered nasal axis, matching contours.
- skin_quality:
  * 15–30: Prominent texture, breakouts, or uneven lighting revealing roughness.
  * 31–50: Mixed smooth and rough zones, patchy tone, visible pores or shine bands.
  * 51–72: Generally smooth with isolated texture or mild tonal variation.
  * 73–90: Even tone, soft gradients, minimal visible blemishes or roughness.
- cheekbones:
  * 15–30: Flat midface, little malar lift, shadow collapses toward mouth.
  * 31–50: Slight cheek shelf but weak projection or blurred contour line.
  * 51–72: Defined highlight with moderate lift and some cheek hollow separation.
  * 73–90: Strong zygomatic projection, lifted highlight, clean midface contour.
- eyes_symmetry:
  * 15–30: Marked difference in lid height, tilt, or spacing; one eye noticeably smaller.
  * 31–50: Moderate asymmetry in canthal tilt, crease height, or inner corner alignment.
  * 51–72: Lids largely matched with small tilt or height variations.
  * 73–90: Aligned inner/outer corners, consistent aperture, even creases.
- nose_harmony:
  * 15–30: Strong deviation, flattened tip, or width out of balance with midface.
  * 31–50: Noticeable bridge bend, bulbous tip, or flared width yet still centered overall.
  * 51–72: Mostly straight bridge with modest tip softness or slight width mismatch.
  * 73–90: Straight dorsum, defined yet proportional tip, width blends with cheeks.
- sexual_dimorphism:
  * 15–30: Traits strongly contrast typical masculine bone/soft-tissue cues (soft jaw, rounded brow, low mass).
  * 31–50: Mixed cues; some angularity but softened by fuller contours or gentle brow.
  * 51–72: Noticeable angularity with moderate contour depth and definition.
  * 73–90: Pronounced structural power—firm jaw, defined brow, lean midface.
Choose numbers outside these bands only for extreme cases beyond the descriptions above.
`.trim();

const SYSTEM_MSG_SINGLE = `
You are a facial aesthetician. Judge only visible facial structure from the provided image.
Return neutral, professional evaluations against a defined aesthetic rubric.
Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes.
No medical claims or sexual content. If content is unclear/occluded/low-res, increase uncertainty but do NOT inflate scores.

${CATEGORY_GUIDE}


Scoring (0–100, integers only, independent per metric):
- jawline: mandibular outline sharpness, gonial angle definition, submental shadow/line, cervicomental angle.
- facial_symmetry: left/right feature alignment (eyes, brows, nasal axis, mouth cant), contour parity.
- skin_quality: apparent smoothness, uniform tone, visible texture/blemishes, specular consistency.
- cheekbones: zygomatic projection, malar highlight continuity, midface contour depth.
- eyes_symmetry: palpebral aperture parity, canthal tilt alignment, lid crease consistency.
- nose_harmony: dorsum straightness, tip definition, width vs midface balance, deviation.
- sexual_dimorphism: degree of culturally typical trait expression in bone/soft-tissue proportions. Do NOT infer identity.

${TIER_ANCHORS}

${RANGE_DISCIPLINE}

Anti-inflation rules:
- Any metric may be low if cues indicate; do not compensate with unrelated positives.
- If cues conflict, prioritize the clearest high-signal cues; do not average toward 50.
- No praise words, no prose, no explanations in the output.

${ANTI_FIVE_SENTENCE}

OUTPUT FORMAT:
Return one strict JSON object with exactly seven keys and integer values 0–100.
Keys must be exactly: ${SCORE_KEYS.join(", ")}.
Do not include any other fields or commentary.

VALID EXAMPLE (structure only, not real values):
{"jawline": 72, "facial_symmetry": 41, "skin_quality": 68, "cheekbones": 59, "eyes_symmetry": 74, "nose_harmony": 33, "sexual_dimorphism": 86}
`.trim();

const SYSTEM_MSG_PAIR = `
You are a facial aesthetician. Judge only visible facial structure from the TWO provided images (frontal and right-side profile).
Return neutral, professional evaluations against the rubric.
Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes.
No medical claims or sexual content. If content is unclear/occluded/low-res, increase uncertainty but do NOT inflate scores.

Metrics and scoring same as single-image prompt.
Rules: Use BOTH views to refine judgments (e.g., jawline, cheekbones, symmetry, nose). If views disagree, still output a single score per metric.

${CATEGORY_GUIDE}

${TIER_ANCHORS}

${RANGE_DISCIPLINE}
${ANTI_FIVE_SENTENCE}

OUTPUT FORMAT:
Return one strict JSON object with exactly seven keys and integer values 0–100.
Keys must be exactly: ${SCORE_KEYS.join(", ")}.
Do not include any other fields or commentary.

VALID EXAMPLE (structure only, not real values):
{"jawline": 69, "facial_symmetry": 28, "skin_quality": 77, "cheekbones": 64, "eyes_symmetry": 71, "nose_harmony": 39, "sexual_dimorphism": 83}
`.trim();

/* ----------------------------- User prompts ------------------------------- */
const USER_PROMPT_SINGLE = `Score this face per the rubric. Return ONLY a JSON object with exactly these keys: ${SCORE_KEYS.join(
  ", "
)}. Values must be integers 0–100 and should not preferentially end in 0 or 5. No extra fields.`.trim();

const USER_PROMPT_PAIR = `Score using BOTH images (frontal then right-side). Return ONLY a JSON object with exactly these keys: ${SCORE_KEYS.join(
  ", "
)}. Values must be integers 0-100 and should not preferentially end in 0 or 5. No extra fields.`.trim();

function isAllZero(scores: Scores): boolean {
  return SCORE_KEYS.every((key) => scores[key] === 0);
}

function logModelFailure(scope: "single" | "pair", model: string, err: unknown, attempt: number) {
  const message =
    (err as any)?.message || (err as any)?.name || (typeof err === "string" ? err : "unknown_error");
  console.warn(`[${scope}] model ${model} attempt ${attempt} failed: ${message}`);
}

/* --------------------------------- API ------------------------------------ */
export async function scoreImageBytes(
  client: OpenAI,
  bytes: Buffer,
  _mime: string
): Promise<Scores> {
  if (!bytes || bytes.length < 64) throw new Error("empty_or_invalid_image_buffer");

  console.log("[scoreImageBytes] input:", preview(bytes));

  const t0 = Date.now();
  const dataUrl = await normalizeToPngDataUrl(bytes, { maxEdge: 1024 });
  console.log("[single] normalize ms =", Date.now() - t0);

  const key = cacheKeySingle(dataUrl);

  // cache hit
  const cached = cacheGet(key);
  if (cached) {
    console.log("[single] cache HIT");
    return cached;
  }

  // in-flight de-duplication
  const existing = inFlight.get(key);
  if (existing) {
    console.log("[single] in-flight dedupe WAIT");
    return existing;
  }

  const task = (async () => {
    let lastErr: any = null;

    for (let i = 0; i < MODEL_SEQUENCE.length; i++) {
      const modelName = MODEL_SEQUENCE[i];
      const attempt = i + 1;
      const attemptStart = Date.now();

      try {
        const response_format: { type: "json_object"; json_schema?: unknown } = {
          type: "json_object",
        };
        if (!scoresResponseFormatLogged) {
          console.log("[RF-CHECK]", {
            type: response_format.type,
            hasSchema: !!response_format.json_schema,
          });
          scoresResponseFormatLogged = true;
        }

        const resp = await client.chat.completions.create({
          model: modelName,
          temperature: 0.1,
          response_format,

          messages: [
            { role: "system", content: SYSTEM_MSG_SINGLE },
            {
              role: "user",
              content: [
                { type: "text", text: USER_PROMPT_SINGLE },
                { type: "image_url", image_url: { url: dataUrl } },
              ] as any,
            },
          ],
        });
        console.log(
          `[single] openai ms (model=${modelName}) =`,
          Date.now() - attemptStart
        );

        const raw = resp.choices?.[0]?.message?.content ?? "";
        const parsed = parseScoresStrict(raw);
        const adjusted = antiFiveSnap(parsed, `${key}|${modelName}`);

        if (isAllZero(adjusted)) {
          const err = new Error("llm_returned_all_zero_scores");
          logModelFailure("single", modelName, err, attempt);
          lastErr = err;
          continue;
        }

        console.log("[single] FINAL ADJUSTED SCORES =>", adjusted);
        cacheSet(key, adjusted);
        return adjusted;
      } catch (err: any) {
        logModelFailure("single", modelName, err, attempt);
        lastErr = err;
      }
    }

    throw lastErr ?? new Error("score_generation_failed");
  })()
    .catch((e) => {
      throw e;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

export async function scoreImagePairBytes(
  client: OpenAI,
  frontalBytes: Buffer,
  _frontalMime: string,
  sideBytes: Buffer,
  _sideMime: string
): Promise<Scores> {
  if (!frontalBytes?.length || !sideBytes?.length) throw new Error("missing_image_bytes");

  console.log(
    "[scoreImagePairBytes] frontal:",
    preview(frontalBytes),
    "side:",
    preview(sideBytes)
  );

  const t0 = Date.now();
  const [frontalDataUrl, sideDataUrl] = await Promise.all([
    normalizeToPngDataUrl(frontalBytes, { maxEdge: 1024 }),
    normalizeToPngDataUrl(sideBytes, { maxEdge: 1024 }),
  ]);
  console.log("[pair] normalize ms =", Date.now() - t0);

  const key = cacheKeyPair(frontalDataUrl, sideDataUrl);

  // cache hit
  const cached = cacheGet(key);
  if (cached) {
    console.log("[pair] cache HIT");
    return cached;
  }

  // in-flight de-duplication
  const existing = inFlight.get(key);
  if (existing) {
    console.log("[pair] in-flight dedupe WAIT");
    return existing;
  }

  const task = (async () => {
    let lastErr: any = null;

    for (let i = 0; i < MODEL_SEQUENCE.length; i++) {
      const modelName = MODEL_SEQUENCE[i];
      const attempt = i + 1;
      const attemptStart = Date.now();

      try {
        const response_format: { type: "json_object"; json_schema?: unknown } = {
          type: "json_object",
        };
        if (!scoresResponseFormatLogged) {
          console.log("[RF-CHECK]", {
            type: response_format.type,
            hasSchema: !!response_format.json_schema,
          });
          scoresResponseFormatLogged = true;
        }
        const resp = await client.chat.completions.create({
          model: modelName,
          temperature: 0.1,
          response_format,

          messages: [
            { role: "system", content: SYSTEM_MSG_PAIR },
            {
              role: "user",
              content: [
                { type: "text", text: USER_PROMPT_PAIR },
                { type: "image_url", image_url: { url: frontalDataUrl } },
                { type: "image_url", image_url: { url: sideDataUrl } },
              ] as any,
            },
          ],
        });
        console.log(
          `[pair] openai ms (model=${modelName}) =`,
          Date.now() - attemptStart
        );

        const raw = resp.choices?.[0]?.message?.content ?? "";
        const parsed = parseScoresStrict(raw);
        const adjusted = antiFiveSnap(parsed, `${key}|${modelName}`);

        if (isAllZero(adjusted)) {
          const err = new Error("llm_returned_all_zero_scores");
          logModelFailure("pair", modelName, err, attempt);
          lastErr = err;
          continue;
        }

        console.log("[pair] FINAL ADJUSTED SCORES =>", adjusted);
        cacheSet(key, adjusted);
        return adjusted;
      } catch (err: any) {
        logModelFailure("pair", modelName, err, attempt);
        lastErr = err;
      }
    }

    throw lastErr ?? new Error("score_generation_failed");
  })()
    .catch((e) => {
      throw e;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

/* --------------------------------- Helpers -------------------------------- */

/**
 * Strict JSON parser:
 * - Parses raw string
 * - Strips code fences if present
 * - Extracts the outermost JSON object if the model wrapped text around it
 */
function coerceJson(raw: any): any {
  if (raw == null) throw new Error("empty_model_response");
  if (typeof raw === "object") return raw;

  let s = String(raw);
  // strip code fences if any
  s = s.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const cut = s.slice(start, end + 1);
      return JSON.parse(cut);
    }
    throw new Error("unparseable_model_json");
  }
}

/**
 * Parse, alias-map, validate presence and numeric type, and clamp to 0–100.
 * Fails fast on missing or non-numeric fields. No silent zeros.
 * If values appear on a 0–10 scale, upscales to 0–100 uniformly.
 */
function parseScoresStrict(raw: string | null | undefined): Scores {
  console.log("MODEL RAW OUTPUT >>>", raw);

  const data = coerceJson(raw);

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`model_returned_non_object_json`);
  }

  // Alias fix-up: map legacy keys to schema keys without overwriting canonical ones
  for (const [k, v] of Object.entries(data)) {
    const alias = KEY_ALIASES[k];
    if (alias) {
      if (!(alias in data)) (data as any)[alias] = v;
      delete (data as any)[k];
    }
  }

  // Check required keys and numeric values
  const missing: string[] = [];
  const nonNumeric: string[] = [];
  const numericValues: number[] = [];

  for (const k of SCORE_KEYS) {
    const v = (data as any)[k];
    if (v === undefined || v === null) {
      missing.push(k);
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
      nonNumeric.push(`${k}=${JSON.stringify(v)}`);
      continue;
    }
    numericValues.push(n);
  }

  if (missing.length || nonNumeric.length) {
    const details = [
      missing.length ? `missing=[${missing.join(", ")}]` : "",
      nonNumeric.length ? `nonNumeric=[${nonNumeric.join(", ")}]` : "",
    ]
      .filter(Boolean)
      .join(" ");
    throw new Error(`model_json_schema_mismatch ${details}`);
  }

  // Decide scaling: if max <= 10 treat as 0–10 and scale to 0–100
  const max = Math.max(...numericValues);
  const tenScale = max <= 10.0001;

  const out: any = {};
  for (const k of SCORE_KEYS) {
    let n = Number((data as any)[k]);
    if (tenScale) n = n * 10;
    // clamp to 0–100
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    // enforce integer (model instructed to output integers)
    out[k] = Math.round(n);
  }

  return out as Scores;
}

/* ------------------------- Deterministic anti-5 snap ----------------------- */
/**
 * If a score lands exactly on a multiple of 5 (except 0 or 100),
 * apply a tiny deterministic offset derived from the cache key and metric name.
 * This prevents robotic “…, 60, 65, 70 …” without introducing randomness.
 * The same inputs always produce the same adjusted outputs.
 */
function antiFiveSnap(scores: Scores, deterministicSeed: string): Scores {
  const out: Scores = { ...scores };

  for (const k of SCORE_KEYS) {
    let s = out[k];
    // leave boundaries alone
    if (s === 0 || s === 100) continue;
    if (s % 5 !== 0) continue;

    // derive a small offset in {-2, -1, +1, +2} deterministically
    const h = sha256Hex(`${deterministicSeed}|${k}`).slice(0, 4); // 16-bit hex
    const n = parseInt(h, 16);
    const offsets = [-2, -1, +1, +2] as const;
    const delta = offsets[n % offsets.length];

    let adjusted = s + delta;
    if (adjusted < 0) adjusted = 0;
    if (adjusted > 100) adjusted = 100;

    // Avoid landing on another multiple of 5 after clamping
    if (adjusted % 5 === 0 && adjusted !== s) {
      // nudge by 1 toward the center (deterministic direction)
      adjusted += delta > 0 ? 1 : -1;
      if (adjusted < 0) adjusted = 0;
      if (adjusted > 100) adjusted = 100;
    }

    out[k] = adjusted;
  }

  return out;
}
