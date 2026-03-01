// app/(onboarding)/ethnicity.tsx
// Ethnicity selection screen
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  { key: "Asian",              label: "Asian",              emoji: "🌏" },
  { key: "African",            label: "African",            emoji: "🌍" },
  { key: "Caucasian",          label: "Caucasian",          emoji: "🌎" },
  { key: "Hispanic / Latino",  label: "Hispanic / Latino",  emoji: "🌮" },
  { key: "Middle Eastern",     label: "Middle Eastern",     emoji: "🌙" },
  { key: "Mixed / Other",      label: "Mixed / Other",      emoji: "🌐" },
  { key: "Prefer not to say",  label: "Prefer not to say",  emoji: "🔒" },
];

export default function EthnicityScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.ethnicity ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      setField("ethnicity", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/edge");
  }, [selected]);

  const handleSkip = useCallback(() => {
    setField("ethnicity", "Prefer not to say");
    router.push("/(onboarding)/edge");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="ethnicity"
      title="What's your ethnicity?"
      subtitle="Optional. We use this to calibrate benchmarks; it doesn't affect your score."
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
        scrollEnabled
        maxHeight={280}
      />
    </OnboardingScreen>
  );
}
