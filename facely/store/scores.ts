// C:\SS\facely\store\scores.ts
import { create } from "zustand";
import { API_BASE } from "../lib/api/config";
import { pingHealth } from "../lib/api/health";
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
  analyze: (uri: string) => Promise<Scores | null>;

  /** Analyze a frontal + side image pair. */
  analyzePair: (frontalUri: string, sideUri: string) => Promise<Scores | null>;

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
      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
      const s = await analyzeImage(uri);
      set({ scores: s, loading: false });
      return s;
    } catch (e: any) {
      set({ error: e?.message || "Failed to analyze", loading: false });
      return null;
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
      const reachable = await pingHealth();
      if (!reachable) {
        throw new Error(
          `Backend unreachable. Check API base (${API_BASE}) and network.`
        );
      }
      const s = await apiAnalyzePair(frontalUri, sideUri);
      set({ scores: s, loading: false });
      return s;
    } catch (e: any) {
      set({
        error: e?.message || "Failed to analyze pair",
        loading: false,
      });
      return null;
    }
  },

  explain: async (uri: string, scores: Scores): Promise<boolean> => {
    if (get().explLoading) return false;

    set({ explLoading: true, explError: null });
    try {
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
