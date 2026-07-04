import React, { useCallback } from "react";
import { router } from "expo-router";

import OrangeQuestionScreen, {
  OrangeOption,
  OrangeOptionGrid,
} from "@/components/onboarding/OrangeQuestionScreen";
import { hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const OPTIONS: OrangeOption[] = [
  { key: "5min", label: "5 min", caption: "Quick habit", emoji: "⚡" },
  { key: "10min", label: "10 min", caption: "Balanced", emoji: "🎯" },
  { key: "15min", label: "15 min", caption: "Dedicated", emoji: "💪" },
  { key: "20min", label: "20+ min", caption: "Full protocol", emoji: "🔥" },
];

export default function TimeDedicationScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.timeDedication);
  const selected = saved ?? "5min";

  const handleSelect = useCallback(
    (key: string) => {
      hapticSelection();
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
      heroImage={require("@/assets/bg-assets-for-onbaording-screens/time.png")}
      title="How much time can you commit?"
      subtitle="We'll build a routine that fits your schedule."
      onContinue={handleNext}
    >
      <OrangeOptionGrid
        options={OPTIONS}
        selectedKey={selected}
        onSelect={handleSelect}
      />
    </OrangeQuestionScreen>
  );
}