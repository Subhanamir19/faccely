import React, { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { StoryTextScreen } from "@/components/onboarding";
import { hapticLight } from "@/lib/haptics";

export default function AnalysisIntroScreen() {
  const params = useLocalSearchParams<{ devPreview?: string | string[] }>();
  const devPreview = (Array.isArray(params.devPreview) ? params.devPreview[0] : params.devPreview) === "1";

  const goNext = useCallback(() => {
    hapticLight();
    router.push({
      pathname: "/loading",
      params: {
        mode: "advanced",
        phase: "analysis",
        onboardingFlow: "1",
        next: "findingsBridge",
        ...(devPreview ? { devPreview: "1" } : {}),
      },
    });
  }, [devPreview]);

  return (
    <StoryTextScreen
      lines={["Let's find", "the things you need", "to improve your face."]}
      accentLineIndex={2}
      ctaLabel="NEXT"
      onNext={goNext}
      accessibilityLabel="Continue to analysis findings"
    />
  );
}
