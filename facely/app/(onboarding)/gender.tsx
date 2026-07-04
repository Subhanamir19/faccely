import React, { useCallback } from "react";
import { router } from "expo-router";

import OrangeQuestionScreen, {
  OrangeOption,
  OrangeOptionRow,
} from "@/components/onboarding/OrangeQuestionScreen";
import { hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: OrangeOption[] = [
  { key: "Male", label: "Male", emoji: "👨" },
  { key: "Female", label: "Female", emoji: "👩" },
  { key: "Other", label: "Other", emoji: "✨" },
  { key: "Prefer not to say", label: "Prefer not to say", emoji: "🤐" },
];

export default function GenderScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.gender ?? "Male";

  const handleSelect = useCallback(
    (key: string) => {
      hapticSelection();
      setField("gender", key);
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    setField("gender", selected);
    router.push("/(onboarding)/age");
  }, [selected, setField]);

  return (
    <OrangeQuestionScreen
      stepKey="gender"
      heroImage={require("@/assets/bg-assets-for-onbaording-screens/gender.png")}
      title="What's your gender?"
      subtitle="This helps us provide more accurate analysis results."
      onContinue={handleNext}
    >
      {OPTIONS.map((option) => (
        <OrangeOptionRow
          key={option.key}
          option={option}
          selected={selected === option.key}
          onPress={() => handleSelect(option.key)}
        />
      ))}
    </OrangeQuestionScreen>
  );
}