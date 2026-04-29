// app/(onboarding)/gender.tsx
// Gender selection — redesigned full-bleed layout with hero illustration
// and flat pill-style options including "Prefer not to say".
import React, { useCallback } from "react";
import { router } from "expo-router";
import { User, PersonStanding, Users, HelpCircle } from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: PillOption[] = [
  { key: "Male", label: "Male", Icon: User },
  { key: "Female", label: "Female", Icon: PersonStanding },
  { key: "Other", label: "Other", Icon: Users },
  { key: "Prefer not to say", label: "Prefer not to say", Icon: HelpCircle },
];

export default function GenderScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.gender ?? null;

  const handleSelect = useCallback(
    (key: string) => setField("gender", key),
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/age");
  }, [selected]);

  return (
    <OnboardingScreenV2
      stepKey="gender"
      title="What's your gender?"
      subtitle="This helps us provide more accurate analysis results"
      centered
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
