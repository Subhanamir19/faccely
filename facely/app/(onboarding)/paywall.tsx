import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolateColor,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useOnboarding } from "@/store/onboarding";
import { useAuthStore } from "@/store/auth";
import { syncUserProfile } from "@/lib/api/user";

const COLORS = {
  bgTop: "#000000",
  bgBottom: "#0B0B0B",
  lime: "#B4F34D",
  limeHi: "#A6F02F",
  limeGlow: "rgba(180,243,77,0.25)",
  text: "#FFFFFF",
  textDim: "rgba(200,200,200,0.85)",
  textSub: "rgba(218,218,218,0.96)",
  card: "rgba(18,18,18,0.85)",
  cardBorder: "rgba(255,255,255,0.08)",
};

const RADII = {
  xl: 28,
  lg: 20,
  md: 16,
  sm: 12,
};

const { width } = Dimensions.get("window");

const CONTENT_WIDTH = Math.round(width * 0.86);
const PLAN_CARD_HEIGHT = 84;
const PLAN_SECTION_TOP = 44 + 34 + 8 + 40 + 32; // cumulative layout spacing
const GLOW_RADIUS = 240;
const GLOW_DIAMETER = GLOW_RADIUS * 2;
const GLOW_TOP = PLAN_SECTION_TOP + PLAN_CARD_HEIGHT / 2 - GLOW_RADIUS;
const GLOW_LEFT = width / 2 - GLOW_RADIUS;

const FEATURE_ITEMS = [
  "Aesthetics scoring",
  "Personalized recommendations",
  "Facial improvement analysis",
  "See your 10 by 10 version",
] as const;

type PlanKey = "weekly" | "monthly";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedText = Animated.createAnimatedComponent(Text);

const FeatureRow: React.FC<{ label: string; delay: number; isLast?: boolean }> = ({
  label,
  delay,
  isLast,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );

    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );
    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [delay, opacity, scale, translateY]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[styles.featureRow, !isLast && styles.featureRowSpacing, rowStyle]}
    >
      <View style={styles.featureIconWrap}>
        <View style={styles.featureIconGlow}>
          <View style={styles.featureIconFill}>
            <View style={styles.check} />
          </View>
        </View>
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
  );
};

const PlanCard: React.FC<{
  label: string;
  price: string;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  animation: {
    scale: Animated.SharedValue<number>;
    progress: Animated.SharedValue<number>;
    badgeOffset?: Animated.SharedValue<number>;
    badgeOpacity?: Animated.SharedValue<number>;
    shimmer?: Animated.SharedValue<number>;
  };
  showBadge?: boolean;
}> = ({
  label,
  price,
  onPress,
  onPressIn,
  onPressOut,
  animation,
  showBadge,
}) => {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animation.scale.value }],
    borderColor: interpolateColor(
      animation.progress.value,
      [0, 1],
      [COLORS.cardBorder, COLORS.lime],
    ),
    shadowOpacity: interpolate(animation.progress.value, [0, 1], [0, 0.25]),
    shadowRadius: interpolate(animation.progress.value, [0, 1], [0, 16]),
    elevation: interpolate(animation.progress.value, [0, 1], [0, 10]),
  }));

  const badgeStyle = useAnimatedStyle(() => {
    if (!showBadge || !animation.badgeOffset || !animation.badgeOpacity) {
      return {};
    }
    return {
      opacity: animation.badgeOpacity.value,
      transform: [{ translateY: animation.badgeOffset.value }],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      animation.progress.value,
      [0, 1],
      [COLORS.textDim, "#111111"],
    ),
  }));

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      animation.progress.value,
      [0, 1],
      [COLORS.textDim, "#111111"],
    ),
  }));

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: animation.progress.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    if (!animation.shimmer) return {};
    return {
      transform: [
        {
          translateX: interpolate(animation.shimmer.value, [0, 1], [-20, 20]),
        },
      ],
    };
  });

  return (
    <AnimatedPressable
      style={[styles.planCard, cardStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View pointerEvents="none" style={[styles.planGradient, gradientStyle]}>
        <AnimatedLinearGradient
          colors={[COLORS.lime, COLORS.limeHi]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>
      {showBadge ? (
        <Animated.View style={[styles.badgeContainer, badgeStyle]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Best Deal</Text>
            <AnimatedLinearGradient
              colors={[
                "rgba(255,255,255,0)",
                "rgba(255,255,255,0.35)",
                "rgba(255,255,255,0)",
              ]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.badgeShimmer, shimmerStyle]}
              pointerEvents="none"
            />
          </View>
        </Animated.View>
      ) : null}
      <AnimatedText style={[styles.planLabel, labelStyle]}>{label}</AnimatedText>
      <AnimatedText style={[styles.planPrice, priceStyle]}>{price}</AnimatedText>
    </AnimatedPressable>
  );
};

const PaywallScreen: React.FC = () => {
  const [selected, setSelected] = useState<PlanKey>("monthly");
  const finishOnboarding = useOnboarding((state) => state.finish);
  const setOnboardingCompletedFromOnboarding = useAuthStore(
    (state) => state.setOnboardingCompletedFromOnboarding
  );

  const screenFade = useSharedValue(0);

  useEffect(() => {
    screenFade.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [screenFade]);

  const weeklyScale = useSharedValue(selected === "weekly" ? 1.02 : 1);
  const monthlyScale = useSharedValue(selected === "monthly" ? 1.02 : 1);
  const weeklyProgress = useSharedValue(selected === "weekly" ? 1 : 0);
  const monthlyProgress = useSharedValue(selected === "monthly" ? 1 : 0);
  const badgeOffset = useSharedValue(selected === "monthly" ? 0 : -8);
  const badgeOpacity = useSharedValue(selected === "monthly" ? 1 : 0);
  const badgeShimmer = useSharedValue(0);

  useEffect(() => {
    const activeScale = selected === "weekly" ? weeklyScale : monthlyScale;
    const inactiveScale = selected === "weekly" ? monthlyScale : weeklyScale;
    const activeProgress = selected === "weekly" ? weeklyProgress : monthlyProgress;
    const inactiveProgress = selected === "weekly" ? monthlyProgress : weeklyProgress;

    activeScale.value = withTiming(1.02, {
      duration: 250,
      easing: Easing.out(Easing.back(1.2)),
    });
    inactiveScale.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });

    activeProgress.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    inactiveProgress.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });

    if (selected === "monthly") {
      badgeOffset.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      });
      badgeOpacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      });
    } else {
      badgeOffset.value = withTiming(-8, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      });
      badgeOpacity.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [badgeOffset, badgeOpacity, monthlyProgress, monthlyScale, selected, weeklyProgress, weeklyScale]);

  useEffect(() => {
    badgeShimmer.value = withDelay(
      400,
      withRepeat(
        withTiming(1, {
          duration: 2400,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
  }, [badgeShimmer]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenFade.value,
  }));

  const onSelectPlan = (plan: PlanKey) => {
    if (plan === selected) return;
    setSelected(plan);
  };

  const onContinue = useCallback(async () => {
    try {
      await finishOnboarding();
      setOnboardingCompletedFromOnboarding(true);
      try {
        await syncUserProfile(true);
      } catch (syncError) {
        if (__DEV__) {
          console.warn("[Paywall] Failed to sync onboarding completion", syncError);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[Paywall] Failed to persist onboarding completion", error);
      }
    } finally {
      router.replace("/(tabs)/take-picture");
    }
  }, [finishOnboarding, setOnboardingCompletedFromOnboarding]);

  const primaryScale = useSharedValue(1);
  const primaryGlow = useSharedValue(0);

  const primaryButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryScale.value }],
  }));

  const primaryGlowStyle = useAnimatedStyle(() => {
    if (Platform.OS === "android") {
      return {};
    }

    return {
      shadowOpacity: 0.35 + primaryGlow.value * 0.1,
    };
  });

  const onPrimaryPressIn = () => {
    primaryScale.value = withTiming(0.96, {
      duration: 120,
      easing: Easing.out(Easing.cubic),
    });
  };

  const onPrimaryPressOut = () => {
    primaryScale.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.back(1.2)),
    });
  };

  useEffect(() => {
    primaryGlow.value = withRepeat(
      withTiming(1, {
        duration: 3000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [primaryGlow]);

  const onPlanPressIn = (plan: PlanKey) => {
    const target = plan === "weekly" ? weeklyScale : monthlyScale;
    const base = plan === selected ? 1.06 : 1.04;
    target.value = withTiming(base, {
      duration: 160,
      easing: Easing.out(Easing.quad),
    });
  };

  const onPlanPressOut = (plan: PlanKey) => {
    const target = plan === "weekly" ? weeklyScale : monthlyScale;
    const base = plan === selected ? 1.02 : 1;
    target.value = withTiming(base, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glowContainer}>
        <LinearGradient
          colors={[
            "rgba(180,243,77,0.32)",
            "rgba(180,243,77,0.16)",
            "rgba(180,243,77,0.0)",
          ]}
          locations={[0, 0.48, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glow}
        />
      </View>
      <Animated.View style={[styles.flex, containerStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.inner}>
            {/* HEADER */}
            <View style={styles.header}>
              <Text style={styles.title}>Sigma Max Premium</Text>
              <Text style={styles.subtitle}>
                Unlock every Sigma Max feature: AI aesthetics scoring, improvement insights
                & personalized plans.
              </Text>
            </View>

            {/* PRICING */}
            <View style={styles.pricingRow}>
              <PlanCard
                label="Weekly"
                price="$5/week"
                onPress={() => onSelectPlan("weekly")}
                onPressIn={() => onPlanPressIn("weekly")}
                onPressOut={() => onPlanPressOut("weekly")}
                animation={{ scale: weeklyScale, progress: weeklyProgress }}
              />
              <View style={styles.planSpacer} />
              <PlanCard
                label="Monthly"
                price="$12/month"
                onPress={() => onSelectPlan("monthly")}
                onPressIn={() => onPlanPressIn("monthly")}
                onPressOut={() => onPlanPressOut("monthly")}
                animation={{
                  scale: monthlyScale,
                  progress: monthlyProgress,
                  badgeOffset,
                  badgeOpacity,
                  shimmer: badgeShimmer,
                }}
                showBadge
              />
            </View>

            {/* FEATURES */}
            <View style={styles.featureCard}>
              {FEATURE_ITEMS.map((item, index) => (
                <FeatureRow
                  key={item}
                  label={item}
                  delay={index * 80}
                  isLast={index === FEATURE_ITEMS.length - 1}
                />
              ))}
            </View>

            {/* BUTTONS */}
            <AnimatedPressable
              style={[styles.primaryButton, primaryGlowStyle, primaryButtonStyle]}
              onPress={onContinue}
              onPressIn={onPrimaryPressIn}
              onPressOut={onPrimaryPressOut}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </AnimatedPressable>
            <Pressable style={styles.secondaryButton} onPress={onContinue}>
              <Text style={styles.secondaryText}>Continue without subscription</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

export default PaywallScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  inner: {
    alignItems: "center",
    paddingTop: 44,
  },
  header: {
    width: CONTENT_WIDTH,
    alignItems: "center",
  },
  title: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDim,
    textAlign: "center",
    maxWidth: Math.round(width * 0.8),
  },
  pricingRow: {
    flexDirection: "row",
    width: CONTENT_WIDTH,
    marginTop: 32,
    justifyContent: "space-between",
  },
  planCard: {
    width: 155,
    height: PLAN_CARD_HEIGHT,
    borderRadius: RADII.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.card,
    overflow: "hidden",
    shadowColor: COLORS.lime,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  planGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  planSpacer: {
    width: 20,
  },
  planLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 18,
    lineHeight: 22,
    color: COLORS.text,
    textAlign: "center",
  },
  planPrice: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.text,
    textAlign: "center",
    marginTop: 8,
  },
  badgeContainer: {
    position: "absolute",
    top: -32,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.lime,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.lime,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: "hidden",
  },
  badgeText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: "#111111",
  },
  badgeShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 40,
  },
  featureCard: {
    width: CONTENT_WIDTH,
    marginTop: 36,
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureRowSpacing: {
    marginBottom: 16,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    backgroundColor: "rgba(180,243,77,0.05)",
  },
  featureIconGlow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(180,243,77,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconFill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.lime,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(255,255,255,0.35)",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  check: {
    width: 14,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: "#111111",
    transform: [{ rotate: "-45deg" }],
  },
  featureLabel: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
  },
  primaryButton: {
    width: CONTENT_WIDTH,
    height: 56,
    borderRadius: RADII.xl,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.lime,
    overflow: "visible",
    ...(Platform.OS === "android"
      ? { elevation: 12 }
      : {
          shadowColor: COLORS.lime,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }),
    marginTop: 44,
  },
  primaryButtonText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: "#0B0B0B",
  },
  secondaryButton: {
    marginTop: 16,
    width: CONTENT_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: "rgba(200,200,200,0.65)",
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  glow: {
    position: "absolute",
    top: GLOW_TOP,
    left: GLOW_LEFT,
    width: GLOW_DIAMETER,
    height: GLOW_DIAMETER,
    borderRadius: GLOW_RADIUS,
  },
});
