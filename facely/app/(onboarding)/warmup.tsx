// app/(onboarding)/warmup.tsx
// Transitional pause between the splash and the quiz. Three lines type in
// sequence with subtle haptic ticks, then auto-advance after a short dwell.
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Pressable, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";
import { hapticSelection } from "@/lib/haptics";
import { COLORS, SP } from "@/lib/tokens";
import { ms } from "@/lib/responsive";

const FONT_BOLD = "DINNextRounded-Bold";
const ORANGE = "#F26A13";

const LINES = [
  "Before we start...",
  "I want to get to know you.",
  "Just a few quick things.",
];

const LINE_STAGGER = 850;
const TYPE_START_DELAY = 120;
const TYPE_CHAR_MS = 34;
const HAPTIC_EVERY_CHARS = 3;
const DWELL_AFTER = 1400;

function lineTypeDuration(text: string) {
  return TYPE_START_DELAY + text.length * TYPE_CHAR_MS;
}

function useTypedText(text: string, delay: number) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
    if (!text) return undefined;

    let nextLength = 0;
    let charTimer: ReturnType<typeof setTimeout> | null = null;

    const writeNext = () => {
      nextLength += 1;
      setTyped(text.slice(0, nextLength));

      const char = text[nextLength - 1];
      if (char?.trim() && nextLength % HAPTIC_EVERY_CHARS === 0) {
        hapticSelection();
      }

      if (nextLength < text.length) {
        charTimer = setTimeout(writeNext, TYPE_CHAR_MS);
      }
    };

    const startTimer = setTimeout(writeNext, delay + TYPE_START_DELAY);

    return () => {
      clearTimeout(startTimer);
      if (charTimer !== null) clearTimeout(charTimer);
    };
  }, [delay, text]);

  return typed;
}

export default function WarmupScreen() {
  const insets = useSafeAreaInsets();
  const goNext = useCallback(() => router.replace("/(onboarding)/goals"), []);
  const finalLineDelay = (LINES.length - 1) * LINE_STAGGER;
  const finalTextDuration = lineTypeDuration(LINES[LINES.length - 1]);
  const revealCompleteDelay = finalLineDelay + finalTextDuration;

  useEffect(() => {
    const total = revealCompleteDelay + DWELL_AFTER;
    const t = setTimeout(goNext, total);
    return () => clearTimeout(t);
  }, [goNext, revealCompleteDelay]);

  const btnOpacity = useSharedValue(0);
  const btnTy = useSharedValue(14);
  useEffect(() => {
    btnOpacity.value = withDelay(
      revealCompleteDelay,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    btnTy.value = withDelay(
      revealCompleteDelay,
      withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
  }, [btnOpacity, btnTy, revealCompleteDelay]);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTy.value }],
  }));

  return (
    <Pressable style={styles.screen} onPress={goNext}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.center}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {LINES.map((line, i) => (
          <RevealLine
            key={line}
            text={line}
            delay={i * LINE_STAGGER}
            isLast={i === LINES.length - 1}
          />
        ))}
      </ScrollView>
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + SP[4] },
          btnStyle,
        ]}
      >
        <OrangePrimaryButton label="Continue" onPress={goNext} tone="ink" uppercase={false} />
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
  const typed = useTypedText(text, delay);
  const opacity = useSharedValue(0);
  const ty = useSharedValue(12);
  const lineStyle = isLast ? styles.lineLast : styles.line;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [delay, opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[styles.lineFrame, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text style={[lineStyle, styles.lineMeasure]} numberOfLines={2} accessible={false}>
        {text}
      </Text>
      <Animated.Text style={[lineStyle, styles.lineTyped]} numberOfLines={2} accessible={false}>
        {typed}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F2" },
  scroll: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[4],
  },
  lineFrame: {
    width: "100%",
    position: "relative",
  },
  line: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: 0,
    textAlign: "center",
  },
  lineLast: {
    color: ORANGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: 0,
    textAlign: "center",
  },
  lineMeasure: {
    opacity: 0,
  },
  lineTyped: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
});