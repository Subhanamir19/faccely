// C:\SS\facely\store\scores.ts
import { create } from "zustand";
import {
  API_BASE,
  API_BASE_CONFIGURED,
  API_BASE_CONFIGURATION_HINT,
  API_BASE_MISCONFIGURED_MESSAGE,
} from "../lib/api/config";import { pingHealth } from "../lib/api/health";
import {
  analyzeImage,
  analyzePair as apiAnalyzePair,
  type Scores,
} from "../lib/api/scores";
import {
  explainMetrics,
  explainMetricsPair,
  type Explanations,
} from "../lib/api/analysis";
import { toUserFacingError } from "../lib/api/client";

const MISCONFIGURED_ERROR_MESSAGE = (() => {
  if (API_BASE_CONFIGURED) return "";
  if (API_BASE_CONFIGURATION_HINT.trim().length > 0) {
    return API_BASE_CONFIGURATION_HINT;
  }
  return `${API_BASE_MISCONFIGURED_MESSAGE} (current fallback: ${API_BASE}).`;
})();

function ensureBackendConfigured() {
  if (!API_BASE_CONFIGURED) {
    throw new Error(MISCONFIGURED_ERROR_MESSAGE);
  }
}
// Re-export for other modules
export type { Scores };

type State = {
  imageUri: string | null;
  sideImageUri: string | null;
  scores: Scores | null;
  loading: boolean;
  error: string | null;

  explanations: Explanations | null;
  explLoading: boolean;
  explError: string | null;
};

type Actions = {
  setImage: (uri: string) => void;
  setSideImage: (uri: string) => void;

  /** Analyze single image. */
  analyze: (uri: string) => Promise<Scores>;


  /** Analyze a frontal + side image pair. */
  analyzePair: (frontalUri: string, sideUri: string) => Promise<Scores>;

  /** Explain metrics with single image. */
  explain: (uri: string, scores: Scores) => Promise<boolean>;

  /** Explain metrics with a pair of images. */
  explainPair: (
    frontalUri: string,
    sideUri: string,
    scores: Scores
  ) => Promise<boolean>;

  /** Reset all state. */
  reset: () => void;
};

export const useScores = create<State & Actions>((set, get) => ({
  imageUri: null,
  sideImageUri: null,
  scores: null,
  loading: false,
  error: null,

  explanations: null,
  explLoading: false,
  explError: null,

  setImage: (uri) => set({ imageUri: uri }),
  setSideImage: (uri) => set({ sideImageUri: uri }),

  analyze: async (uri: string) => {
    set({ loading: true, error: null, imageUri: uri });
    try {
      ensureBackendConfigured();

      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
      const s = await analyzeImage(uri);
      set({ scores: s, loading: false });
      return s;
    } catch (err) {
      const friendly = toUserFacingError(err, "Failed to analyze");
      set({ error: friendly.message, loading: false });
      throw friendly;
    }
  },

  analyzePair: async (frontalUri: string, sideUri: string) => {
    set({
      loading: true,
      error: null,
      imageUri: frontalUri,
      sideImageUri: sideUri,
    });
    try {
      ensureBackendConfigured();

      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
      const s = await apiAnalyzePair(frontalUri, sideUri);
      set({ scores: s, loading: false });
      return s;
    } catch (err) {
      const friendly = toUserFacingError(err, "Failed to analyze pair");
      set({ error: friendly.message, loading: false });
      throw friendly;
    }
  },

  explain: async (uri: string, scores: Scores): Promise<boolean> => {
    if (get().explLoading) return false;

    set({ explLoading: true, explError: null });
    try {
      ensureBackendConfigured();

      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
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

  explainPair: async (
    frontalUri: string,
    sideUri: string,
    scores: Scores
  ): Promise<boolean> => {
    if (get().explLoading) return false;

    set({ explLoading: true, explError: null });
    try {
      ensureBackendConfigured();

      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
      const exps = await explainMetricsPair(frontalUri, sideUri, scores);
      set({ explanations: exps, explLoading: false, explError: null });
      return true;
    } catch (e: any) {
      set({
        explLoading: false,
        explError:
          e?.name === "AbortError"
            ? "Request timed out"
            : e?.message || "Failed to explain pair",
      });
      return false;
    }
  },

  reset: () =>
    set({
      imageUri: null,
      sideImageUri: null,
      scores: null,
      loading: false,
      error: null,
      explanations: null,
      explLoading: false,
      explError: null,
    }),
}));
