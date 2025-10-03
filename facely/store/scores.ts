// C:\SS\facely\store\scores.ts
import { create } from "zustand";
import { pingHealth } from "../lib/api/health";
import { analyzeImage, type Scores } from "../lib/api/scores";
import {
  explainMetrics,
  explainMetricsPair,
  type Explanations,
} from "../lib/api/analysis";

// re-export for other modules
export type { Scores };

/* -------------------- API base -------------------- */
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  // Android emulator host
  "http://10.0.2.2:8080";

/* Build a RN-friendly file part. Always give name and type. */
function toPart(uri: string, fallbackName: string): {
  uri: string;
  name: string;
  type: string;
} {
  const u = uri.startsWith("file://")
    ? uri
    : uri.startsWith("/")
    ? `file://${uri}`
    : uri;
  // We label as JPEG; server sniffs true type anyway.
  return { uri: u, name: `${fallbackName}.jpg`, type: "image/jpeg" };
}

/* Upload frontal+side via multipart without forcing Content-Type */
async function uploadPair(frontalUri: string, sideUri: string): Promise<Scores> {
  const fd = new FormData();
  fd.append("frontal", toPart(frontalUri, "frontal") as any);
  fd.append("side", toPart(sideUri, "side") as any);

  const res = await fetch(`${API_URL}/analyze/pair`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // DO NOT set "Content-Type": RN sets correct multipart boundary.
    },
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Backend ${res.status}${
        text ? ` — ${text.slice(0, 200)}` : ""
      }`.trim()
    );
  }
  return (await res.json()) as Scores;
}

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

  /** Explain metrics with a pair (frontal + side). */
  explainPair: (
    frontalUri: string,
    sideUri: string,
    scores: Scores
  ) => Promise<boolean>;

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
        throw new Error("Backend unreachable. Check API base URL and network.");
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
        throw new Error("Backend unreachable. Check API base URL and network.");
      }

      // Use our fixed uploader (no manual Content-Type, real bytes)
      const s = await uploadPair(frontalUri, sideUri);
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
        throw new Error("Backend unreachable. Check API base URL and network.");
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
        throw new Error("Backend unreachable. Check API base URL and network.");
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

/* ------------------------------------------------------------------------- */
/* Visible-cards utilities: keep the first 7 metrics without mutating source */
/* ------------------------------------------------------------------------- */

export const MAX_VISIBLE_CARDS = 7;

export function trimScoresToVisible(
  s: Scores,
  n: number = MAX_VISIBLE_CARDS
): Scores {
  const clone: any = Array.isArray(s) ? [...(s as any)] : { ...(s as any) };
  const candidateKeys = ["metrics", "cards", "series"];

  for (const key of candidateKeys) {
    if (Array.isArray(clone[key])) {
      clone[key] = clone[key].slice(0, n);
    }
  }

  if (Array.isArray(clone)) {
    return (clone as any).slice(0, n) as Scores;
  }
  return clone as Scores;
}

export const selectVisibleScores = (state: State): Scores | null =>
  state.scores ? trimScoresToVisible(state.scores, MAX_VISIBLE_CARDS) : null;
