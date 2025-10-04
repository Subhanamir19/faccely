// C:\SS\scorer-node\src\recommender.ts
import OpenAI from "openai";
import { ENV } from "./env.js";
import {
  RecommendationsRequestSchema,
  RecommendationsResponseSchema,
  RecommendationsRequest,
  RecommendationsResponse,
} from "./validators.js";

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

/**
 * generateRecommendations
 * Validates input, calls OpenAI with a tightly-scoped prompt,
 * and returns a RecommendationsResponse (schema-validated).
 */
export async function generateRecommendations(
  payload: unknown
): Promise<RecommendationsResponse> {
  const req: RecommendationsRequest = RecommendationsRequestSchema.parse(payload);

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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  // Best-effort JSON extraction if the model misbehaves
  const maybeJson =
    tryParse(raw) ??
    tryParse(extractJson(raw)) ??
    {
      summary: raw.slice(0, 240),
      items: [],
      version: "v1" as const,
    };

  // Validate and return
  return RecommendationsResponseSchema.parse(maybeJson);
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
