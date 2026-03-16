// app/(onboarding)/goals.tsx
// Goal selection screen - multi-select for what user wants to improve
import React, { useState, useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const GOAL_OPTIONS: Option[] = [
  {
    key: "jawline",
    label: "Sharper Jawline",
    description: "Improve jaw definition and mandible structure",
    emoji: "💎",
  },
  {
    key: "cheekbones",
    label: "Higher Cheekbones",
    description: "Enhance midface projection and hollows",
    emoji: "✨",
  },
  {
    key: "symmetry",
    label: "Better Facial Symmetry",
    description: "Balance both sides of your face",
    emoji: "⚖️",
  },
  {
    key: "skin",
    label: "Clearer Skin",
    description: "Improve skin texture and clarity",
    emoji: "🧴",
  },
  {
    key: "eyes",
    label: "Eye Area Improvement",
    description: "Enhance eye shape and under-eye area",
    emoji: "👁️",
  },
  {
    key: "overall",
    label: "Overall Attractiveness",
    description: "General improvements across all features",
    emoji: "🔥",
  },
];

export default function GoalsScreen() {
  const setField = useOnboarding((s) => s.setField);
  const savedGoals = useOnboarding((s) => s.data.goals);

  const [selected, setSelected] = useState<string[]>(savedGoals ?? []);

  const handleSelectMulti = useCallback((keys: string[]) => {
    setSelected(keys);
  }, []);

  const handleNext = useCallback(() => {
    setField("goals", selected.length > 0 ? selected : ["overall"]);
    router.push("/(onboarding)/gender");
  }, [selected, setField]);

  return (
    <OnboardingScreen
      stepKey="goals"
      title="What do you want to improve?"
      subtitle="Select all that apply — we'll personalize your experience"
      onPrimary={handleNext}
      primaryLabel="Continue"
    >
      <OptionsList
        options={GOAL_OPTIONS}
        multiSelect
        selectedMulti={selected}
        onSelectMulti={handleSelectMulti}
        scrollEnabled
        maxHeight={300}
      />
    </OnboardingScreen>
  );
}
