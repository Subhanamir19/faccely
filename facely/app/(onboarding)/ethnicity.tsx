// app/(onboarding)/ethnicity.tsx
// Ethnicity selection — redesigned to match gender/birthday: full-bleed
// layout, hero illustration, pill-style options with lucide icons.
import React, { useCallback } from "react";
import { router } from "expo-router";
import {
  Globe2,
  Globe,
  Mountain,
  Utensils,
  Moon,
  Shuffle,
  HelpCircle,
} from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: PillOption[] = [
  { key: "Asian",             label: "Asian",             Icon: Globe2 },
  { key: "African",           label: "African",           Icon: Globe },
  { key: "Caucasian",         label: "Caucasian",         Icon: Mountain },
  { key: "Hispanic / Latino", label: "Hispanic / Latino", Icon: Utensils },
  { key: "Middle Eastern",    label: "Middle Eastern",    Icon: Moon },
  { key: "Mixed / Other",     label: "Mixed / Other",     Icon: Shuffle },
  { key: "Prefer not to say", label: "Prefer not to say", Icon: HelpCircle },
];

export default function EthnicityScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.ethnicity ?? null;

  const handleSelect = useCallback(
    (key: string) => setField("ethnicity", key),
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/scan");
  }, [selected]);

  return (
    <OnboardingScreenV2
      stepKey="ethnicity"
      title="What's your ethnicity?"
      subtitle="Optional. We use this to calibrate benchmarks; it doesn't affect your score."
      heroImage={require("@/assets/onbaording-images/ethnicity.png")}
      onPrimary={handleNext}
      primaryDisabled={!selected}
    >
      <PillOptionsList
        options={OPTIONS}
        selected={selected}
        onSelect={handleSelect}
      />
    </OnboardingScreenV2>
  );
}
