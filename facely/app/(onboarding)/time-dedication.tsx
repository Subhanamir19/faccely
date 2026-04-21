// app/(onboarding)/time-dedication.tsx
// Asks how much time per day the user can dedicate to their routine.
import React, { useCallback } from "react";
import { router } from "expo-router";
import { Zap, Target, Dumbbell, Flame } from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: PillOption[] = [
  {
    key: "5min",
    label: "5 minutes",
    description: "Quick daily habit — minimal time commitment",
    Icon: Zap,
  },
  {
    key: "10min",
    label: "10 minutes",
    description: "Balanced routine — great for most people",
    Icon: Target,
  },
  {
    key: "15min",
    label: "15 minutes",
    description: "Dedicated practice — noticeably faster results",
    Icon: Dumbbell,
  },
  {
    key: "20min",
    label: "20+ minutes",
    description: "Full protocol — maximum improvement",
    Icon: Flame,
  },
];

export default function TimeDedicationScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.timeDedication);

  const handleSelect = useCallback(
    (key: string) => setField("timeDedication", key),
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!saved) return;
    router.push("/(onboarding)/routine-animation");
  }, [saved]);

  return (
    <OnboardingScreenV2
      stepKey="time-dedication"
      title="How much time can you commit?"
      subtitle="We'll build a routine that fits your schedule"
      heroImage={require("@/assets/onbaording-images/time-dedication.png")}
      onPrimary={handleNext}
      primaryDisabled={!saved}
    >
      <PillOptionsList
        options={OPTIONS}
        selected={saved ?? null}
        onSelect={handleSelect}
      />
    </OnboardingScreenV2>
  );
}
