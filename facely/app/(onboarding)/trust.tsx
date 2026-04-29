// app/(onboarding)/trust.tsx
// Trust / accuracy reveal — counts a hero accuracy figure up to 98.5% to land
// the brand promise after the scan, then lets the user continue. Light system,
// sage hero number, black-pill CTA. Photos are stored locally and analysed
// post-purchase; nothing is sent here.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  StatusBar,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, getProgressForStep } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — progress bar
const SAGE = "#3F7A2A";        // dark readable — hero number on white

const RAW_TARGET_ACCURACY = 98.5;
const ANIMATION_DURATION = 1400;

const clampToRange = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};

const formatAccuracy = (value: number) => {
  "worklet";
  return `${value.toFixed(1)}%`;
};

const sanitizeAccuracy = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clampToRange(numeric, 0, 100);
};

export default function TrustAccuracyScreen() {
  const insets = useSafeAreaInsets();
  const prefersReducedMotion = useReducedMotion();
  const progress = getProgressForStep("trust");

  const [animDone, setAnimDone] = useState(false);
  const navigated = useRef(false);

  const targetAccuracy = useMemo(
    () => sanitizeAccuracy(RAW_TARGET_ACCURACY),
    []
  );
  const finalAccuracyText = useMemo(
    () => formatAccuracy(targetAccuracy),
    [targetAccuracy]
  );

  const animatedAccuracy = useSharedValue(0);
  const [metricText, setMetricText] = useState(formatAccuracy(0));

  const announceAccuracy = useCallback(() => {
    hapticSuccess();
    AccessibilityInfo.announceForAccessibility(
      `Accuracy ${targetAccuracy.toFixed(1)} percent.`
    );
  }, [targetAccuracy]);

  const handleAnimationComplete = useCallback(() => {
    announceAccuracy();
    setAnimDone(true);
  }, [announceAccuracy]);

  useEffect(() => {
    if (prefersReducedMotion) {
      animatedAccuracy.value = targetAccuracy;
      setMetricText(finalAccuracyText);
      handleAnimationComplete();
      return;
    }

    animatedAccuracy.value = 0;
    setMetricText(formatAccuracy(0));
    animatedAccuracy.value = withTiming(
      targetAccuracy,
      { duration: ANIMATION_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => { if (finished) runOnJS(handleAnimationComplete)(); }
    );

    return () => {
      animatedAccuracy.value = targetAccuracy;
      setMetricText(finalAccuracyText);
    };
  }, [
    animatedAccuracy,
    finalAccuracyText,
    handleAnimationComplete,
    prefersReducedMotion,
    targetAccuracy,
  ]);

  useAnimatedReaction(
    () => animatedAccuracy.value,
    (value, previous) => {
      const clamped = clampToRange(value, 0, 100);
      const rounded = Math.round(clamped * 10) / 10;
      const nextText = formatAccuracy(rounded);
      if (previous == null) {
        runOnJS(setMetricText)(nextText);
        return;
      }
      const prevClamped = clampToRange(previous, 0, 100);
      const prevRounded = Math.round(prevClamped * 10) / 10;
      if (rounded !== prevRounded) runOnJS(setMetricText)(nextText);
    },
    [setMetricText]
  );

  const handleContinue = useCallback(() => {
    if (navigated.current) return;
    hapticSuccess();
    navigated.current = true;
    router.push("/(onboarding)/time-dedication");
  }, []);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  // Progress bar fill width animates in
  const progressW = useSharedValue(0);
  useEffect(() => {
    progressW.value = withTiming(progress * 100, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressW]);
  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progressW.value}%`,
  }));

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <View
        style={[
          styles.content,
          {
            paddingTop:    insets.top    + SP[3],
            paddingBottom: insets.bottom + SP[3],
          },
        ]}
      >
        {/* Top — back chevron above progress bar */}
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
        >
          <ChevronLeft size={ms(22)} color={COLORS.lightText} strokeWidth={2.5} />
        </Pressable>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressFillStyle]} />
        </View>

        {/* Body — copy stack pinned to vertical center */}
        <View style={styles.body}>
          <T
            style={styles.title}
            accessibilityRole="header"
            accessibilityLabel="How precise is SigmaMax?"
          >
            {"How precise is\nSigmaMax?"}
          </T>

          <T style={styles.subtitle}>
            Every symmetry, contour, and ratio analysed with near-perfect precision.
          </T>

          <View style={styles.metricBlock}>
            <T
              style={styles.metric}
              accessibilityLabel={`Accuracy ${metricText.replace("%", " percent")}`}
            >
              {metricText}
            </T>
            <T style={styles.metricLabel}>ACCURACY</T>
          </View>
        </View>

        {/* Footer */}
        <Pressable
          onPress={handleContinue}
          disabled={!animDone}
          style={({ pressed }) => [
            styles.cta,
            !animDone && styles.ctaDisabled,
            animDone && pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={[styles.ctaText, !animDone && { color: COLORS.lightSub }]}>
            {animDone ? "CONTINUE" : "…"}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  content: {
    flex: 1,
    paddingHorizontal: SP[5],
  },

  backBtn: {
    width: ms(36),
    height: ms(36),
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  progressTrack: {
    height: sh(6),
    width: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
    marginBottom: SP[5],
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  body: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: FONT_BOLD,
    color: COLORS.lightText,
    fontSize: ms(32),
    lineHeight: ms(38),
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    color: COLORS.lightSub,
    fontSize: ms(15),
    lineHeight: ms(22),
    marginTop: SP[3],
  },
  metricBlock: {
    marginTop: sh(48),
  },
  metric: {
    color: SAGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(86),
    lineHeight: ms(92),
    letterSpacing: -2,
    includeFontPadding: false,
  },
  metricLabel: {
    fontFamily: FONT_BOLD,
    color: SAGE,
    fontSize: ms(13),
    letterSpacing: 1.4,
    marginTop: sh(4),
  },

  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
