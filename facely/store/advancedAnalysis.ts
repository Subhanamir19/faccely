// store/advancedAnalysis.ts
import { create } from "zustand";
import {
  fetchAdvancedAnalysis,
  hasAssessedHaircut,
  type AdvancedAnalysis,
} from "@/lib/api/advancedAnalysis";
import { useScores } from "./scores";
import { useInsights } from "./insights";
import { mapBackendErrorToUserMessage } from "@/lib/api/client";
import { logger } from "@/lib/logger";

type State = {
  data: AdvancedAnalysis | null;
  loading: boolean;
  error: string | null;
  /** scanId that produced current data — detects stale cache on re-scan */
  cachedScanId: string | null;
};

type EnsureFetchedResult = {
  data: AdvancedAnalysis | null;
  error: string | null;
};

type FetchOptions = {
  force?: boolean;
};

type Actions = {
  fetch: (options?: FetchOptions) => Promise<void>;
  /**
   * Resolve advanced-analysis data for the current scan without starting a
   * duplicate request. Three cases:
   *   1. Fresh cached data for current scanId → returns immediately.
   *   2. A fetch is already in flight → attach to it and wait for it to settle.
   *   3. Otherwise → kick off a fresh fetch.
   *
   * This exists because `fetch()` is also triggered in the background
   * post-scan; if the user taps "Advanced Analysis" while that background
   * call is still running, a naive `fetch()` becomes a no-op (the store's
   * `loading` guard short-circuits), leaving the caller to read `data: null`
   * and falsely report failure while the background call is still working.
   */
  ensureFetched: () => Promise<EnsureFetchedResult>;
  /** Dev-only seed path for previewing paid flows without backend calls. */
  seedDevData: (data: AdvancedAnalysis, scanId?: string) => void;
  reset: () => void;
};

export const useAdvancedAnalysis = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  cachedScanId: null,

  fetch: async (options = {}) => {
    const { imageUri, sideImageUri, scores, scanId } = useScores.getState();

    logger.log(
      "[advancedAnalysis] fetch() called — scanId:", scanId,
      "hasImageUri:", !!imageUri,
      "hasSideImageUri:", !!sideImageUri,
      "hasScores:", !!scores
    );

    if (!scores || !imageUri) {
      logger.warn("[advancedAnalysis] blocked — missing scores or imageUri");
      set({ error: "Run a face scan first to unlock advanced analysis." });
      return;
    }

    // Already have fresh data for this scan — skip
    const { data, cachedScanId, loading } = get();
    logger.log("[advancedAnalysis] cache check — loading:", loading, "cachedScanId:", cachedScanId, "scanId:", scanId, "hasData:", !!data);
    if (loading) { logger.log("[advancedAnalysis] skipped — already loading"); return; }
    if (data && cachedScanId === scanId && scanId !== null && !options.force) {
      logger.log("[advancedAnalysis] skipped — cache hit (scanId matches)");
      return;
    }
    if (options.force && data && cachedScanId === scanId && scanId !== null && !hasAssessedHaircut(data)) {
      logger.log("[advancedAnalysis] cached data missing assessed haircut - refreshing current scan");
    }

    set({ loading: true, error: null });
    try {
      logger.log("[advancedAnalysis] calling /analyze/advanced-explain...", sideImageUri ? "(with side image)" : "(frontal only)");
      const result = await fetchAdvancedAnalysis(imageUri, scores, scanId, sideImageUri ?? null);
      logger.log("[advancedAnalysis] fetch OK — groups returned:", Object.keys(result));
      set({ data: result, loading: false, cachedScanId: scanId ?? null });
      // Fix B: DB write is now complete (Fix A awaits it on backend).
      // Tell the insights store to re-fetch so the dashboard picks up latest_advanced.
      logger.log("[advancedAnalysis] fetch complete — invalidating insights and reloading");
      useInsights.getState().invalidate();
      useInsights.getState().loadInsights();
    } catch (err) {
      const message = mapBackendErrorToUserMessage(err, "advanced-analysis");
      logger.error("[advancedAnalysis] fetch FAILED:", message);
      set({ error: message, loading: false });
    }
  },

  ensureFetched: async (): Promise<EnsureFetchedResult> => {
    const { scanId } = useScores.getState();
    const initial = get();

    // Case 1 — fresh cache for current scan.
    if (initial.data && scanId !== null && initial.cachedScanId === scanId) {
      return { data: initial.data, error: null };
    }

    // Case 2 — a fetch is already running. Attach to it instead of
    // starting a second one (which the `fetch()` guard would no-op).
    if (initial.loading) {
      return new Promise<EnsureFetchedResult>((resolve) => {
        const unsub = useAdvancedAnalysis.subscribe((s) => {
          if (s.loading) return;
          unsub();
          resolve({ data: s.data, error: s.error });
        });
      });
    }

    // Case 3 — no fetch in flight. Start one and read the settled state.
    await get().fetch();
    const after = get();
    return { data: after.data, error: after.error };
  },

  seedDevData: (data, scanId = "dev-scan-preview") =>
    set({ data, loading: false, error: null, cachedScanId: scanId }),

  reset: () => set({ data: null, loading: false, error: null, cachedScanId: null }),
}));
