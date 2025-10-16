// app/(onboarding)/age.tsx
import { useCallback, useEffect, useRef, useState } from "react";

import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  AccessibilityInfo,
  findNodeHandle,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import T from "@/components/ui/T";
import { useOnboarding } from "@/store/onboarding";

const ACCENT = "#B4F34D";
const BG_TOP = "#000000";
const BG_BOTTOM = "#0B0B0B";
const CARD_BG = "rgba(18,18,18,0.90)"; // #121212 @ 90%
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const TEXT_DIM = "rgba(160,160,160,0.80)";

export default function AgeScreen() {
  const params = useLocalSearchParams<{ autofocus?: string }>();

  const { data, setField } = useOnboarding();
  const [age, setAge] = useState<number>(
    Number.isFinite(data.age) ? Number(data.age) : 25
  );
  const firstControlRef = useRef<any>(null);

  useEffect(() => {
    setField("age", age);
  }, [age]);

  useFocusEffect(
    useCallback(() => {
      if (params.autofocus !== "1") {
        return;
      }

      const timeout = setTimeout(() => {
        const handle = firstControlRef.current
          ? findNodeHandle(firstControlRef.current)
          : null;
        if (handle != null) {
          try {
            AccessibilityInfo.setAccessibilityFocus(handle);
          } catch {
            // no-op for platforms without focus APIs
          }
        }
      }, 250);

      return () => clearTimeout(timeout);
    }, [params.autofocus])
  );

  const dec = () => setAge(a => Math.max(10, a - 1));
  const inc = () => setAge(a => Math.min(100, a + 1));
  const next = () => router.push("/(onboarding)/ethnicity");
  const skip = () => router.push("/(onboarding)/ethnicity");

  return (
    <LinearGradient
      colors={[BG_TOP, BG_BOTTOM]}
      style={styles.bg}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.cardWrap}>
        {/* Blur on the card container; no reflections to avoid Android banding */}
        <BlurView intensity={Platform.OS === "android" ? 20 : 30} tint="dark" style={styles.cardOuter}>
          <View style={styles.card}>
            {/* Progress */}
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>

            {/* Copy */}
            <T style={styles.title}>How old are you?</T>
            <T style={styles.sub}>
              We use your age to calibrate{"\n"}health & aesthetics benchmarks.
            </T>

            {/* Circular age stepper */}
            <View style={styles.circleWrap}>
              <LinearGradient
                pointerEvents="none"
                colors={["#00000000", `${ACCENT}0D`]} // ~5% at rim
                style={styles.circleGlow}
              />
              <View style={styles.circleCore}>
              <Pressable
                  ref={firstControlRef}
                  hitSlop={16}
                  onPress={inc}
                  style={[styles.sideBtn, styles.leftBtn]}
                >
                  <T style={styles.sideSymbol}>＋</T>
                </Pressable>

                <View style={{ alignItems: "center" }}>
                  <T style={styles.ageText}>{age}</T>
                  <View style={styles.underline} />
                </View>

                <Pressable hitSlop={16} onPress={dec} style={[styles.sideBtn, styles.rightBtn]}>
                  <T style={styles.sideSymbol}>－</T>
                </Pressable>
              </View>
            </View>

            {/* Buttons */}
            <Pressable
              onPress={next}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={["#D7FF83", ACCENT]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.primaryBtnFill}
              >
                <T style={styles.primaryLabel}>Next</T>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={skip}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
            >
              <T style={styles.ghostLabel}>Skip</T>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </LinearGradient>
  );
}

const R_CARD = 32;

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: "center",
  },

  cardWrap: {
    paddingHorizontal: 18,
    justifyContent: "center",
  },

  cardOuter: {
    alignSelf: "center",
    width: "92%",
    borderRadius: R_CARD,
    overflow: "hidden",
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: R_CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 22,
    position: "relative",
    ...(Platform.OS === "android"
      ? { elevation: 8 }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 18 },
        }),
  },

  // Progress (step 1 of 3)
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    width: `${(1 / 3) * 100}%`,
    backgroundColor: ACCENT,
  },

  title: {
    fontSize: 22,
    lineHeight: 28,
    color: TEXT,
    textAlign: "center",
    marginTop: 2,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_DIM,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  circleGlow: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    opacity: 0.6,
  },
  circleCore: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#0E1114",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },

  sideBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: `${ACCENT}4D`,
    position: "absolute",
    top: "50%",
    marginTop: -17, // center vertically
    ...(Platform.OS === "android"
      ? {}
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        }),
  },
  leftBtn: { left: 16 },
  rightBtn: { right: 16 },

  sideSymbol: {
    fontSize: 18,
    color: TEXT,
    fontFamily: "Poppins-SemiBold",
  },

  ageText: {
    fontSize: 40,
    letterSpacing: 0.5,
    color: TEXT,
    textAlign: "center",
  },
  underline: {
    height: 2,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 8,
    width: 52,
  },

  primaryBtn: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 12,
    ...(Platform.OS === "android"
      ? { elevation: 6 }
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.25,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 2 },
        }),
  },
  primaryBtnFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: "#000000",
    fontSize: 18,
  },

  ghostBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#2D2D2D",
  },
  ghostLabel: {
    color: TEXT,
    fontSize: 18,
  },

  pressed: { transform: [{ translateY: 1 }] },
});
