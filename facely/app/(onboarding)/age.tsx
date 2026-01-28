// app/(onboarding)/age.tsx
// Age input screen with custom circular stepper
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Platform, StatusBar } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AgeScreen() {
  const insets = useSafeAreaInsets();
  const { data, setField } = useOnboarding();
  const [age, setAge] = useState<number>(
    Number.isFinite(data.age) ? Number(data.age) : 25
  );

  const progress = getProgressForStep("age");

  useEffect(() => {
    setField("age", age);
  }, [age, setField]);

  const dec = useCallback(() => {
    hapticSelection();
    setAge((a) => Math.max(10, a - 1));
  }, []);

  const inc = useCallback(() => {
    hapticSelection();
    setAge((a) => Math.min(100, a + 1));
  }, []);

  const handleNext = useCallback(() => {
    router.push("/(onboarding)/ethnicity");
  }, []);

  const handleSkip = useCallback(() => {
    setField("age", 25);
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
                style={styles.circleGlow}
              />
              <View style={styles.circleCore}>
                <StepperButton onPress={inc} position="left">
                  <Plus size={18} color={COLORS.text} strokeWidth={2.5} />
                </StepperButton>

                <View style={styles.ageCenter}>
                  <T variant="h1" color="text" style={styles.ageText}>
                    {age}
                  </T>
                  <View style={styles.underline} />
                </View>

                <StepperButton onPress={dec} position="right">
                  <Minus size={18} color={COLORS.text} strokeWidth={2.5} />
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
  children,
}: {
  onPress: () => void;
  position: "left" | "right";
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
      style={[
        styles.sideBtn,
        position === "left" ? styles.leftBtn : styles.rightBtn,
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
    gap: 2,
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
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  ageCenter: {
    alignItems: "center",
  },
  ageText: {
    fontSize: 40,
    letterSpacing: 0.5,
  },
  underline: {
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: SP[2],
    width: 52,
  },

  // Stepper buttons
  sideBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    position: "absolute",
    top: "50%",
    marginTop: -17,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        }
      : {}),
  },
  leftBtn: { left: 16 },
  rightBtn: { right: 16 },

  // CTAs
  ctaContainer: {
    marginTop: SP[2],
    gap: SP[3],
  },
  secondaryButton: {
    marginTop: 0,
  },
});
