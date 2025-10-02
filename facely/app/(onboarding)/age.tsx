// app/(onboarding)/age.tsx
import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ImageBackground,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import T from "@/components/ui/T";
import { useOnboarding } from "@/store/onboarding";

const ACCENT = "#8FA31E";
const CARD_BG = "rgba(12, 14, 18, 0.72)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.65)";
const R = 28;

export default function AgeScreen() {
  const { data, setField } = useOnboarding();
  const [age, setAge] = useState<number>(
    Number.isFinite(data.age) ? Number(data.age) : 25
  );

  useEffect(() => {
    setField("age", age);
  }, [age]);

  const dec = () => setAge(a => Math.max(10, a - 1));
  const inc = () => setAge(a => Math.min(100, a + 1));
  const next = () => router.push("/(onboarding)/ethnicity");
  const skip = () => router.push("/(onboarding)/ethnicity");

  return (
    <ImageBackground
      source={require("../../assets/bg/score-bg.jpg")}
      resizeMode="cover"
      style={styles.bg}
      imageStyle={styles.bgImg}
    >
      <View style={styles.bgOverlay} />

      <View style={styles.cardWrap}>
        <BlurView intensity={60} tint="dark" style={styles.card}>
          {/* Top slim progress */}
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <T style={styles.title}>How old are you?</T>
          <T style={styles.sub}>
            We use your age to calibrate{"\n"}health & aesthetics benchmarks.
          </T>

          {/* Circular age stepper */}
          <View style={styles.circle}>
            {/* translucent inner overlay to avoid GPU faceting */}
            <View style={styles.circleInner} />

            <Pressable hitSlop={16} onPress={inc} style={styles.sideBtn}>
              <T style={styles.sideSymbol}>＋</T>
            </Pressable>

            <View style={{ alignItems: "center" }}>
              <T style={styles.ageText}>{age}</T>
              <View style={styles.underline} />
            </View>

            <Pressable hitSlop={16} onPress={dec} style={styles.sideBtn}>
              <T style={styles.sideSymbol}>－</T>
            </Pressable>
          </View>

          {/* Buttons */}
          <Pressable
            onPress={next}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <T style={styles.primaryLabel}>Next</T>
          </Pressable>

          <Pressable
            onPress={skip}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <T style={styles.ghostLabel}>Skip</T>
          </Pressable>
        </BlurView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "#0A0C10",
    justifyContent: "center",
  },
  bgImg: {},
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,6,10,0.45)",
  },

  cardWrap: {
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  card: {
    alignSelf: "center",
    width: "92%",
    borderRadius: 32,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...(Platform.OS === "android"
      ? { elevation: 8 }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 18 },
        }),
  },

  // Progress
  progressTrack: {
    height: 14,
    width: "70%",
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    width: `${(1 / 3) * 100}%`,
    backgroundColor: ACCENT,
  },

  // Copy
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    color: TEXT,
    marginTop: 6,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: TEXT_DIM,
    marginTop: 8,
    marginBottom: 22,
  },

  // Circle stepper
  circle: {
    alignSelf: "center",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#0E1114", // OPAQUE base to stop hexagon artifact
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 26,
    overflow: "hidden", // ensure inner overlay clips perfectly circular
    // Important: NO elevation/shadow on the circle itself (causes polygonal artifacts on Android)
  },
  circleInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.04)", // gives the soft glass look
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sideSymbol: {
    fontSize: 24,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
  },
  ageText: {
    fontSize: 64,
    fontWeight: "900",
    color: TEXT,
    textAlign: "center",
  },
  underline: {
    height: 6,
    borderRadius: 6,
    backgroundColor: ACCENT,
    marginTop: 8,
    width: 72,
  },

  // Buttons
  primaryBtn: {
    marginTop: 6,
    backgroundColor: ACCENT,
    borderRadius: R,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "android"
      ? { elevation: 6 }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        }),
  },
  primaryLabel: {
    color: "#0C0F13",
    fontSize: 16,
    fontWeight: "800",
  },

  ghostBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: R,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  ghostLabel: { color: TEXT, fontSize: 16, fontWeight: "700" },

  pressed: { transform: [{ translateY: 1 }] },
});
