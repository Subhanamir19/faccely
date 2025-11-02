import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type SigmaThread,
  type SigmaMessage,
  type SigmaError,
} from "../lib/types/sigma";
import {
  createSigmaThread,
  getSigmaThread,
  sendSigmaMessage,
  makeLocalUserMessage,
} from "../lib/api/sigma";

interface SigmaStore {
  thread: SigmaThread | null;
  loading: boolean;
  error?: string;
  sendInProgress: boolean;
  ensureThread: () => Promise<string>;
  initThread: () => Promise<void>;
  reloadThread: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  newChat: () => Promise<void>;
  resetThread: () => void;
}

let creatingThread: Promise<SigmaThread> | null = null;

const toSigmaError = (error: unknown): SigmaError => {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return error as SigmaError;
  }

  return {
    code: "UNKNOWN",
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Something went wrong",
  };
};

const snapshotThread = (thread: SigmaThread): SigmaThread => ({
  ...thread,
  messages: [...thread.messages],
});

export const useSigmaStore = create<SigmaStore>()(
  persist(
    (set, get) => ({
      thread: null,
      loading: false,
      error: undefined,
      sendInProgress: false,

      ensureThread: async () => {
        const current = get().thread;
        if (current) return current.id;

        if (!creatingThread) {
          creatingThread = (async () => {
            set({ loading: true, error: undefined });
            try {
              const resp = await createSigmaThread();
              const fresh: SigmaThread = { id: resp.id, messages: [] as SigmaMessage[] };
              set({ thread: fresh });
              return fresh;
            } catch (err) {
              const mapped = toSigmaError(err);
              set({ error: mapped.message });
              throw mapped;
            } finally {
              set({ loading: false });
            }
          })();
        }

        try {
          const thread = await creatingThread;
          return thread.id;
        } finally {
          creatingThread = null;
        }
      },

      initThread: async () => {
        try {
          await get().ensureThread();
        } catch {
          // handled in ensureThread
        }
      },

      reloadThread: async () => {
        const existing = get().thread;
        const threadId = existing?.id ?? (await get().ensureThread().catch(() => null));
        if (!threadId) return;

        try {
          set({ loading: true, error: undefined });
          const fresh = await getSigmaThread(threadId);
          set({ thread: fresh, loading: false });
        } catch (err) {
          const mapped = toSigmaError(err);
          set({ error: mapped.message, loading: false });
        }
      },

      sendMessage: async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (get().sendInProgress) return;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          let threadId: string;
          try {
            threadId = await get().ensureThread();
          } catch (err) {
            const mapped = toSigmaError(err);
            set({ error: mapped.message });
            return;
          }

          const currentThread = get().thread;
          if (!currentThread) {
            continue;
          }

          const baseSnapshot = snapshotThread(currentThread);
          const optimistic = makeLocalUserMessage(trimmed);
          const optimisticThread: SigmaThread = {
            ...baseSnapshot,
            messages: [...baseSnapshot.messages, optimistic],
          };

          set({ thread: optimisticThread, sendInProgress: true, error: undefined });

          try {
            const reply = await sendSigmaMessage({
              thread_id: threadId,
              user_text: trimmed,
              share_scores: false,
              share_routine: false,
            });

            const completed: SigmaThread = {
              ...optimisticThread,
              messages: [...optimisticThread.messages, reply.assistant_message],
            };
            set({ thread: completed, sendInProgress: false });
            return;
          } catch (err) {
            const mapped = toSigmaError(err);

            if (mapped.code === "THREAD_NOT_FOUND" && attempt === 0) {
              set({ thread: baseSnapshot, sendInProgress: false });
              await get().newChat();
              continue;
            }

            set({ thread: baseSnapshot, error: mapped.message, sendInProgress: false });
            return;
          }
        }
      },

      newChat: async () => {
        creatingThread = null;
        set({ thread: null, loading: true, error: undefined, sendInProgress: false });
        try {
          const resp = await createSigmaThread();
          const fresh: SigmaThread = { id: resp.id, messages: [] as SigmaMessage[] };
          set({ thread: fresh, loading: false });
        } catch (err) {
          const mapped = toSigmaError(err);
          set({ error: mapped.message, loading: false });
          throw mapped;
        }
      },

      resetThread: () => {
        creatingThread = null;
        set({ thread: null, error: undefined, sendInProgress: false });
      },
    }),
    {
      name: "sigma-thread-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
