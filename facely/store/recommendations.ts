import { create } from "zustand";
import {
  fetchRecommendations,
  RecommendationsReq,
  RecommendationsRes,
} from "../lib/api/recommendations";

/**
 * UI expects a stable, task-like shape.
 * We normalize ANY backend payload to this.
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

/* -------------------------------- Normalizer --------------------------------
   Accepts legacy or future API forms and returns a stable shape for the UI.
   Handles these possibilities:
   1) { summary?: string, items: Array<Item> }                      // ideal
   2) { summary?: string, recommendations: Array<ItemLike> }        // legacy
   3) Array<string|ItemLike>                                        // ultra-legacy
   4) { items: Array<string> } or { recommendations: Array<string>} // text-only
----------------------------------------------------------------------------- */

function normalize(res: RecommendationsRes): NormalizedRecommendations {
  // Type helpers without being precious about exact backend types
  const toItem = (x: any): NormalizedRecommendations["items"][number] => {
    if (x && typeof x === "object") {
      return {
        metric: String(x.metric ?? "general"),
        title: typeof x.title === "string" ? x.title : undefined,
        recommendation:
          typeof x.recommendation === "string" ? x.recommendation : undefined,
        finding: typeof x.finding === "string" ? x.finding : undefined,
        priority:
          x.priority === "low" || x.priority === "medium" || x.priority === "high"
            ? x.priority
            : undefined,
        expected_gain:
          typeof x.expected_gain === "number" ? x.expected_gain : undefined,
        score: typeof x.score === "number" ? x.score : undefined,
      };
    }
    if (typeof x === "string") {
      return { metric: "general", title: x, recommendation: x };
    }
    return { metric: "general" };
  };

  // Case 1: already normalized
  if (
    res &&
    typeof res === "object" &&
    Array.isArray((res as any).items) &&
    ((res as any).items.length === 0 || (res as any).items.every((it: any) => it && typeof it === "object"))
  ) {
    const r = res as any;
    return {
      summary: typeof r.summary === "string" ? r.summary : undefined,
      items: r.items.map(toItem),
    };
  }

  // Case 2: legacy { recommendations: [...] }
  if (res && typeof res === "object" && Array.isArray((res as any).recommendations)) {
    const r = res as any;
    return {
      summary: typeof r.summary === "string" ? r.summary : undefined,
      items: r.recommendations.map(toItem),
    };
  }

  // Case 3: raw array
  if (Array.isArray(res)) {
    return { items: res.map(toItem) };
  }

  // Case 4: objects that only contain text arrays
  if (res && typeof res === "object") {
    const r = res as any;
    if (Array.isArray(r.items)) return { items: r.items.map(toItem) };
    if (Array.isArray(r.list)) return { items: r.list.map(toItem) };
  }

  // Fallback: wrap as single generic item so the UI never dies
  return { items: [{ metric: "general", recommendation: JSON.stringify(res) }] };
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
