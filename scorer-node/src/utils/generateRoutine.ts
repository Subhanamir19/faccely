// scorer-node/src/utils/generateRoutine.ts
import { z } from "zod";

import { RoutineSchema, type Routine } from "../schemas/RoutineSchema.js";
import type { Scores } from "../validators.js";
import { PROTOCOL_LIBRARY } from "../data/protocolLibrary.js";

const MODEL = "gpt-4o-mini";
const MAX_RESPONSE_BYTES = 800 * 1024;
const DEFAULT_N_DAYS = 15;
const TASKS_PER_DAY = 5;

// NEW: strict cap for LLM runtime; keep env-driven to avoid API changes.
const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.ROUTINE_LLM_TIMEOUT_MS ?? 25_000);

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
        // NEW: allow AbortSignal for timeout propagation (supported by modern SDKs)
        signal?: AbortSignal;
      }) => Promise<{
        choices: Array<{
          finish_reason?: string | null;
          message?: { content?: string | null };
        }>;
        // NEW: usage/meta are optional in some SDKs; type them defensively
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        } | null;
        model?: string | null;
      }>;
    };
  };
};

function normalizeProtocol(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// Strict enforcement OFF by default; opt-in only.
const STRICT_SAUCE =
  String(process.env.ROUTINE_STRICT_SAUCE ?? "").toLowerCase() === "true";

const ALLOWED_SET = new Set<string>(
  Object.values(PROTOCOL_LIBRARY)
    .flat()
    .map((p) => normalizeProtocol(p))
);

type AttemptResult =
  | { success: true; routine: Routine }
  | {
      success: false;
      raw: string;
      finishReason: string | null | undefined;
      error: Error;
    };

// --- NEW: Abort/timeout utility with cleanup ---
function withAbortTimeout(parent: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();

  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", onAbort, { once: true });
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (parent) parent.removeEventListener("abort", onAbort);
  };

  return { signal: controller.signal, cleanup };
}

export function finalizeRoutine(r: any): Routine {
  const routine = RoutineSchema.parse(r);

  if (routine.days.length !== DEFAULT_N_DAYS) throw new Error("invalid_day_count");
  for (const d of routine.days) {
    if (d.components.length !== TASKS_PER_DAY)
      throw new Error("invalid_component_count");
    for (const c of d.components) {
      if (
        typeof c.headline !== "string" ||
        typeof c.category !== "string" ||
        typeof c.protocol !== "string"
      ) {
        throw new Error("component_missing_field");
      }
    }
  }

  if (STRICT_SAUCE) {
    for (const d of routine.days) {
      for (const c of d.components) {
        const normalizedProtocol = normalizeProtocol(c.protocol);
        if (!ALLOWED_SET.has(normalizedProtocol)) {
          console.warn("[routine] reject protocol", {
            protocol: c.protocol,
            normalizedProtocol,
          });
          throw new Error("protocol_not_in_library");
        }
      }
    }
  } else {
    // Lenient mode: warn, don’t block
    for (const d of routine.days) {
      for (const c of d.components) {
        const normalizedProtocol = normalizeProtocol(c.protocol);
        if (!ALLOWED_SET.has(normalizedProtocol)) {
          console.warn("[routine] lenient pass for protocol", {
            protocol: c.protocol,
            normalizedProtocol,
          });
        }
      }
    }
  }

  return routine;
}

export async function generateRoutine(
  scores: Scores,
  context_hint?: string,
  openai?: OpenAIClient,
  n_days: number = DEFAULT_N_DAYS
): Promise<Routine> {
  if (!openai) {
    throw new Error("generateRoutine requires an OpenAI client instance.");
  }

  const baseMessages: ChatMessage[] = [
    { role: "system", content: buildPrimarySystemPrompt(n_days) },
    { role: "user", content: buildPrimaryUserPrompt(scores, context_hint, n_days) },
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
  // NEW: wall-clock + abortable LLM call
  const t0 = Date.now();
  const { signal, cleanup } = withAbortTimeout(undefined, DEFAULT_LLM_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages,
      max_tokens: 4000,
      response_format: responseFormat,
      signal, // hard timeout protection
    });

    const t1 = Date.now();
    const latency_ms = t1 - t0;

    const choice = completion.choices[0];
    const finishReason = choice?.finish_reason ?? null;
    const raw = choice?.message?.content?.trim() ?? "";

    // Meta: token usage if available
    const meta = {
      model: completion.model ?? MODEL,
      tokens_in: completion.usage?.prompt_tokens ?? undefined,
      tokens_out: completion.usage?.completion_tokens ?? undefined,
      total_tokens: completion.usage?.total_tokens ?? undefined,
      latency_ms,
      finish_reason: finishReason,
      path,
    };

    // Size guard before parsing
    const byteLength = Buffer.byteLength(raw, "utf8");
    if (byteLength > MAX_RESPONSE_BYTES) {
      const error = new Error(
        `Routine response exceeded ${MAX_RESPONSE_BYTES} bytes (${byteLength}).`
      );
      // Structured log to aid Phase 2 observability (pino later; console for now)
      console.warn("[generateRoutine] oversize", { ...meta, byteLength });
      return { success: false, raw, finishReason, error };
    }

    const rawLength = raw.length;
    const hasClosingBrace = /}\s*$/.test(raw);

    const { parsed, dayCount, counts } = attemptParse(raw);

    console.log("[generateRoutine] guard", {
      ...meta,
      rawLength,
      hasClosingBrace,
      dayCount,
      counts,
      targetDays: DEFAULT_N_DAYS,
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
        err instanceof Error
          ? err
          : new Error(`Routine validation failed: ${String(err)}`);
      return { success: false, raw, finishReason, error };
    }
  } catch (err: any) {
    // Normalize timeout vs generic failure
    if (err?.name === "AbortError") {
      const elapsed = Date.now() - t0;
      const e = new Error(
        `LLM timeout after ${elapsed} ms (limit ${DEFAULT_LLM_TIMEOUT_MS} ms)`
      );
      (e as any).code = "LLM_TIMEOUT";
      console.error("[generateRoutine] timeout", {
        path,
        elapsed_ms: elapsed,
        limit_ms: DEFAULT_LLM_TIMEOUT_MS,
      });
      return { success: false, raw: "", finishReason: "timeout", error: e };
    }
    console.error("[generateRoutine] attempt_error", { path, message: String(err) });
    return {
      success: false,
      raw: "",
      finishReason: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
  } finally {
    cleanup();
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

function buildPrimarySystemPrompt(n_days: number): string {
  return [
    "You output STRICT JSON only. No prose. No extra keys.",
    `Schema: { "days":[{ "day":1,"components":[{ "headline":string,"category":string,"protocol":string } x${TASKS_PER_DAY}]} x${n_days}] }`,
    `Exactly ${n_days} days (1..${n_days}). Exactly ${TASKS_PER_DAY} components per day.`,
    "protocol MUST be chosen ONLY from the allowed library (The Sauce). Do NOT invent or paraphrase.",
    "category MUST be one of: Glass Skin, Debloating, Facial Symmetry, Maxilla, Hunter Eyes, Cheekbones, Nose, Jawline.",
    "Forbidden terms: makeup, contour, highlighter, bronzer, jade roller, mask, cream, serum, toner, facial yoga, selfie, visualization.",
    "If unsure, pick the closest valid protocol from the library. Never output forbidden items.",
    "Allowed protocol library (The Sauce):",
    JSON.stringify(PROTOCOL_LIBRARY, null, 2),
    "Output JSON only.",
  ].join("\n");
}

function buildPrimaryUserPrompt(
  scores: Scores,
  context_hint: string | undefined,
  n_days: number
): string {
  const payload = { scores, context_hint: context_hint ?? null, n_days };
  return [
    `Generate a ${n_days}-day routine with ${TASKS_PER_DAY} components/day using ONLY protocols from The Sauce.`,
    "Forbidden terms are disallowed under any circumstance.",
    JSON.stringify(payload, null, 2),
    "Return JSON only matching the schema.",
  ].join("\n");
}

function buildRepairSystemPrompt(): string {
  return [
    "You repair JSON to match the required schema exactly.",
    "Rules:",
    "- Preserve meaningful content but fix structure/keys/lengths.",
    `- Output strictly valid JSON with the same schema described below.`,
    `- Exactly ${DEFAULT_N_DAYS} days numbered 1-${DEFAULT_N_DAYS}, each with ${TASKS_PER_DAY} components (headline, category, protocol).`,
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
    `  "days": [`,
    `    { "day": number 1-${DEFAULT_N_DAYS}, "components": [`,
    `      { "headline": string, "category": string, "protocol": string } x${TASKS_PER_DAY}`,
    "    ] } x" + DEFAULT_N_DAYS,
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
