// app/(onboarding)/goals.tsx
// Multi-select goals screen — redesigned to match the new onboarding system.
import React, { useCallback, useState } from "react";
import { router } from "expo-router";
import {
  Gem,
  Sparkles,
  Scale,
  Droplets,
  Eye,
  Flame,
} from "lucide-react-native";

import {
  OnboardingScreenV2,
  PillOptionsList,
} from "@/components/onboarding";
import type { PillOption } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const GOAL_OPTIONS: PillOption[] = [
  {
    key: "jawline",
    label: "Sharper Jawline",
    description: "Improve jaw definition and mandible structure",
    Icon: Gem,
  },
  {
    key: "cheekbones",
    label: "Higher Cheekbones",
    description: "Enhance midface projection and hollows",
    Icon: Sparkles,
  },
  {
    key: "symmetry",
    label: "Better Facial Symmetry",
    description: "Balance both sides of your face",
    Icon: Scale,
  },
  {
    key: "skin",
    label: "Clearer Skin",
    description: "Improve skin texture and clarity",
    Icon: Droplets,
  },
  {
    key: "eyes",
    label: "Eye Area Improvement",
    description: "Enhance eye shape and under-eye area",
    Icon: Eye,
  },
  {
    key: "overall",
    label: "Overall Attractiveness",
    description: "General improvements across all features",
    Icon: Flame,
  },
];

export default function GoalsScreen() {
  const setField = useOnboarding((s) => s.setField);
  const savedGoals = useOnboarding((s) => s.data.goals);

  const [selected, setSelected] = useState<string[]>(savedGoals ?? []);

  const handleToggle = useCallback((keys: string[]) => {
    setSelected(keys);
  }, []);

  const handleNext = useCallback(() => {
    if (selected.length === 0) return;
    setField("goals", selected);
    router.push("/(onboarding)/gender");
  }, [selected, setField]);

  return (
    <OnboardingScreenV2
      stepKey="goals"
      title="What do you want to improve?"
      subtitle="Select all that apply — we'll personalize your experience"
      heroImage={require("@/assets/onbaording-images/goals.png")}
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
    >
      <PillOptionsList
        options={GOAL_OPTIONS}
        multiSelect
        selectedKeys={selected}
        onToggle={handleToggle}
      />
    </OnboardingScreenV2>
  );
}
