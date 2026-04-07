// store/advancedAnalysis.ts
import { create } from "zustand";
import { fetchAdvancedAnalysis, type AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
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

type Actions = {
  fetch: () => Promise<void>;
  reset: () => void;
};

export const useAdvancedAnalysis = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  cachedScanId: null,

  fetch: async () => {
    const { imageUri, scores, scanId } = useScores.getState();

    logger.log("[advancedAnalysis] fetch() called — scanId:", scanId, "hasImageUri:", !!imageUri, "hasScores:", !!scores);

    if (!scores || !imageUri) {
      logger.warn("[advancedAnalysis] blocked — missing scores or imageUri");
      set({ error: "Run a face scan first to unlock advanced analysis." });
      return;
    }

    // Already have fresh data for this scan — skip
    const { data, cachedScanId, loading } = get();
    logger.log("[advancedAnalysis] cache check — loading:", loading, "cachedScanId:", cachedScanId, "scanId:", scanId, "hasData:", !!data);
    if (loading) { logger.log("[advancedAnalysis] skipped — already loading"); return; }
    if (data && cachedScanId === scanId && scanId !== null) {
      logger.log("[advancedAnalysis] skipped — cache hit (scanId matches)");
      return;
    }

    set({ loading: true, error: null });
    try {
      logger.log("[advancedAnalysis] calling /analyze/advanced-explain...");
      const result = await fetchAdvancedAnalysis(imageUri, scores, scanId);
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

  reset: () => set({ data: null, loading: false, error: null, cachedScanId: null }),
}));
