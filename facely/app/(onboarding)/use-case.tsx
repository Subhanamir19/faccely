// app/(onboarding)/use-case.tsx
// Use case selection screen
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  { key: "scores", label: "For getting facial scores" },
  { key: "analysis", label: "For getting facial analysis" },
  { key: "routine", label: "For the routine" },
];

export default function UseCaseScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.useCase ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      setField("useCase", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/experience");
  }, [selected]);

  const handleSkip = useCallback(() => {
    setField("useCase", "scores");
    router.push("/(onboarding)/experience");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="use-case"
      title="What do you want to use the app for?"
      subtitle="Pick one"
      onPrimary={handleNext}
      primaryDisabled={!selected}
      primaryLabel="Continue"
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
