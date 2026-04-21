// app/(onboarding)/experience.tsx
// Looksmaxxing experience selection — redesigned to match the new onboarding
// system (OnboardingScreenV2 + PillOptionsList).
import React, { useCallback } from "react";
import { router } from "expo-router";
import { Sprout, TrendingUp, Zap } from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: PillOption[] = [
  { key: "new",     label: "Completely new",   description: "Never tried a looksmaxxing app", Icon: Sprout },
  { key: "some",    label: "Some experience",  description: "Tried a few, inconsistent results", Icon: TrendingUp },
  { key: "regular", label: "Experienced user", description: "I know the basics", Icon: Zap },
];

export default function ExperienceScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.looksmaxxingExperience ?? null;

  const handleSelect = useCallback(
    (key: string) => setField("looksmaxxingExperience", key),
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/goals");
  }, [selected]);

  return (
    <OnboardingScreenV2
      stepKey="experience"
      title="What's your experience with looksmaxxing apps?"
      subtitle="Pick one"
      heroImage={require("@/assets/onbaording-images/gender.png")}
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
