import React, { useCallback } from "react";
import { router } from "expo-router";

import OrangeQuestionScreen, {
  OrangeOption,
  OrangeOptionRow,
} from "@/components/onboarding/OrangeQuestionScreen";
import { hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: OrangeOption[] = [
  { key: "Asian", label: "Asian", emoji: "🌏" },
  { key: "African", label: "African", emoji: "🌍" },
  { key: "Caucasian", label: "Caucasian", emoji: "🏔️" },
  { key: "Hispanic / Latino", label: "Hispanic / Latino", emoji: "🌎" },
  { key: "Middle Eastern", label: "Middle Eastern", emoji: "🌙" },
  { key: "Mixed / Other", label: "Mixed / Other", emoji: "✨" },
  { key: "Prefer not to say", label: "Prefer not to say", emoji: "🤐" },
];

export default function EthnicityScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.ethnicity ?? "Asian";

  const handleSelect = useCallback(
    (key: string) => {
      hapticSelection();
      setField("ethnicity", key);
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    setField("ethnicity", selected);
    router.push("/(onboarding)/scan");
  }, [selected, setField]);

  return (
    <OrangeQuestionScreen
      stepKey="ethnicity"
      heroImage={require("@/assets/bg-assets-for-onbaording-screens/ethnicity.png")}
      title="What's your ethnicity?"
      subtitle="Optional. We use this to calibrate benchmarks; it doesn't affect your score."
      onContinue={handleNext}
      contentTall
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