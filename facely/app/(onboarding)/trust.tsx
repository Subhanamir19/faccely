// app/(onboarding)/trust.tsx
// Accuracy/trust screen with animated percentage counter
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import Button from "@/components/ui/Button";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

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
      {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(handleAnimationComplete)();
        }
      }
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

      if (rounded !== prevRounded) {
        runOnJS(setMetricText)(nextText);
      }
    },
    [setMetricText]
  );

  const handleContinue = useCallback(() => {
    // Go to auth screen - after auth, user will be redirected to paywall via index.tsx
    router.push("/(auth)/login");
  }, []);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + SP[6],
            paddingBottom: insets.bottom + SP[6],
          },
        ]}
      >
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Back button */}
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backButton}
        >
          <ChevronLeft size={18} color={COLORS.sub} strokeWidth={2.5} />
          <T variant="captionMedium" color="sub">
            Back
          </T>
        </Pressable>

        <View style={styles.mainContent}>
          <T
            variant="h2"
            color="text"
            accessibilityRole="header"
            accessibilityLabel="How precise is Sigma Max?"
          >
            {"How precise is\nSigma Max?"}
          </T>

          <T variant="body" color="sub" style={styles.subtitle}>
            Every symmetry, contour, and ratio analyzed with near-perfect
            precision.
          </T>

          <View style={styles.metricBlock}>
            <T
              style={styles.metric}
              accessibilityLabel={`Accuracy ${metricText.replace("%", " percent")}`}
            >
              {metricText}
            </T>
            <T variant="bodySemiBold" color="accent">
              Accuracy
            </T>
          </View>
        </View>

        {/* CTA */}
        <Button label="Continue" onPress={handleContinue} variant="primary" size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  content: {
    flex: 1,
    paddingHorizontal: SP[6],
  },
  progressTrack: {
    height: 8,
    width: "100%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: SP[4],
    paddingVertical: SP[1],
    paddingRight: SP[2],
    gap: 2,
  },
  mainContent: {
    flex: 1,
  },
  subtitle: {
    marginTop: SP[3],
  },
  metricBlock: {
    marginTop: SP[12],
  },
  metric: {
    color: COLORS.accent,
    fontSize: 96,
    lineHeight: 100,
    letterSpacing: -0.5,
    fontFamily: "Poppins-SemiBold",
  },
});
