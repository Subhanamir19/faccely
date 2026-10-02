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
    key: "5min",
    label: "5 min",
    caption: "Quick habit",
    image: require("@/assets/onboarding-option-illustrations/time-dedication/quick_habit.png"),
  },
  {
    key: "10min",
    label: "10 min",
    caption: "Balanced",
    image: require("@/assets/onboarding-option-illustrations/time-dedication/balanced_target.png"),
  },
  {
    key: "15min",
    label: "15 min",
    caption: "Dedicated",
    image: require("@/assets/onboarding-option-illustrations/time-dedication/dedicated_arm.png"),
  },
  {
    key: "20min",
    label: "20+ min",
    caption: "Full protocol",
    image: require("@/assets/onboarding-option-illustrations/time-dedication/full_protocol_flame.png"),
  },
];

export default function TimeDedicationScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.timeDedication);
  const selected = saved ?? "5min";

  const handleSelect = useCallback(
    (key: string) => {
      hapticRigid();
      setField("timeDedication", key);
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    setField("timeDedication", selected);
    router.push("/(onboarding)/score-projection");
  }, [selected, setField]);

  return (
    <OrangeQuestionScreen
      stepKey="time-dedication"
      heroImage={require("@/assets/bg-assets-for-onbaording-screens/time.jpg")}
      title="How much time can you commit?"
      onContinue={handleNext}
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