// C:\SS\scorer-node\src\scorer.ts
import OpenAI from "openai";
import type { Scores } from "./validators";
import { normalizeToPngDataUrl } from "./lib/image-normalize";

/** Model tuned for JSON + lower latency. Change via OPENAI_SCORES_MODEL if needed. */
const MODEL = process.env.OPENAI_SCORES_MODEL || "gpt-4o-mini";

/* ------------------------------- Keys ------------------------------------- */
const SCORE_KEYS: (keyof Scores)[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

/* ------------------------------ JSON Schema ------------------------------- */
const SCORES_JSON_SCHEMA = {
  name: "Scores",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      jawline: { type: "number", minimum: 0, maximum: 100 },
      facial_symmetry: { type: "number", minimum: 0, maximum: 100 },
      skin_quality: { type: "number", minimum: 0, maximum: 100 },
      cheekbones: { type: "number", minimum: 0, maximum: 100 },
      eyes_symmetry: { type: "number", minimum: 0, maximum: 100 },
      nose_harmony: { type: "number", minimum: 0, maximum: 100 },
      sexual_dimorphism: { type: "number", minimum: 0, maximum: 100 }
    },
    required: [
      "jawline",
      "facial_symmetry",
      "skin_quality",
      "cheekbones",
      "eyes_symmetry",
      "nose_harmony",
      "sexual_dimorphism"
    ]
  },
  strict: true as const
};

/* --------------------------- Prompts -------------------------------------- */
const SYSTEM_MSG_SINGLE = `
You are a facial aesthetician. Judge only visible facial structure from the provided image.
Return neutral, professional evaluations against a defined aesthetic rubric. No identification or protected-attribute inference.
Score each metric 0–100 (decimals allowed). Do not include any keys other than those required by the schema.
`.trim();

const SYSTEM_MSG_PAIR = `
You are a facial aesthetician. Judge only visible facial structure using TWO images (frontal, right-side profile).
Use both views. One score per metric, 0–100. Do not include any keys other than those required by the schema.
`.trim();

const USER_PROMPT_SINGLE =
  "Score this face strictly using the required keys only. Output must validate against the provided JSON schema.";
const USER_PROMPT_PAIR =
  "Score this face pair strictly using the required keys only. Output must validate against the provided JSON schema.";

/* --------------------------------- Utils ---------------------------------- */
function preview(buf?: Buffer) {
  if (!buf) return "nil";
  const head = buf.slice(0, 12).toString("hex");
  return `${buf.length}B ${head}`;
}

function clampScores(obj: Record<string, number>): Scores {
  const out: any = {};
  for (const k of SCORE_KEYS) {
    let v = Number(obj[k]);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    out[k] = v;
  }
  return out as Scores;
}

function getOutputText(resp: any): string {
  // SDK v4 responses: prefer .output_text
  if (resp?.output_text) return String(resp.output_text);
  // Fallback crawl for other shapes
  try {
    const chunks = resp?.output ?? resp?.choices ?? [];
    const first = chunks[0];
    const text =
      first?.content?.[0]?.text ??
      first?.message?.content ??
      "";
    return String(text || "");
  } catch {
    return "";
  }
}

function parseScores(raw: string): Scores {
  if (!raw) throw new Error("empty_model_response");
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    const s = raw.replace(/```json|```/g, "").trim();
    data = JSON.parse(s);
  }
  return clampScores(data);
}

/* --------------------------------- API ------------------------------------ */
/** Single image scoring */
export async function scoreImageBytes(
  client: OpenAI,
  bytes: Buffer,
  _mime: string
): Promise<Scores> {
  if (!bytes || bytes.length < 64) throw new Error("empty_or_invalid_image_buffer");
  console.log("[scoreImageBytes] input:", preview(bytes));

  const dataUrl = await normalizeToPngDataUrl(bytes, { maxEdge: 2048 });

  const resp = await client.responses.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: SCORES_JSON_SCHEMA },
    input: [
      { role: "system", content: [{ type: "text", text: SYSTEM_MSG_SINGLE }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: USER_PROMPT_SINGLE },
          { type: "input_image", image_url: dataUrl }
        ]
      }
    ]
  });

  const raw = getOutputText(resp);
  return parseScores(raw);
}

/** Pair scoring */
export async function scoreImagePairBytes(
  client: OpenAI,
  frontalBytes: Buffer,
  _frontalMime: string,
  sideBytes: Buffer,
  _sideMime: string
): Promise<Scores> {
  if (!frontalBytes?.length || !sideBytes?.length) throw new Error("missing_image_bytes");
  console.log("[scoreImagePairBytes] frontal:", preview(frontalBytes), "side:", preview(sideBytes));

  const frontalDataUrl = await normalizeToPngDataUrl(frontalBytes, { maxEdge: 2048 });
  const sideDataUrl = await normalizeToPngDataUrl(sideBytes, { maxEdge: 2048 });

  const resp = await client.responses.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: SCORES_JSON_SCHEMA },
    input: [
      { role: "system", content: [{ type: "text", text: SYSTEM_MSG_PAIR }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: USER_PROMPT_PAIR },
          { type: "input_image", image_url: frontalDataUrl },
          { type: "input_image", image_url: sideDataUrl }
        ]
      }
    ]
  });

  const raw = getOutputText(resp);
  return parseScores(raw);
}
