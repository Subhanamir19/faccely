// src/scorer.ts
import OpenAI from "openai";
import type { Scores } from "./validators";

const MODEL = "gpt-4o-mini";

/**
 * Safety-aware, aesthetics-only scorer.
 * Produces independent 0–100 scores (decimals allowed; do NOT snap to 5s).
 */
const SYSTEM_MSG = `
You are an experienced facial aesthetician and researcher. Using visual pattern recognition only,
assign independent aesthetic scores for these metrics on a 0–100 scale:

- jawline
- facial_symmetry
- skin_quality
- cheekbones
- eyes_symmetry
- nose_harmony
- sexual_dimorphism  (how strongly the face exhibits culturally typical male/female facial cues; do NOT infer gender identity, sex, or orientation.)
- youthfulness       (perceived skin tautness/texture/volume; no health/age claims)

Safety rules:
• Do NOT identify or name the person, or infer age, gender identity, race/ethnicity, nationality, religion, health status, or any protected attribute.
• Do NOT make medical or diagnostic claims. This is aesthetic scoring only.
• Keep tone neutral and professional; avoid sexual content.
• If the image likely contains a minor, multiple faces, explicit content, or is too unclear to assess,
  return conservative midrange estimates (50–60) without commentary.

Scoring guidance:
• Scores may be decimals; avoid snapping to multiples of 5 (e.g., 34, 57.2, 73.5, 81.1).
• Each score must be within [0,100] and metrics are independent.

Return STRICT JSON only—no prose/markdown—exactly:

{
  "jawline": number,
  "facial_symmetry": number,
  "skin_quality": number,
  "cheekbones": number,
  "eyes_symmetry": number,
  "nose_harmony": number,
  "sexual_dimorphism": number,
  "youthfulness": number
}
`.trim();

const USER_PROMPT = `Score this face image per the instructions and return ONLY the JSON object.`.trim();

export async function scoreImageBytes(
  client: OpenAI,
  bytes: Buffer,
  mime: string
): Promise<Scores> {
  const b64 = bytes.toString("base64");

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    top_p: 0.9,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_MSG },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          {
            // keep types happy across SDK versions; omit "detail"
            type: "image_url",
            image_url: { url: `data:${mime};base64,${b64}` },
          },
        ],
      },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content ?? "{}";

  // Be resilient to accidental fences
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    data = JSON.parse(cleaned || "{}");
  }

  // Clamp & coerce so downstream code never breaks
  const keys: (keyof Scores)[] = [
    "jawline",
    "facial_symmetry",
    "skin_quality",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "sexual_dimorphism",
    "youthfulness",
  ];

  const out: Partial<Scores> = {};
  for (const k of keys) {
    let v = Number(data[k]);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    out[k] = v as Scores[typeof k];
  }

  return out as Scores;
}
