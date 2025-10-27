export type LoadingStageKey =
  | "startup"
  | "post-age"
  | "post-paywall"
  | "score"
  | "analysis";

export type LoadingStageCopy = {
  title: string;
  subtitle: string;
};

export const LOADING_STAGE_COPY: Record<LoadingStageKey, LoadingStageCopy> = {
  startup: {
    title: "Max your Looks",
    subtitle: "initializing Sigma engine",
  },
  "post-age": {
    title: "Refining age metrics",
    subtitle: "preparing adaptive parameters",
  },
  "post-paywall": {
    title: "Syncing intelligence layer",
    subtitle: "calibrating cognitive model",
  },
  score: {
    title: "Scoring your photos",
    subtitle: "extracting facial vectors",
  },
  analysis: {
    title: "Analyzing your structure",
    subtitle: "mapping proportions & harmony",
  },
};

const PHASE_ALIASES: Record<string, LoadingStageKey> = {
  startup: "startup",
  "age-metrics": "post-age",
  "paywall-sync": "post-paywall",
  scoring: "score",
  analysis: "analysis",
  "post-age": "post-age",
  "post-paywall": "post-paywall",
  score: "score",
};

export function resolveLoadingStage({
  mode,
  phase,
}: {
  mode?: string | null;
  phase?: string | null;
}): LoadingStageKey {
  if (phase) {
    const normalized = PHASE_ALIASES[phase];
    if (normalized) {
      return normalized;
    }
  }

  if (mode === "analyzePair") {
    return "score";
  }

  if (mode === "advanced") {
    return "analysis";
  }

  return "startup";
}

export function isLoadingStageKey(value: string): value is LoadingStageKey {
  return Object.prototype.hasOwnProperty.call(LOADING_STAGE_COPY, value);
}
