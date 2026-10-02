import React, { useCallback } from "react";
import { router } from "expo-router";

import OrangeQuestionScreen, {
  OrangeOption,
  OrangeOptionRow,
} from "@/components/onboarding/OrangeQuestionScreen";
import { hapticRigid } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: OrangeOption[] = [
  {
    key: "Male",
    label: "Male",
    image: require("@/assets/onboarding-option-illustrations/gender/male_face.png"),
  },
  {
    key: "Female",
    label: "Female",
    image: require("@/assets/onboarding-option-illustrations/gender/female_face.png"),
  },
  {
    key: "Other",
    label: "Other",
    image: require("@/assets/onboarding-option-illustrations/gender/other_sparkles.png"),
  },
  {
    key: "Prefer not to say",
    label: "Prefer not to say",
    image: require("@/assets/onboarding-option-illustrations/gender/prefer_not_to_say.png"),
  },
];

export default function GenderScreen() {
  const { data, setField } = useOnboarding();
  const selected = data.gender ?? "Male";

  const handleSelect = useCallback(
    (key: string) => {
      hapticRigid();
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
      heroImage={require("@/assets/bg-assets-for-onbaording-screens/gender.jpg")}
      title="What's your gender?"
      onContinue={handleNext}
    >
      {OPTIONS.map((option) => (
        <OrangeOptionRow
          key={option.key}
          variant="compact"
          option={option}
          selected={selected === option.key}
          onPress={() => handleSelect(option.key)}
        />
      ))}
    </OrangeQuestionScreen>
  );
}