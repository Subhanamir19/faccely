// app/(onboarding)/ethnicity.tsx
// Ethnicity selection screen
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  { key: "Asian", label: "🌏 Asian" },
  { key: "African", label: "🌍 African" },
  { key: "Caucasian", label: "🏛️ Caucasian" },
  { key: "Hispanic / Latino", label: "🌎 Hispanic / Latino" },
  { key: "Middle Eastern", label: "🌙 Middle Eastern" },
  { key: "Mixed / Other", label: "🌐 Mixed / Other" },
  { key: "Prefer not to say", label: "🤐 Prefer not to say" },
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
    router.push("/(onboarding)/gender");
  }, [selected]);

  const handleSkip = useCallback(() => {
    setField("ethnicity", "Prefer not to say");
    router.push("/(onboarding)/gender");
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
