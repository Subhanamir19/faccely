// app/(onboarding)/warmup.tsx
// Transitional pause between the splash and the quiz. Three lines reveal in
// sequence; the last line emphasises the warm intent in sage. Auto-advances
// after a short dwell, or on tap.
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

import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const SAGE = "#3F7A2A";

const LINES = [
  "Before we start…",
  "I want to get to know you.",
  "Just a few quick things.",
];

const LINE_STAGGER = 850;
const DWELL_AFTER  = 1400;

export default function WarmupScreen() {
  const insets = useSafeAreaInsets();
  const goNext = () => router.replace("/(onboarding)/goals");

  useEffect(() => {
    const total = LINES.length * LINE_STAGGER + DWELL_AFTER;
    const t = setTimeout(goNext, total);
    return () => clearTimeout(t);
  }, []);

  // Button fades in once the third line lands.
  const btnOpacity = useSharedValue(0);
  const btnTy      = useSharedValue(14);
  useEffect(() => {
    const appearDelay = LINES.length * LINE_STAGGER;
    btnOpacity.value = withDelay(appearDelay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    btnTy.value      = withDelay(appearDelay, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [btnOpacity, btnTy]);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTy.value }],
  }));

  return (
    <Pressable style={styles.screen} onPress={goNext}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.center}>
        {LINES.map((line, i) => (
          <RevealLine
            key={i}
            text={line}
            delay={i * LINE_STAGGER}
            isLast={i === LINES.length - 1}
          />
        ))}
      </View>
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + SP[4] },
          btnStyle,
        ]}
      >
        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>CONTINUE</T>
        </Pressable>
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
  const ty      = useSharedValue(14);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    ty.value      = withDelay(delay, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));
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
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[4],
  },
  line: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: -0.4,
    textAlign: "center",
  },
  lineLast: {
    color: SAGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: -0.4,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
