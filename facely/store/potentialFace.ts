// facely/store/potentialFace.ts
//
// Zustand store for the Potential Face feature.
//
// Persisted to AsyncStorage so the dashboard can render the last-known image
// immediately on cold start. Note: signed image URLs minted by the backend
// have a ~6h TTL — rehydrated state is rendered optimistically, but `load()`
// is called on mount to mint fresh URLs in the background.
//
// Polling: `pollUntilReady()` is the reveal-screen path. It polls /current
// every 2s until status === "ready" or the timeout fires. A module-level
// guard prevents two polls running at once; a generation counter protects
// against stale-fetch races (mirrors insights.ts).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { logger } from "../lib/logger";
import {
  fetchCurrentPotentialFace,
  requestPotentialFaceGeneration,
  usePotentialFaceAlternate,
  checkPotentialFaceUnlock,
  type PotentialFace,
  type TargetedMetric,
  type UnlockEvaluation,
} from "../lib/api/potentialFace";
import type { LatestAdvanced } from "../lib/api/insights";

const STORAGE_KEY = "sigma_potential_face_v1";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 30_000;

/* -------------------------------------------------------------------------- */
/*   Module-level mutable refs (kept outside zustand to avoid re-renders)     */
/* -------------------------------------------------------------------------- */

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollDeadline = 0;
let _fetchGen = 0;

/* -------------------------------------------------------------------------- */
/*   State                                                                    */
/* -------------------------------------------------------------------------- */

type State = {
  data: PotentialFace | null;
  loading: boolean;
  error: string | null;
  /** Wall-clock timestamp (ms) of the most recent successful /current call. */
  lastFetchedAt: number | null;
  /** True while a poll loop is active. */
  isPolling: boolean;
  /** Latest unlock evaluation snapshot — used by the dashboard to render diagnostics. */
  unlockEvaluation: UnlockEvaluation | null;
  /**
   * Set after the user sees the current Stage-1 reveal screen and dismisses
   * via the primary CTA. Tied to a row id so stale persisted state cannot skip
   * a newly generated/unseen potential face.
   */
  revealSeen: boolean;
  revealSeenPotentialFaceId: string | null;
};

type Actions = {
  /** Fetch /current and update state. Always hits the network. */
  load: () => Promise<PotentialFace | null>;
  /**
   * Poll /current until status === "ready" or timeout. Resolves with the
   * latest known row (ready, failed, or whatever it was at timeout).
   * Idempotent — concurrent callers share one underlying poll.
   */
  pollUntilReady: (timeoutMs?: number) => Promise<PotentialFace | null>;
  /** Stop any in-flight poll. */
  stopPolling: () => void;
  /**
   * Explicit retry — used when the user is on the reveal screen and the row
   * arrived in `failed` state. Re-enqueues server-side and refreshes state.
   */
  retryGeneration: (scanId: string) => Promise<PotentialFace | null>;
  /**
   * "This doesn't look like me" — swaps to the pre-generated alternate.
   * Throws if the server rejects (e.g. already used).
   */
  useAlternate: () => Promise<PotentialFace | null>;
  /**
   * Run the unlock gate; if a Stage N+1 row was created server-side, refresh
   * `data`. Always stores the latest `unlockEvaluation` so the dashboard can
   * render the % closer breakdown.
   */
  checkUnlock: () => Promise<{ unlocked: boolean; evaluation: UnlockEvaluation }>;
  /** Mark the current Stage-1 reveal as seen (called from the reveal screen's primary CTA). */
  markRevealSeen: () => void;
  /** Wipe — call from sign-out. */
  clear: () => void;
};

/* -------------------------------------------------------------------------- */
/*   Store                                                                    */
/* -------------------------------------------------------------------------- */

export const usePotentialFace = create<State & Actions>()(
  persist(
    (set, get) => ({
      data: null,
      loading: false,
      error: null,
      lastFetchedAt: null,
      isPolling: false,
      unlockEvaluation: null,
      revealSeen: false,
      revealSeenPotentialFaceId: null,

      // ---------------------------------------------------------------------
      // load
      // ---------------------------------------------------------------------
      load: async () => {
        if (get().loading) return get().data;

        _fetchGen += 1;
        const gen = _fetchGen;
        set({ loading: true, error: null });
        try {
          const data = await fetchCurrentPotentialFace({ quiet: true });
          if (gen !== _fetchGen) return get().data; // newer fetch already landed
          set({ data, loading: false, lastFetchedAt: Date.now() });
          return data;
        } catch (err: any) {
          if (gen !== _fetchGen) return get().data;
          logger.error("[potentialFace] load failed:", err?.message);
          set({ loading: false, error: err?.message ?? "Failed to load potential face" });
          return get().data;
        }
      },

      // ---------------------------------------------------------------------
      // pollUntilReady — used by the reveal screen
      // ---------------------------------------------------------------------
      pollUntilReady: async (timeoutMs = POLL_TIMEOUT_MS) => {
        // If a poll is already running, extend its deadline and resolve from
        // the eventual completion via a snapshot subscription.
        const now = Date.now();
        const newDeadline = now + Math.max(0, timeoutMs);
        if (_pollTimer && _pollDeadline >= now) {
          _pollDeadline = Math.max(_pollDeadline, newDeadline);
        } else {
          _pollDeadline = newDeadline;
          set({ isPolling: true });
          startPollLoop(set, get);
        }

        return new Promise((resolve) => {
          const unsub = usePotentialFace.subscribe((state) => {
            const ready =
              state.data?.status === "ready" ||
              state.data?.status === "failed" ||
              state.data?.status === "unlocked";
            if (ready || !state.isPolling) {
              unsub();
              resolve(state.data);
            }
          });
        });
      },

      // ---------------------------------------------------------------------
      // stopPolling
      // ---------------------------------------------------------------------
      stopPolling: () => {
        if (_pollTimer) {
          clearInterval(_pollTimer);
          _pollTimer = null;
        }
        if (get().isPolling) set({ isPolling: false });
      },

      // ---------------------------------------------------------------------
      // retryGeneration
      // ---------------------------------------------------------------------
      retryGeneration: async (scanId) => {
        set({ loading: true, error: null });
        try {
          const { potentialFace } = await requestPotentialFaceGeneration(scanId);
          set({ data: potentialFace, loading: false, lastFetchedAt: Date.now() });
          return potentialFace;
        } catch (err: any) {
          logger.error("[potentialFace] retryGeneration failed:", err?.message);
          set({ loading: false, error: err?.message ?? "Retry failed" });
          throw err;
        }
      },

      // ---------------------------------------------------------------------
      // useAlternate
      // ---------------------------------------------------------------------
      useAlternate: async () => {
        const current = get().data;
        if (!current) {
          throw new Error("No potential face to swap.");
        }
        if (current.regeneratedCount >= 1) {
          throw new Error("Alternate has already been used.");
        }
        if (!current.alternateImageUrl) {
          throw new Error("No alternate image available.");
        }
        set({ loading: true, error: null });
        try {
          const updated = await usePotentialFaceAlternate(current.id);
          set({ data: updated, loading: false, lastFetchedAt: Date.now() });
          return updated;
        } catch (err: any) {
          logger.error("[potentialFace] useAlternate failed:", err?.message);
          set({ loading: false, error: err?.message ?? "Could not swap image" });
          throw err;
        }
      },

      // ---------------------------------------------------------------------
      // checkUnlock
      // ---------------------------------------------------------------------
      checkUnlock: async () => {
        try {
          const result = await checkPotentialFaceUnlock();
          set({ unlockEvaluation: result.evaluation });
          if (result.unlocked && result.nextStage) {
            // Server promoted us to the next stage — adopt it as the active row.
            set({ data: result.nextStage, lastFetchedAt: Date.now() });
          }
          return { unlocked: result.unlocked, evaluation: result.evaluation };
        } catch (err: any) {
          logger.error("[potentialFace] checkUnlock failed:", err?.message);
          throw err;
        }
      },

      // ---------------------------------------------------------------------
      // markRevealSeen
      // ---------------------------------------------------------------------
      markRevealSeen: () => {
        const currentId = get().data?.id ?? null;
        set({ revealSeen: true, revealSeenPotentialFaceId: currentId });
      },

      // ---------------------------------------------------------------------
      // clear
      // ---------------------------------------------------------------------
      clear: () => {
        if (_pollTimer) {
          clearInterval(_pollTimer);
          _pollTimer = null;
        }
        _fetchGen += 1; // invalidate any in-flight load
        set({
          data: null,
          loading: false,
          error: null,
          lastFetchedAt: null,
          isPolling: false,
          unlockEvaluation: null,
          revealSeen: false,
          revealSeenPotentialFaceId: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist transient state. Signed URLs go stale — components must
      // tolerate a missed image and `load()` will refresh on mount.
      partialize: (state) => ({
        data: state.data,
        lastFetchedAt: state.lastFetchedAt,
        revealSeen: state.revealSeen,
        revealSeenPotentialFaceId: state.revealSeenPotentialFaceId,
      }),
    }
  )
);

/* -------------------------------------------------------------------------- */
/*   Internal: poll loop                                                      */
/* -------------------------------------------------------------------------- */

function startPollLoop(
  set: (partial: Partial<State>) => void,
  get: () => State & Actions
) {
  if (_pollTimer) return; // shouldn't happen, defensive

  const tick = async () => {
    if (Date.now() > _pollDeadline) {
      stopLoop();
      return;
    }
    _fetchGen += 1;
    const gen = _fetchGen;
    try {
      const data = await fetchCurrentPotentialFace({ quiet: true });
      if (gen !== _fetchGen) return; // newer fetch already landed
      set({ data, lastFetchedAt: Date.now() });
      const status = data?.status;
      // Terminal states stop the loop. `pending` keeps polling.
      if (status === "ready" || status === "failed" || status === "unlocked") {
        stopLoop();
      }
    } catch (err: any) {
      // Network blip — stay in the loop until the deadline. Surface error so
      // the reveal screen can show a hint if it persists.
      if (gen === _fetchGen) {
        logger.warn("[potentialFace] poll tick failed:", err?.message);
      }
    }
  };

  // Fire one immediately so the first tick doesn't wait POLL_INTERVAL_MS.
  void tick();
  _pollTimer = setInterval(tick, POLL_INTERVAL_MS);

  function stopLoop() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
    set({ isPolling: false });
  }
}

/* -------------------------------------------------------------------------- */
/*   Pure helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Compute the "% closer" value (0..1) by comparing the user's current
 * advanced sub-metric scores against the targeted_metrics on their active
 * potential face. Pure — no store access, components compose.
 *
 * Returns `null` when we can't compute (no potential face, no advanced
 * analysis, or no targeted metrics).
 */
export function computeProgressPercent(
  potentialFace: PotentialFace | null,
  latestAdvanced: LatestAdvanced | null
): number | null {
  if (!potentialFace || !latestAdvanced) return null;
  const targets = potentialFace.targetedMetrics;
  if (!targets?.length) return null;

  const ratios: number[] = [];
  for (const t of targets) {
    const groupVal = (latestAdvanced as Record<string, unknown>)[t.group];
    if (!groupVal || typeof groupVal !== "object") continue;
    const current = (groupVal as Record<string, unknown>)[t.sub_metric];
    if (typeof current !== "number" || !Number.isFinite(current)) continue;
    const span = t.target_score - t.baseline_score;
    if (span <= 0) {
      // Already at target at baseline — count as fully closed.
      ratios.push(current >= t.target_score ? 1 : 0);
      continue;
    }
    const ratio = (current - t.baseline_score) / span;
    ratios.push(Math.max(0, Math.min(1, ratio)));
  }

  if (!ratios.length) return null;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

export type { PotentialFace, TargetedMetric, UnlockEvaluation };
