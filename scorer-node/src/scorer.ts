// C:\SS\scorer-node\src\scorer.ts
import OpenAI from "openai";
import type { Scores } from "./validators";
import { normalizeToPngDataUrl } from "./lib/image-normalize";

const MODEL = "gpt-4o-mini";

/* ------------------------------- Shared keys ------------------------------ */
const SCORE_KEYS: (keyof Scores)[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

/* --------------------------- System prompts ------------------------------- */
const SYSTEM_MSG_SINGLE = `
You are a facial aesthetician. Judge only visible facial structure from the provided image.
Return neutral, professional evaluations against a defined aesthetic rubric.
Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes.
No medical claims or sexual content. If content is unclear/occluded/low-res, increase uncertainty but do NOT inflate scores.

Scoring (0–100, decimals allowed, independent per metric):
- jawline: mandibular outline sharpness, gonial angle definition, submental shadow/line, cervicomental angle.
- facial_symmetry: left/right feature alignment (eyes, brows, nasal axis, mouth cant), contour parity.
- skin_quality: apparent smoothness, uniform tone, visible texture/blemishes, specular consistency.
- cheekbones: zygomatic projection, malar highlight continuity, midface contour depth.
- eyes_symmetry: palpebral aperture parity, canthal tilt alignment, lid crease consistency.
- nose_harmony: dorsum straightness, tip definition, width vs midface balance, deviation.
- sexual_dimorphism: degree of culturally typical trait expression in bone/soft-tissue proportions. Do NOT infer identity.

Anti-inflation rules:
- Any metric may be low if cues indicate; do not compensate with unrelated positives.
- If cues conflict, prioritize the clearest high-signal cues; do not average toward 50.
- Provide terse evidence for each metric; avoid praise words.

Output STRICT JSON only:
{
  "jawline": number,
  "facial_symmetry": number,
  "skin_quality": number,
  "cheekbones": number,
  "eyes_symmetry": number,
  "nose_harmony": number,
  "sexual_dimorphism": number,
  "evidence": {
    "jawline": [string,string],
    "facial_symmetry": [string,string],
    "skin_quality": [string,string],
    "cheekbones": [string,string],
    "eyes_symmetry": [string,string],
    "nose_harmony": [string,string],
    "sexual_dimorphism": [string,string]
  },
  "uncertainty": number
}
`.trim();

const SYSTEM_MSG_PAIR = `
You are a facial aesthetician. Judge only visible facial structure from the provided TWO images (frontal and right-side profile).
Return neutral, professional evaluations against the rubric.
Do not identify the person or infer age, gender identity, race/ethnicity, health, or other protected attributes.
No medical claims or sexual content. If content is unclear/occluded/low-res, increase uncertainty but do NOT inflate scores.

Metrics and scoring same as single-image prompt.
Rules: Use BOTH views to refine judgments (e.g., jawline, cheekbones, symmetry, nose). 
If views disagree, explain in evidence but still return one score per metric.

Output STRICT JSON only with same schema as single-image.
`.trim();

/* ----------------------------- User prompts ------------------------------- */
const USER_PROMPT_SINGLE = `Score this face per the rubric. Return ONLY the JSON object.`.trim();
const USER_PROMPT_PAIR = `Score using BOTH images (frontal, then right-side). Return ONLY the JSON object.`.trim();

/* ---------------------------- Single-image API ---------------------------- */
export async function scoreImageBytes(
  client: OpenAI,
  bytes: Buffer,
  _mime: string
): Promise<Scores> {
  if (!bytes || bytes.length < 64) throw new Error("empty_or_invalid_image_buffer");

  // Normalize any format (HEIC, TIFF, etc.) to a PNG data URL
  
  const dataUrl = await normalizeToPngDataUrl(bytes);

  const resp = await client.responses.create({
    model: MODEL,
    temperature: 0.4,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_MSG_SINGLE }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: USER_PROMPT_SINGLE },
          { type: "input_image", image_url: dataUrl, detail: "auto" },
        ],
      },
    ],
  });

  return normalizeScores((resp as any).output_text);
  
}

/* ----------------------------- Pair-image API ----------------------------- */
export async function scoreImagePairBytes(
  client: OpenAI,
  frontalBytes: Buffer,
  _frontalMime: string,
  sideBytes: Buffer,
  _sideMime: string
): Promise<Scores> {
  if (!frontalBytes?.length || !sideBytes?.length) throw new Error("missing_image_bytes");

  // Normalize both before sending to the model
  const frontalDataUrl = await normalizeToPngDataUrl(frontalBytes);
  const sideDataUrl = await normalizeToPngDataUrl(sideBytes);

  const resp = await client.responses.create({
    model: MODEL,
    temperature: 0.4,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_MSG_PAIR }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: USER_PROMPT_PAIR },
          { type: "input_image", image_url: frontalDataUrl, detail: "auto" },
          { type: "input_image", image_url: sideDataUrl, detail: "auto" },
        ],
      },
    ],
  });

  return normalizeScores((resp as any).output_text);
}

/* --------------------------------- Helpers -------------------------------- */
function normalizeScores(raw: string | null | undefined): Scores {
  console.log("MODEL RAW OUTPUT >>>", raw);   // 👈 add this line

  let data: any;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    data = JSON.parse(cleaned || "{}");
  }

  const out: Partial<Scores> = {};
  for (const k of SCORE_KEYS) {
    let v = Number(data[k]);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    out[k] = v as Scores[typeof k];
  }
  return out as Scores;
}

