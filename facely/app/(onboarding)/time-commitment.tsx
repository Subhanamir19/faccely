// app/(onboarding)/time-commitment.tsx
// How much time will the user commit to their routine daily?
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  {
    key: "5min",
    label: "⚡ 5 min / day",
    description: "Quick habits that stack up over time",
  },
  {
    key: "10min",
    label: "🎯 10 min / day",
    description: "Steady, consistent progress",
  },
  {
    key: "20min",
    label: "🔥 20 min / day",
    description: "Accelerated gains with focused effort",
  },
  {
    key: "30min",
    label: "💪 30+ min / day",
    description: "Maximum transformation, full commitment",
  },
];

export default function TimeCommitmentScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.timeCommitment ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      setField("timeCommitment", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/building-plan");
  }, [selected]);

  const handleSkip = useCallback(() => {
    setField("timeCommitment", "10min");
    router.push("/(onboarding)/building-plan");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="time-commitment"
      title="How much time will you commit daily?"
      subtitle="We'll tailor your routine to fit your schedule"
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
