import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

// ---------------------------------------------------------------------------
// Module-level mutable refs — outside Zustand state so they never trigger re-renders.
// ---------------------------------------------------------------------------

/** Active background poll interval — null means no poll is running. */
let _pollId: ReturnType<typeof setInterval> | null = null;

/**
 * Monotonically-increasing generation counter. Each loadInsights() call
 * captures its own generation; a stale poll tick that resolves after a newer
 * manual fetch drops its result instead of overwriting fresh data.
 */
let _fetchGeneration = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type State = {
  data: InsightData | null;
  loading: boolean;
  error: string | null;
  /** True when data is stale — next focus will re-fetch. */
  isDirty: boolean;
};

type Actions = {
  /** Fetch insights if data is missing or dirty. No-op if already fresh. */
  loadInsights: () => Promise<void>;
  /** Mark insights as stale — call after a new explanation or scan completes. */
  invalidate: () => void;
  /**
   * Start a single background poll that covers BOTH pending-insight and
   * pending-advanced-analysis cases. Fires every 5 s, stops when both
   * conditions resolve or after MAX_ATTEMPTS ticks.
   *
   * Safe to call multiple times — no-op if a poll is already running.
   * Returns a cleanup function to cancel early (e.g. on unmount).
   */
  startPolling: () => () => void;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInsights = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  isDirty: true, // start dirty so first mount always fetches

  // -------------------------------------------------------------------------
  // loadInsights
  // -------------------------------------------------------------------------
  loadInsights: async () => {
    const { loading, data, isDirty } = get();
    if (loading) return;
    if (data && !isDirty) return;

    _fetchGeneration += 1;
    const gen = _fetchGeneration;

    set({ loading: true, error: null });
    try {
      const result = await fetchInsights();
      if (gen !== _fetchGeneration) return; // a newer fetch already landed
      set({ data: result, loading: false, isDirty: false });
    } catch (err: any) {
      if (gen !== _fetchGeneration) return;
      console.error("[insights] fetch failed:", err?.message);
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  // -------------------------------------------------------------------------
  // invalidate
  // -------------------------------------------------------------------------
  invalidate: () => set({ isDirty: true }),

  // -------------------------------------------------------------------------
  // startPolling — single unified poll replacing the two old separate ones.
  //
  // Conditions that warrant polling:
  //   • scan_count >= 2 && insight === null  (AI insight pending)
  //   • scan_count >= 1 && latest_advanced === null  (advanced analysis pending)
  //
  // Only ONE interval runs at a time regardless of how many callers invoke this.
  // -------------------------------------------------------------------------
  startPolling: () => {
    const { data } = get();

    const needsInsight  = data != null && data.scan_count >= 2 && data.insight === null;
    const needsAdvanced = data != null && data.scan_count >= 1 && data.latest_advanced === null;

    if (!needsInsight && !needsAdvanced) {
      return () => {}; // nothing to poll for
    }

    // Already polling — return a cancel handle for the existing interval.
    if (_pollId !== null) {
      return () => {
        if (_pollId !== null) { clearInterval(_pollId); _pollId = null; }
      };
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 10 × 5 s = 50 s max

    _pollId = setInterval(async () => {
      attempts++;
      _fetchGeneration += 1;
      const gen = _fetchGeneration;

      try {
        const result = await fetchInsights();
        if (gen !== _fetchGeneration) return; // stale, discard

        set({ data: result, loading: false, isDirty: false });

        const stillNeedsInsight  = result.scan_count >= 2 && result.insight === null;
        const stillNeedsAdvanced = result.scan_count >= 1 && result.latest_advanced === null;

        if ((!stillNeedsInsight && !stillNeedsAdvanced) || attempts >= MAX_ATTEMPTS) {
          clearInterval(_pollId!);
          _pollId = null;
        }
      } catch (err: any) {
        if (gen !== _fetchGeneration) return;
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(_pollId!);
          _pollId = null;
          set({ error: "Background sync timed out." });
        }
      }
    }, 5_000);

    return () => {
      if (_pollId !== null) { clearInterval(_pollId); _pollId = null; }
    };
  },

  reset: () => set({ data: null, loading: false, error: null, isDirty: true }),
}));
