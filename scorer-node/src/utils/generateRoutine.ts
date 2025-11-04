// scorer-node/src/utils/generateRoutine.ts
import { z } from "zod";

import { RoutineSchema, type Routine } from "../schemas/RoutineSchema.js";
import type { Scores } from "../validators.js";
import { PROTOCOL_LIBRARY } from "../data/protocolLibrary.js";

const MODEL = "gpt-4o-mini";
const MAX_RESPONSE_BYTES = 800 * 1024;
const DEFAULT_N_DAYS = 15;
const TASKS_PER_DAY = 5;

// --- LLM runtime cap (worker also has wall clock cap) ---
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
      }) => Promise<{
        choices: Array<{
          finish_reason?: string | null;
          message?: { content?: string | null };
        }>;
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

// ---------------- Core helpers ----------------
function normalizeProtocol(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const STRICT_SAUCE =
  String(process.env.ROUTINE_STRICT_SAUCE ?? "").toLowerCase() === "true";

// Library sets and helpers
type ProtocolCategory = keyof typeof PROTOCOL_LIBRARY;
const CATEGORY_KEYS = Object.keys(PROTOCOL_LIBRARY) as ProtocolCategory[];

const ALLOWED_SET = new Set<string>(
  Object.values(PROTOCOL_LIBRARY).flat().map((p) => normalizeProtocol(p))
);

// Pick a deterministic safe default from the Sauce (first entry of first category)
const SAFE_DEFAULT_PROTOCOL: string = (() => {
  for (const key of CATEGORY_KEYS) {
    const arr = PROTOCOL_LIBRARY[key] as readonly string[];
    if (Array.isArray(arr) && arr.length) return normalizeProtocol(arr[0]);
  }
  // Absolute fallback if library were empty (shouldn’t happen)
  return "Nasal breathe 5 min";
})();

function looksLikeVersionTag(s: string) {
  const t = s.trim().toLowerCase();
  return t === "v1" || t === "v2" || /^v\d+$/i.test(t);
}

// -------- NEW: Forbidden Terms (server-side guaranteed) --------
const FORBIDDEN_TERMS = [
  "makeup",
  "contour",
  "highlighter",
  "bronzer",
  "jade roller",
  "mask",
  "cream",
  "serum",
  "toner",
  "facial yoga",
  "selfie",
  "visualization",
] as const;

function hasForbiddenTerm(protocol: string): boolean {
  const p = protocol.toLowerCase();
  return FORBIDDEN_TERMS.some((t) => p.includes(t));
}

function firstForbiddenTerm(protocol: string): string | null {
  const p = protocol.toLowerCase();
  for (const t of FORBIDDEN_TERMS) {
    if (p.includes(t)) return t;
  }
  return null;
}

type AttemptResult =
  | { success: true; routine: Routine }
  | {
      success: false;
      raw: string;
      finishReason: string | null | undefined;
      error: Error;
    };

// ---------------- Finalization & Guards ----------------
export function finalizeRoutine(r: any): Routine {
  const routine = RoutineSchema.parse(r);

  if (routine.days.length !== DEFAULT_N_DAYS) throw new Error("invalid_day_count");
  for (const d of routine.days) {
    if (d.components.length !== TASKS_PER_DAY) {
      throw new Error("invalid_component_count");
    }
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
    // Hard enforcement: only Sauce + no forbidden terms
    for (let dayIdx = 0; dayIdx < routine.days.length; dayIdx++) {
      const d = routine.days[dayIdx];
      for (let compIdx = 0; compIdx < d.components.length; compIdx++) {
        const c = d.components[compIdx];
        const normalizedProtocol = normalizeProtocol(c.protocol);

        // 1) Forbidden terms kill the response immediately
        const bad = firstForbiddenTerm(normalizedProtocol);
        if (bad) {
          const e = new Error(
            `forbidden_term_detected (${bad}) at day=${d.day} component=${compIdx + 1}`
          );
          (e as any).code = "FORBIDDEN_PROTOCOL";
          throw e;
        }

        // 2) Must exist in Sauce
        if (!ALLOWED_SET.has(normalizedProtocol)) {
          console.warn("[routine] reject protocol (not in Sauce)", {
            protocol: c.protocol,
            normalizedProtocol,
            day: d.day,
            component: compIdx + 1,
          });
          const e = new Error(
            `protocol_not_in_library at day=${d.day} component=${compIdx + 1}`
          );
          (e as any).code = "NOT_IN_SAUCE";
          throw e;
        }
      }
    }
  } else {
    // Lenient: sanitize obvious junk (version tags) and ANY forbidden terms
    cleanRoutineInLenientMode(routine);
  }

  return routine;
}

// NEW: lenient sanitizer – fixes "v1"/"v2" and replaces forbidden terms with SAFE_DEFAULT_PROTOCOL
function cleanRoutineInLenientMode(routine: Routine) {
  for (const d of routine.days) {
    for (const c of d.components) {
      const np = normalizeProtocol(c.protocol);

      // If already valid, keep
      if (ALLOWED_SET.has(np) && !hasForbiddenTerm(np)) continue;

      // Version-like placeholders
      if (looksLikeVersionTag(np)) {
        console.warn("[routine] fixed version-like protocol", {
          bad_protocol: c.protocol,
          replaced_with: SAFE_DEFAULT_PROTOCOL,
          day: d.day,
        });
        c.protocol = SAFE_DEFAULT_PROTOCOL;
        continue;
      }

      // Forbidden terms -> replace with safe default
      const bad = firstForbiddenTerm(np);
      if (bad) {
        console.warn("[routine] replaced forbidden protocol", {
          bad_term: bad,
          bad_protocol: c.protocol,
          replaced_with: SAFE_DEFAULT_PROTOCOL,
          day: d.day,
        });
        c.protocol = SAFE_DEFAULT_PROTOCOL;
        continue;
      }

      // Unknown (not in Sauce) but not obviously forbidden:
      // In lenient mode, we do NOT auto-fix arbitrary text; keep warning.
      if (!ALLOWED_SET.has(np)) {
        console.warn("[routine] lenient pass for unknown protocol", {
          protocol: c.protocol,
          normalizedProtocol: np,
          day: d.day,
        });
      }
    }
  }
}

// ---------------- Generation Orchestration ----------------
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
  if (direct.success) return direct.routine;

  const repairMessages: ChatMessage[] = [
    { role: "system", content: buildRepairSystemPrompt() },
    {
      role: "user",
      content: buildRepairUserPrompt(direct.raw, scores, context_hint),
    },
  ];

  const repair = await runAttempt(openai, "repair", repairMessages);
  if (repair.success) return repair.routine;

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
  const t0 = Date.now();

  try {
    // Use OpenAI client’s own timeout (configured in worker); no AbortSignal.
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages,
      max_tokens: 4000,
      response_format: responseFormat,
    });

    const t1 = Date.now();
    const latency_ms = t1 - t0;

    const choice = completion.choices[0];
    const finishReason = choice?.finish_reason ?? null;
    const raw = choice?.message?.content?.trim() ?? "";

    const meta = {
      model: completion.model ?? MODEL,
      tokens_in: completion.usage?.prompt_tokens ?? undefined,
      tokens_out: completion.usage?.completion_tokens ?? undefined,
      total_tokens: completion.usage?.total_tokens ?? undefined,
      latency_ms,
      finish_reason: finishReason,
      path,
    };

    const byteLength = Buffer.byteLength(raw, "utf8");
    if (byteLength > MAX_RESPONSE_BYTES) {
      const error = new Error(
        `Routine response exceeded ${MAX_RESPONSE_BYTES} bytes (${byteLength}).`
      );
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
      llm_timeout_hint_ms: DEFAULT_LLM_TIMEOUT_MS,
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
    console.error("[generateRoutine] attempt_error", { path, message: String(err) });
    return {
      success: false,
      raw: "",
      finishReason: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
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

// ---------------- Prompts ----------------
function buildPrimarySystemPrompt(n_days: number): string {
  return [
    "You output STRICT JSON only. No prose. No extra keys.",
    `Schema: { "days":[{ "day":1,"components":[{ "headline":string,"category":string,"protocol":string } x${TASKS_PER_DAY}]} x${n_days}] }`,
    `Exactly ${n_days} days (1..${n_days}). Exactly ${TASKS_PER_DAY} components per day.`,
    "protocol MUST be chosen ONLY from the allowed library (The Sauce). Do NOT invent or paraphrase.",
    "Never output version tags (e.g., v1, v2) or placeholders as protocols.",
    "category MUST be one of: Glass Skin, Debloating, Facial Symmetry, Maxilla, Hunter Eyes, Cheekbones, Nose, Jawline.",
    `Forbidden terms: ${FORBIDDEN_TERMS.join(", ")}.`,
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
    "Never output version tags (e.g., v1, v2) as protocols.",
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
    "- protocol MUST be chosen ONLY from the allowed library (The Sauce) below.",
    "- Never output version tags (e.g., v1, v2) or placeholders as protocols.",
    `- Apply the forbidden list exactly: ${FORBIDDEN_TERMS.join(", ")}.`,
    "Allowed protocol library (The Sauce):",
    JSON.stringify(PROTOCOL_LIBRARY, null, 2),
    "- No extra fields, comments, or prose. Output JSON only.",
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
