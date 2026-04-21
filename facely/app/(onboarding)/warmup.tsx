// app/(onboarding)/warmup.tsx
// Transitional screen between splash and goals — sequential text reveal,
// auto-advances after dwell. Tap anywhere to skip forward.
import React, { useEffect } from "react";
import { View, StyleSheet, Pressable, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

import LimeButton from "@/components/ui/LimeButton";
import { COLORS, SP } from "@/lib/tokens";

const LINES = [
  "Before we start…",
  "I want to get to know you.",
  "Just a few quick things.",
];

const LINE_STAGGER = 850;   // ms between lines
const DWELL_AFTER = 1400;   // ms after last line before advancing

export default function WarmupScreen() {
  const insets = useSafeAreaInsets();
  const goNext = () => router.replace("/(onboarding)/goals");

  useEffect(() => {
    const total = LINES.length * LINE_STAGGER + DWELL_AFTER;
    const t = setTimeout(goNext, total);
    return () => clearTimeout(t);
  }, []);

  // Button fades in after the last line reveals
  const btnOpacity = useSharedValue(0);
  const btnTy = useSharedValue(14);
  useEffect(() => {
    const appearDelay = LINES.length * LINE_STAGGER;
    btnOpacity.value = withDelay(appearDelay, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    btnTy.value = withDelay(appearDelay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [btnOpacity, btnTy]);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTy.value }],
  }));

  return (
    <Pressable style={styles.screen} onPress={goNext}>
      <StatusBar barStyle="light-content" />
      <View style={styles.center}>
        {LINES.map((line, i) => (
          <RevealLine key={i} text={line} delay={i * LINE_STAGGER} isLast={i === LINES.length - 1} />
        ))}
      </View>
      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + SP[4] }, btnStyle]}>
        <LimeButton label="Continue" onPress={goNext} />
      </Animated.View>
    </Pressable>
  );
}

function RevealLine({
  text,
  delay,
  isLast,
}: {
  text: string;
  delay: number;
  isLast: boolean;
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(14);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [delay, opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.Text style={[isLast ? styles.lineLast : styles.line, style]}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[4],
  },
  line: {
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  lineLast: {
    color: COLORS.accent,
    fontFamily: "Poppins-SemiBold",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
});
