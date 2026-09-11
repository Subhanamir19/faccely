import { fetch as expoFetch } from "expo/fetch";

import { API_BASE } from "./config";
import { buildAuthHeadersAsync } from "./authHeaders";
import { logger } from "@/lib/logger";
import {
  isRenderableBlock,
  type CoachBlock,
  type CoachQuota,
  type CoachStreamEvent,
} from "@/lib/coach/blocks";

/* ============================================================================
 * Coach API client.
 *
 * Uses `expo/fetch` rather than the global fetch. React Native's built-in fetch
 * buffers the whole response before resolving, which would hold Coach's reply
 * until it was finished and defeat streaming entirely. `expo/fetch` returns a
 * real ReadableStream, so the reply can be read as it arrives.
 *
 * The wire format is NDJSON: one JSON object per line. Chosen over SSE because
 * splitting on newlines needs no client library.
 * ========================================================================== */

export type CoachOpening = {
  thread_id: string | null;
  chips: string[];
  has_scans: boolean;
  quota: CoachQuota;
};

export type CoachHistoryMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  blocks: CoachBlock[] | null;
  screen: string | null;
  created_at: string;
};

export type CoachHistory = {
  thread_id: string | null;
  messages: CoachHistoryMessage[];
  next_before: string | null;
};

export class CoachDisabledError extends Error {
  constructor() {
    super("Coach is not enabled on this server.");
    this.name = "CoachDisabledError";
  }
}

/* -------------------------------------------------------------------------- */
/*   Non-streaming endpoints                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What to show when the sheet opens: suggested questions and remaining quota.
 *
 * Cheap by design — the backend answers this without calling a model, so it is
 * safe to call every time the button is tapped.
 */
export async function fetchCoachOpening(screen?: string | null): Promise<CoachOpening> {
  const headers = await buildAuthHeadersAsync();
  const query = screen ? `?screen=${encodeURIComponent(screen)}` : "";

  const res = await fetch(`${API_BASE}/coach/opening${query}`, { headers });

  if (res.status === 503) throw new CoachDisabledError();
  if (!res.ok) throw new Error(`Coach opening failed: ${res.status}`);

  return (await res.json()) as CoachOpening;
}

export async function fetchCoachHistory(options?: {
  threadId?: string;
  before?: string;
  limit?: number;
}): Promise<CoachHistory> {
  const headers = await buildAuthHeadersAsync();

  const params = new URLSearchParams();
  if (options?.threadId) params.set("thread_id", options.threadId);
  if (options?.before) params.set("before", options.before);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE}/coach/history${query}`, { headers });

  if (res.status === 503) throw new CoachDisabledError();
  if (!res.ok) throw new Error(`Coach history failed: ${res.status}`);

  return (await res.json()) as CoachHistory;
}

export async function markCoachSeen(): Promise<void> {
  try {
    const headers = await buildAuthHeadersAsync();
    await fetch(`${API_BASE}/coach/seen`, { method: "POST", headers });
  } catch (err) {
    // Clearing a badge is not worth surfacing to the user.
    logger.warn("[coach] mark seen failed", err);
  }
}

/* -------------------------------------------------------------------------- */
/*   Streaming                                                                */
/* -------------------------------------------------------------------------- */

export type StreamCoachOptions = {
  userText: string;
  threadId?: string | null;
  screen?: string | null;
  signal?: AbortSignal;
  onEvent: (event: CoachStreamEvent) => void;
};

/**
 * Send a message and deliver each stream event as it arrives.
 *
 * Resolves when the stream closes. Network and parse failures surface as a
 * final `error` event rather than a rejection, so callers have exactly one path
 * to handle — the UI always has something to show.
 */
export async function streamCoach(options: StreamCoachOptions): Promise<void> {
  const { onEvent } = options;

  let response: Response;
  try {
    const headers = await buildAuthHeadersAsync();

    response = (await expoFetch(`${API_BASE}/coach/stream`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_text: options.userText,
        thread_id: options.threadId ?? undefined,
        screen: options.screen ?? undefined,
      }),
      signal: options.signal,
    })) as unknown as Response;
  } catch (err) {
    if (options.signal?.aborted) return;
    logger.error("[coach] stream request failed", err);
    onEvent({ t: "error", code: "upstream_failed" });
    return;
  }

  if (response.status === 503) {
    onEvent({ t: "error", code: "internal", message: "Coach is switched off." });
    return;
  }

  if (!response.ok || !response.body) {
    logger.error("[coach] stream rejected", response.status);
    onEvent({
      t: "error",
      code: response.status === 401 ? "internal" : "upstream_failed",
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // A chunk can split a line anywhere, so the tail is held back until its
      // newline arrives.
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) emitLine(line, onEvent);
        newline = buffer.indexOf("\n");
      }
    }

    const tail = buffer.trim();
    if (tail) emitLine(tail, onEvent);
  } catch (err) {
    if (options.signal?.aborted) return;
    logger.error("[coach] stream read failed", err);
    onEvent({ t: "error", code: "upstream_failed" });
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Parse one NDJSON line into an event.
 *
 * A malformed or unknown line is dropped rather than thrown on. One bad frame
 * should cost a single block, never the rest of the reply.
 */
function emitLine(line: string, onEvent: (event: CoachStreamEvent) => void): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    logger.warn("[coach] dropped unparseable stream line");
    return;
  }

  if (!parsed || typeof parsed !== "object") return;
  const event = parsed as CoachStreamEvent;

  switch (event.t) {
    case "start":
    case "delta":
    case "tool":
    case "done":
    case "error":
      onEvent(event);
      return;
    case "block":
      if (isRenderableBlock(event.block)) onEvent(event);
      return;
    default:
      return;
  }
}
