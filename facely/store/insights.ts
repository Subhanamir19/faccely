import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

// ---------------------------------------------------------------------------
// Module-level mutable refs — intentionally outside Zustand state so they
// never trigger re-renders.  They are implementation details, not UI state.
// ---------------------------------------------------------------------------

/** Active interval for pollUntilInsight — null means no poll is running. */
let _insightPollId: ReturnType<typeof setInterval> | null = null;
/** Active interval for pollUntilAdvanced — null means no poll is running. */
let _advancedPollId: ReturnType<typeof setInterval> | null = null;
/**
 * Monotonically-increasing generation counter.  Each loadInsights() call
 * captures its own generation; stale poll ticks that finish after a newer
 * manual fetch silently drop their result instead of overwriting fresh data.
 */
let _fetchGeneration = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
   * When scan_count >= 2 but insight hasn't generated yet, poll until it
   * arrives (max 30 s).  No-op if insight already exists, scan_count < 2,
   * or a poll is already running.
   * Returns a cleanup function — call it to cancel the poll on unmount.
   */
  pollUntilInsight: () => () => void;
  /**
   * When scan_count >= 1 but latest_advanced is null (advanced analysis still
   * running), poll every 5 s for up to 50 s until the data appears.
   * No-op if latest_advanced already exists, scan_count < 1, or a poll is
   * already running.
   * Returns a cleanup function — call it to cancel the poll on unmount.
   */
  pollUntilAdvanced: () => () => void;
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
    console.log("[insights] loadInsights called — loading:", loading, "isDirty:", isDirty, "hasData:", !!data);
    if (loading) { console.log("[insights] skipped — already in-flight"); return; }
    if (data && !isDirty) { console.log("[insights] skipped — data is fresh (isDirty=false)"); return; }

    // Capture generation so a concurrent poll tick cannot overwrite this result.
    _fetchGeneration += 1;
    const gen = _fetchGeneration;

    set({ loading: true, error: null });
    try {
      const result = await fetchInsights();

      // Discard if a newer fetch has already started (e.g. user pulled-to-refresh
      // while a background poll was in flight).
      if (gen !== _fetchGeneration) {
        console.log("[insights] discarding stale result — gen", gen, "< current", _fetchGeneration);
        return;
      }

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
      if (gen !== _fetchGeneration) return; // stale, ignore
      console.error("[insights] fetch FAILED:", err?.message);
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  // -------------------------------------------------------------------------
  // invalidate
  // -------------------------------------------------------------------------
  invalidate: () => {
    console.log("[insights] invalidate() called — marking isDirty=true");
    set({ isDirty: true });
  },

  // -------------------------------------------------------------------------
  // pollUntilInsight
  // -------------------------------------------------------------------------
  pollUntilInsight: () => {
    const { data } = get();

    // Guard: only poll when we have 2+ scans but insight hasn't generated yet.
    if (!data || data.scan_count < 2 || data.insight !== null) {
      return () => {}; // no-op cleanup
    }

    // Guard: don't start a second interval if one is already running.
    if (_insightPollId !== null) {
      console.log("[insights] pollUntilInsight already running — skipping");
      return () => { if (_insightPollId !== null) { clearInterval(_insightPollId); _insightPollId = null; } };
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 6; // 6 × 5 s = 30 s max
    const INTERVAL_MS  = 5_000;

    console.log("[insights] starting poll for insight (scan_count >= 2, insight is null)");

    _insightPollId = setInterval(async () => {
      attempts++;
      console.log("[insights] polling for insight — attempt", attempts);

      // Capture generation so a concurrent loadInsights() doesn't get stomped.
      _fetchGeneration += 1;
      const gen = _fetchGeneration;

      try {
        const result = await fetchInsights();

        if (gen !== _fetchGeneration) {
          console.log("[insights] pollUntilInsight: discarding stale result");
          return;
        }

        set({ data: result, loading: false, isDirty: false });

        if (result.insight !== null) {
          console.log("[insights] insight received — stopping poll");
          clearInterval(_insightPollId!);
          _insightPollId = null;
        } else if (attempts >= MAX_ATTEMPTS) {
          console.log("[insights] pollUntilInsight: max attempts reached — giving up");
          clearInterval(_insightPollId!);
          _insightPollId = null;
          set({ error: "Insight generation is taking longer than expected." });
        }
      } catch (err: any) {
        if (gen !== _fetchGeneration) return;
        console.warn("[insights] pollUntilInsight tick error:", err?.message);
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(_insightPollId!);
          _insightPollId = null;
          set({ error: "Failed to load insight after multiple retries." });
        }
      }
    }, INTERVAL_MS);

    return () => {
      if (_insightPollId !== null) {
        clearInterval(_insightPollId);
        _insightPollId = null;
      }
    };
  },

  // -------------------------------------------------------------------------
  // pollUntilAdvanced
  // -------------------------------------------------------------------------
  pollUntilAdvanced: () => {
    const { data } = get();

    // Guard: only poll when we have scans but advanced data hasn't arrived yet.
    if (!data || data.scan_count < 1 || data.latest_advanced !== null) {
      return () => {}; // no-op cleanup
    }

    // Guard: don't start a second interval if one is already running.
    if (_advancedPollId !== null) {
      console.log("[insights] pollUntilAdvanced already running — skipping");
      return () => { if (_advancedPollId !== null) { clearInterval(_advancedPollId); _advancedPollId = null; } };
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 10 × 5 s = 50 s max
    const INTERVAL_MS  = 5_000;

    console.log("[insights] starting poll for advanced data (latest_advanced is null)");

    _advancedPollId = setInterval(async () => {
      attempts++;
      console.log("[insights] polling for advanced data — attempt", attempts);

      _fetchGeneration += 1;
      const gen = _fetchGeneration;

      try {
        const result = await fetchInsights();

        if (gen !== _fetchGeneration) {
          console.log("[insights] pollUntilAdvanced: discarding stale result");
          return;
        }

        set({ data: result, loading: false, isDirty: false });

        if (result.latest_advanced !== null) {
          console.log("[insights] advanced data received — stopping poll");
          clearInterval(_advancedPollId!);
          _advancedPollId = null;
        } else if (attempts >= MAX_ATTEMPTS) {
          console.log("[insights] pollUntilAdvanced: max attempts reached — giving up");
          clearInterval(_advancedPollId!);
          _advancedPollId = null;
          set({ error: "Advanced analysis is taking longer than expected." });
        }
      } catch (err: any) {
        if (gen !== _fetchGeneration) return;
        console.warn("[insights] pollUntilAdvanced tick error:", err?.message);
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(_advancedPollId!);
          _advancedPollId = null;
          set({ error: "Failed to load advanced analysis after multiple retries." });
        }
      }
    }, INTERVAL_MS);

    return () => {
      if (_advancedPollId !== null) {
        clearInterval(_advancedPollId);
        _advancedPollId = null;
      }
    };
  },

  reset: () => set({ data: null, loading: false, error: null, isDirty: true }),
}));
