import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Alert,
  ActivityIndicator,
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
  withSequence,
} from "react-native-reanimated";
import { router } from "expo-router";
import { Check, Gift } from "lucide-react-native";
import { useOnboarding } from "@/store/onboarding";
import { useAuthStore } from "@/store/auth";
import { useSubscriptionStore } from "@/store/subscription";
import { syncUserProfile } from "@/lib/api/user";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  checkSubscriptionStatus,
} from "@/lib/revenuecat";
import { COLORS, RADII } from "@/lib/tokens";
import { PurchasesPackage } from "react-native-purchases";

const { width } = Dimensions.get("window");

const CONTENT_WIDTH = Math.round(width * 0.86);

const FEATURE_ITEMS = [
  "AI aesthetics scoring & analysis",
  "Personalized improvement recommendations",
  "Facial symmetry & structure insights",
  "Progress tracking & history",
  "Unlimited scans",
] as const;

type PlanKey = "weekly" | "monthly" | "yearly";

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
        <Check size={18} color="#111" strokeWidth={3} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
  );
};

const PlanCard: React.FC<{
  label: string;
  price: string;
  period: string;
  badge?: string;
  savings?: string;
  selected: boolean;
  onPress: () => void;
  animation: {
    scale: Animated.SharedValue<number>;
    progress: Animated.SharedValue<number>;
  };
}> = ({ label, price, period, badge, savings, selected, onPress, animation }) => {
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animation.scale.value }],
    borderColor: interpolateColor(
      animation.progress.value,
      [0, 1],
      [COLORS.cardBorder, COLORS.accent],
    ),
    shadowOpacity: interpolate(animation.progress.value, [0, 1], [0, 0.35]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      animation.progress.value,
      [0, 1],
      ["rgba(200,200,200,0.85)", "#111111"],
    ),
  }));

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      animation.progress.value,
      [0, 1],
      [COLORS.text, "#111111"],
    ),
  }));

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: animation.progress.value,
  }));

  return (
    <AnimatedPressable
      style={[styles.planCard, cardStyle]}
      onPress={onPress}
    >
      <Animated.View pointerEvents="none" style={[styles.planGradient, gradientStyle]}>
        <LinearGradient
          colors={[COLORS.accent, "#A6F02F"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>
      {badge && (
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>
      )}
      <View style={styles.planContent}>
        <AnimatedText style={[styles.planLabel, labelStyle]}>{label}</AnimatedText>
        <AnimatedText style={[styles.planPrice, priceStyle]}>{price}</AnimatedText>
        <AnimatedText style={[styles.planPeriod, labelStyle]}>{period}</AnimatedText>
        {savings && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>{savings}</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};

const PaywallScreen: React.FC = () => {
  const [selected, setSelected] = useState<PlanKey>("yearly");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState<{
    weekly?: PurchasesPackage;
    monthly?: PurchasesPackage;
    yearly?: PurchasesPackage;
  }>({});

  const finishOnboarding = useOnboarding((state) => state.finish);
  const setOnboardingCompletedFromOnboarding = useAuthStore(
    (state) => state.setOnboardingCompletedFromOnboarding
  );
  const subscriptionStore = useSubscriptionStore();

  const screenFade = useSharedValue(0);

  useEffect(() => {
    screenFade.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [screenFade]);

  // Fetch offerings on mount
  useEffect(() => {
    const mapPackagesFromOfferings = (offerings: any) => {
      const pkgs = offerings.current.availablePackages;
      const mapped: typeof packages = {};

      pkgs.forEach((pkg: any) => {
        const id = pkg.identifier.toLowerCase();
        if (id.includes("weekly")) mapped.weekly = pkg;
        else if (id.includes("yearly") || id.includes("annual")) mapped.yearly = pkg;
        else if (id.includes("monthly")) mapped.monthly = pkg;
      });

      return mapped;
    };

    const fetchOfferings = async () => {
      // Guard: if offerings already exist in store, use them
      if (subscriptionStore.offerings) {
        if (__DEV__) {
          console.log("[Paywall] Using cached offerings from store");
        }
        const mapped = mapPackagesFromOfferings(subscriptionStore.offerings);
        setPackages(mapped);
        return;
      }

      setIsLoading(true);
      try {
        const offerings = await getOfferings();
        if (offerings?.current) {
          subscriptionStore.setOfferings(offerings);

          // Map packages by identifier
          const mapped = mapPackagesFromOfferings(offerings);
          setPackages(mapped);

          if (__DEV__) {
            console.log("[Paywall] Available packages:", Object.keys(mapped));
          }
        }
      } catch (error) {
        console.error("[Paywall] Failed to fetch offerings:", error);
        Alert.alert(
          "Connection Error",
          "Failed to load subscription options. Please check your connection and try again."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const weeklyScale = useSharedValue(selected === "weekly" ? 1.02 : 1);
  const monthlyScale = useSharedValue(selected === "monthly" ? 1.02 : 1);
  const yearlyScale = useSharedValue(selected === "yearly" ? 1.02 : 1);

  const weeklyProgress = useSharedValue(selected === "weekly" ? 1 : 0);
  const monthlyProgress = useSharedValue(selected === "monthly" ? 1 : 0);
  const yearlyProgress = useSharedValue(selected === "yearly" ? 1 : 0);

  useEffect(() => {
    const scales = { weekly: weeklyScale, monthly: monthlyScale, yearly: yearlyScale };
    const progresses = { weekly: weeklyProgress, monthly: monthlyProgress, yearly: yearlyProgress };

    Object.keys(scales).forEach((key) => {
      const planKey = key as PlanKey;
      const isSelected = planKey === selected;

      scales[planKey].value = withTiming(isSelected ? 1.02 : 1, {
        duration: 250,
        easing: Easing.out(isSelected ? Easing.back(1.2) : Easing.cubic),
      });

      progresses[planKey].value = withTiming(isSelected ? 1 : 0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    });
  }, [selected, weeklyScale, monthlyScale, yearlyScale, weeklyProgress, monthlyProgress, yearlyProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenFade.value,
  }));

  const onSelectPlan = (plan: PlanKey) => {
    if (plan === selected) return;
    setSelected(plan);
  };

  const completeOnboardingAndNavigate = useCallback(async () => {
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

  const onContinue = useCallback(async () => {
    setIsLoading(true);
    subscriptionStore.setLoading(true);

    try {
      const selectedPackage = packages[selected];

      if (!selectedPackage) {
        Alert.alert(
          "Package Not Available",
          "The selected package is not available. Please try another plan."
        );
        return;
      }

      subscriptionStore.setCurrentPackage(selectedPackage);

      // Attempt purchase
      const customerInfo = await purchasePackage(selectedPackage);

      if (!customerInfo) {
        // User cancelled
        return;
      }

      // Check if user has entitlement (only updates RevenueCat state, never touches promo)
      const hasEntitlement = await checkSubscriptionStatus();
      subscriptionStore.setRevenueCatEntitlement(hasEntitlement);
      const hasAccess = hasEntitlement || subscriptionStore.promoActivated;

      if (hasAccess) {
        Alert.alert(
          "Success!",
          "Welcome to Sigma Max Pro! You now have access to all premium features.",
          [
            {
              text: "Get Started",
              onPress: () => void completeOnboardingAndNavigate(),
            },
          ]
        );
      } else {
        Alert.alert(
          "Purchase Completed",
          "Your purchase was successful, but we couldn't verify your subscription. Please try restoring purchases.",
          [
            {
              text: "OK",
              onPress: () => void completeOnboardingAndNavigate(),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("[Paywall] Purchase error:", error);
      Alert.alert(
        "Purchase Failed",
        error.message || "An error occurred while processing your purchase. Please try again."
      );
    } finally {
      setIsLoading(false);
      subscriptionStore.setLoading(false);
    }
  }, [selected, packages, subscriptionStore, completeOnboardingAndNavigate]);

  const onRestorePurchases = useCallback(async () => {
    setIsLoading(true);
    subscriptionStore.setLoading(true);

    try {
      await restorePurchases();

      // Check if user has entitlement (only updates RevenueCat state, never touches promo)
      const hasEntitlement = await checkSubscriptionStatus();
      subscriptionStore.setRevenueCatEntitlement(hasEntitlement);
      const hasAccess = hasEntitlement || subscriptionStore.promoActivated;

      if (hasAccess) {
        Alert.alert(
          "Purchases Restored!",
          "Your subscription has been restored. Welcome back to Sigma Max Pro!",
          [
            {
              text: "Continue",
              onPress: () => void completeOnboardingAndNavigate(),
            },
          ]
        );
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases associated with your account."
        );
      }
    } catch (error: any) {
      console.error("[Paywall] Restore error:", error);
      Alert.alert(
        "Restore Failed",
        error.message || "Failed to restore purchases. Please try again."
      );
    } finally {
      setIsLoading(false);
      subscriptionStore.setLoading(false);
    }
  }, [subscriptionStore, completeOnboardingAndNavigate]);

  const onApplyPromoCode = useCallback(() => {
    const success = subscriptionStore.activatePromoCode(promoCode);

    if (success) {
      Alert.alert(
        "Promo Code Activated!",
        "You've unlocked Sigma Max Pro! Enjoy all premium features.",
        [
          {
            text: "Get Started",
            onPress: () => void completeOnboardingAndNavigate(),
          },
        ]
      );
    } else {
      Alert.alert("Invalid Code", "The promo code you entered is not valid. Please try again.");
    }
  }, [promoCode, subscriptionStore, completeOnboardingAndNavigate]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
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
              <Text style={styles.title}>Unlock Your Full Potential</Text>
              <Text style={styles.subtitle}>
                Get AI-powered aesthetics insights, personalized recommendations, and unlimited access to all features.
              </Text>
            </View>

            {/* PRICING */}
            <View style={styles.pricingColumn}>
              <PlanCard
                label="Weekly"
                price="$3.99"
                period="per week"
                selected={selected === "weekly"}
                onPress={() => onSelectPlan("weekly")}
                animation={{ scale: weeklyScale, progress: weeklyProgress }}
              />
              <PlanCard
                label="Monthly"
                price="$8.99"
                period="per month"
                badge="Most Popular"
                selected={selected === "monthly"}
                onPress={() => onSelectPlan("monthly")}
                animation={{ scale: monthlyScale, progress: monthlyProgress }}
              />
              <PlanCard
                label="Yearly"
                price="$49.99"
                period="per year"
                badge="Best Value"
                savings="Save 76%"
                selected={selected === "yearly"}
                onPress={() => onSelectPlan("yearly")}
                animation={{ scale: yearlyScale, progress: yearlyProgress }}
              />
            </View>

            {/* FEATURES */}
            <View style={styles.featureCard}>
              <Text style={styles.featureHeader}>What's Included:</Text>
              {FEATURE_ITEMS.map((item, index) => (
                <FeatureRow
                  key={item}
                  label={item}
                  delay={index * 80}
                  isLast={index === FEATURE_ITEMS.length - 1}
                />
              ))}
            </View>

            {/* PRIMARY BUTTON */}
            <AnimatedPressable
              style={[styles.primaryButton, primaryGlowStyle, primaryButtonStyle]}
              onPress={onContinue}
              onPressIn={onPrimaryPressIn}
              onPressOut={onPrimaryPressOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0B0B0B" />
              ) : (
                <Text style={styles.primaryButtonText}>Start Subscription</Text>
              )}
            </AnimatedPressable>

            {/* RESTORE PURCHASES */}
            <Pressable style={styles.restoreButton} onPress={onRestorePurchases} disabled={isLoading}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </Pressable>

            {/* PROMO CODE */}
            <Pressable
              style={styles.promoToggle}
              onPress={() => setShowPromoInput(!showPromoInput)}
            >
              <Gift size={16} color={COLORS.accent} strokeWidth={2} />
              <Text style={styles.promoToggleText}>Have a promo code?</Text>
            </Pressable>

            {showPromoInput && (
              <View style={styles.promoSection}>
                <View style={styles.promoInputWrapper}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Enter code"
                    placeholderTextColor="rgba(200,200,200,0.5)"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Pressable style={styles.promoApplyButton} onPress={onApplyPromoCode}>
                    <Text style={styles.promoApplyText}>Apply</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* LEGAL */}
            <View style={styles.legal}>
              <Text style={styles.legalText}>
                Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
              </Text>
              <View style={styles.legalLinks}>
                <Text style={styles.legalLink}>Terms of Service</Text>
                <Text style={styles.legalSeparator}>•</Text>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </View>
            </View>
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
    paddingHorizontal: 20,
  },
  header: {
    width: CONTENT_WIDTH,
    alignItems: "center",
    marginBottom: 32,
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
    color: "rgba(200,200,200,0.85)",
    textAlign: "center",
    maxWidth: Math.round(width * 0.8),
  },
  pricingColumn: {
    width: CONTENT_WIDTH,
    gap: 16,
  },
  planCard: {
    width: "100%",
    minHeight: 100,
    borderRadius: RADII.lg,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: COLORS.card,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOpacity: 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  planGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  planContent: {
    alignItems: "center",
  },
  planLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 20,
    lineHeight: 24,
    color: COLORS.text,
    textAlign: "center",
  },
  planPrice: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 32,
    lineHeight: 38,
    color: COLORS.text,
    textAlign: "center",
    marginTop: 4,
  },
  planPeriod: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    lineHeight: 18,
    color: "rgba(200,200,200,0.7)",
    textAlign: "center",
    marginTop: 2,
  },
  badgeContainer: {
    position: "absolute",
    top: -10,
    right: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#111111",
  },
  savingsBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.sm,
    backgroundColor: "rgba(180,243,77,0.15)",
  },
  savingsText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    color: COLORS.accent,
  },
  featureCard: {
    width: CONTENT_WIDTH,
    marginTop: 32,
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  featureHeader: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureRowSpacing: {
    marginBottom: 14,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: COLORS.accent,
  },
  featureLabel: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  primaryButton: {
    width: CONTENT_WIDTH,
    height: 56,
    borderRadius: RADII.pill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.accent,
    overflow: "visible",
    ...(Platform.OS === "android"
      ? { elevation: 12 }
      : {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }),
    marginTop: 32,
  },
  primaryButtonText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: "#0B0B0B",
  },
  restoreButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  restoreText: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: "rgba(200,200,200,0.7)",
    textDecorationLine: "underline",
  },
  promoToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  promoToggleText: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: COLORS.accent,
  },
  promoSection: {
    width: CONTENT_WIDTH,
    marginTop: 12,
  },
  promoInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promoInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.inputBg,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 16,
    color: COLORS.text,
    fontFamily: "Poppins-Regular",
    fontSize: 14,
  },
  promoApplyButton: {
    height: 48,
    paddingHorizontal: 24,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.md,
    justifyContent: "center",
    alignItems: "center",
  },
  promoApplyText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: "#0B0B0B",
  },
  legal: {
    width: CONTENT_WIDTH,
    marginTop: 32,
    alignItems: "center",
  },
  legalText: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(200,200,200,0.5)",
    textAlign: "center",
    marginBottom: 8,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: "rgba(200,200,200,0.6)",
    textDecorationLine: "underline",
  },
  legalSeparator: {
    fontSize: 11,
    color: "rgba(200,200,200,0.4)",
  },
});
