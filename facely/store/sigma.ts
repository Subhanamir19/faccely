// facely/store/sigma.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type SigmaThread,
  type CreateThreadResponse,
  type SendMessageResponse,
} from "../lib/types/sigma";
import {
  createSigmaThread,
  getSigmaThread,
  sendSigmaMessage,
  makeLocalUserMessage,
} from "../lib/api/sigma";

/* ============================================================
 * Sigma Store (robust)
 * - No deadlocks: sendInProgress is cleared in finally
 * - Debounce concurrent sends
 * - Lazy-create thread if missing
 * ============================================================
 */

interface SigmaStore {
  thread: SigmaThread | null;
  loading: boolean;
  error?: string;
  sendInProgress: boolean;
  initThread: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  reloadThread: () => Promise<void>;
  resetThread: () => void;
}

export const useSigmaStore = create<SigmaStore>()(
  persist(
    (set, get) => ({
      thread: null,
      loading: false,
      error: undefined,
      sendInProgress: false,

      /** Create a new thread on backend */
      initThread: async () => {
        try {
          set({ loading: true, error: undefined });
          const resp: CreateThreadResponse = await createSigmaThread();
          const thread: SigmaThread = { id: resp.id, messages: [] };
          set({ thread, loading: false });
        } catch (e: any) {
          set({ error: e?.message ?? "Failed to initialize Sigma thread", loading: false });
        }
      },

      /** Reload messages from backend */
      reloadThread: async () => {
        const t = get().thread;
        if (!t) return;
        try {
          set({ loading: true });
          const fresh = await getSigmaThread(t.id);
          set({ thread: fresh, loading: false });
        } catch (e: any) {
          set({ error: e?.message ?? "Failed to reload Sigma thread", loading: false });
        }
      },

      /** Send user message -> optimistic append -> fetch assistant reply */
      sendMessage: async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        // Prevent overlapping sends
        if (get().sendInProgress) return;

        let t = get().thread;

        // Lazy-init if user types before init finishes
        if (!t) {
          try {
            const resp: CreateThreadResponse = await createSigmaThread();
            t = { id: resp.id, messages: [] };
            set({ thread: t });
          } catch (e: any) {
            set({ error: e?.message ?? "No active Sigma thread" });
            return;
          }
        }

        // Optimistic append
        const optimistic = makeLocalUserMessage(trimmed);
        const updated: SigmaThread = { ...t, messages: [...t.messages, optimistic] };
        set({ thread: updated, sendInProgress: true, error: undefined });

        try {
          const reply: SendMessageResponse = await sendSigmaMessage({
            thread_id: t.id,
            user_text: trimmed,
            share_scores: false,
            share_routine: false,
          });

          const thread: SigmaThread = {
            ...updated,
            messages: [...updated.messages, reply.assistant_message],
          };
          set({ thread });
        } catch (e: any) {
          console.error("Sigma sendMessage failed:", e);
          set({ error: e?.message ?? "Sigma message failed" });
        } finally {
          // Always clear the flag so the composer never deadlocks
          set({ sendInProgress: false });
        }
      },

      /** Start fresh */
      resetThread: () => {
        set({ thread: null, error: undefined, sendInProgress: false });
      },
    }),
    {
      name: "sigma-thread-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
