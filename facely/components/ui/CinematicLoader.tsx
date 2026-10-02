// components/ui/CinematicLoader.tsx
// Light-themed analysis/startup loader. Delegates rendering to RingLoader and
// owns the per-mode copy + stage cycling. Same public API as before so all
// existing call sites (loading.tsx, score-teaser, _protocols) keep working.
import React, { useEffect, useState } from "react";

import RingLoader from "@/components/ui/RingLoader";
import { hapticTick } from "@/lib/haptics";

const SCAN_STAGES = [
  "Finding your features",
  "Measuring proportions",
  "Checking symmetry",
  "Scoring each feature",
  "Putting your results together",
];

const STARTUP_STAGES = [
  "Setting things up",
  "Loading your routine",
  "Almost ready",
];

const STAGE_INTERVAL_MS = 2800;

export type CinematicLoaderProps = {
  loading?: boolean;
  messages?: string[];
  brandLabel?: string;
  photoUri?: string;
  appearance?: "default" | "onboarding";
};

const CinematicLoader: React.FC<CinematicLoaderProps> = ({
  loading = true,
  messages,
  photoUri,
  appearance = "default",
}) => {
  const isScan = !!photoUri;
  const stages = messages ?? (isScan ? SCAN_STAGES : STARTUP_STAGES);

  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setStageIdx(0);
    const t = setInterval(() => {
      // Hold on the last stage rather than looping back to the first.
      setStageIdx((i) => Math.min(i + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loading, stages.length]);

  // A tick per scan stage, so the wait feels like work landing step by step.
  // The startup loader stays silent.
  useEffect(() => {
    if (isScan && loading && stageIdx > 0) hapticTick();
  }, [isScan, loading, stageIdx]);

  return (
    <RingLoader
      loading={loading}
      kind={isScan ? "photo" : "mascot"}
      photoUri={photoUri}
      title={isScan ? "Analyzing your face" : "Preparing SigmaMax"}
      subtitle={stages[stageIdx]}
      appearance={appearance}
    />
  );
};

export default CinematicLoader;
