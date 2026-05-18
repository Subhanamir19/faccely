import React, { useCallback } from "react";
import { router } from "expo-router";

import { StoryTextScreen } from "@/components/onboarding";
import { hapticLight } from "@/lib/haptics";

export default function PlanIntroScreen() {
  const goNext = useCallback(() => {
    hapticLight();
    router.push({ pathname: "/(onboarding)/routine-animation", params: { fromAnalysis: "1" } });
  }, []);

  return (
    <StoryTextScreen
      lines={["Let us build", "a plan for you", "to achieve it."]}
      accentLineIndex={2}
      ctaLabel="NEXT"
      onNext={goNext}
      accessibilityLabel="Continue to routine builder"
    />
  );
}
