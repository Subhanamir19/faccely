import type OpenAI from "openai";

import { COACH, PROVIDERS, estimateCoachCostUsd } from "../config/index.js";
import {
  appendMessage,
  getOrCreateActiveThread,
  getRecentMessages,
  getThreadForUser,
  type CoachMessageRecord,
} from "../supabase/coachThreads.js";
import { checkQuota, recordUsage } from "../supabase/coachUsage.js";
import { buildCoachContext } from "./coachContext.js";
import { composeCoachMessages, suggestFollowUpChips } from "./coachPrompt.js";
import { guardNumbers, isEmptyAfterGuard } from "./coachNumberGuard.js";
import {
  COACH_TOOL_DEFINITIONS,
  executeCoachTool,
  type ToolExecution,
} from "./coachTools.js";
import type { CoachBlock, CoachStreamEvent } from "../schemas/CoachSchema.js";

/* ============================================================================
 * One Coach turn, start to finish.
 *
 * Owns the model loop, the tool calls, the guard, persistence and accounting.
 * The route above it only moves bytes, so this can be driven by a test or a
 * future proactive-message job without an HTTP request in play.
 *
 * Sentence-level streaming, not token-level, and the reason matters. The guard
 * can only judge a sentence once it is complete. Streaming raw tokens would put
 * "your jawline is around 78" on screen a word at a time and leave nothing to
 * take back. So text is buffered to the next sentence boundary, checked, and
 * only then emitted. The reply still moves while it is being written; it just
 * cannot show a figure that was never real.
 * ========================================================================== */

export type CoachEmit = (event: CoachStreamEvent) => void;

export interface RunCoachTurnInput {
  userId: string;
  userText: string;
  threadId?: string;
  screen?: string | null;
  signal?: AbortSignal;
}

export interface CoachTurnResult {
  threadId: string;
  messageId: string;
  blocks: CoachBlock[];
}

/**
 * How many times the model may call tools before it must answer.
 *
 * Three covers every real pattern — look up, look up again on what it found,
 * then render. Beyond that a model is looping, and each round costs a full
 * request.
 */
const MAX_TOOL_ROUNDS = 3;

let client: OpenAI | null = null;

/** Injected from index.ts, matching how the other OpenAI routes are wired. */
export function setCoachOpenAIClient(next: OpenAI): void {
  client = next;
}

class CoachTurnError extends Error {
  readonly code: Extract<CoachStreamEvent, { t: "error" }>["code"];

  constructor(code: CoachTurnError["code"], message: string) {
    super(message);
    this.name = "CoachTurnError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*   Sentence buffering                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Holds partial text until a sentence is complete, so the guard can see a whole
 * claim before any of it reaches the user.
 */
export class SentenceBuffer {
  private pending = "";

  /** Add streamed text; return whatever complete sentences it produced. */
  push(chunk: string): string[] {
    this.pending += chunk;
    const complete: string[] = [];

    // Split on a terminator followed by whitespace, so "3.5" stays intact.
    let match = this.pending.match(/^[\s\S]*?[.!?](?=\s|$)\s*/);
    while (match && match[0].length > 0) {
      complete.push(match[0]);
      this.pending = this.pending.slice(match[0].length);
      match = this.pending.match(/^[\s\S]*?[.!?](?=\s|$)\s*/);
    }

    return complete;
  }

  /** Anything left when the model stops mid-sentence. */
  flush(): string {
    const rest = this.pending;
    this.pending = "";
    return rest;
  }
}

/* -------------------------------------------------------------------------- */
/*   Turn                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Run a turn, emitting stream events as it goes.
 *
 * Throws only before anything has been emitted. Once the stream is open,
 * failures arrive as an `error` event so the app can show something useful
 * rather than a dead connection.
 */
export async function runCoachTurn(
  input: RunCoachTurnInput,
  emit: CoachEmit
): Promise<CoachTurnResult> {
  if (!client) {
    throw new CoachTurnError("internal", "Coach OpenAI client is not configured.");
  }

  const startedAt = Date.now();

  // 1. Quota, before any model spend.
  const quota = await checkQuota(input.userId);
  if (!quota.allowed) {
    throw new CoachTurnError(
      quota.reason === "daily_messages" ? "daily_limit" : "quota_exceeded",
      `Coach quota spent (${quota.reason ?? "unknown"}).`
    );
  }

  // 2. Resolve the thread. An unknown id is treated as a new conversation
  //    rather than an error — a stale id on the device should not block a
  //    message the user has already typed.
  const thread = input.threadId
    ? (await getThreadForUser(input.userId, input.threadId)) ??
      (await getOrCreateActiveThread(input.userId))
    : await getOrCreateActiveThread(input.userId);

  const [context, history] = await Promise.all([
    buildCoachContext(input.userId, input.screen),
    getRecentMessages(input.userId, thread.id, COACH.historyTurns),
  ]);

  await appendMessage({
    threadId: thread.id,
    userId: input.userId,
    role: "user",
    content: input.userText,
    screen: input.screen ?? null,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
    composeCoachMessages({
      context,
      history,
      userText: input.userText,
    });

  const messageId = crypto.randomUUID();
  emit({ t: "start", messageId, threadId: thread.id });

  // Phase 1 runs every turn on the strong model. The cheap-model router that
  // handles definitions and small talk lands in phase 2; at current volumes the
  // difference is a few cents a week, and a router tuned before there is real
  // traffic to tune against would be guesswork.
  const model = PROVIDERS.openai.coachLargeModel;
  const tier = "large" as const;

  const blocks: CoachBlock[] = [];
  const knownNumbers: number[] = [];
  const toolsUsed: string[] = [];
  const buffer = new SentenceBuffer();

  let tokensIn = 0;
  let tokensOut = 0;
  let pendingTextIndex: number | null = null;

  /** Guard a finished sentence and emit it if it survives. */
  const emitSentence = (sentence: string): void => {
    if (!sentence.trim()) return;

    const { blocks: kept } = guardNumbers([{ type: "text", md: sentence }], knownNumbers);
    if (kept.length === 0) return;

    const text = (kept[0] as { md: string }).md;

    if (pendingTextIndex === null) {
      pendingTextIndex = blocks.length;
      blocks.push({ type: "text", md: "" });
    }

    const block = blocks[pendingTextIndex] as { type: "text"; md: string };
    block.md = block.md ? `${block.md} ${text}`.trim() : text;

    emit({ t: "delta", i: pendingTextIndex, text: `${text} ` });
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const stream = await client.chat.completions.create(
      {
        model,
        temperature: COACH.temperature,
        max_tokens: COACH.maxOutputTokens,
        messages,
        tools: COACH_TOOL_DEFINITIONS,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: input.signal }
    );

    let finishReason: string | null = null;
    let assistantText = "";
    const toolCalls: Array<{ id: string; name: string; args: string }> = [];

    for await (const chunk of stream) {
      if (chunk.usage) {
        tokensIn += chunk.usage.prompt_tokens ?? 0;
        tokensOut += chunk.usage.completion_tokens ?? 0;
      }

      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content.length > 0) {
        assistantText += delta.content;
        for (const sentence of buffer.push(delta.content)) {
          emitSentence(sentence);
        }
      }

      // Tool calls arrive in fragments, keyed by index; arguments are streamed
      // as partial JSON and are only parseable once the round ends.
      for (const fragment of delta.tool_calls ?? []) {
        const slot = (toolCalls[fragment.index] ??= { id: "", name: "", args: "" });
        if (fragment.id) slot.id = fragment.id;
        if (fragment.function?.name) slot.name = fragment.function.name;
        if (fragment.function?.arguments) slot.args += fragment.function.arguments;
      }
    }

    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      const tail = buffer.flush();
      if (tail) emitSentence(tail);
      break;
    }

    messages.push({
      role: "assistant",
      content: assistantText || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.args || "{}" },
      })),
    });

    for (const call of toolCalls) {
      emit({ t: "tool", name: call.name });
      toolsUsed.push(call.name);

      const execution: ToolExecution = await executeCoachTool(
        input.userId,
        call.name,
        call.args || "{}"
      );

      knownNumbers.push(...execution.numbers);

      if (execution.block) {
        // A rendered block closes the current paragraph, so prose that follows
        // starts a new text block instead of reading as one run-on sentence.
        pendingTextIndex = null;
        const index = blocks.length;
        blocks.push(execution.block);
        emit({ t: "block", i: index, block: execution.block });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(execution.payload),
      });
    }
  }

  // Guarantee a way forward.
  //
  // The prompt asks for follow-up suggestions on every reply, and the model
  // often forgets. A dead-end answer is the single biggest drop-off point in a
  // chat feature, so this is enforced rather than requested: if the model did
  // not offer chips or an action, the same suggestions the sheet opens with are
  // appended. They are derived from the user's own data and cost nothing.
  const endsOpen = blocks.some(
    (block) => block.type === "chips" || block.type === "action_card"
  );

  if (!endsOpen && blocks.length > 0) {
    const fallback = suggestFollowUpChips(context);
    if (fallback.length > 0) {
      const index = blocks.length;
      const block: CoachBlock = { type: "chips", items: fallback };
      blocks.push(block);
      emit({ t: "block", i: index, block });
    }
  }

  // A reply whose every sentence was stripped means the model invented all of
  // its numbers. Better to say nothing than to leave a chart with no words.
  const finalBlocks = isEmptyAfterGuard(blocks)
    ? [
        {
          type: "text" as const,
          md: "I could not put that together reliably just now. Ask me again and I will pull the numbers directly.",
        },
      ]
    : blocks;

  if (finalBlocks !== blocks) {
    emit({ t: "block", i: blocks.length, block: finalBlocks[0] });
  }

  const plainText = finalBlocks
    .filter((block): block is Extract<CoachBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.md)
    .join(" ")
    .trim();

  await appendMessage({
    threadId: thread.id,
    userId: input.userId,
    role: "assistant",
    content: plainText || null,
    blocks: finalBlocks,
    tools: toolsUsed,
    usage: {
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: estimateCoachCostUsd(tier, tokensIn, tokensOut),
      latency_ms: Date.now() - startedAt,
      tier,
    },
    screen: input.screen ?? null,
  });

  const updatedQuota = await recordUsage({
    userId: input.userId,
    tokensIn,
    tokensOut,
    costUsd: estimateCoachCostUsd(tier, tokensIn, tokensOut),
  });

  emit({
    t: "done",
    usage: { in: tokensIn, out: tokensOut },
    quota: {
      messagesLeft: updatedQuota.messagesLeft,
      imagesLeft: updatedQuota.imagesLeft,
      resetsAt: updatedQuota.resetsAt,
    },
  });

  return { threadId: thread.id, messageId, blocks: finalBlocks };
}

export { CoachTurnError };
export type { CoachMessageRecord };
