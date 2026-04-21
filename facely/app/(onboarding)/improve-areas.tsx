// app/(onboarding)/improve-areas.tsx
// Post-scan: asks which facial areas the user wants to improve specifically.
// Redesigned on OnboardingScreenV2 + PillOptionsList (multi-select).
import React, { useCallback, useState } from "react";
import { router } from "expo-router";
import { Gem, Sparkles, Flame, Target } from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: PillOption[] = [
  {
    key: "angularity",
    label: "Facial Angularity",
    description: "Sharper jawline, cheekbones, and bone structure",
    Icon: Gem,
  },
  {
    key: "harmony",
    label: "Facial Harmony",
    description: "Better balance and proportion across features",
    Icon: Sparkles,
  },
  {
    key: "leanness",
    label: "Facial Leanness",
    description: "Reduce facial fat and reveal underlying structure",
    Icon: Flame,
  },
  {
    key: "overall",
    label: "Overall",
    description: "Improve everything together",
    Icon: Target,
  },
];

export default function ImproveAreasScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.improveFocus);
  const [selected, setSelected] = useState<string[]>(saved ?? []);

  const handleToggle = useCallback((keys: string[]) => {
    setSelected(keys);
  }, []);

  const handleNext = useCallback(() => {
    if (selected.length === 0) return;
    setField("improveFocus", selected);
    router.push("/(onboarding)/time-dedication");
  }, [selected, setField]);

  return (
    <OnboardingScreenV2
      stepKey="improve-areas"
      title="What do you want to fix first?"
      subtitle="Based on your scan, select the areas you want to improve"
      heroImage={require("@/assets/onbaording-images/improve-areas.png")}
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
    >
      <PillOptionsList
        options={OPTIONS}
        multiSelect
        selectedKeys={selected}
        onToggle={handleToggle}
      />
    </OnboardingScreenV2>
  );
}
