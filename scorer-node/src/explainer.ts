// src/explainer.ts
import OpenAI from "openai";
import { Scores, metricKeys, type MetricKey } from "./validators";

/**
 * Produce two ultra-concise notes per metric:
 *   Line 1 = tier verdict + dominant visible trait (or primary limitation on low tiers)
 *   Line 2 = ONLY a targeted refinement if helpful; if already ideal, say no adjustment needed
 */
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `
You are a facial aesthetician. Write ultra-concise, plain-English observations.
For each metric, output EXACTLY TWO lines:

• Line 1 — Tier verdict + key trait.
  - Include the EXACT tier word once in Line 1.
  - Strong/Elite → state the dominant visible strength.
  - Developing/Emerging → state the primary visible limitation (no praise words).
  - If features read neutral/unclear: say "reads neutral" and name the trait observed.

• Line 2 — Targeted refinement, ONLY if useful.
  - If metric is clearly ideal: say "already meets the standard; no adjustment needed."
  - If Strong/Elite but improvable: give a fine-tune nudge.
  - If Developing/Emerging: name the clearest gap with one precise pointer.
  - Prefer a contrast word ("while", "however", "but", "whereas") when proposing a change.
  - Do NOT invent adjustments when not warranted.

Hard rules
- Describe only what is visible. Present tense. No causes, advice, products, routines, medical or identity claims.
- No identity/ethnicity/age/health inferences. Keep neutral and respectful.
- Use everyday words only. BAN: dimorphism, malar, gonial, dorsum, supraorbital, anthropometry, ratio.
- No filler or hedging: avoid "looks good", "decent", "might", "probably", "consider", "you should".
- Each line ≤ 110 characters. No emojis. No markdown. Output STRICT JSON only with fixed keys.

Tone control by tier
- Developing/Emerging: do NOT use praise adjectives ("strong", "clean", "sharp", "glassy", "aligned").
- Strong/Elite: you MAY use them once, modestly.
- Never insulting; use respectful clinical phrasing (e.g., "less defined", "heaviness", "reduced clarity").

Action requirement for low tiers (Developing/Emerging) — no templates, use judgment within these levers
- When a metric is Developing/Emerging, Line 2 MUST choose one concrete lever and phrase it succinctly:
  1) Contour/definition: sharpen edge/angle/contour; reduce under-jaw softening; clarify jaw corner or chin center.
  2) Volume/redistribution: reduce heaviness; restore lift/height/projection; adjust midface fullness for clearer contour.
  3) Alignment/proportion: even left/right height/tilt/spacing; smooth bridge or profile blend; balance width/offset.
  4) Surface/texture/light: even texture and reflect; reduce shadow bands or noise; prefer even light for clarity.
  5) Openness/visibility: reduce brow heaviness; lift lid set; clear under-eye shadow to steady the set.
  6) Grooming/styling: shape hair/brow/lip lines that clarify contour/edge/height without changing identity.
  7) Camera hygiene (if visibility is clearly impaired): neutral frontal angle and even light to reveal true edge/contour.
- Pick exactly ONE lever. Keep it specific, observable, and within 110 chars.
- Include ≥1 checklist token for that metric in Line 2.
- Do not repeat the same lever text across multiple metrics in the same output.

Metric checklists (each line must include ≥1 token from the metric’s checklist)
- jawline: ["edge", "angle", "under-jaw", "chin center", "jaw corner"]
- facial_symmetry: ["left/right", "tilt", "height", "width", "offset"]
- eyes_symmetry: ["left/right", "tilt", "height", "spacing", "set"]
- cheekbones: ["projection", "height", "lift", "contour"]
- nose_harmony: ["proportion", "bridge", "straight", "blend", "profile"]
- skin_quality: ["texture", "even", "clarity", "reflect", "noise", "shadow", "light"]
- sexual_dimorphism (write as "masculinity/femininity cues"): ["brow", "jaw", "lips", "contour", "cheek"]

Symmetry rules
- If asymmetry is visible, name the side (“left/right height/tilt/spacing”). Do NOT say “some asymmetry”.

Lighting/occlusion hygiene
- If lighting/angle/makeup clearly soften edges, you may state it once as a visibility note in Line 1 or 2.

Few-shot style (imitate structure and brevity):
// High tier examples
- Jawline (Strong): "Strong tier; edge under-jaw reads clear." / "However, jaw corner near ear looks softer."
- Facial symmetry (Elite): "Elite; left/right height and tilt read aligned." / "But bridge could read straighter."
- Skin quality (Elite): "Elite; texture reads even with clean reflect and light." / "Already meets the standard; no adjustment needed."

// Low tier examples
- Jawline (Emerging): "Emerging; under-jaw edge reads soft near chin center." / "Whereas angle by jaw corner could read sharper."
- Skin quality (Developing): "Developing; texture and reflect read uneven under light." / "However, even light would reduce shadow noise."
- Eyes symmetry (Emerging): "Emerging; right eye height sits lower than left." / "Whereas spacing could read more even."

Return STRICT JSON only:
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

export async function explainImageBytes(
  client: OpenAI,
  bytes: Buffer,
  mime: string,
  scores: Scores
): Promise<Record<MetricKey, string[]>> {
  const img64 = bytes.toString("base64");

  const userText = `
You are given: (a) a face image, (b) numeric scores (0–100), (c) per-metric tier labels computed by these ranges:
- 0–30 Developing
- 31–60 Emerging
- 61–80 Strong
- 81–100 Elite

For EACH metric, produce exactly TWO lines per system rules.
- Line 1 includes the tier word once and names the dominant strength (Strong/Elite) OR limitation (Emerging/Developing).
- Line 2 ONLY proposes a refinement if helpful; if already ideal, say: "already meets the standard; no adjustment needed."
- Prefer a contrast word ("while", "however", "but", "whereas") when proposing a change.
- Use ≥1 checklist token per line. Each line ≤110 chars. JSON only.

Scores JSON:
${JSON.stringify(scores)}

Compute the tier word for each metric using the ranges above and the provided score. Do not change scores.
`.trim();

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:${mime};base64,${img64}` } },
        ],
      },
    ],
  });

  return normalizeResponse(resp.choices?.[0]?.message?.content);
}

/**
 * Pair version: use BOTH images of the same face (frontal + right-side profile)
 * to generate two-line explanations per metric.
 */
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

  const userText = `
You are given TWO images of the SAME face: first = frontal, second = right-side profile,
plus numeric scores (0–100). Use both images to decide which visible trait to mention.

Tier rules:
- 0–30 Developing
- 31–60 Emerging
- 61–80 Strong
- 81–100 Elite

For EACH metric, return exactly TWO lines per system rules:
- Line 1 includes the tier word and leads with limitation on low tiers or strength on high tiers.
- Line 2 ONLY proposes a refinement if helpful; if already ideal, say: "already meets the standard; no adjustment needed."
- Mention left/right for symmetry when relevant.
- Use ≥1 checklist token each line. Each line ≤110 chars. JSON only.

Scores JSON:
${JSON.stringify(scores)}

Compute tier words from scores using the ranges above. Do not change scores.
`.trim();

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:${frontalMime};base64,${f64}` } }, // frontal
          { type: "image_url", image_url: { url: `data:${sideMime};base64,${s64}` } },     // side
        ],
      },
    ],
  });

  return normalizeResponse(resp.choices?.[0]?.message?.content);
}

/* ------------------------------- Utilities ------------------------------- */

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
    return lines.map((s) => (s.length > 110 ? s.slice(0, 110).trim() : s));
  };

  for (const k of metricKeys) {
    out[k] = normalizeTwo(data?.[k]);
  }
  return out;
}
