// scorer-node/src/routes/sigma.ts
import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";

import {
  CreateThreadRequestSchema,
  CreateThreadResponseSchema,
  GetThreadResponseSchema,
  SendMessageRequestSchema,
  SigmaMessageSchema,
  SigmaThreadSchema,
  type SigmaMessage,
  type SigmaThread,
} from "../schemas/SigmaSchema.js";
import { composeSigmaPrompt, type SigmaPromptContext } from "../services/sigmaPrompt.js";
import { generateSigmaAnswer } from "../services/sigmaOpenAI.js";
import { PROVIDERS } from "../config/index.js";

/* ============================================================
 * Sigma Routes
 * Endpoints:
 *   POST /sigma/thread           -> create thread
 *   GET  /sigma/thread/:id       -> fetch thread
 *   POST /sigma/message          -> send a user message, get assistant reply
 *
 * Storage: in-memory map (swap for DB later)
 * ============================================================
 */

export const sigmaRouter = Router();

// In-memory "DB" for fast prototyping; replace with real persistence later.
const threads = new Map<string, SigmaThread>();

function nowISO() {
  return new Date().toISOString();
}

function makeUserMessage(content: string): SigmaMessage {
  return {
    id: randomUUID(),
    role: "user",
    content,
    created_at: nowISO(),
  };
}

function makeAssistantMessage(partial: {
  content: string;
  suggested_next_steps?: string[];
}): SigmaMessage {
  return {
    id: randomUUID(),
    role: "assistant",
    content: partial.content,
    suggested_next_steps: partial.suggested_next_steps,
    created_at: nowISO(),
  };
}

/* ----------------------- POST /sigma/thread ----------------------- */
sigmaRouter.post("/thread", async (req: Request, res: Response) => {
  try {
    // For forward-compat: allow empty body or future options
    const _parsed = CreateThreadRequestSchema.parse(req.body ?? {});
    const id = randomUUID();

    const thread: SigmaThread = {
      id,
      user_id: "anon", // replace with real auth/user id when available
      messages: [],
      last_summary: undefined,
      meta: {},
    };
    // Validate before storing (paranoia prevents stupidity)
    SigmaThreadSchema.parse(thread);

    threads.set(id, thread);

    const payload = { id };
    res.status(201).json(CreateThreadResponseSchema.parse(payload));
  } catch (err: any) {
    res.status(400).json({
      error: "CREATE_THREAD_FAILED",
      detail: err?.message ?? "Unknown error",
    });
  }
});

/* ---------------------- GET /sigma/thread/:id --------------------- */
sigmaRouter.get("/thread/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id || !threads.has(id)) {
      return res.status(404).json({ error: "THREAD_NOT_FOUND" });
    }
    const thread = threads.get(id)!;
    // Validate shape before returning
    res.json(GetThreadResponseSchema.parse(thread));
  } catch (err: any) {
    res.status(400).json({
      error: "GET_THREAD_FAILED",
      detail: err?.message ?? "Unknown error",
    });
  }
});

/* ------------------------- POST /sigma/message -------------------- */
sigmaRouter.post("/message", async (req: Request, res: Response) => {
  try {
    const parsed = SendMessageRequestSchema.parse(req.body);

    const thread = threads.get(parsed.thread_id);
    if (!thread) {
      return res.status(404).json({ error: "THREAD_NOT_FOUND" });
    }

    // Append the user's message optimistically
    const userMsg = makeUserMessage(parsed.user_text);
    SigmaMessageSchema.parse(userMsg);
    thread.messages.push(userMsg);

    // Compose context (plug real data here later)
    const context: SigmaPromptContext = {};
    if (parsed.share_scores && thread.meta?.latest_scores) {
      context.latest_scores = thread.meta.latest_scores;
    }
    if (parsed.share_routine && typeof thread.meta?.active_routine_day === "number") {
      context.active_routine_day = thread.meta.active_routine_day;
    }

   // Call model
const prompt = composeSigmaPrompt(parsed, context);

// ESM-safe dynamic import of OpenAI client
const OpenAIMod = await import("openai");
const OpenAI = OpenAIMod.default ?? OpenAIMod;
const openai = new OpenAI({ apiKey: PROVIDERS.openai.apiKey });


    const result = await generateSigmaAnswer(openai, prompt);

    const assistantMsg = makeAssistantMessage({
      content: result.content,
      suggested_next_steps: result.suggested_next_steps,
    });
    SigmaMessageSchema.parse(assistantMsg);
    thread.messages.push(assistantMsg);

    // Optional: maintain a lightweight rolling summary after N messages
    if ((thread.messages?.length ?? 0) % 6 === 0) {
      const recent = thread.messages.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
      thread.last_summary = `Recent context (last 6 turns):\n${recent.slice(0, 1500)}`;
    }

    res.json({ assistant_message: assistantMsg });
  } catch (err: any) {
    // If we optimistically pushed user message and then failed, that's fine; the thread keeps history.
    const msg = err?.message ?? "Unknown error";
    const isZod = !!err?.issues;
    res.status(isZod ? 400 : 500).json({
      error: "SEND_MESSAGE_FAILED",
      detail: msg,
    });
  }
});

export default sigmaRouter;
