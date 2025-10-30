// scorer-node/src/services/sigmaPrompt.ts
import type { SendMessageRequest } from "../schemas/SigmaSchema.js";

/* ============================================================
 * Sigma Prompt Composer
 * Generates the system message fed into OpenAI for each chat turn.
 * ============================================================
 */

export interface SigmaPromptContext {
  latest_scores?: Record<string, number>;
  active_routine_day?: number;
}

export interface ComposedPrompt {
  system: string;
  user: string;
}

/**
 * Compose the structured system + user prompt for Sigma.
 * Injects user metrics and guardrails.
 */
export function composeSigmaPrompt(
  req: SendMessageRequest,
  context?: SigmaPromptContext
): ComposedPrompt {
  const { user_text, share_scores, share_routine } = req;

  const preamble = [
    "You are Sigma, a board-certified facial aesthetics coach.",
    "Your goal: provide educational, evidence-based, and safe guidance on facial improvement, skincare, posture, nutrition, and recovery.",
    "Rules:",
    "1. Do NOT provide medical diagnosis or prescribe medication.",
    "2. Base all reasoning on biomechanics, anatomy, and dermatology fundamentals.",
    "3. Maintain a warm but precise tone; never exaggerate results.",
    "4. Encourage professional consultation for invasive treatments.",
    "5. Always be concise and structured in your explanations.",
    "",
    "Structure each answer as:",
    "• TLDR: one-line summary",
    "• Rationale: concise science-based reasoning",
    "• Plan: actionable steps (3-5 max)",
    "• Safety: what to avoid or warning signs",
    "• Next: 2-3 short follow-up options the user can tap",
  ].join("\n");

  const contextLines: string[] = [];
  if (share_scores && context?.latest_scores) {
    const scoresSummary = Object.entries(context.latest_scores)
      .map(([k, v]) => `${k}: ${v}/100`)
      .join(", ");
    contextLines.push(`User facial scores: ${scoresSummary}.`);
  }
  if (share_routine && context?.active_routine_day) {
    contextLines.push(`User is currently on routine day ${context.active_routine_day}.`);
  }

  const system = [preamble, contextLines.join(" ")].filter(Boolean).join("\n\n");

  const user = user_text.trim();

  return { system, user };
}
