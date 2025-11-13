import { create } from "zustand";
import {
  fetchRecommendations,
  RecommendationsReq,
  RecommendationsRes,
} from "../lib/api/recommendations";

/**
 * UI expects a stable, task-like shape derived from the backend response.
 */
export type NormalizedRecommendations = {
  summary?: string;
  items: Array<{
    metric: string;
    title?: string;
    recommendation?: string;
    finding?: string;
    priority?: "low" | "medium" | "high";
    expected_gain?: number;
    score?: number;
  }>;
};

type State = {
  data: NormalizedRecommendations | null;
  isLoading: boolean;
  error: string | null;
  lastHash: string | null;
  get: (req: RecommendationsReq) => Promise<void>;
  reset: () => void;
};

function hashReq(req: RecommendationsReq) {
  // simple JSON hash — good enough for caching identical inputs
  return JSON.stringify(req);
}

function normalize(res: RecommendationsRes): NormalizedRecommendations {
  return {
    summary: res.summary,
    items: res.items.map((item) => ({
      metric: item.metric,
      title: item.title,
      recommendation: item.recommendation,
      finding: item.finding,
      priority: item.priority,
      expected_gain: item.expected_gain,
      score: item.score,
    })),
  };
}

export const useRecommendations = create<State>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastHash: null,

  async get(req) {
    const h = hashReq(req);
    const { lastHash, data } = get();

    // soft cache: don’t re-fetch if same input already resolved
    if (lastHash === h && data) return;

    set({ isLoading: true, error: null });
    try {
      const raw = await fetchRecommendations(req);
      const norm = normalize(raw);
      set({ data: norm, isLoading: false, error: null, lastHash: h });
    } catch (e: any) {
      set({
        data: null,
      
        error:
          typeof e?.message === "string"
            ? e.message
            : "Failed to fetch recommendations",
        isLoading: false,
        lastHash: null,
      });
    }
  },

  reset() {
    set({ data: null, error: null, isLoading: false, lastHash: null });
  },
}));
