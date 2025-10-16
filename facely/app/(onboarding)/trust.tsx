// app/(onboarding)/trust.tsx
import React, { useCallback, useEffect, useMemo } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedT = Animated.createAnimatedComponent(T);

type TrackFn = (event: string, params?: Record<string, unknown>) => void;

const track: TrackFn = () => {};

const RAW_TARGET_ACCURACY = 98.5;
const ANIMATION_DURATION = 1400;

const clampToRange = (value: number, min: number, max: number) =>

  Math.min(max, Math.max(min, value));

const formatAccuracy = (value: number) => {
  'worklet';
  return `${value.toFixed(1)}%`;
};

const sanitizeAccuracy = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    if (__DEV__) {
      console.warn(
        "[TrustAccuracy] Invalid accuracy value provided; defaulting to 0.",
        value,
      );
    }
    return 0;
  }

  const clamped = clampToRange(numeric, 0, 100);

  if (__DEV__ && clamped !== numeric) {
    console.warn(
      `[TrustAccuracy] Accuracy value ${numeric} out of bounds; clamped to ${clamped}.`,
    );
  }
  return clamped;
};

export default function TrustAccuracyScreen() {
  const insets = useSafeAreaInsets();
  const prefersReducedMotion = useReducedMotion();

  const targetAccuracy = useMemo(
    () => sanitizeAccuracy(RAW_TARGET_ACCURACY),
    [],
  );

  const finalAccuracyText = useMemo(
    () => formatAccuracy(targetAccuracy),
    [targetAccuracy],
  );

  const animatedAccuracy = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  const announceAccuracy = useCallback(() => {
    AccessibilityInfo.announceForAccessibility(
      `Accuracy ${targetAccuracy.toFixed(1)} percent.`,
    );
  }, [targetAccuracy]);

  const handleAnimationComplete = useCallback(() => {
    track("trust_screen_anim_complete", {
      targetAccuracy,
      durationMs: ANIMATION_DURATION,
    });
    announceAccuracy();
  }, [announceAccuracy, targetAccuracy]);

  useEffect(() => {
    track("trust_screen_shown", { targetAccuracy });

    if (prefersReducedMotion) {
      animatedAccuracy.value = targetAccuracy;
      handleAnimationComplete();
      return;
    }

    animatedAccuracy.value = 0;
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
      },
    );

    return () => {
      animatedAccuracy.value = targetAccuracy;
    };
  }, [
    animatedAccuracy,
    handleAnimationComplete,
    prefersReducedMotion,
    targetAccuracy,
  ]);

  const animatedMetricProps = useAnimatedProps(() => {
    const rawValue = animatedAccuracy.value;
    const current = rawValue < 0 ? 0 : rawValue > 100 ? 100 : rawValue;
    const rounded = Math.round(current * 10) / 10;
    return {
      text: formatAccuracy(rounded),
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const onContinue = useCallback(() => {
    track("trust_screen_continue_tapped", { targetAccuracy });
    router.push("/(onboarding)/paywall");
  }, [targetAccuracy]);

  const onPressIn = useCallback(() => {
    buttonScale.value = withTiming(0.98, {
      duration: 80,
      easing: Easing.out(Easing.cubic),
    });
  }, [buttonScale]);

  const onPressOut = useCallback(() => {
    buttonScale.value = withSpring(1, {
      damping: 12,
      stiffness: 200,
      mass: 0.8,
    });
  }, [buttonScale]);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#000000", "#0B0B0B"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View>
          <T
            accessibilityRole="header"
            style={styles.title}
            accessibilityLabel="How precise is Sigma Max?"
          >
            {"How precise is\nSigma Max?"}
          </T>
          <T style={styles.subtitle}>
            Every symmetry, contour, and ratio analyzed with near-perfect precision.
          </T>

          <View style={styles.metricBlock}>
            <AnimatedT
              animatedProps={animatedMetricProps}
              style={styles.metric}
              accessibilityLabel={`Accuracy ${finalAccuracyText.replace("%", " percent")}`}
            >
              {formatAccuracy(0)}
            </AnimatedT>
            <T style={styles.metricCaption}>Accuracy</T>
          </View>
        </View>

        <AnimatedPressable
          accessibilityRole="button"
          onPress={onContinue}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.ctaButton, buttonAnimatedStyle]}
        >
          <T style={styles.ctaLabel}>Continue</T>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 12,
    color: "rgba(160,160,160,0.80)",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "500",
  },
  metricBlock: {
    marginTop: 48,
  },
  metric: {
    color: "#B4F34D",
    fontSize: 96,
    lineHeight: 100,
    letterSpacing: -0.5,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "700",
  },
  metricCaption: {
    marginTop: 12,
    color: "#B4F34D",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "600",
  },
  ctaButton: {
    width: "100%",
    height: 64,
    borderRadius: 999,
    backgroundColor: "#B4F34D",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(180,243,77,0.35)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaLabel: {
    color: "#0B0B0B",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Poppins-SemiBold",
    fontWeight: "700",
  },
});
