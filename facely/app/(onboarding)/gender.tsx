// app/(onboarding)/gender.tsx
// Gender selection screen
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  { key: "Female", label: "Female" },
  { key: "Male", label: "Male" },
  { key: "Other", label: "Other" },
];

export default function GenderScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.gender ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      setField("gender", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/edge");
  }, [selected]);

  const handleSkip = useCallback(() => {
    // Don't store default for gender - it's optional
    router.push("/(onboarding)/edge");
  }, []);

  return (
    <OnboardingScreen
      stepKey="gender"
      title="What's your gender?"
      subtitle="This helps us provide more accurate analysis results"
      onPrimary={handleNext}
      primaryDisabled={!selected}
      primaryLabel="Next"
      showSecondary
      secondaryLabel="Skip"
      onSecondary={handleSkip}
    >
      <OptionsList
        options={OPTIONS}
        selected={selected}
        onSelect={handleSelect}
      />
    </OnboardingScreen>
  );
}
