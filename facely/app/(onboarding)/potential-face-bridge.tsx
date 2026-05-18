// app/(onboarding)/potential-face-bridge.tsx
// Story beat before the advanced analysis surface.

import React, { useCallback } from "react";
import { router } from "expo-router";

import { StoryTextScreen } from "@/components/onboarding";
import { hapticLight } from "@/lib/haptics";

export default function PotentialFaceBridgeScreen() {
  const goNext = useCallback(() => {
    hapticLight();
    router.replace({ pathname: "/(tabs)/analysis", params: { onboardingFlow: "1" } });
  }, []);

  return (
    <StoryTextScreen
      lines={["Here's what", "we found", "inside your analysis."]}
      accentLineIndex={2}
      ctaLabel="NEXT"
      onNext={goNext}
      accessibilityLabel="Continue to advanced analysis"
    />
  );
}
