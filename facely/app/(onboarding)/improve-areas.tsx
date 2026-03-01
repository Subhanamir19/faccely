// app/(onboarding)/improve-areas.tsx
// Post-scan: asks which facial areas the user wants to improve specifically.
import React, { useCallback, useState } from "react";
import { router } from "expo-router";

import { OnboardingScreen, OptionsList, Option } from "@/components/onboarding";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: Option[] = [
  {
    key: "jawline",
    label: "Jawline & Chin",
    description: "Definition, projection, and mandibular structure",
    emoji: "💎",
  },
  {
    key: "eyes",
    label: "Eye Area",
    description: "Shape, symmetry, and canthal positioning",
    emoji: "👁️",
  },
  {
    key: "cheekbones",
    label: "Cheekbones",
    description: "Projection, hollows, and midface structure",
    emoji: "✨",
  },
  {
    key: "nose",
    label: "Nose",
    description: "Balance, harmony, and dorsal refinement",
    emoji: "👃",
  },
  {
    key: "skin",
    label: "Skin & Complexion",
    description: "Texture, clarity, and overall quality",
    emoji: "🧴",
  },
  {
    key: "symmetry",
    label: "Facial Symmetry",
    description: "Balance and alignment across both sides",
    emoji: "⚖️",
  },
];

export default function ImproveAreasScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.improveFocus);
  const [selected, setSelected] = useState<string[]>(saved ?? []);

  const handleSelectMulti = useCallback((keys: string[]) => {
    setSelected(keys);
  }, []);

  const handleNext = useCallback(() => {
    setField("improveFocus", selected.length > 0 ? selected : ["overall"]);
    router.push("/(onboarding)/time-dedication");
  }, [selected, setField]);

  const handleSkip = useCallback(() => {
    setField("improveFocus", ["overall"]);
    router.push("/(onboarding)/time-dedication");
  }, [setField]);

  return (
    <OnboardingScreen
      stepKey="improve-areas"
      title="What do you want to fix first?"
      subtitle="Based on your scan, select the areas you want to improve"
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
      primaryLabel="Continue"
      showSecondary
      secondaryLabel="Skip"
      onSecondary={handleSkip}
    >
      <OptionsList
        options={OPTIONS}
        selected={null}
        onSelect={() => {}}
        multiSelect
        selectedMulti={selected}
        onSelectMulti={handleSelectMulti}
        scrollEnabled
        maxHeight={340}
      />
    </OnboardingScreen>
  );
}
