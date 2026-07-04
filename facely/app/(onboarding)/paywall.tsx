import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
  Image,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  type SharedValue,
  Easing,
  interpolateColor,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import {
  Dumbbell,
  KeyRound,
  RefreshCw,
  ScanLine,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react-native";
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
import { SP } from "@/lib/tokens";
import { useResponsiveScale } from "@/lib/responsive";
import { PurchasesPackage } from "react-native-purchases";
import { logger } from '@/lib/logger';
import * as WebBrowser from "expo-web-browser";
import { useRecoveryCodeStore } from "@/store/recoveryCode";
import { restoreWithCode } from "@/lib/api/recoveryCodes";

const FONT_DIN = "DINNextRounded-Regular";
const ORANGE = "#FF7900";
const ORANGE_DARK = "#ED6B00";
const ORANGE_SOFT = "#FFF3E8";
const PLAN_ICONS = {
  yearly: require("../../assets/paywall-icons/yearly.png"),
  monthly: require("../../assets/paywall-icons/monthly.png"),
  weekly: require("../../assets/paywall-icons/weekly.png"),
} as const;
const PLAN_ACCENTS = {
  yearly: {
    main: ORANGE,
    soft: ORANGE_SOFT,
    badgeBg: ORANGE_SOFT,
    badgeText: ORANGE_DARK,
  },
  monthly: {
    main: ORANGE,
    soft: ORANGE_SOFT,
    badgeBg: ORANGE_SOFT,
    badgeText: ORANGE_DARK,
  },
  weekly: {
    main: ORANGE,
    soft: ORANGE_SOFT,
    badgeBg: ORANGE_SOFT,
    badgeText: ORANGE_DARK,
  },
} as const;

type PlanAccent = (typeof PLAN_ACCENTS)[PlanKey];

const FEATURE_ITEMS = [
  {
    title: "Potential face generation",
    subtitle: "See your optimized face after executing your protocol.",
    icon: Sparkles,
  },
  {
    title: "Know your weakest points",
    subtitle: "Facial symmetry scoring, structure analysis, and ranked fixes.",
    icon: ScanLine,
  },
  {
    title: "Progress tracking",
    subtitle: "Scan history, rank progression, and measurable improvements.",
    icon: TrendingUp,
  },
  {
    title: "Daily routine",
    subtitle: "Exercises and diet protocols built around your scan results.",
    icon: Dumbbell,
  },
] as const;

type PlanKey = "weekly" | "monthly" | "yearly";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedText = Animated.createAnimatedComponent(Text);

const RevealView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, delay = 0, style }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const scale = useSharedValue(0.985);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 460,
        easing: Easing.out(Easing.cubic),
      }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
    scale.value = withDelay(
      delay,
      withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [delay, opacity, scale, translateY]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={[style, revealStyle]}>{children}</Animated.View>;
};

const FeatureRow: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  delay: number;
  accent: PlanAccent;
}> = ({
  title,
  subtitle,
  icon: Icon,
  delay,
  accent,
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
      style={[styles.featureRow, rowStyle]}
    >
      <View style={[styles.featureIconWrap, { backgroundColor: accent.soft }]}>
        <Icon size={16} color={accent.main} strokeWidth={2.4} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </Animated.View>
  );
};

const PlanCard: React.FC<{
  label: string;
  tagline: string;
  price: string;
  period: string;
  iconSource: ImageSourcePropType;
  accent: PlanAccent;
  badge?: string;
  savings?: string;
  selected: boolean;
  onPress: () => void;
  entranceDelay: number;
  animation: {
    scale: SharedValue<number>;
    progress: SharedValue<number>;
  };
}> = ({ label, tagline, price, period, iconSource, accent, badge, savings, selected, onPress, entranceDelay, animation }) => {
  const entranceOpacity = useSharedValue(0);
  const entranceY = useSharedValue(20);
  const entranceScale = useSharedValue(0.985);

  useEffect(() => {
    entranceOpacity.value = withDelay(
      entranceDelay,
      withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
    entranceY.value = withDelay(
      entranceDelay,
      withTiming(0, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
    entranceScale.value = withDelay(
      entranceDelay,
      withTiming(1, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [entranceDelay, entranceOpacity, entranceScale, entranceY]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [
      { translateY: entranceY.value },
      { scale: animation.scale.value * entranceScale.value },
    ],
    borderColor: interpolateColor(
      animation.progress.value,
      [0, 1],
      ["#E8E8E8", accent.main],
    ),
    shadowOpacity: interpolate(animation.progress.value, [0, 1], [0, 0.08]),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: animation.progress.value,
    transform: [
      {
        translateY: interpolate(animation.progress.value, [0, 1], [-8, 0]),
      },
    ],
  }));

  return (
    <AnimatedPressable
      style={[styles.planCard, selected && styles.planCardSelected, cardStyle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, expanded: selected }}
    >
      <View style={styles.planHeader}>
        <View style={[styles.planIcon, selected && { backgroundColor: accent.soft }]}>
          <Image source={iconSource} style={styles.planIconImage} resizeMode="contain" />
        </View>
        <View style={styles.planMeta}>
          <Text style={styles.planLabel}>{label}</Text>
          <Text style={styles.planTagline}>{tagline}</Text>
          <View style={styles.planBadgeRow}>
            {badge && (
              <View style={[
                styles.planBadge,
                { backgroundColor: accent.badgeBg },
              ]}>
                <Text style={[
                  styles.planBadgeText,
                  { color: accent.badgeText },
                ]}>{badge}</Text>
              </View>
            )}
            {savings && (
              <View style={[styles.savingsBadge, { backgroundColor: accent.badgeBg }]}>
                <Text style={[styles.savingsText, { color: accent.badgeText }]}>{savings}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.planPriceColumn}>
          <AnimatedText style={styles.planPrice}>{price}</AnimatedText>
          <Text style={styles.planPeriod}>{period}</Text>
          <View style={[
            styles.radioDot,
            selected && {
              borderColor: accent.main,
              backgroundColor: accent.main,
            },
          ]}>
            {selected && <View style={styles.radioDotInner} />}
          </View>
        </View>
      </View>
      {selected && (
        <Animated.View style={[styles.planBody, bodyStyle]}>
          <View style={styles.planDivider} />
          <View style={styles.expandedFeatureList}>
            {FEATURE_ITEMS.map((item, index) => (
              <FeatureRow
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                icon={item.icon}
                delay={index * 45}
                accent={accent}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </AnimatedPressable>
  );
};

const PaywallScreen: React.FC = () => {
  const navigation = useNavigation();
  const responsive = useResponsiveScale();
  const contentMaxWidth = Math.min(560, Math.max(240, responsive.width - SP[5] * 2));
  const [selected, setSelected] = useState<PlanKey>("monthly");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [restoringWithCode, setRestoringWithCode] = useState(false);
  const ensureCode = useRecoveryCodeStore((s) => s.ensureCode);
  const isMountedRef = useRef(true);
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
  // Use individual selectors instead of getting entire store to avoid stale closures
  const offerings = useSubscriptionStore((state) => state.offerings);
  const setLoading = useSubscriptionStore((state) => state.setLoading);
  const setOfferings = useSubscriptionStore((state) => state.setOfferings);
  const setCurrentPackage = useSubscriptionStore((state) => state.setCurrentPackage);
  const setRevenueCatEntitlement = useSubscriptionStore((state) => state.setRevenueCatEntitlement);
  const activatePromoCode = useSubscriptionStore((state) => state.activatePromoCode);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const screenFade = useSharedValue(0);

  useEffect(() => {
    screenFade.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [screenFade]);

  // Fetch offerings on mount
  useEffect(() => {
    const mapPackagesFromOfferings = (offeringsData: any) => {
      const pkgs = offeringsData.current.availablePackages;
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
      if (offerings) {
        logger.log("[Paywall] Using cached offerings from store");
        const mapped = mapPackagesFromOfferings(offerings);
        setPackages(mapped);
        return;
      }

      setIsLoading(true);
      try {
        const fetchedOfferings = await getOfferings();
        if (fetchedOfferings?.current) {
          setOfferings(fetchedOfferings);

          // Map packages by identifier
          const mapped = mapPackagesFromOfferings(fetchedOfferings);
          setPackages(mapped);

          logger.log("[Paywall] Available packages:", Object.keys(mapped));
        }
      } catch (error) {
        logger.error("[Paywall] Failed to fetch offerings:", error);
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

  // Reset the entire navigation state to /(tabs)/take-picture.
  // IMPORTANT: useNavigation() returns the (onboarding) Stack navigator,
  // NOT the root Stack. We must use getParent() to reach the root Stack
  // which owns the "(tabs)" route. Dispatching on the wrong navigator
  // crashes the app because "(tabs)" doesn't exist in the onboarding Stack.
  const navigateToMainApp = useCallback(() => {
    const rootNav = navigation.getParent();
    if (rootNav) {
      rootNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "(tabs)" }],
        })
      );
    } else {
      // Fallback: if getParent() is somehow null, dispatch on current navigator.
      // This shouldn't happen in practice given the navigation hierarchy.
      logger.warn("[Paywall] navigation.getParent() returned null, falling back");
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "(tabs)" }],
        })
      );
    }
  }, [navigation]);

  const completeOnboarding = useCallback(async () => {
    try {
      await finishOnboarding();
    } catch (error) {
      logger.warn("[Paywall] Failed to persist onboarding completion", error);
    } finally {
      // Always mark onboarding complete in auth store so IndexGate never
      // gets stuck on VideoSplash, even if AsyncStorage write failed above.
      setOnboardingCompletedFromOnboarding(true);
    }
    try {
      await syncUserProfile(true);
    } catch (syncError) {
      logger.warn("[Paywall] Failed to sync onboarding completion", syncError);
    }
  }, [finishOnboarding, setOnboardingCompletedFromOnboarding]);

  const onRestoreWithCode = useCallback(async () => {
    const trimmed = recoveryCode.trim().toUpperCase();
    if (!trimmed) return;
    setRestoringWithCode(true);
    try {
      const result = await restoreWithCode(trimmed);
      if (result === "ok") {
        await completeOnboarding();
        const hasEntitlement = await checkSubscriptionStatus();
        setRevenueCatEntitlement(hasEntitlement);
        navigateToMainApp();
      } else if (result === "invalid_code") {
        Alert.alert("Invalid Code", "We couldn't find a subscription linked to that code. Double-check and try again.");
      } else {
        Alert.alert("Restore Failed", "Something went wrong on our end. Please try again in a moment.");
      }
    } catch {
      Alert.alert("Restore Failed", "Something went wrong. Please try again.");
    } finally {
      setRestoringWithCode(false);
    }
  }, [recoveryCode, completeOnboarding, setRevenueCatEntitlement, navigateToMainApp]);

  const onContinue = useCallback(async () => {
    setIsLoading(true);
    setLoading(true);

    try {
      const selectedPackage = packages[selected];

      if (!selectedPackage) {
        Alert.alert(
          "Package Not Available",
          "The selected package is not available. Please try another plan."
        );
        return;
      }

      setCurrentPackage(selectedPackage);

      // Attempt purchase
      const customerInfo = await purchasePackage(selectedPackage);

      if (!customerInfo) {
        // User cancelled
        return;
      }

      // Complete onboarding BEFORE updating subscription state.
      // This prevents a race where the RevenueCat listener fires and
      // IndexGate sees hasAccess=true but onboarding isn't marked complete.
      await completeOnboarding();

      // Generate recovery code — awaited so it's persisted before user enters app
      await ensureCode().catch(() => {});

      // Update subscription state
      const hasEntitlement = await checkSubscriptionStatus();
      setRevenueCatEntitlement(hasEntitlement);

      // Kick the post-purchase hero workflow. It scores the saved onboarding
      // scan, enqueues the durable potential-face generation, then reveals it.
      const frontal = useOnboarding.getState().scanFrontalUri;
      const side = useOnboarding.getState().scanSideUri;
      if (frontal && side) {
        router.replace({ pathname: "/loading", params: { mode: "onboardingPotentialFace" } });
      } else {
        router.replace("/(tabs)/program");
      }
    } catch (error: any) {
      logger.error("[Paywall] Purchase error:", error);
      if (isMountedRef.current) {
        Alert.alert(
          "Purchase Failed",
          error.message || "An error occurred while processing your purchase. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoading(false);
      }
    }
  }, [selected, packages, setLoading, setCurrentPackage, setRevenueCatEntitlement, completeOnboarding, ensureCode, navigateToMainApp]);

  const onRestorePurchases = useCallback(async () => {
    setIsLoading(true);
    setLoading(true);

    try {
      await restorePurchases();

      // Check if user has entitlement (only updates RevenueCat state, never touches promo)
      const hasEntitlement = await checkSubscriptionStatus();

      // Get fresh promoActivated value from store to avoid stale closure
      const currentPromoActivated = useSubscriptionStore.getState().promoActivated;
      const hasAccess = hasEntitlement || currentPromoActivated;

      if (hasAccess) {
        await completeOnboarding();
        ensureCode().catch(() => {});
        setRevenueCatEntitlement(hasEntitlement);
        navigateToMainApp();
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases associated with your account."
        );
      }
    } catch (error: any) {
      logger.error("[Paywall] Restore error:", error);
      if (isMountedRef.current) {
        Alert.alert(
          "Restore Failed",
          error.message || "Failed to restore purchases. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLoading(false);
      }
    }
  }, [setLoading, setRevenueCatEntitlement, completeOnboarding, navigateToMainApp]);

  const onApplyPromoCode = useCallback(async () => {
    if (!promoCode.trim()) {
      Alert.alert("Enter a Code", "Please enter a promo code.");
      return;
    }

    const success = await activatePromoCode(promoCode);

    if (success) {
      await completeOnboarding();
      navigateToMainApp();
    } else {
      // Get fresh error value from store
      const currentError = useSubscriptionStore.getState().error;
      const errorMessage = currentError || "The promo code you entered is not valid.";
      Alert.alert("Invalid Code", errorMessage);
    }
  }, [promoCode, activatePromoCode, completeOnboarding, navigateToMainApp]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#FFA640", ORANGE]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.flex, containerStyle]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.paywallHero,
              { minHeight: responsive.clampHeight(0.22, 160, 220) },
            ]}
          >
            <Text style={styles.paywallEyebrow}>YOUR PLAN IS READY</Text>
            <Text style={styles.paywallHeroTitle}>Unlock your full analysis.</Text>
          </View>
          <View style={styles.inner}>
            <View style={styles.sheetHandle} />
            <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
            {/* HEADER */}
            <RevealView style={styles.header} delay={80}>
              <View style={styles.socialProofRow}>
                <View style={styles.socialProofPill}>
                  <Text style={styles.socialProofStrong}>2,800+</Text>
                </View>
                <Text style={styles.socialProofText}>
                  men already leveling up
                </Text>
              </View>
              <Text style={styles.title}>
                Your best face is{"\n"}
                <Text style={styles.titleAccent}>already possible.</Text>
              </Text>
              <Text style={styles.subtitle}>
                Know your weaknesses. Fix them with precision. Track every win.
              </Text>
            </RevealView>

            {/* PRICING */}
            <View style={styles.pricingColumn}>
              <PlanCard
                label="Yearly"
                tagline="Best value - commit to the mission"
                price="$49.99"
                period="per year - $0.14/day"
                iconSource={PLAN_ICONS.yearly}
                accent={PLAN_ACCENTS.yearly}
                savings="Save $57 vs monthly"
                selected={selected === "yearly"}
                onPress={() => onSelectPlan("yearly")}
                entranceDelay={190}
                animation={{ scale: yearlyScale, progress: yearlyProgress }}
              />
              <PlanCard
                label="Monthly"
                tagline="Start this month, cancel anytime"
                price="$8.99"
                period="per month"
                iconSource={PLAN_ICONS.monthly}
                accent={PLAN_ACCENTS.monthly}
                badge="Most Popular"
                selected={selected === "monthly"}
                onPress={() => onSelectPlan("monthly")}
                entranceDelay={280}
                animation={{ scale: monthlyScale, progress: monthlyProgress }}
              />
              <PlanCard
                label="Weekly"
                tagline="Try it for a week"
                price="$3.99"
                period="per week"
                iconSource={PLAN_ICONS.weekly}
                accent={PLAN_ACCENTS.weekly}
                selected={selected === "weekly"}
                onPress={() => onSelectPlan("weekly")}
                entranceDelay={370}
                animation={{ scale: weeklyScale, progress: weeklyProgress }}
              />
            </View>

            {/* PRIMARY BUTTON */}
            <RevealView style={styles.primaryButtonWrap} delay={500}>
              <View style={[styles.ctaDepth, isLoading && styles.ctaDepthDisabled]}>
                <Pressable
                  onPress={onContinue}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isLoading }}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    { height: responsive.clamp(56, 48, 62) },
                    pressed && !isLoading && styles.ctaButtonPressed,
                    isLoading && styles.ctaButtonDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={isLoading ? ["#D8D4CF", "#D8D4CF"] : ["#FF9238", ORANGE]}
                    locations={[0, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#7A7A7A" />
                    ) : (
                      <Text style={styles.ctaText}>Start Subscription</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
              <Text style={styles.ctaSubcopy}>Cancel anytime - secure checkout</Text>
            </RevealView>

            <RevealView style={styles.secondaryActions} delay={590}>
              {/* PROMO CODE */}
              <Pressable
                style={({ pressed }) => [
                  styles.fullSecondaryButton,
                  showPromoInput && styles.secondaryButtonActive,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={() => setShowPromoInput(!showPromoInput)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showPromoInput }}
              >
                <Tag size={16} color={showPromoInput ? ORANGE_DARK : "#8A8A8E"} strokeWidth={2.2} />
                <Text style={[styles.secondaryButtonText, showPromoInput && styles.secondaryButtonTextActive]}>
                  Apply promo code
                </Text>
              </Pressable>

              {showPromoInput && (
                <View style={styles.promoSection}>
                  <Text style={styles.inputLabel}>Promo code</Text>
                  <View style={styles.promoInputWrapper}>
                    <TextInput
                      style={styles.promoInput}
                      placeholder="Enter code"
                      placeholderTextColor="#A9A9A9"
                      value={promoCode}
                      onChangeText={setPromoCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.promoApplyButton,
                        pressed && styles.applyButtonPressed,
                        isLoading && styles.applyButtonDisabled,
                      ]}
                      onPress={onApplyPromoCode}
                      disabled={isLoading}
                    >
                      <Text style={styles.promoApplyText}>Apply</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.secondaryRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                    isLoading && styles.secondaryButtonDisabled,
                  ]}
                  onPress={onRestorePurchases}
                  disabled={isLoading}
                  accessibilityRole="button"
                >
                  <RefreshCw size={15} color="#8A8A8E" strokeWidth={2.2} />
                  <Text style={styles.secondaryButtonText}>Restore purchases</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    showRecoveryInput && styles.secondaryButtonActive,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  onPress={() => setShowRecoveryInput(!showRecoveryInput)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showRecoveryInput }}
                >
                  <KeyRound size={15} color={showRecoveryInput ? ORANGE_DARK : "#8A8A8E"} strokeWidth={2.2} />
                  <Text style={[styles.secondaryButtonText, showRecoveryInput && styles.secondaryButtonTextActive]}>
                    Recovery code
                  </Text>
                </Pressable>
              </View>

              {showRecoveryInput && (
                <View style={styles.promoSection}>
                  <Text style={styles.inputLabel}>Recovery code</Text>
                  <View style={styles.promoInputWrapper}>
                    <TextInput
                      style={styles.promoInput}
                      placeholder="XXXX-XXXX-XXXX"
                      placeholderTextColor="#A9A9A9"
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.promoApplyButton,
                        pressed && styles.applyButtonPressed,
                        restoringWithCode && styles.applyButtonDisabled,
                      ]}
                      onPress={onRestoreWithCode}
                      disabled={restoringWithCode}
                    >
                      <Text style={styles.promoApplyText}>
                        {restoringWithCode ? "..." : "Restore"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </RevealView>

            {/* LEGAL */}
            <RevealView style={styles.legal} delay={680}>
              <Text style={styles.legalText}>
                Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
              </Text>
              <View style={styles.legalLinks}>
                <Text style={styles.legalLink}>Terms of Service</Text>
                <Text style={styles.legalSeparator}>•</Text>
                <Pressable onPress={() => WebBrowser.openBrowserAsync("https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999")}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </Pressable>
              </View>
            </RevealView>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
};

export default PaywallScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ORANGE,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
    backgroundColor: ORANGE,
  },
  paywallHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
  },
  paywallEyebrow: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.86)",
    letterSpacing: 0.9,
  },
  paywallHeroTitle: {
    fontFamily: FONT_DIN,
    fontSize: 30,
    lineHeight: 36,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: SP[2],
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D1D1D1",
    marginBottom: SP[4],
  },
  inner: {
    alignItems: "center",
    paddingTop: SP[4],
    paddingHorizontal: SP[5],
    paddingBottom: SP[6],
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  contentColumn: {
    width: "100%",
    alignItems: "center",
  },
  header: {
    width: "100%",
    alignItems: "center",
    marginBottom: SP[5],
  },
  socialProofRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: SP[4],
  },
  socialProofPill: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: ORANGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  socialProofText: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 16,
    color: "#888888",
  },
  socialProofStrong: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 16,
    color: ORANGE_DARK,
  },
  title: {
    fontFamily: FONT_DIN,
    fontSize: 24,
    lineHeight: 30,
    color: "#111111",
    textAlign: "center",
  },
  titleAccent: {
    color: ORANGE,
  },
  subtitle: {
    fontFamily: FONT_DIN,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SP[2],
    color: "#888888",
    textAlign: "center",
    maxWidth: 282,
  },
  pricingColumn: {
    width: "100%",
    gap: 10,
  },
  planCard: {
    width: "100%",
    minHeight: 106,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  planCardSelected: {
    borderWidth: 2,
  },
  planHeader: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  planIconImage: {
    width: 31,
    height: 31,
  },
  planMeta: {
    flex: 1,
    minWidth: 0,
  },
  planBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  planLabel: {
    fontFamily: FONT_DIN,
    fontSize: 16,
    lineHeight: 19,
    color: "#111111",
  },
  planTagline: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 15,
    color: "#9B9B9B",
  },
  planPrice: {
    fontFamily: FONT_DIN,
    fontSize: 23,
    lineHeight: 26,
    color: "#111111",
    textAlign: "right",
  },
  planPeriod: {
    fontFamily: FONT_DIN,
    fontSize: 11,
    lineHeight: 14,
    color: "#9B9B9B",
    textAlign: "right",
  },
  planPriceColumn: {
    alignItems: "center",
    minWidth: 80,
  },
  planBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  planBadgeText: {
    fontFamily: FONT_DIN,
    fontSize: 10,
    lineHeight: 13,
    color: "#27500A",
    textTransform: "uppercase",
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  savingsBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "#EAF3DE",
  },
  savingsText: {
    fontFamily: FONT_DIN,
    fontSize: 10,
    lineHeight: 13,
    color: "#27500A",
  },
  planBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  planDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EDEDED",
    marginBottom: 12,
  },
  expandedFeatureList: {
    gap: 8,
  },
  featureRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#F7F7F7",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FONT_DIN,
    fontSize: 13,
    lineHeight: 16,
    color: "#111111",
  },
  featureSubtitle: {
    fontFamily: FONT_DIN,
    fontSize: 11,
    lineHeight: 13,
    color: "#9B9B9B",
    marginTop: 1,
  },
  primaryButtonWrap: {
    width: "100%",
    marginTop: 18,
  },
  ctaDepth: {
    width: "100%",
    borderRadius: 17,
    backgroundColor: ORANGE_DARK,
    paddingBottom: 3,
    shadowColor: ORANGE,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaDepthDisabled: {
    backgroundColor: "#2A2A2A",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButton: {
    borderRadius: 17,
    overflow: "hidden",
  },
  ctaButtonPressed: {
    transform: [{ translateY: 4 }],
  },
  ctaButtonDisabled: {
    transform: [{ translateY: 0 }],
  },
  ctaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  ctaText: {
    fontFamily: FONT_DIN,
    fontSize: 18,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  ctaSubcopy: {
    fontFamily: FONT_DIN,
    fontSize: 11,
    lineHeight: 16,
    color: "#B5B5B5",
    textAlign: "center",
    marginTop: 8,
  },
  secondaryActions: {
    width: "100%",
    marginTop: 14,
    gap: 8,
  },
  fullSecondaryButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    backgroundColor: "#FAFAFA",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    backgroundColor: "#FAFAFA",
  },
  secondaryButtonActive: {
    borderColor: "#FFD1AA",
    backgroundColor: ORANGE_SOFT,
  },
  secondaryButtonPressed: {
    opacity: 0.75,
  },
  secondaryButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 16,
    color: "#555555",
    textAlign: "center",
  },
  secondaryButtonTextActive: {
    color: ORANGE_DARK,
  },
  inputLabel: {
    fontFamily: FONT_DIN,
    fontSize: 12,
    lineHeight: 16,
    color: "#555555",
    marginBottom: 6,
  },
  promoSection: {
    width: "100%",
  },
  promoInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  promoInput: {
    fontFamily: FONT_DIN,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingHorizontal: 12,
    color: "#111111",
  },
  promoApplyButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    backgroundColor: ORANGE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonPressed: {
    opacity: 0.82,
  },
  applyButtonDisabled: {
    opacity: 0.55,
  },
  promoApplyText: {
    fontFamily: FONT_DIN,
    fontSize: 13,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  legal: {
    width: "100%",
    marginTop: SP[6],
    alignItems: "center",
  },
  legalText: {
    fontFamily: FONT_DIN,
    fontSize: 11,
    lineHeight: 16,
    color: "#A0A0A0",
    textAlign: "center",
    marginBottom: 8,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontFamily: FONT_DIN,
    fontSize: 11,
    color: "#7A7A7A",
    textDecorationLine: "underline",
  },
  legalSeparator: {
    fontSize: 11,
    color: "#C7C7C7",
  },
});
