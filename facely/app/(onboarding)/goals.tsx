// app/(onboarding)/goals.tsx
// Goal selection screen - multi-select for what user wants to improve
import React, { useState, useCallback } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const GOAL_OPTIONS: Option[] = [
  {
    key: "jawline",
    label: "💎 Sharper Jawline",
    description: "Improve jaw definition and mandible structure",
  },
  {
    key: "cheekbones",
    label: "✨ Higher Cheekbones",
    description: "Enhance midface projection and hollows",
  },
  {
    key: "symmetry",
    label: "⚖️ Better Facial Symmetry",
    description: "Balance both sides of your face",
  },
  {
    key: "skin",
    label: "💧 Clearer Skin",
    description: "Improve skin texture and clarity",
  },
  {
    key: "eyes",
    label: "👁️ Eye Area Improvement",
    description: "Enhance eye shape and under-eye area",
  },
  {
    key: "overall",
    label: "🏆 Overall Attractiveness",
    description: "General improvements across all features",
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
    setField("goals", selected);
    router.push("/(onboarding)/time-commitment");
  }, [selected, setField]);

  const handleSkip = useCallback(() => {
    setField("goals", ["overall"]);
    router.push("/(onboarding)/time-commitment");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="goals"
      title="What facial parts do you want to improve?"
      subtitle="Select all that apply — we'll build your routine around these"
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
      primaryLabel="Continue"
      showSecondary
      secondaryLabel="Skip"
      onSecondary={handleSkip}
    >
      <OptionsList
        options={GOAL_OPTIONS}
        selected={null}
        onSelect={() => {}}
        multiSelect
        selectedMulti={selected}
        onSelectMulti={handleSelectMulti}
        scrollEnabled
        maxHeight={300}
      />
    </OnboardingScreen>
  );
}
