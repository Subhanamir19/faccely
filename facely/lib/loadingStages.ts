export type LoadingStageKey =
  | "startup"
  | "age-metrics"
  | "paywall-sync"
  | "scoring"
  | "analysis"
  | "routine-plan";

export type LoadingStageCopy = {
  title: string;
  subtitle: string;
  badge: number | "random";

};

export const LOADING_STAGE_COPY: Record<LoadingStageKey, LoadingStageCopy> = {
  startup: {
    title: "Max your Looks",
    subtitle: "initializing Sigma engine",
    badge: "random",

  },
  "age-metrics": {
    title: "Refining age metrics",
    subtitle: "preparing adaptive parameters",
    badge: 31,

  },
  "paywall-sync": {
    title: "Syncing intelligence layer",
    subtitle: "calibrating cognitive model",
    badge: 48,

  },
  scoring: {
    title: "Scoring your photos",
    subtitle: "extracting facial vectors",
    badge: 69,

  },
  analysis: {
    title: "Analyzing your structure",
    subtitle: "mapping proportions & harmony",
    badge: 69,

  },
  "routine-plan": {
    title: "Designing your 30-day plan",
    subtitle: "selecting top routines",
    badge: 94,

  },
};

export function resolveLoadingStage({
  mode,
  phase,
}: {
  mode?: string | null;
  phase?: string | null;
}): LoadingStageKey {
  if (phase && isLoadingStageKey(phase)) {
    return phase;
  }

  if (mode === "analyzePair") {
    return "scoring";
  }

  if (mode === "advanced") {
    return "analysis";
  }

  return "startup";
}

export function isLoadingStageKey(value: string): value is LoadingStageKey {
  return Object.prototype.hasOwnProperty.call(LOADING_STAGE_COPY, value);
}