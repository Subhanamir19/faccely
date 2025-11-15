// C:\SS\scorer-node\src\recommender.ts
import OpenAI from "openai";
import { PROVIDERS } from "./config/index.js";
import {
  
  RecommendationsResponseSchema,
  RecommendationsRequest,
  RecommendationsResponse,
} from "./validators.js";

export class RecommendationsParseError extends Error {
  readonly rawPreview: string;

  constructor(raw: string) {
    super("Recommendations generation failed: upstream response was not valid JSON.");
    this.name = "RecommendationsParseError";
    this.rawPreview = truncate(raw, 1200);
  }
}

const openai = new OpenAI({ apiKey: PROVIDERS.openai.apiKey });

let recommenderResponseFormatLogged = false;

/**
 * generateRecommendations
 * Validates input, calls OpenAI with a tightly-scoped prompt,
 * and returns a RecommendationsResponse (schema-validated).
 */
export async function generateRecommendations(
  req: RecommendationsRequest
): Promise<RecommendationsResponse> {
  

  const system = [
    "You are a board-certified aesthetician and evidence-driven coach.",
    "The user provides demographics and metric scores (0–100).",
    "Return STRICT JSON in this exact shape:",
    "{",
    '  "summary": string,',
    '  "items": [',
    "    {",
    '      "metric": one of ["jawline","facial_symmetry","skin_quality","cheekbones","eyes_symmetry","nose_harmony","sexual_dimorphism"],',
    '      "score": number (0–100),',
    '      "title": string (short, imperative task, ≤40 chars),',
    '      "recommendation": string (≤220 chars, plain language, actionable),',
    '      "finding": string (≤120 chars, optional),',
    '      "priority": "low" | "medium" | "high",',
    '      "expected_gain": number (0–100, optional)',
    "    }",
    "  ],",
    '  "version": "v1"',
    "}",
    "Constraints:",
    "- Focus on habits, skincare basics, grooming, posture, lighting, photography, fitness, fat %, hydration.",
    "- Plain language. No emojis. No links. No markdown. No extra commentary.",
    "- Always include at least 3–5 items if possible.",
    "- JSON only. Do not wrap in code fences or text.",
  ].join("\n");

  const user = JSON.stringify(req);

  const response_format: { type: "json_object"; json_schema?: unknown } = {
    type: "json_object",
  };
  if (!recommenderResponseFormatLogged) {
    console.log("[RF-CHECK]", {
      type: response_format.type,
      hasSchema: !!response_format.json_schema,
    });
    recommenderResponseFormatLogged = true;
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 600,
    response_format,

  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  if (raw) {
    console.debug("[generateRecommendations] completion preview:", truncate(raw, 1200));
  }

  const parsed = tryParse(raw) ?? tryParse(extractJson(raw));

  if (!parsed) {
    console.error("[generateRecommendations] failed to parse completion:", truncate(raw, 2000));
    throw new RecommendationsParseError(raw);
  }

  // Validate and return
  return RecommendationsResponseSchema.parse(parsed);

}

/* ---------------------------- helpers ---------------------------- */

function tryParse(s: string | null | undefined): unknown | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractJson(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return s;
  return s.slice(start, end + 1);
}
function truncate(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…(truncated)`;
}
