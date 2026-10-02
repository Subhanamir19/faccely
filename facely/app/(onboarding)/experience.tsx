// app/(onboarding)/experience.tsx
// Looksmaxxing experience selection. Uses the descriptive row rather than the
// wide row: these three options each carry a line of explanation, and the
// reference reserves the wide row for options that are label-only.
import React, { useCallback } from "react";
import { router } from "expo-router";
import { Sprout, TrendingUp, Zap } from "lucide-react-native";

import OrangeQuestionScreen, {
  OrangeOption,
  OrangeOptionRow,
} from "@/components/onboarding/OrangeQuestionScreen";
import { hapticRigid } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: OrangeOption[] = [
  { key: "new",     label: "Completely new",   caption: "Never tried a looksmaxxing app", Icon: Sprout },
  { key: "some",    label: "Some experience",  caption: "Tried a few, inconsistent results", Icon: TrendingUp },
  { key: "regular", label: "Experienced user", caption: "I know the basics", Icon: Zap },
];

export default function ExperienceScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.looksmaxxingExperience ?? null;

  const handleSelect = useCallback(
    (key: string) => {
      hapticRigid();
      setField("looksmaxxingExperience", key);
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!selected) return;
    router.push("/(onboarding)/goals");
  }, [selected]);

  return (
    <OrangeQuestionScreen
      stepKey="experience"
      title="What's your experience with looksmaxxing apps?"
      heroImage={require("@/assets/onbaording-images/gender.png")}
      onContinue={handleNext}
      continueDisabled={!selected}
    >
      {OPTIONS.map((option) => (
        <OrangeOptionRow
          key={option.key}
          variant="descriptive"
          option={option}
          selected={selected === option.key}
          onPress={() => handleSelect(option.key)}
        />
      ))}
    </OrangeQuestionScreen>
  );
}
