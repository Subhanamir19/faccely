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
   * When scan_count >= 2 but insight hasn't generated yet, poll until it arrives.
   * No-op if insight already exists or scan_count < 2.
   */
  pollUntilInsight: () => void;
  /**
   * When scan_count >= 1 but latest_advanced is null (advanced analysis still running),
   * poll every 5s for up to 50s until the data appears.
   * No-op if latest_advanced already exists or scan_count < 1.
   * Returns a cleanup function — call it to cancel the poll (e.g. on unmount).
   */
  pollUntilAdvanced: () => () => void;
  reset: () => void;
};

export const useInsights = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  isDirty: true, // start dirty so first mount always fetches

  loadInsights: async () => {
    const { loading, data, isDirty } = get();
    console.log("[insights] loadInsights called — loading:", loading, "isDirty:", isDirty, "hasData:", !!data);
    if (loading) { console.log("[insights] skipped — already in-flight"); return; }
    if (data && !isDirty) { console.log("[insights] skipped — data is fresh (isDirty=false)"); return; }

    set({ loading: true, error: null });
    try {
      const result = await fetchInsights();
      console.log("[insights] fetch OK — scan_count:", result.scan_count,
        "latest_advanced:", result.latest_advanced ? "PRESENT" : "NULL",
        "previous_advanced:", result.previous_advanced ? "PRESENT" : "NULL",
        "insight:", result.insight ? "PRESENT" : "NULL",
      );
      if (result.latest_advanced) {
        console.log("[insights] latest_advanced keys:", Object.keys(result.latest_advanced));
        console.log("[insights] latest_advanced raw:", JSON.stringify(result.latest_advanced));
      }
      set({ data: result, loading: false, isDirty: false });
    } catch (err: any) {
      console.error("[insights] fetch FAILED:", err?.message);
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  invalidate: () => {
    console.log("[insights] invalidate() called — marking isDirty=true");
    set({ isDirty: true });
  },

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

  pollUntilAdvanced: () => {
    const { data } = get();
    // Only poll when we have scans but advanced data hasn't arrived yet
    if (!data || data.scan_count < 1 || data.latest_advanced !== null) {
      return () => {}; // no-op cleanup
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 10 × 5s = 50s max
    const INTERVAL_MS  = 5_000;

    console.log("[insights] starting poll for advanced data (latest_advanced is null)");

    const tick = setInterval(async () => {
      attempts++;
      console.log("[insights] polling for advanced data — attempt", attempts);
      try {
        const result = await fetchInsights();
        set({ data: result, loading: false, isDirty: false });
        if (result.latest_advanced !== null) {
          console.log("[insights] advanced data received — stopping poll");
          clearInterval(tick);
        } else if (attempts >= MAX_ATTEMPTS) {
          console.log("[insights] poll max attempts reached — giving up");
          clearInterval(tick);
        }
      } catch {
        if (attempts >= MAX_ATTEMPTS) clearInterval(tick);
      }
    }, INTERVAL_MS);

    return () => clearInterval(tick);
  },

  reset: () => set({ data: null, loading: false, error: null, isDirty: true }),
}));
