// app/(onboarding)/age.tsx
// Age input screen with custom circular stepper
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Platform, StatusBar, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Minus } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
  Easing,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import Button from "@/components/ui/Button";
import { OnboardingCard } from "@/components/onboarding";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

// Age constraints
const MIN_AGE = 10;
const MAX_AGE = 100;
const DEFAULT_AGE = 25;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Circle size as percentage of screen width (clamped)
const CIRCLE_SIZE_RATIO = 0.42;
const CIRCLE_MIN = 140;
const CIRCLE_MAX = 200;

export default function AgeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { data, setField } = useOnboarding();
  const [age, setAge] = useState<number>(
    Number.isFinite(data.age) ? Number(data.age) : DEFAULT_AGE
  );

  const progress = getProgressForStep("age");

  // Responsive circle sizing
  const circleSize = Math.min(CIRCLE_MAX, Math.max(CIRCLE_MIN, screenWidth * CIRCLE_SIZE_RATIO));
  const glowSize = circleSize + 8;
  const stepperBtnSize = Math.round(circleSize * 0.21);
  const underlineWidth = Math.round(circleSize * 0.325);

  useEffect(() => {
    setField("age", age);
  }, [age, setField]);

  const dec = useCallback(() => {
    hapticSelection();
    setAge((a) => Math.max(MIN_AGE, a - 1));
  }, []);

  const inc = useCallback(() => {
    hapticSelection();
    setAge((a) => Math.min(MAX_AGE, a + 1));
  }, []);

  const handleNext = useCallback(() => {
    router.push("/(onboarding)/ethnicity");
  }, []);

  const handleSkip = useCallback(() => {
    setField("age", DEFAULT_AGE);
    router.push("/(onboarding)/ethnicity");
  }, [setField]);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Diagonal reflection */}
      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.diagonalReflection}
      />

      <View
        style={[
          styles.centerWrap,
          {
            paddingTop: insets.top + SP[4],
            paddingBottom: insets.bottom + SP[4],
          },
        ]}
      >
        <Animated.View entering={FadeInDown.duration(350).easing(Easing.out(Easing.cubic))}>
          <OnboardingCard>
            {/* Progress bar */}
            <ProgressBar progress={progress} />

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

            {/* Title */}
            <T variant="h3" color="text" align="center">
              How old are you?
            </T>

            {/* Subtitle */}
            <T variant="caption" color="sub" align="center" style={styles.subtitle}>
              We use your age to calibrate{"\n"}health & aesthetics benchmarks.
            </T>

            {/* Circular age stepper */}
            <View style={styles.circleWrap}>
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", `${COLORS.accent}0D`]}
                style={[styles.circleGlow, { width: glowSize, height: glowSize, borderRadius: glowSize / 2 }]}
              />
              <View style={[styles.circleCore, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
                <StepperButton
                  onPress={dec}
                  position="left"
                  size={stepperBtnSize}
                  accessibilityLabel="Decrease age"
                >
                  <Minus size={Math.round(stepperBtnSize * 0.53)} color={COLORS.text} strokeWidth={2.5} />
                </StepperButton>

                <View style={styles.ageCenter}>
                  <T variant="scoreLarge" color="text">
                    {age}
                  </T>
                  <View style={[styles.underline, { width: underlineWidth }]} />
                </View>

                <StepperButton
                  onPress={inc}
                  position="right"
                  size={stepperBtnSize}
                  accessibilityLabel="Increase age"
                >
                  <Plus size={Math.round(stepperBtnSize * 0.53)} color={COLORS.text} strokeWidth={2.5} />
                </StepperButton>
              </View>
            </View>

            {/* CTAs */}
            <View style={styles.ctaContainer}>
              <Button label="Next" onPress={handleNext} variant="primary" />
              <Button
                label="Skip"
                onPress={handleSkip}
                variant="ghost"
                style={styles.secondaryButton}
              />
            </View>
          </OnboardingCard>
        </Animated.View>
      </View>
    </View>
  );
}

// Progress bar component
function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

// Stepper button component
function StepperButton({
  onPress,
  position,
  size,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  position: "left" | "right";
  size: number;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.sideBtn,
        position === "left" ? styles.leftBtn : styles.rightBtn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginTop: -size / 2,
        },
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  diagonalReflection: {
    position: "absolute",
    left: -50,
    right: -50,
    top: -80,
    height: 260,
    transform: [{ rotate: "12deg" }],
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SP[4],
  },

  // Progress bar
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

  // Back button
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: SP[3],
    marginLeft: -SP[1],
    paddingVertical: SP[1],
    paddingRight: SP[2],
    gap: SP[1],
  },

  subtitle: {
    marginTop: SP[2],
    marginBottom: SP[5],
  },

  // Circular stepper
  circleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[6],
  },
  circleGlow: {
    position: "absolute",
    opacity: 0.6,
  },
  circleCore: {
    backgroundColor: COLORS.bgTop,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  ageCenter: {
    alignItems: "center",
  },
  underline: {
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: SP[2],
  },

  // Stepper buttons
  sideBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    position: "absolute",
    top: "50%",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        }
      : {}),
  },
  leftBtn: { left: SP[4] },
  rightBtn: { right: SP[4] },

  // CTAs
  ctaContainer: {
    marginTop: SP[2],
    gap: SP[3],
  },
  secondaryButton: {
    marginTop: 0,
  },
});
