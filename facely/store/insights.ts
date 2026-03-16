import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

type State = {
  data: InsightData | null;
  loading: boolean;
  error: string | null;
  /** True when a new explanation has completed — next load will re-fetch */
  isDirty: boolean;
};

type Actions = {
  /** Fetch insights if data is missing or dirty. No-op if already fresh. */
  loadInsights: () => Promise<void>;
  /** Mark insights as stale — called after a new explanation completes. */
  invalidate: () => void;
  /**
   * When scan_count >= 2 but insight is still null (backend generating),
   * poll every 5s for up to 30s until the insight record appears.
   * No-op if insight already exists or scan_count < 2.
   */
  pollUntilInsight: () => void;
  reset: () => void;
};

export const useInsights = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  isDirty: true, // start dirty so first mount always fetches

  loadInsights: async () => {
    const { loading, data, isDirty } = get();
    if (loading) return;           // already in-flight
    if (data && !isDirty) return;  // fresh — nothing changed since last fetch

    set({ loading: true, error: null });
    try {
      const result = await fetchInsights();
      set({ data: result, loading: false, isDirty: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  invalidate: () => set({ isDirty: true }),

  pollUntilInsight: () => {
    const { data } = get();
    // Only poll when we have 2+ scans but insight hasn't generated yet
    if (!data || data.scan_count < 2 || data.insight !== null) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 6; // 6 × 5s = 30s max
    const INTERVAL_MS  = 5_000;

    const tick = setInterval(async () => {
      attempts++;
      try {
        const result = await fetchInsights();
        set({ data: result, loading: false, isDirty: false });
        // Stop as soon as insight arrives or we've exhausted attempts
        if (result.insight !== null || attempts >= MAX_ATTEMPTS) {
          clearInterval(tick);
        }
      } catch {
        if (attempts >= MAX_ATTEMPTS) clearInterval(tick);
      }
    }, INTERVAL_MS);
  },

  reset: () => set({ data: null, loading: false, error: null, isDirty: true }),
}));
