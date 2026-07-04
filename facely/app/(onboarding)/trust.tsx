// app/(onboarding)/trust.tsx
// Trust / accuracy reveal after scan capture. Keep the proof compact and calm:
// one metric panel, a short explanation, and a single primary CTA.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
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
import { SP } from "@/lib/tokens";
import { ms, sh } from "@/lib/responsive";
import { hapticSuccess } from "@/lib/haptics";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";

const FONT = ORANGE_ONBOARDING.font;
const FONT_BOLD = ORANGE_ONBOARDING.fontBold;
const SAGE = "#34752A";
const SAGE_SOFT = "#EEF8EA";
const SAGE_BORDER = "#CFE7C8";
const RAW_TARGET_ACCURACY = 98.5;
const ANIMATION_DURATION = 1400;

const PROOF_ITEMS = ["Symmetry", "Contours", "Ratios"];

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
  const prefersReducedMotion = useReducedMotion();
  const [animDone, setAnimDone] = useState(false);
  const navigated = useRef(false);

  const targetAccuracy = useMemo(() => sanitizeAccuracy(RAW_TARGET_ACCURACY), []);
  const finalAccuracyText = useMemo(() => formatAccuracy(targetAccuracy), [targetAccuracy]);

  const animatedAccuracy = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const [metricText, setMetricText] = useState(formatAccuracy(0));

  const announceAccuracy = useCallback(() => {
    hapticSuccess();
    AccessibilityInfo.announceForAccessibility(
      `Accuracy ${targetAccuracy.toFixed(1)} percent.`,
    );
  }, [targetAccuracy]);

  const handleAnimationComplete = useCallback(() => {
    announceAccuracy();
    setAnimDone(true);
  }, [announceAccuracy]);

  useEffect(() => {
    setAnimDone(false);

    if (prefersReducedMotion) {
      animatedAccuracy.value = targetAccuracy;
      progressWidth.value = targetAccuracy;
      setMetricText(finalAccuracyText);
      handleAnimationComplete();
      return undefined;
    }

    animatedAccuracy.value = 0;
    progressWidth.value = 0;
    setMetricText(formatAccuracy(0));

    animatedAccuracy.value = withTiming(
      targetAccuracy,
      { duration: ANIMATION_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(handleAnimationComplete)();
      },
    );
    progressWidth.value = withTiming(targetAccuracy, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    return () => {
      animatedAccuracy.value = targetAccuracy;
      progressWidth.value = targetAccuracy;
      setMetricText(finalAccuracyText);
    };
  }, [
    animatedAccuracy,
    finalAccuracyText,
    handleAnimationComplete,
    prefersReducedMotion,
    progressWidth,
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
    [setMetricText],
  );

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handleContinue = useCallback(() => {
    if (navigated.current || !animDone) return;
    hapticSuccess();
    navigated.current = true;
    router.push("/(onboarding)/time-dedication");
  }, [animDone]);

  return (
    <OrangeOnboardingLayout
      showHeader={false}
      scrollable={false}
      sheetContentStyle={styles.content}
      footer={
        <OrangePrimaryButton
          label={animDone ? "Continue" : "..."}
          onPress={handleContinue}
          disabled={!animDone}
          uppercase={false}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.copyBlock}>
          <T style={styles.eyebrow}>SCAN PRECISION</T>
          <T style={styles.title} accessibilityRole="header">
            How precise is SigmaMax?
          </T>
          <T style={styles.subtitle}>
            Every symmetry, contour, and ratio is checked against calibrated facial benchmarks.
          </T>
        </View>

        <View style={styles.metricPanel}>
          <View style={styles.metricTopRow}>
            <T style={styles.metricKicker}>Accuracy model</T>
            <View style={styles.livePill}>
              <T style={styles.livePillText}>Calibrated</T>
            </View>
          </View>

          <T
            style={styles.metric}
            accessibilityLabel={`Accuracy ${metricText.replace("%", " percent")}`}
          >
            {metricText}
          </T>
          <T style={styles.metricLabel}>analysis accuracy</T>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressFillStyle]} />
          </View>
        </View>

        <View style={styles.proofRow}>
          {PROOF_ITEMS.map((item) => (
            <View key={item} style={styles.proofChip}>
              <T style={styles.proofText}>{item}</T>
            </View>
          ))}
        </View>
      </View>
    </OrangeOnboardingLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: SP[4],
    paddingHorizontal: SP[1],
    paddingBottom: SP[2],
  },
  copyBlock: {
    alignItems: "center",
    gap: sh(8),
  },
  eyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12, 0.14),
    lineHeight: ms(16, 0.14),
    color: SAGE,
    letterSpacing: 1.1,
  },
  title: {
    fontFamily: FONT_BOLD,
    color: ORANGE_ONBOARDING.text,
    fontSize: ms(31, 0.12),
    lineHeight: ms(37, 0.12),
    letterSpacing: 0,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: ms(320),
    fontFamily: FONT,
    color: ORANGE_ONBOARDING.muted,
    fontSize: ms(15, 0.18),
    lineHeight: ms(22, 0.18),
    letterSpacing: 0,
    textAlign: "center",
  },
  metricPanel: {
    width: "100%",
    borderRadius: ms(22),
    borderWidth: 1,
    borderColor: SAGE_BORDER,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    shadowColor: "#2A1A10",
    shadowOpacity: 0.07,
    shadowRadius: ms(18),
    shadowOffset: { width: 0, height: ms(8) },
    elevation: 4,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  metricKicker: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13, 0.16),
    lineHeight: ms(18, 0.16),
    color: ORANGE_ONBOARDING.text,
  },
  livePill: {
    borderRadius: 999,
    backgroundColor: SAGE_SOFT,
    paddingHorizontal: SP[3],
    paddingVertical: sh(5),
  },
  livePillText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12, 0.14),
    lineHeight: ms(15, 0.14),
    color: SAGE,
  },
  metric: {
    marginTop: sh(22),
    color: SAGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(74, 0.08),
    lineHeight: ms(80, 0.08),
    letterSpacing: 0,
    textAlign: "center",
    includeFontPadding: false,
  },
  metricLabel: {
    fontFamily: FONT_BOLD,
    color: SAGE,
    fontSize: ms(13, 0.14),
    lineHeight: ms(17, 0.14),
    letterSpacing: 0.8,
    marginTop: sh(4),
    textAlign: "center",
    textTransform: "uppercase",
  },
  progressTrack: {
    height: sh(8),
    borderRadius: 999,
    backgroundColor: "#EEF0EC",
    overflow: "hidden",
    marginTop: sh(22),
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: SAGE,
  },
  proofRow: {
    flexDirection: "row",
    gap: SP[2],
  },
  proofChip: {
    flex: 1,
    minHeight: sh(42),
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[2],
  },
  proofText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13, 0.16),
    lineHeight: ms(17, 0.16),
    color: ORANGE_ONBOARDING.muted,
    letterSpacing: 0,
    textAlign: "center",
  },
});