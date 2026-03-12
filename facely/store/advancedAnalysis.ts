// store/advancedAnalysis.ts
import { create } from "zustand";
import { fetchAdvancedAnalysis, type AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import { useScores } from "./scores";
import { mapBackendErrorToUserMessage } from "@/lib/api/client";

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

    if (!scores || !imageUri) {
      set({ error: "Run a face scan first to unlock advanced analysis." });
      return;
    }

    // Already have fresh data for this scan — skip
    const { data, cachedScanId, loading } = get();
    if (loading) return;
    if (data && cachedScanId === scanId && scanId !== null) return;

    set({ loading: true, error: null });
    try {
      const result = await fetchAdvancedAnalysis(imageUri, scores, scanId);
      set({ data: result, loading: false, cachedScanId: scanId ?? null });
    } catch (err) {
      const message = mapBackendErrorToUserMessage(err, "advanced-analysis");
      set({ error: message, loading: false });
    }
  },

  reset: () => set({ data: null, loading: false, error: null, cachedScanId: null }),
}));
