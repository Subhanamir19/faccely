// app/(onboarding)/time-dedication.tsx
// Asks how much time per day the user can dedicate to their routine.
import React, { useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  {
    key: "5min",
    label: "5 minutes",
    description: "Quick daily habit — minimal time commitment",
    emoji: "⚡",
  },
  {
    key: "10min",
    label: "10 minutes",
    description: "Balanced routine — great for most people",
    emoji: "🎯",
  },
  {
    key: "15min",
    label: "15 minutes",
    description: "Dedicated practice — noticeably faster results",
    emoji: "💪",
  },
  {
    key: "20min",
    label: "20+ minutes",
    description: "Full protocol — maximum improvement",
    emoji: "🔥",
  },
];

export default function TimeDedicationScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.timeDedication);

  const handleSelect = useCallback(
    (key: string) => {
      setField("timeDedication", key);
    },
    [setField]
  );

  const handleNext = useCallback(() => {
    if (!saved) setField("timeDedication", "10min");
    router.push("/(onboarding)/routine-animation");
  }, [saved, setField]);

  const handleSkip = useCallback(() => {
    setField("timeDedication", "10min");
    router.push("/(onboarding)/routine-animation");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="time-dedication"
      title="How much time can you commit?"
      subtitle="We'll build a routine that fits your schedule"
      onPrimary={handleNext}
      primaryDisabled={!saved}
      primaryLabel="Continue"
      showSecondary
      secondaryLabel="Skip"
      onSecondary={handleSkip}
    >
      <OptionsList
        options={OPTIONS}
        selected={saved ?? null}
        onSelect={handleSelect}
      />
    </OnboardingScreen>
  );
}
