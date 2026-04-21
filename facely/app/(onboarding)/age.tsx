// app/(onboarding)/age.tsx
// Birthday screen — user picks DOB via a 3-wheel modal; age is derived.
import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Calendar, ShieldCheck } from "lucide-react-native";

import T from "@/components/ui/T";
import {
  OnboardingScreenV2,
  DateWheelModal,
} from "@/components/onboarding";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const DEFAULT_DOB = new Date(2001, 3, 19); // April 19, 2001

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDob(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function calcAge(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export default function BirthdayScreen() {
  const { data, setField } = useOnboarding();

  const initialDob = useMemo<Date>(() => {
    if (data.dob) {
      const parsed = new Date(data.dob);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return DEFAULT_DOB;
  }, [data.dob]);

  const [dob, setDob] = useState<Date>(initialDob);
  const [hasPicked, setHasPicked] = useState<boolean>(!!data.dob);
  const [pickerVisible, setPickerVisible] = useState(false);

  const age = useMemo(() => calcAge(dob), [dob]);

  const openPicker = useCallback(() => {
    hapticLight();
    setPickerVisible(true);
  }, []);

  const handleDone = useCallback(
    (next: Date) => {
      setDob(next);
      setHasPicked(true);
      setPickerVisible(false);
      setField("dob", next.toISOString().slice(0, 10));
      setField("age", calcAge(next));
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!hasPicked) return;
    router.push("/(onboarding)/ethnicity");
  }, [hasPicked]);

  return (
    <>
      <OnboardingScreenV2
        stepKey="age"
        title="When's your birthday?"
        subtitle="We only use this to calibrate health & aesthetics benchmarks. Your birthday data is kept private and secure."
        heroImage={require("@/assets/onbaording-images/date-of-birth.png")}
        onPrimary={handleNext}
        primaryDisabled={!hasPicked}
      >
        <T variant="captionMedium" color="sub" style={styles.fieldLabel}>
          Birthday
        </T>

        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel="Select birthday"
          style={({ pressed }) => [
            styles.field,
            hasPicked && styles.fieldFilled,
            pressed && styles.fieldPressed,
          ]}
        >
          <View style={styles.fieldTextCol}>
            <T
              variant="h3"
              color={hasPicked ? "accent" : "sub"}
              style={hasPicked ? undefined : styles.placeholder}
            >
              {hasPicked ? formatDob(dob) : "Select your birthday"}
            </T>
            {hasPicked && (
              <T variant="caption" color="accent" style={styles.ageNote}>
                {age} years old
              </T>
            )}
          </View>
          <Calendar size={22} color={COLORS.sub} strokeWidth={2} />
        </Pressable>

        <View style={styles.trustRow}>
          <ShieldCheck size={14} color={COLORS.accent} strokeWidth={2.5} />
          <T variant="small" color="sub" style={styles.trustText}>
            Your data is private and secure
          </T>
        </View>
      </OnboardingScreenV2>

      <DateWheelModal
        visible={pickerVisible}
        initial={dob}
        onDone={handleDone}
        onCancel={() => setPickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    marginBottom: SP[2],
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    minHeight: 76,
    paddingHorizontal: SP[5],
    paddingVertical: SP[3],
    borderRadius: RADII.lg,
    backgroundColor: COLORS.optionBg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fieldFilled: {
    borderColor: COLORS.accentBorder,
  },
  fieldPressed: { opacity: 0.85 },
  fieldTextCol: { flex: 1 },
  placeholder: { opacity: 0.9 },
  ageNote: { marginTop: 2 },

  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[1],
    marginTop: SP[4],
  },
  trustText: { marginLeft: 4 },
});
