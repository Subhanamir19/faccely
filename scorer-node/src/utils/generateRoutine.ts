// scorer-node/src/utils/generateRoutine.ts
import { z } from "zod";

import { RoutineSchema, type Routine } from "../schemas/RoutineSchema.js";
import type { Scores } from "../validators.js";
import { PROTOCOL_LIBRARY } from "../data/protocolLibrary.js";


const MODEL = "gpt-4o-mini";
const MAX_RESPONSE_BYTES = 800 * 1024;

const responseFormat = { type: "json_object" as const };

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAIClient = {
  chat: {
    completions: {
      create: (args: {
        model: string;
        temperature: number;
        messages: ChatMessage[];
        max_tokens: number;
        response_format: typeof responseFormat;
      }) => Promise<{
        choices: Array<{
          finish_reason?: string | null;
          message?: { content?: string | null };
        }>;
      }>;
    };
  };
};

type AttemptResult =
  | { success: true; routine: Routine }
  | {
      success: false;
      raw: string;
      finishReason: string | null | undefined;
      error: Error;
    };

    export function finalizeRoutine(r: any): Routine {
      const routine = RoutineSchema.parse(r);
      if (routine.days.length !== 5) throw new Error("invalid_day_count");
      for (const d of routine.days) if (d.components.length !== 5) throw new Error("invalid_component_count");
    
      const STRICT_SAUCE = process.env.ROUTINE_STRICT_SAUCE !== "false";
      if (STRICT_SAUCE) {
        const allowed = new Set<string>(Object.values(PROTOCOL_LIBRARY).flat().map(s => s.trim()));
        for (const d of routine.days) for (const c of d.components) {
          if (typeof c.headline !== "string" || typeof c.category !== "string" || typeof c.protocol !== "string")
            throw new Error("component_missing_field");
          if (!allowed.has(c.protocol.trim())) throw new Error("protocol_not_in_library");
        }
      }
      return routine;
    }
    

export async function generateRoutine(
  scores: Scores,
  context_hint?: string,
  openai?: OpenAIClient
): Promise<Routine> {
  if (!openai) {
    throw new Error("generateRoutine requires an OpenAI client instance.");
  }

  const baseMessages: ChatMessage[] = [
    { role: "system", content: buildPrimarySystemPrompt() },
    { role: "user", content: buildPrimaryUserPrompt(scores, context_hint) },
  ];

  const direct = await runAttempt(openai, "direct", baseMessages);

  if (direct.success) {
    return direct.routine;
  }

  const repairMessages: ChatMessage[] = [
    { role: "system", content: buildRepairSystemPrompt() },
    {
      role: "user",
      content: buildRepairUserPrompt(direct.raw, scores, context_hint),
    },
  ];

  const repair = await runAttempt(openai, "repair", repairMessages);

  if (repair.success) {
    return repair.routine;
  }

  const error = new Error(
    `Routine generation failed after repair attempt: ${repair.error.message}`
  );
  (error as { cause?: unknown }).cause = repair.error;
  throw error;
}

async function runAttempt(
  openai: OpenAIClient,
  path: "direct" | "repair",
  messages: ChatMessage[]
): Promise<AttemptResult> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages,
    max_tokens: 2000,
    response_format: responseFormat,
  });

  const choice = completion.choices[0];
  const finishReason = choice?.finish_reason;
  const raw = choice?.message?.content?.trim() ?? "";

  const rawLength = raw.length;
  const hasClosingBrace = /}\s*$/.test(raw);

  const byteLength = Buffer.byteLength(raw, "utf8");
  if (byteLength > MAX_RESPONSE_BYTES) {
    const error = new Error(
      `Routine response exceeded ${MAX_RESPONSE_BYTES} bytes (${byteLength}).`
    );
    return { success: false, raw, finishReason, error };
  }

  const { parsed, dayCount, counts } = attemptParse(raw);

  console.log("[generateRoutine] guard", {
    path,
    rawLength,
    hasClosingBrace,
    dayCount,
    counts,
  });

  if (!parsed) {
    const error = new Error("Routine response was not valid JSON.");
    return { success: false, raw, finishReason, error };
  }

  if (finishReason === "length") {
    const error = new Error("Routine response was truncated.");
    return { success: false, raw, finishReason, error };
  }

  try {
    const routine = finalizeRoutine(parsed);
    return { success: true, routine };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        raw,
        finishReason,
        error: new Error(`Routine schema validation failed: ${err.message}`),
      };
    }
    const error =
      err instanceof Error ? err : new Error(`Routine validation failed: ${String(err)}`);
    return { success: false, raw, finishReason, error };
  }
}

function attemptParse(raw: string): {
  parsed: unknown | null;
  dayCount: number;
  counts: number[];
} {
  let parsed: unknown | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { parsed: null, dayCount: 0, counts: [] };
  }

  if (parsed === null || typeof parsed !== "object") {
    return { parsed: null, dayCount: 0, counts: [] };
  }

  const days = (parsed as { days?: unknown }).days;
  if (!Array.isArray(days)) {
    return { parsed, dayCount: 0, counts: [] };
  }

  const counts = days.map((day) => {
    if (
      day &&
      typeof day === "object" &&
      Array.isArray((day as { components?: unknown }).components)
    ) {
      return (day as { components: unknown[] }).components.length;
    }
    return 0;
  });

  return { parsed, dayCount: days.length, counts };
}

function buildPrimarySystemPrompt(): string {
  return [
    "You output STRICT JSON only. No prose. No extra keys.",
    'Schema: { "days":[{ "day":1,"components":[{ "headline":string,"category":string,"protocol":string } x5]} x5] }',
    "Exactly 5 days (1..5). Exactly 5 components per day.",
    "protocol MUST be chosen ONLY from the allowed library (The Sauce). Do NOT invent or paraphrase.",
    "category MUST be one of: Glass Skin, Debloating, Facial Symmetry, Maxilla, Hunter Eyes, Cheekbones, Nose, Jawline.",
    "Forbidden terms: makeup, contour, highlighter, bronzer, jade roller, mask, cream, serum, toner, facial yoga, selfie, visualization.",
    "If unsure, pick the closest valid protocol from the library. Never output forbidden items.",
    "Allowed protocol library (The Sauce):",
    JSON.stringify(PROTOCOL_LIBRARY, null, 2),
    "Output JSON only."
  ].join("\n");
}


function buildPrimaryUserPrompt(scores: Scores, context_hint?: string): string {
  const payload = { scores, context_hint: context_hint ?? null };
  return [
    "Generate a 5-day routine with 5 components/day using ONLY protocols from The Sauce.",
    "Forbidden terms are disallowed under any circumstance.",
    JSON.stringify(payload, null, 2),
    "Return JSON only matching the schema."
  ].join("\n");
}


function buildRepairSystemPrompt(): string {
  return [
    "You repair JSON to match the required schema exactly.",
    "Rules:",
    "- Preserve meaningful content but fix structure/keys/lengths.",
    "- Output strictly valid JSON with the same schema described below.",
    "- Exactly 5 days numbered 1-5, each with 5 components (headline, category, protocol).",
    "- No extra fields, comments, or prose.",
  ].join("\n");
}

function buildRepairUserPrompt(
  raw: string,
  scores: Scores,
  context_hint?: string
): string {
  const schemaReminder = [
    "Target schema:",
    "{",
    '  "days": [',
    '    { "day": number 1-5, "components": [',
    '      { "headline": string, "category": string, "protocol": string } x5',
    "    ] } x5",
    "  ]",
    "}",
  ].join("\n");
  const contextBlock = JSON.stringify(
    { scores, context_hint: context_hint ?? null },
    null,
    2
  );
  return [
    "Repair the following JSON so it conforms exactly to the target schema.",
    schemaReminder,
    "Context (do not echo outside JSON):",
    contextBlock,
    "Original JSON (may be truncated or invalid):",
    raw,
  ].join("\n");
}
