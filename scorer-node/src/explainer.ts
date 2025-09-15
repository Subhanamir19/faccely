// src/explainer.ts
import OpenAI from "openai";
import { Scores, metricKeys, type MetricKey } from "./validators";

/**
 * Produce two ultra-concise notes per metric:
 *   Line 1 = anchor (best sub-metric)
 *   Line 2 = nudge (weakest sub-metric with a specific, short pointer)
 */
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `
You are a seasoned facial aesthetician. Using pattern recognition only, write two concise lines per metric:

Line 1 — Anchor the strongest sub-metric in that category.
Line 2 — Target the weakest sub-metric with a specific, short pointer.

Examples of sub-metrics to consider:
• jawline: mandibular definition, gonial angle, chin projection, cervicomental angle
• facial_symmetry: midline alignment, left/right balance, proportionality
• skin_quality: texture, pore visibility, pigmentation uniformity, sheen
• cheekbones: malar prominence, zygomatic width/height, anterior projection
• eyes_symmetry: canthal tilt, crease symmetry, interpupillary alignment
• nose_harmony: dorsum smoothness, tip projection/rotation, alar width, bridge-to-face balance
• sexual_dimorphism: brow ridge, jaw breadth, lip fullness, midface ratios (purely phenotypic cues; do NOT infer gender identity or orientation)
• youthfulness: elasticity, surface evenness, volume in midface/tear troughs (no medical/age claims)

Hard rules:
• Be neutral, professional, and safe.
• Do NOT identify/name the person or infer age, gender identity, race/ethnicity, health, or any protected attribute.
• No medical or diagnostic claims; this is aesthetic observation only.
• If the image is unclear, a minor, contains multiple faces, or explicit content, provide conservative, generic notes.
• Each metric must return exactly TWO short strings (<= 110 chars each). No emojis, no markdown, no prefixes like "Anchor:"/"Nudge:".

Return STRICT JSON only with these keys, each value a string[2]:
{
  "jawline": [line1, line2],
  "facial_symmetry": [line1, line2],
  "skin_quality": [line1, line2],
  "cheekbones": [line1, line2],
  "eyes_symmetry": [line1, line2],
  "nose_harmony": [line1, line2],
  "sexual_dimorphism": [line1, line2],
  "youthfulness": [line1, line2]
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
An aesthetician already scored this face (0–100, decimals allowed).
Use the scores to guide which sub-aspects feel strongest/weakest.
Image + scores are below. Produce exactly two short lines per metric (anchor, then nudge).
Return ONLY the strict JSON object.
Scores:
${JSON.stringify(scores)}
`.trim();

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    top_p: 0.9,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${img64}` },
          },
        ],
      },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content ?? "{}";

  // Parse resiliently
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    data = JSON.parse(cleaned || "{}");
  }

  // Normalize to exactly two short lines per key
  const out: Record<MetricKey, string[]> = {} as any;

  const normalizeTwo = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return ["", ""];
    const lines = arr
      .filter((x) => typeof x === "string")
      .map((s) => String(s).trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, 2);

    // pad if needed
    while (lines.length < 2) lines.push("");
    // hard cap length
    return lines.map((s) => (s.length > 110 ? s.slice(0, 110).trim() : s));
  };

  for (const k of metricKeys) {
    out[k] = normalizeTwo(data?.[k]);
  }

  return out;
}
