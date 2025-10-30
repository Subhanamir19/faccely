// scorer-node/src/services/sigmaOpenAI.ts
import type { ComposedPrompt } from "./sigmaPrompt.js";

/* ============================================================
 * Sigma OpenAI Call Wrapper
 * - Minimal dependency surface
 * - Tolerant to different OpenAI client shapes
 * - Extracts "suggested_next_steps" heuristically from "Next:" section
 * ============================================================
 */

/** Environment + defaults */
const MODEL =
  process.env.OPENAI_MODEL_SIGMA?.trim() ||
  process.env.OPENAI_SCORES_MODEL?.trim() || // fall back to existing model if set
  "gpt-4o-mini";

const TEMPERATURE = Number(process.env.SIGMA_TEMPERATURE ?? 0.3);
const MAX_TOKENS = Number(process.env.SIGMA_MAX_TOKENS ?? 800);
const MAX_RESPONSE_BYTES = Number(process.env.SIGMA_MAX_RESPONSE_BYTES ?? 200 * 1024);

/** Very small interface so we don't care which SDK wrapper you use elsewhere */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface OpenAICompat {
  chat: {
    completions: {
      create: (args: {
        model: string;
        temperature?: number;
        max_tokens?: number;
        messages: ChatMessage[];
        // Some SDKs support this; harmless if ignored
        response_format?: { type: "json_object" | "text" };
      }) => Promise<{
        choices: Array<{
          message?: { role?: string; content?: string | null } | null;
          finish_reason?: string | null;
        }>;
      }>;
    };
  };
}

/** Result shape we hand to routers */
export interface SigmaGenResult {
  content: string;
  suggested_next_steps?: string[];
  finish_reason?: string | null;
  raw_bytes?: number;
}

/** Build chat messages from our composed prompt */
function buildMessages(prompt: ComposedPrompt): ChatMessage[] {
  return [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
}

/** Extract bullet-like suggestions from a "Next:" section in the text response */
function extractSuggestedNextSteps(text: string): string[] | undefined {
  const idx = text.toLowerCase().indexOf("next:");
  if (idx < 0) return undefined;

  // Take the tail after "Next:" and split into lines
  const tail = text.slice(idx + "next:".length);
  const lines = tail.split(/\r?\n/);

  const steps: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();

    // Stop if we hit another section header
    if (/^(tldr|rationale|plan|safety)\s*:?\s*$/i.test(line)) break;

    // Accept bullets like "• text", "- text", "1) text", "1. text"
    const m = line.match(/^([•\-–—]|\d{1,2}[).])\s*(.+)$/);
    if (m && m[2]) {
      const clean = m[2].replace(/\s+/g, " ").trim();
      if (clean.length > 0) steps.push(clean);
      if (steps.length >= 5) break;
      continue;
    }

    // Also accept short plain lines immediately after "Next:" if they look like options
    if (line.length > 0 && line.length <= 80) {
      steps.push(line);
      if (steps.length >= 5) break;
    } else if (line.length === 0 && steps.length > 0) {
      // blank line after capturing some steps: likely end of list
      break;
    }
  }

  return steps.length ? steps : undefined;
}

/** Hard cap on response size to protect downstream consumers */
function clampResponseBytes(text: string): { text: string; bytes: number } {
  const encoder = new TextEncoder();
  const buf = encoder.encode(text);
  if (buf.byteLength <= MAX_RESPONSE_BYTES) {
    return { text, bytes: buf.byteLength };
  }
  // Truncate at a code-point boundary-ish length and append an ellipsis
  // We aim ~ 0.95 of the limit to avoid slicing mid-multibyte
  const target = Math.floor(MAX_RESPONSE_BYTES * 0.95);
  const truncated = new TextDecoder().decode(buf.slice(0, target)).replace(/\s+\S*$/, "").trim();
  return { text: truncated + " …", bytes: Math.min(buf.byteLength, MAX_RESPONSE_BYTES) };
}

/**
 * Call OpenAI using a thin compatibility layer.
 * Do NOT pass user PII here; scores/routine context should be abstracted.
 */
export async function generateSigmaAnswer(
  openai: OpenAICompat,
  prompt: ComposedPrompt
): Promise<SigmaGenResult> {
  const messages = buildMessages(prompt);

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages,
    // Prefer plain text; we parse our own structure
    response_format: { type: "text" as const },
  });

  const choice = res.choices?.[0];
  const content = (choice?.message?.content ?? "").toString().trim();

  if (!content) {
    return {
      content: "I couldn’t generate a response. Please try again in a moment.",
      finish_reason: choice?.finish_reason ?? null,
      suggested_next_steps: ["Try again", "Ask for at-home options", "Share latest scores"],
      raw_bytes: 0,
    };
  }

  const { text: safeText, bytes } = clampResponseBytes(content);
  const suggestions = extractSuggestedNextSteps(safeText);

  return {
    content: safeText,
    suggested_next_steps: suggestions,
    finish_reason: choice?.finish_reason ?? null,
    raw_bytes: bytes,
  };
}
