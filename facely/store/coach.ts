import { create } from "zustand";

import { logger } from "@/lib/logger";
import {
  fetchCoachHistory,
  fetchCoachOpening,
  markCoachSeen,
  streamCoach,
  CoachDisabledError,
} from "@/lib/api/coach";
import type {
  CoachBlock,
  CoachErrorCode,
  CoachMessage,
  CoachQuota,
} from "@/lib/coach/blocks";

/* ============================================================================
 * Coach state.
 *
 * The conversation lives on the server, so this store holds only what the tab
 * needs while it is on screen: the loaded messages, the in-flight reply, the
 * suggestions and the quota.
 *
 * Nothing is persisted. Keeping a local copy of the transcript would mean two
 * sources of truth for the same conversation and a stale one to reconcile on
 * every launch; refetching it is a single cheap request.
 * ========================================================================== */

export type CoachStatus = "idle" | "loading" | "streaming";

type State = {
  status: CoachStatus;
  /** True until the first load finishes, so the tab can show a skeleton. */
  initialising: boolean;
  /** Null until the first message creates a conversation. */
  threadId: string | null;
  messages: CoachMessage[];
  chips: string[];
  quota: CoachQuota | null;
  hasScans: boolean;
  /** Name of the lookup currently running, shown as "reading your scans…". */
  activeTool: string | null;
  error: CoachErrorCode | null;
  /** True when the server has Coach switched off. */
  disabled: boolean;
  unread: boolean;
};

type Actions = {
  /** Load suggestions, quota and history. Safe to call on every tab focus. */
  initialise: (screen?: string | null) => Promise<void>;
  send: (userText: string, screen?: string | null) => Promise<void>;
  stop: () => void;
  loadHistory: () => Promise<void>;
  markSeen: () => void;
  reset: () => void;
};

/**
 * The in-flight request, held outside the store so that aborting it never
 * triggers a re-render of the thread.
 */
let activeController: AbortController | null = null;

const INITIAL: State = {
  status: "idle",
  initialising: true,
  threadId: null,
  messages: [],
  chips: [],
  quota: null,
  hasScans: false,
  activeTool: null,
  error: null,
  disabled: false,
  unread: false,
};

function makeId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCoach = create<State & Actions>()((set, get) => ({
  ...INITIAL,

  /* -------------------------------------------------------------------- */
  /*   Loading                                                            */
  /* -------------------------------------------------------------------- */

  initialise: async (screen) => {
    // A reply in flight means the tab was simply re-focused mid-answer.
    if (get().status !== "idle") return;

    set({ error: null, unread: false });

    try {
      const opening = await fetchCoachOpening(screen ?? null);

      set({
        chips: opening.chips,
        quota: opening.quota,
        hasScans: opening.has_scans,
        threadId: opening.thread_id,
        disabled: false,
        initialising: false,
      });

      if (opening.thread_id && get().messages.length === 0) {
        await get().loadHistory();
      }
    } catch (err) {
      if (err instanceof CoachDisabledError) {
        set({ disabled: true, initialising: false });
        return;
      }
      logger.warn("[coach] opening failed", err);
      // Not fatal: the user can still type. Only the suggestions are lost.
      set({ initialising: false });
    }
  },

  loadHistory: async () => {
    try {
      const history = await fetchCoachHistory({
        threadId: get().threadId ?? undefined,
        limit: 20,
      });

      set({
        threadId: history.thread_id,
        messages: history.messages.map((record) => ({
          id: record.id,
          role: record.role === "assistant" ? "assistant" : "user",
          blocks: record.blocks ?? [],
          text: record.content ?? "",
          createdAt: record.created_at,
        })),
      });
    } catch (err) {
      logger.warn("[coach] history failed", err);
    }
  },

  /* -------------------------------------------------------------------- */
  /*   Sending                                                            */
  /* -------------------------------------------------------------------- */

  send: async (userText, screen) => {
    const text = userText.trim();
    if (!text || get().status !== "idle") return;

    const controller = new AbortController();
    activeController = controller;

    const userMessage: CoachMessage = {
      id: makeId(),
      role: "user",
      blocks: [],
      text,
      createdAt: new Date().toISOString(),
    };

    // The assistant row is created up front and filled in as events land, so
    // the thread never jumps when the first sentence arrives.
    const assistantId = makeId();
    const assistantMessage: CoachMessage = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      text: "",
      createdAt: new Date().toISOString(),
      streaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      status: "loading",
      chips: [],
      error: null,
      activeTool: null,
    }));

    const patchAssistant = (patch: (message: CoachMessage) => CoachMessage) => {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantId ? patch(message) : message
        ),
      }));
    };

    await streamCoach({
      userText: text,
      threadId: get().threadId,
      screen: screen ?? null,
      signal: controller.signal,
      onEvent: (event) => {
        switch (event.t) {
          case "start":
            set({ threadId: event.threadId, status: "streaming" });
            return;

          case "tool":
            set({ activeTool: event.name });
            return;

          case "delta":
            set({ activeTool: null });
            patchAssistant((message) => {
              const blocks = [...message.blocks];
              const existing = blocks[event.i];

              if (existing && existing.type === "text") {
                blocks[event.i] = { type: "text", md: existing.md + event.text };
              } else {
                // Blocks can arrive out of order relative to their index; pad
                // so the index stays meaningful.
                while (blocks.length < event.i) {
                  blocks.push({ type: "text", md: "" });
                }
                blocks[event.i] = { type: "text", md: event.text };
              }

              return { ...message, blocks };
            });
            return;

          case "block":
            set({ activeTool: null });
            patchAssistant((message) => {
              const blocks = [...message.blocks];
              while (blocks.length < event.i) {
                blocks.push({ type: "text", md: "" });
              }
              blocks[event.i] = event.block;
              return { ...message, blocks };
            });
            return;

          case "done":
            set({ quota: event.quota, activeTool: null });
            patchAssistant((message) => ({
              ...message,
              streaming: false,
              text: message.blocks
                .filter(
                  (block): block is Extract<CoachBlock, { type: "text" }> =>
                    block.type === "text"
                )
                .map((block) => block.md)
                .join(" ")
                .trim(),
            }));
            return;

          case "error":
            set({ error: event.code, activeTool: null });
            patchAssistant((message) => ({
              ...message,
              streaming: false,
              error: event.code,
            }));
            return;
        }
      },
    });

    // Drop an assistant row that never received anything — a stopped reply
    // should leave no trace beyond the user's own message.
    set((state) => ({
      status: "idle",
      activeTool: null,
      messages: state.messages.filter(
        (message) =>
          message.id !== assistantId ||
          message.blocks.length > 0 ||
          Boolean(message.error)
      ),
    }));

    activeController = null;
  },

  stop: () => {
    activeController?.abort();
    activeController = null;
    set({ status: "idle", activeTool: null });
  },

  markSeen: () => {
    set({ unread: false });
    void markCoachSeen();
  },

  reset: () => {
    activeController?.abort();
    activeController = null;
    set({ ...INITIAL });
  },
}));

export function getCoachState() {
  return useCoach.getState();
}
