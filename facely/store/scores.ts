// facely/store/scores.ts
import { create } from "zustand";
import { API_BASE, API_BASE_CONFIGURATION_HINT, API_BASE_REASON } from "../lib/api/config";
import { pingHealth } from "../lib/api/health";
import {
  analyzeImage,
  analyzePair as apiAnalyzePair,
  type Scores,
  consumeUploadMeta,
} from "../lib/api/scores";
import {
  explainMetrics,
  explainMetricsPair,
  type Explanations,
} from "../lib/api/analysis";
import { mapBackendErrorToUserMessage } from "../lib/api/client";

type InputFile = string | { uri: string; name?: string; mime?: string };

type RequestKey =
  | "analyzeSingle"
  | "analyzePair"
  | "explainSingle"
  | "explainPair";

type RequestSnapshot = {
  id: number;
  loading: boolean;
  error: string | null;
};

type RequestStatusMap = Record<RequestKey, RequestSnapshot>;

const createInitialRequests = (): RequestStatusMap => ({
  analyzeSingle: { id: 0, loading: false, error: null },
  analyzePair: { id: 0, loading: false, error: null },
  explainSingle: { id: 0, loading: false, error: null },
  explainPair: { id: 0, loading: false, error: null },
});

let requestCounter = 0;
const nextRequestId = () => ++requestCounter;

const computeAnalyzeLoading = (r: RequestStatusMap) =>
  r.analyzeSingle.loading || r.analyzePair.loading;

const computeAnalyzeError = (r: RequestStatusMap): string | null =>
  r.analyzeSingle.error ?? r.analyzePair.error ?? null;

const computeExplainLoading = (r: RequestStatusMap) =>
  r.explainSingle.loading || r.explainPair.loading;

const computeExplainError = (r: RequestStatusMap): string | null =>
  r.explainSingle.error ?? r.explainPair.error ?? null;

const deriveLegacyFlags = (requests: RequestStatusMap) => ({
  loading: computeAnalyzeLoading(requests),
  error: computeAnalyzeError(requests),
  explLoading: computeExplainLoading(requests),
  explError: computeExplainError(requests),
});

const BACKEND_CONFIGURATION_MESSAGE = (() => {
  const hint = API_BASE_CONFIGURATION_HINT?.trim();
  if (hint) return hint;
  if (API_BASE.trim()) return `Using backend at ${API_BASE}.`;
  return "Backend base URL missing. Set EXPO_PUBLIC_API_BASE_URL.";
})();

function ensureBackendConfigured() {
  if (!API_BASE || API_BASE.trim().length === 0) {
    throw new Error(BACKEND_CONFIGURATION_MESSAGE);
  }
}

async function assertBackendReachable(): Promise<void> {
  ensureBackendConfigured();
  const reachable = await pingHealth();
  if (!reachable) {
    throw new Error(
      `Backend unreachable at ${API_BASE} (reason: ${API_BASE_REASON}). Check network, emulator mapping, or server process.`
    );
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

  requests: RequestStatusMap;
};

type Actions = {
  setImage: (uri: string) => void;
  setSideImage: (uri: string) => void;

  /** Analyze single image. Accepts string or { uri, name?, mime? }. */
  analyze: (input: InputFile) => Promise<Scores>;

  /** Analyze a frontal + side image pair. Accepts strings or objects. */
  analyzePair: (front: InputFile, side: InputFile) => Promise<Scores>;

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

const getUri = (x: InputFile): string =>
  typeof x === "string" ? x : x?.uri ?? "";

const initialRequests = createInitialRequests();
const initialLegacyFlags = deriveLegacyFlags(initialRequests);

export const useScores = create<State & Actions>((set, get) => ({
  imageUri: null,
  sideImageUri: null,
  scores: null,
  loading: initialLegacyFlags.loading,
  error: initialLegacyFlags.error,

  explanations: null,
  explLoading: initialLegacyFlags.explLoading,
  explError: initialLegacyFlags.explError,

  requests: initialRequests,

  setImage: (uri) => set({ imageUri: uri }),
  setSideImage: (uri) => set({ sideImageUri: uri }),

  analyze: async (input: InputFile) => {
    const originalUri = getUri(input);
    const requestId = nextRequestId();
    set((state) => {
      const requests = {
        ...state.requests,
        analyzeSingle: { id: requestId, loading: true, error: null },
      };
      return {
        ...state,
        requests,
        ...deriveLegacyFlags(requests),
      };
    });

    try {
      await assertBackendReachable();

      // Pass through; api layer now accepts string or { uri, name, mime }
      const s = await analyzeImage(input as any);
      const meta = consumeUploadMeta(s);
      const normalizedUri = meta?.single?.uri ?? originalUri;
      set((state) => {
        if (state.requests.analyzeSingle.id !== requestId) return state;
        const requests = {
          ...state.requests,
          analyzeSingle: { id: requestId, loading: false, error: null },
        };
        return {
          ...state,
          scores: s,
          imageUri: normalizedUri ?? originalUri ?? null,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return s;
    } catch (err) {
      const friendlyMessage = mapBackendErrorToUserMessage(err, "analyze");
      set((state) => {
        if (state.requests.analyzeSingle.id !== requestId) return state;
        const requests = {
          ...state.requests,
          analyzeSingle: {
            id: requestId,
            loading: false,
            error: friendlyMessage,
          },
        };
        return {
          ...state,
          imageUri: originalUri,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      throw new Error(friendlyMessage);
    }
  },

  analyzePair: async (front: InputFile, side: InputFile) => {
    const frontUri = getUri(front);
    const sideUri = getUri(side);
    const requestId = nextRequestId();
    set((state) => {
      const requests = {
        ...state.requests,
        analyzePair: { id: requestId, loading: true, error: null },
      };
      return {
        ...state,
        requests,
        ...deriveLegacyFlags(requests),
      };
    });

    try {
      await assertBackendReachable();

      // Pass through; api layer now accepts string or { uri, name, mime }
      const s = await apiAnalyzePair(front as any, side as any);
      const meta = consumeUploadMeta(s);
      const normalizedFront = meta?.front?.uri ?? frontUri;
      const normalizedSide = meta?.side?.uri ?? sideUri;
      set((state) => {
        if (state.requests.analyzePair.id !== requestId) return state;
        const requests = {
          ...state.requests,
          analyzePair: { id: requestId, loading: false, error: null },
        };
        return {
          ...state,
          scores: s,
          imageUri: normalizedFront ?? frontUri ?? null,
          sideImageUri: normalizedSide ?? sideUri ?? null,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return s;
    } catch (err) {
      const friendlyMessage = mapBackendErrorToUserMessage(err, "analyze");
      set((state) => {
        if (state.requests.analyzePair.id !== requestId) return state;
        const requests = {
          ...state.requests,
          analyzePair: {
            id: requestId,
            loading: false,
            error: friendlyMessage,
          },
        };
        return {
          ...state,
          imageUri: frontUri,
          sideImageUri: sideUri,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      throw new Error(friendlyMessage);
    }
  },

  explain: async (uri: string, scores: Scores): Promise<boolean> => {
    if (get().requests.explainSingle.loading) return false;
    const requestId = nextRequestId();
    set((state) => {
      const requests = {
        ...state.requests,
        explainSingle: { id: requestId, loading: true, error: null },
      };
      return {
        ...state,
        requests,
        ...deriveLegacyFlags(requests),
      };
    });
    try {
      await assertBackendReachable();

      const exps = await explainMetrics(uri, scores);
      set((state) => {
        if (state.requests.explainSingle.id !== requestId) return state;
        const requests = {
          ...state.requests,
          explainSingle: { id: requestId, loading: false, error: null },
        };
        return {
          ...state,
          explanations: exps,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return true;
    } catch (e: any) {
      const message = mapBackendErrorToUserMessage(e, "explain");
      set((state) => {
        if (state.requests.explainSingle.id !== requestId) return state;
        const requests = {
          ...state.requests,
          explainSingle: {
            id: requestId,
            loading: false,
            error: message,
          },
        };
        return {
          ...state,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return false;
    }
  },

  explainPair: async (
    frontalUri: string,
    sideUri: string,
    scores: Scores
  ): Promise<boolean> => {
    if (get().requests.explainPair.loading) return false;
    const requestId = nextRequestId();
    set((state) => {
      const requests = {
        ...state.requests,
        explainPair: { id: requestId, loading: true, error: null },
      };
      return {
        ...state,
        requests,
        ...deriveLegacyFlags(requests),
      };
    });
    try {
      await assertBackendReachable();

      const exps = await explainMetricsPair(frontalUri, sideUri, scores);
      set((state) => {
        if (state.requests.explainPair.id !== requestId) return state;
        const requests = {
          ...state.requests,
          explainPair: { id: requestId, loading: false, error: null },
        };
        return {
          ...state,
          explanations: exps,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return true;
    } catch (e: any) {
      const message = mapBackendErrorToUserMessage(e, "explain");
      set((state) => {
        if (state.requests.explainPair.id !== requestId) return state;
        const requests = {
          ...state.requests,
          explainPair: {
            id: requestId,
            loading: false,
            error: message,
          },
        };
        return {
          ...state,
          requests,
          ...deriveLegacyFlags(requests),
        };
      });
      return false;
    }
  },

  reset: () =>
    set(() => {
      const requests = createInitialRequests();
      return {
        imageUri: null,
        sideImageUri: null,
        scores: null,
        explanations: null,
        requests,
        ...deriveLegacyFlags(requests),
      };
    }),
}));

// ---------------------------------------------------------------------------
// Helpers for UI (non-breaking additions)
// ---------------------------------------------------------------------------
export function getSubmetricVerdicts(
  explanations: Explanations | null,
  metric: keyof Scores
): string[] {
  if (!explanations) return ["", "", "", ""];
  const arr = explanations[metric as keyof typeof explanations];
  return Array.isArray(arr) ? [...arr] : ["", "", "", ""];
}
