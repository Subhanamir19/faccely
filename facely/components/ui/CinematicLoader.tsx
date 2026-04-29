// components/ui/CinematicLoader.tsx
// Light-themed analysis/startup loader. Delegates rendering to RingLoader and
// owns the per-mode copy + stage cycling. Same public API as before so all
// existing call sites (loading.tsx, score-teaser, _protocols) keep working.
import React, { useEffect, useState } from "react";

import RingLoader from "@/components/ui/RingLoader";

const SCAN_STAGES = [
  "Extracting facial vectors",
  "Mapping proportions & harmony",
  "Calibrating sub-metrics",
  "Generating your scores",
];

const STARTUP_STAGES = [
  "Setting things up",
  "Loading your routine",
  "Almost ready",
];

const STAGE_INTERVAL_MS = 1900;

export type CinematicLoaderProps = {
  loading?: boolean;
  messages?: string[];
  brandLabel?: string;
  photoUri?: string;
};

const CinematicLoader: React.FC<CinematicLoaderProps> = ({
  loading = true,
  messages,
  photoUri,
}) => {
  const isScan = !!photoUri;
  const stages = messages ?? (isScan ? SCAN_STAGES : STARTUP_STAGES);

  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setStageIdx(0);
    const t = setInterval(() => {
      setStageIdx((i) => (i + 1) % stages.length);
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loading, stages.length]);

  return (
    <RingLoader
      loading={loading}
      kind={isScan ? "photo" : "mascot"}
      photoUri={photoUri}
      title={isScan ? "Analyzing your face" : "Preparing SigmaMax"}
      subtitle={stages[stageIdx]}
    />
  );
};

export default CinematicLoader;
