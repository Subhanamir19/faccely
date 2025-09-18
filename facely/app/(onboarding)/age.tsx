// app/(onboarding)/age.tsx
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useOnboarding } from "@/store/onboarding";

/**
 * Visual spec:
 * - Soft light background
 * - White rounded card with shadow
 * - Top pill progress (step 1/3)
 * - Title + subtitle
 * - Circular age stepper with + / −
 * - Primary green "Next" button, ghost "Skip" button
 */

const ACCENT = "#23A455";       // primary green (tune if you want)
const BG = "#F5F7FA";
const TEXT_DARK = "#0F172A";
const TEXT_SUB = "#667085";
const CARD = "#FFFFFF";
const BORDER = "rgba(15,23,42,0.06)";

export default function AgeScreen() {
  const { data, setField } = useOnboarding();
  const [age, setAge] = useState<number>(Number.isFinite(data.age) ? Number(data.age) : 25);

  useEffect(() => {
    setField("age", age);
  }, [age]);

  const dec = () => setAge((a) => Math.max(10, a - 1));
  const inc = () => setAge((a) => Math.min(100, a + 1));
  const next = () => router.push("/(onboarding)/ethnicity");
  const skip = () => router.push("/(onboarding)/ethnicity");

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* pill progress (step 1 of 3) */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(1 / 3) * 100}%` }]} />
          </View>
        </View>

        <Text style={styles.title}>How old are you?</Text>
        <Text style={styles.sub}>
          We use your age to calibrate{"\n"}health & aesthetics benchmarks.
        </Text>

        {/* circular stepper */}
        <View style={styles.circle}>
        <Pressable hitSlop={16} onPress={inc} style={styles.sideBtn}>
  <Text style={styles.sideSymbol}>＋</Text>
</Pressable>

<View>
  <Text style={styles.ageText}>{age}</Text>
  <View style={styles.underline} />
</View>

<Pressable hitSlop={16} onPress={dec} style={styles.sideBtn}>
  <Text style={styles.sideSymbol}>－</Text>
</Pressable>
        </View>

        {/* buttons */}
        <Pressable onPress={next} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
          <Text style={styles.primaryLabel}>Next</Text>
        </Pressable>

        <Pressable onPress={skip} style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
          <Text style={styles.ghostLabel}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const R = 24;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: BORDER,
    // soft shadow
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  progressWrap: { marginBottom: 18, alignItems: "center" },
  progressTrack: {
    height: 16,
    width: "70%",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(35,164,85,0.35)",
  },

  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
    marginTop: 6,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SUB,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
  },

  circle: {
    alignSelf: "center",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingHorizontal: 20,
    // inner ring glow
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 24,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sideSymbol: {
    fontSize: 24,
    color: "#9AA4B2",
    fontWeight: "600",
  },

  ageText: {
    fontSize: 56,
    fontWeight: "800",
    color: TEXT_DARK,
    textAlign: "center",
  },
  underline: {
    height: 6,
    borderRadius: 6,
    backgroundColor: ACCENT,
    marginTop: 6,
  },

  primaryBtn: {
    marginTop: 6,
    backgroundColor: ACCENT,
    borderRadius: R,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  ghostBtn: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: R,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ghostLabel: { color: TEXT_DARK, fontSize: 16, fontWeight: "700" },

  pressed: { transform: [{ translateY: 1 }] },
});
