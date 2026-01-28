// app/(onboarding)/experience.tsx
// Looksmaxxing experience selection screen
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  { key: "new", label: "Completely new — never tried one" },
  { key: "tried", label: "Tried one or two — didn't stick" },
  { key: "few", label: "Used a few — inconsistent results" },
  { key: "regular", label: "Regular user — I know the basics" },
  { key: "skeptical", label: "Skeptical — I don't trust most apps" },
  { key: "bad", label: "Had a bad experience — too complicated / felt scammy" },
];

export default function ExperienceScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.looksmaxxingExperience ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      setField("looksmaxxingExperience", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/goals");
  }, [selected]);

  const handleSkip = useCallback(() => {
    // Store a default value when skipping
    setField("looksmaxxingExperience", "new");
    router.push("/(onboarding)/goals");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="experience"
      title="What's your experience with looksmaxxing apps?"
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
        scrollEnabled
        maxHeight={280}
      />
    </OnboardingScreen>
  );
}
