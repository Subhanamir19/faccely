import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";

const { width } = Dimensions.get("window");

const ACCENT = "#B4F34D";
const ACCENT_HL = "#A6F02F";
const BG_TOP = "#000000";
const BG_BOTTOM = "#0B0B0B";
const TEXT = "#FFFFFF";
const TEXT_DIM = "rgba(160,160,160,0.8)";
const OUTLINE = "rgba(255,255,255,0.08)";
const CARD_BG = "rgba(18,18,18,0.9)";

const FEATURE_ITEMS = [
  "Aesthetics scoring",
  "Routine generation",
  "Facial improvement analysis",
  "See your 10 by 10 version",
] as const;

type PlanKey = "weekly" | "monthly";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedText = Animated.createAnimatedComponent(Text);

const FeatureRow: React.FC<{ label: string; delay: number; isLast?: boolean }> = ({
  label,
  delay,
  isLast,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }),
    );

    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [delay, opacity, translateY]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.featureRow, !isLast && styles.featureRowSpacing, rowStyle]}
    >
      <View style={styles.featureIconWrap}>
        <View style={styles.checkBase}>
          <View style={styles.checkStem} />
          <View style={styles.checkTip} />
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
  animation: {
    scale: Animated.SharedValue<number>;
    progress: Animated.SharedValue<number>;
    badgeOffset?: Animated.SharedValue<number>;
    badgeOpacity?: Animated.SharedValue<number>;
  };
  showBadge?: boolean;
  inactiveBackground: string;
  activeBackground: string;
  inactiveTextColor: string;
  activeTextColor: string;
  inactivePriceColor?: string;
  activePriceColor?: string;
}> = ({
  label,
  price,
  onPress,
  animation,
  showBadge,
  inactiveBackground,
  activeBackground,
  inactiveTextColor,
  activeTextColor,
  inactivePriceColor,
  activePriceColor,
}) => {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animation.scale.value }],
    borderColor: interpolateColor(
      animation.progress.value,
      [0, 1],
      [OUTLINE, ACCENT],
    ),
    backgroundColor: interpolateColor(
      animation.progress.value,
      [0, 1],
      [inactiveBackground, activeBackground],
    ),
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
      [inactiveTextColor, activeTextColor],
    ),
  }));

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      animation.progress.value,
      [0, 1],
      [inactivePriceColor ?? inactiveTextColor, activePriceColor ?? activeTextColor],
    ),
  }));

  return (
    <AnimatedPressable style={[styles.planCard, cardStyle]} onPress={onPress}>
      {showBadge ? (
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>Best Deal</Text>
        </Animated.View>
      ) : null}
      <AnimatedText style={[styles.planLabel, labelStyle]}>{label}</AnimatedText>
      <AnimatedText style={[styles.planPrice, priceStyle]}>{price}</AnimatedText>
    </AnimatedPressable>
  );
};

const PaywallScreen: React.FC = () => {
  const [selected, setSelected] = useState<PlanKey>("monthly");

  const screenFade = useSharedValue(0);

  useEffect(() => {
    screenFade.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [screenFade]);

  const weeklyScale = useSharedValue(selected === "weekly" ? 1.05 : 1);
  const monthlyScale = useSharedValue(selected === "monthly" ? 1.05 : 1);
  const weeklyProgress = useSharedValue(selected === "weekly" ? 1 : 0);
  const monthlyProgress = useSharedValue(selected === "monthly" ? 1 : 0);
  const badgeOffset = useSharedValue(selected === "monthly" ? 0 : -8);
  const badgeOpacity = useSharedValue(selected === "monthly" ? 1 : 0);

  useEffect(() => {
    const activeScale = selected === "weekly" ? weeklyScale : monthlyScale;
    const inactiveScale = selected === "weekly" ? monthlyScale : weeklyScale;
    const activeProgress = selected === "weekly" ? weeklyProgress : monthlyProgress;
    const inactiveProgress = selected === "weekly" ? monthlyProgress : weeklyProgress;

    activeScale.value = withTiming(1.05, {
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

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenFade.value,
  }));

  const onSelectPlan = (plan: PlanKey) => {
    if (plan === selected) return;
    setSelected(plan);
  };

  const onContinue = () => {
    router.push("/(tabs)/take-picture");
  };

  const primaryScale = useSharedValue(1);

  const primaryButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryScale.value }],
  }));

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[BG_TOP, BG_BOTTOM]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
                animation={{ scale: weeklyScale, progress: weeklyProgress }}
                inactiveBackground="#000000"
                activeBackground="rgba(0,0,0,0.65)"
                inactiveTextColor={TEXT_DIM}
                activeTextColor={TEXT}
                inactivePriceColor={TEXT_DIM}
                activePriceColor={ACCENT}
              />
              <View style={{ width: 16 }} />
              <PlanCard
                label="Monthly"
                price="$12/month"
                onPress={() => onSelectPlan("monthly")}
                animation={{
                  scale: monthlyScale,
                  progress: monthlyProgress,
                  badgeOffset,
                  badgeOpacity,
                }}
                showBadge
                inactiveBackground="#000000"
                activeBackground="rgba(0,0,0,0)"
                inactiveTextColor={TEXT_DIM}
                activeTextColor={TEXT}
                inactivePriceColor={TEXT_DIM}
                activePriceColor={ACCENT}
              />
            </View>

            {/* FEATURES */}
            <View style={styles.featureCard}>
              {FEATURE_ITEMS.map((item, index) => (
                <FeatureRow
                  key={item}
                  label={item}
                  delay={index * 60}
                  isLast={index === FEATURE_ITEMS.length - 1}
                />
              ))}
            </View>

            {/* BUTTONS */}
            <AnimatedPressable
              style={[styles.primaryButton, primaryButtonStyle]}
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

const CARD_WIDTH = width - 48;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  inner: {
    alignItems: "center",
    paddingTop: 24,
  },
  header: {
    width: CARD_WIDTH,
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 24,
    color: TEXT,
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 20,
  },
  pricingRow: {
    flexDirection: "row",
    width: CARD_WIDTH,
    marginBottom: 32,
    justifyContent: "center",
  },
  planCard: {
    width: 140,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    overflow: "visible",
  },
  planLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: TEXT,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  planPrice: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 18,
    color: TEXT,
    textAlign: "center",
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    paddingHorizontal: 14,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    color: "#000000",
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 24,
    marginBottom: 40,
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
    backgroundColor: "rgba(180,243,77,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  checkBase: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkStem: {
    position: "absolute",
    width: 1.5,
    height: 10,
    borderRadius: 1,
    backgroundColor: ACCENT,
    transform: [{ rotate: "45deg" }],
    bottom: 4,
  },
  checkTip: {
    position: "absolute",
    width: 1.5,
    height: 6,
    borderRadius: 1,
    backgroundColor: ACCENT_HL,
    transform: [{ rotate: "-45deg" }],
    bottom: 4,
    left: 6,
  },
  featureLabel: {
    flex: 1,
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    color: TEXT,
  },
  primaryButton: {
    width: CARD_WIDTH,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryButtonText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    color: "#000000",
  },
  secondaryButton: {
    marginTop: 12,
    width: CARD_WIDTH,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
});