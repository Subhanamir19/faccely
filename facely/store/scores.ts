import { create } from "zustand";
import { analyzeImage, type Scores } from "../lib/api/scores";
import { explainMetrics, type Explanations } from "../lib/api/analysis";

// re-export for other modules
export type { Scores };

type State = {
  imageUri: string | null;
  scores: Scores | null;
  loading: boolean;
  error: string | null;

  explanations: Explanations | null;
  explLoading: boolean;
  explError: string | null;
};

type Actions = {
  setImage: (uri: string) => void;

  /** Analyze image and return scores JSON (or null on failure). */
  analyze: (uri: string) => Promise<Scores | null>;

  reset: () => void;

  /** Returns true on success, false on failure (never hangs). */
  explain: (uri: string, scores: Scores) => Promise<boolean>;
};

export const useScores = create<State & Actions>((set, get) => ({
  imageUri: null,
  scores: null,
  loading: false,
  error: null,

  explanations: null,
  explLoading: false,
  explError: null,

  setImage: (uri) => set({ imageUri: uri }),

  analyze: async (uri: string) => {
    set({ loading: true, error: null, imageUri: uri });
    try {
      const lower = uri.toLowerCase();
      const mime = lower.endsWith(".png") ? "image/png" : "image/jpeg";
      const s = await analyzeImage(uri, mime);
      set({ scores: s, loading: false });
      return s; // <-- return the JSON scores
    } catch (e: any) {
      set({ error: e?.message || "Failed to analyze", loading: false });
      return null; // <-- fail safe
    }
  },

  // Always resolves; spinner can’t get stuck
  explain: async (uri: string, scores: Scores): Promise<boolean> => {
    if (get().explLoading) return false;

    set({ explLoading: true, explError: null });
    try {
      const exps = await explainMetrics(uri, scores);
      set({ explanations: exps, explLoading: false, explError: null });
      return true;
    } catch (e: any) {
      set({
        explLoading: false,
        explError:
          e?.name === "AbortError"
            ? "Request timed out"
            : e?.message || "Failed to explain",
      });
      return false;
    }
  },

  reset: () =>
    set({
      imageUri: null,
      scores: null,
      loading: false,
      error: null,
      explanations: null,
      explLoading: false,
      explError: null,
    }),
}));
