import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TextStyle,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CommonActions, useNavigation } from "expo-router/react-navigation";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";
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
import { useResponsiveScale } from "@/lib/responsive";
import { PurchasesPackage } from "react-native-purchases";
import { logger } from '@/lib/logger';
import * as WebBrowser from "expo-web-browser";
import { useRecoveryCodeStore } from "@/store/recoveryCode";
import { restoreWithCode } from "@/lib/api/recoveryCodes";

const FONT_REGULAR = "SFProRounded-Regular";
const FONT_SEMIBOLD = "SFProRounded-Semibold";
const FONT_BOLD = "SFProRounded-Bold";
const PLAN_ICONS = {
  yearly: require("../../assets/paywall-icons/yearly.png"),
  monthly: require("../../assets/paywall-icons/monthly.png"),
  weekly: require("../../assets/paywall-icons/weekly.png"),
} as const;
const COACH_IMAGE = require("../../assets/advanced-analysis-coach.png");
const HEADER_TEXT = "Start your glowup today!";
const PARROT_GREEN = "#58CC02";
const PARROT_GREEN_TEXT = "#348000";

const PAYWALL_BENEFITS = [
  "See your complete facial scores and priority fixes",
  "Preview your potential face with personalized guidance",
  "Follow a daily routine and track measurable progress",
] as const;

type PlanKey = "weekly" | "monthly" | "yearly";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

const MascotCrown: React.FC = () => (
  <Svg
    width="100%"
    height="100%"
    viewBox="0 0 220 190"
    fill="none"
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <Defs>
      <SvgLinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE58A" />
        <Stop offset="0.5" stopColor="#F5C54A" />
        <Stop offset="1" stopColor="#D99A25" />
      </SvgLinearGradient>
    </Defs>

    <Path
      d="M81 42 L86 12 L101 28 L110 2 L121 28 L137 12 L141 42 Q111 49 81 42 Z"
      fill="#8E641B"
      opacity="0.16"
      transform="translate(0 2)"
    />
    <Path
      d="M81 42 L86 12 L101 28 L110 2 L121 28 L137 12 L141 42 Q111 49 81 42 Z"
      fill="url(#gold)"
      stroke="#D69B2E"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <Path
      d="M88 36 Q110 42 134 36"
      stroke="#FFF2B9"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.72"
    />
  </Svg>
);

const MascotComposition: React.FC<{
  width: number;
  height: number;
  imageSize: number;
}> = ({ width, height, imageSize }) => {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.965);
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      scale.set(1);
      translateX.set(0);
      rotation.set(0);
      return;
    }

    scale.set(withDelay(
      45,
      withSpring(1, { duration: 360, dampingRatio: 0.9 }),
    ));
    translateX.set(withDelay(
      2450,
      withSequence(
        withTiming(-3, { duration: 55, easing: EASE_IN_OUT }),
        withTiming(3, { duration: 65, easing: EASE_IN_OUT }),
        withTiming(-2, { duration: 60, easing: EASE_IN_OUT }),
        withTiming(2, { duration: 65, easing: EASE_IN_OUT }),
        withTiming(0, { duration: 95, easing: EASE_OUT }),
      ),
    ));
    rotation.set(withDelay(
      2450,
      withSequence(
        withTiming(-1.25, { duration: 55, easing: EASE_IN_OUT }),
        withTiming(1.25, { duration: 65, easing: EASE_IN_OUT }),
        withTiming(-0.75, { duration: 60, easing: EASE_IN_OUT }),
        withTiming(0.75, { duration: 65, easing: EASE_IN_OUT }),
        withTiming(0, { duration: 95, easing: EASE_OUT }),
      ),
    ));

    return () => {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(rotation);
    };
  }, [reduceMotion, rotation, scale, translateX]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { rotate: `${rotation.get()}deg` },
      { scale: scale.get() },
    ],
  }));

  return (
    <Animated.View style={[styles.mascotStage, { width, height }, scaleStyle]}>
      <View style={styles.mascotDecor}>
        <MascotCrown />
      </View>
      <Image
        source={COACH_IMAGE}
        style={[
          styles.coachImage,
          {
            width: imageSize,
            height: imageSize,
            left: (width - imageSize) / 2,
          },
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const TypewriterHeading: React.FC<{
  style?: StyleProp<TextStyle>;
}> = ({ style }) => {
  const reduceMotion = useReducedMotion();
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(
    reduceMotion ? HEADER_TEXT.length : 0,
  );

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCharacterCount(HEADER_TEXT.length);
      return;
    }

    let currentCharacterCount = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      intervalId = setInterval(() => {
        currentCharacterCount += 1;
        setVisibleCharacterCount(currentCharacterCount);

        if (currentCharacterCount >= HEADER_TEXT.length && intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 36);
    }, 85);

    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [reduceMotion]);

  return (
    <Text
      style={style}
      accessibilityRole="header"
      accessibilityLabel={HEADER_TEXT}
    >
      {HEADER_TEXT.slice(0, visibleCharacterCount)}
      <Text style={styles.typewriterReservedText}>
        {HEADER_TEXT.slice(visibleCharacterCount)}
      </Text>
    </Text>
  );
};

const RevealView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, delay = 0, style }) => {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reduceMotion ? 0 : 16);

  useEffect(() => {
    const effectiveDelay = reduceMotion ? 0 : delay;

    opacity.set(withDelay(
      effectiveDelay,
      withTiming(1, {
        duration: reduceMotion ? 150 : 230,
        easing: EASE_OUT,
      }),
    ));

    if (!reduceMotion) {
      translateY.set(withDelay(
        delay,
        withTiming(0, {
          duration: 250,
          easing: EASE_OUT,
        }),
      ));
    }
  }, [delay, opacity, reduceMotion, translateY]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: translateY.get() }],
  }));

  return <Animated.View style={[style, revealStyle]}>{children}</Animated.View>;
};

const BenefitRow: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const reduceMotion = useReducedMotion();
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(reduceMotion ? 1 : 0.78);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(reduceMotion ? 0 : 11);

  useEffect(() => {
    const delay = reduceMotion ? 0 : 260 + index * 50;

    checkOpacity.set(withDelay(
      delay,
      withTiming(1, { duration: reduceMotion ? 150 : 170, easing: EASE_OUT }),
    ));
    textOpacity.set(withDelay(
      delay + (reduceMotion ? 0 : 18),
      withTiming(1, { duration: reduceMotion ? 150 : 220, easing: EASE_OUT }),
    ));

    if (!reduceMotion) {
      checkScale.set(withDelay(
        delay,
        withSpring(1, { duration: 260, dampingRatio: 0.86 }),
      ));
      textTranslateY.set(withDelay(
        delay + 18,
        withTiming(0, { duration: 230, easing: EASE_OUT }),
      ));
    }
  }, [checkOpacity, checkScale, index, reduceMotion, textOpacity, textTranslateY]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.get(),
    transform: [{ scale: checkScale.get() }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.get(),
    transform: [{ translateY: textTranslateY.get() }],
  }));

  return (
    <View style={styles.benefitRow}>
      <Animated.View style={[styles.benefitCheck, checkStyle]}>
        <Check size={18} color={PARROT_GREEN} strokeWidth={3} />
      </Animated.View>
      <Animated.Text style={[styles.benefitText, textStyle]}>{text}</Animated.Text>
    </View>
  );
};

/**
 * Format an amount the same way the store formatted `sample`, so derived
 * figures (per-day, savings) keep the storefront's currency symbol, position
 * and decimal separator. Never hardcode a currency: the store decides it.
 */
function formatLikePriceString(amount: number, sample: string): string {
  const match = sample.match(/[\d][\d\s.,]*/);
  if (!match || match.index == null) return amount.toFixed(2);
  // Trailing space belongs to the suffix ("59,99 €"), not the number.
  const numeric = match[0].replace(/\s+$/, "");
  const prefix = sample.slice(0, match.index);
  const suffix = sample.slice(match.index + numeric.length);
  const trimmed = numeric.trim();
  const usesComma = /,\d{1,2}$/.test(trimmed);
  // Zero-decimal currencies (JPY, KRW) print no fraction — match that.
  const hasFraction = /[.,]\d{1,2}$/.test(trimmed);
  const body = hasFraction
    ? usesComma
      ? amount.toFixed(2).replace(".", ",")
      : amount.toFixed(2)
    : String(Math.round(amount));
  return `${prefix}${body}${suffix}`;
}

const PlanCard: React.FC<{
  label: string;
  tagline: string;
  price: string;
  period: string;
  iconSource: ImageSourcePropType;
  badge?: string;
  savings?: string;
  selected: boolean;
  onPress: () => void;
  entranceDelay: number;
}> = ({ label, tagline, price, period, iconSource, badge, savings, selected, onPress, entranceDelay }) => {
  const reduceMotion = useReducedMotion();
  const entranceOpacity = useSharedValue(0);
  const entranceY = useSharedValue(reduceMotion ? 0 : 17);
  const cardPressScale = useSharedValue(1);
  const gemScale = useSharedValue(selected ? 1.06 : 1);
  const gemRotation = useSharedValue(0);

  useEffect(() => {
    const effectiveDelay = reduceMotion ? 0 : entranceDelay;

    entranceOpacity.set(withDelay(
      effectiveDelay,
      withTiming(1, {
        duration: reduceMotion ? 150 : 220,
        easing: EASE_OUT,
      }),
    ));

    if (!reduceMotion) {
      entranceY.set(withDelay(
        entranceDelay,
        withTiming(0, { duration: 245, easing: EASE_OUT }),
      ));
    }
  }, [entranceDelay, entranceOpacity, entranceY, reduceMotion]);

  useEffect(() => {
    if (!selected) {
      gemScale.set(withTiming(1, { duration: 150, easing: EASE_OUT }));
      gemRotation.set(withTiming(0, { duration: 150, easing: EASE_OUT }));
    }
  }, [gemRotation, gemScale, selected]);

  const animateGem = () => {
    cancelAnimation(gemScale);
    cancelAnimation(gemRotation);

    if (reduceMotion) {
      gemScale.set(withTiming(1.06, { duration: 120, easing: EASE_OUT }));
      return;
    }

    gemScale.set(withSequence(
      withTiming(1.16, { duration: 105, easing: EASE_OUT }),
      withSpring(1.06, { duration: 230, dampingRatio: 0.86 }),
    ));
    gemRotation.set(withSequence(
      withTiming(-7, { duration: 70, easing: EASE_OUT }),
      withTiming(8, { duration: 90, easing: EASE_OUT }),
      withSpring(0, { duration: 210, dampingRatio: 0.9 }),
    ));
  };

  const handlePress = () => {
    animateGem();
    onPress();
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.get(),
    transform: [
      { translateY: entranceY.get() },
      { scale: cardPressScale.get() },
    ],
  }));

  const gemStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${gemRotation.get()}deg` },
      { scale: gemScale.get() },
    ],
  }));

  return (
    <AnimatedPressable
      style={[styles.planCard, selected && styles.planCardSelected, cardStyle]}
      onPress={handlePress}
      onPressIn={() => {
        if (!reduceMotion) {
          cardPressScale.set(withTiming(0.985, { duration: 100, easing: EASE_OUT }));
        }
      }}
      onPressOut={() => {
        if (!reduceMotion) {
          cardPressScale.set(withSpring(1, { duration: 200, dampingRatio: 1 }));
        }
      }}
      pressRetentionOffset={16}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.planHeader}>
        <View style={styles.planGemSlot}>
          <Animated.Image
            source={iconSource}
            style={[styles.planIconImage, gemStyle]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.planMeta}>
          <Text style={[styles.planLabel, selected && styles.planPrimaryTextSelected]}>{label}</Text>
          <Text style={[styles.planTagline, selected && styles.planSecondaryTextSelected]}>{tagline}</Text>
          <View style={styles.planBadgeRow}>
            {badge && (
              <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
                <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>{badge}</Text>
              </View>
            )}
            {savings && (
              <View style={[styles.savingsBadge, selected && styles.planBadgeSelected]}>
                <Text style={[styles.savingsText, selected && styles.planBadgeTextSelected]}>{savings}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.planTrailing}>
          <View style={styles.planPriceColumn}>
            <Text style={[styles.planPrice, selected && styles.planPrimaryTextSelected]}>{price}</Text>
            <Text style={[styles.planPeriod, selected && styles.planSecondaryTextSelected]}>{period}</Text>
          </View>
          <View style={[
            styles.radioDot,
            selected && {
              borderColor: "#FFFFFF",
              backgroundColor: "#FFFFFF",
            },
          ]}>
            {selected && <View style={styles.radioDotInner} />}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
};

const PaywallScreen: React.FC = () => {
  const navigation = useNavigation();
  const responsive = useResponsiveScale();
  const horizontalPadding = responsive.clamp(20, 16, 24);
  const contentMaxWidth = Math.min(560, Math.max(240, responsive.width - horizontalPadding * 2));
  const mascotStageWidth = responsive.clampWidth(0.56, 210, 236);
  const mascotImageSize = responsive.clampWidth(0.39, 146, 162);
  const [selected, setSelected] = useState<PlanKey>("monthly");
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

  // Prices come from the store (RevenueCat product), never from constants —
  // a hardcoded "$49.99" is wrong in every non-USD storefront.
  const pricing = useMemo(() => {
    const placeholder = "…";
    const yearlyProduct = packages.yearly?.product;
    const monthlyProduct = packages.monthly?.product;
    const weeklyProduct = packages.weekly?.product;

    const yearlyPerDay =
      yearlyProduct && yearlyProduct.price > 0
        ? formatLikePriceString(yearlyProduct.price / 365, yearlyProduct.priceString)
        : null;

    const yearlySaving =
      yearlyProduct && monthlyProduct && monthlyProduct.price * 12 > yearlyProduct.price
        ? formatLikePriceString(
            monthlyProduct.price * 12 - yearlyProduct.price,
            yearlyProduct.priceString,
          )
        : null;

    return {
      yearlyPrice: yearlyProduct?.priceString ?? placeholder,
      yearlyPeriod: yearlyPerDay ? `per year - ${yearlyPerDay}/day` : "per year",
      yearlySavings: yearlySaving ? `Save ${yearlySaving} vs monthly` : undefined,
      monthlyPrice: monthlyProduct?.priceString ?? placeholder,
      weeklyPrice: weeklyProduct?.priceString ?? placeholder,
    };
  }, [packages]);

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

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

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

  const onSelectPlan = (plan: PlanKey) => {
    if (Platform.OS === "ios") {
      void Haptics.selectionAsync();
    }
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
        const hasEntitlement = await checkSubscriptionStatus();
        setRevenueCatEntitlement(hasEntitlement);
        if (hasEntitlement) {
          await completeOnboarding();
          navigateToMainApp();
        } else {
          Alert.alert(
            "No Subscription Found",
            "That account is restored, but it has no active subscription. Choose a plan to continue."
          );
        }
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

      const hasEntitlement = await checkSubscriptionStatus();

      if (hasEntitlement) {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          <RevealView style={styles.paywallHero} delay={20}>
            <TypewriterHeading
              style={[
                styles.heroHeading,
                {
                  fontSize: responsive.clamp(24, 22, 26),
                  lineHeight: responsive.clamp(29, 27, 31),
                },
              ]}
            />
            <MascotComposition
              width={mascotStageWidth}
              height={responsive.clamp(174, 164, 188)}
              imageSize={mascotImageSize}
            />
          </RevealView>
          <View style={[styles.inner, { paddingHorizontal: horizontalPadding }]}>
            <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
            {/* CORE BENEFITS */}
            <View style={styles.benefitsSection}>
              {PAYWALL_BENEFITS.map((benefit, index) => (
                <BenefitRow key={benefit} text={benefit} index={index} />
              ))}
            </View>

            {/* PRICING */}
            <View style={styles.pricingColumn}>
              <PlanCard
                label="Yearly"
                tagline="Best value"
                price={pricing.yearlyPrice}
                period={pricing.yearlyPeriod}
                iconSource={PLAN_ICONS.yearly}
                savings={pricing.yearlySavings}
                selected={selected === "yearly"}
                onPress={() => onSelectPlan("yearly")}
                entranceDelay={430}
              />
              <PlanCard
                label="Monthly"
                tagline="Cancel anytime"
                price={pricing.monthlyPrice}
                period="per month"
                iconSource={PLAN_ICONS.monthly}
                badge="Most Popular"
                selected={selected === "monthly"}
                onPress={() => onSelectPlan("monthly")}
                entranceDelay={475}
              />
              <PlanCard
                label="Weekly"
                tagline="Flexible access"
                price={pricing.weeklyPrice}
                period="per week"
                iconSource={PLAN_ICONS.weekly}
                selected={selected === "weekly"}
                onPress={() => onSelectPlan("weekly")}
                entranceDelay={520}
              />
            </View>

            {/* PRIMARY BUTTON */}
            <RevealView style={styles.primaryButtonWrap} delay={570}>
              <View style={[styles.ctaDepth, isLoading && styles.ctaDepthDisabled]}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === "ios") {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    void onContinue();
                  }}
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
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#7A7A7A" />
                  ) : (
                    <Text style={styles.ctaText}>Unlock My Analysis</Text>
                  )}
                </Pressable>
              </View>
              <Text style={styles.ctaSubcopy}>Cancel anytime · Secure checkout</Text>
            </RevealView>

            <RevealView style={styles.footerArea} delay={620}>
              <Text style={styles.legalText}>
                Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
              </Text>
              <View style={styles.footerActions}>
                <View style={styles.footerAction}>
                  <Text style={styles.footerActionText}>Terms</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.footerAction, pressed && styles.footerActionPressed]}
                  onPress={() => {
                    if (Platform.OS === "ios") void Haptics.selectionAsync();
                    void WebBrowser.openBrowserAsync("https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999");
                  }}
                  accessibilityRole="link"
                >
                  <Text style={styles.footerActionText}>Privacy</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.footerAction,
                    showRecoveryInput && styles.footerActionActive,
                    pressed && styles.footerActionPressed,
                  ]}
                  onPress={() => {
                    if (Platform.OS === "ios") void Haptics.selectionAsync();
                    setShowRecoveryInput(!showRecoveryInput);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showRecoveryInput }}
                >
                  <Text style={[styles.footerActionText, showRecoveryInput && styles.footerActionTextActive]}>
                    Recovery code
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.footerAction,
                    pressed && styles.footerActionPressed,
                    isLoading && styles.footerActionDisabled,
                  ]}
                  onPress={() => {
                    if (Platform.OS === "ios") {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    void onRestorePurchases();
                  }}
                  disabled={isLoading}
                  accessibilityRole="button"
                >
                  <Text style={styles.footerActionText}>Restore</Text>
                </Pressable>
              </View>

              {showRecoveryInput && (
                <View style={styles.promoSection}>
                  <Text style={styles.inputLabel}>Recovery code</Text>
                  <Text style={styles.recoveryHint}>
                    Sign back into an account that already has an active subscription.
                  </Text>
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

            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

export default PaywallScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  paywallHero: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  heroHeading: {
    fontFamily: FONT_BOLD,
    color: "#0A0A0A",
    letterSpacing: -0.55,
    textAlign: "center",
  },
  typewriterReservedText: {
    color: "transparent",
  },
  mascotStage: {
    position: "relative",
    alignItems: "center",
  },
  mascotDecor: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
  coachImage: {
    position: "absolute",
    bottom: 0,
    zIndex: 2,
  },
  inner: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  contentColumn: {
    width: "100%",
    alignItems: "center",
  },
  benefitsSection: {
    width: "100%",
    gap: 7,
    marginBottom: 14,
  },
  benefitRow: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  benefitCheck: {
    width: 20,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontFamily: FONT_REGULAR,
    fontSize: 14,
    lineHeight: 19,
    color: PARROT_GREEN_TEXT,
  },
  pricingColumn: {
    width: "100%",
    gap: 8,
  },
  planCard: {
    width: "100%",
    minHeight: 90,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#E1E1E3",
    backgroundColor: "#F3F3F4",
    overflow: "hidden",
  },
  planCardSelected: {
    borderColor: "#0A0A0A",
    backgroundColor: "#0A0A0A",
  },
  planHeader: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  planGemSlot: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  planIconImage: {
    width: 37,
    height: 44,
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
    marginTop: 4,
  },
  planLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 15,
    lineHeight: 19,
    color: "#111111",
  },
  planTagline: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    lineHeight: 16,
    color: "#6D6D72",
  },
  planPrimaryTextSelected: {
    color: "#FFFFFF",
  },
  planSecondaryTextSelected: {
    color: "#C4C4C7",
  },
  planPrice: {
    fontFamily: FONT_BOLD,
    fontSize: 20,
    lineHeight: 23,
    color: "#111111",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  planPeriod: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    lineHeight: 14,
    color: "#6D6D72",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  planTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planPriceColumn: {
    alignItems: "flex-end",
    minWidth: 68,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E3E3E5",
  },
  planBadgeText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 9,
    lineHeight: 12,
    color: "#525257",
    textTransform: "uppercase",
  },
  planBadgeSelected: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  planBadgeTextSelected: {
    color: "#FFFFFF",
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D8D1CA",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0A0A0A",
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E3E3E5",
  },
  savingsText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 9,
    lineHeight: 12,
    color: "#525257",
  },
  primaryButtonWrap: {
    width: "100%",
    marginTop: 14,
  },
  ctaDepth: {
    width: "100%",
    borderRadius: 16,
    borderCurve: "continuous",
  },
  ctaDepthDisabled: {
    opacity: 0.72,
  },
  ctaButton: {
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  ctaButtonDisabled: {
    transform: [{ translateY: 0 }],
    backgroundColor: "#D8D8DA",
  },
  ctaText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 17,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  ctaSubcopy: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    lineHeight: 16,
    color: "#B5B5B5",
    textAlign: "center",
    marginTop: 8,
  },
  footerArea: {
    width: "100%",
    marginTop: 10,
    gap: 10,
  },
  footerActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  footerAction: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 10,
    borderCurve: "continuous",
  },
  footerActionActive: {
    backgroundColor: "#EEEEF0",
  },
  footerActionPressed: {
    opacity: 0.58,
  },
  footerActionDisabled: {
    opacity: 0.42,
  },
  footerActionText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11,
    lineHeight: 15,
    color: "#6F7174",
    textAlign: "center",
  },
  footerActionTextActive: {
    color: "#111111",
  },
  inputLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 12,
    lineHeight: 16,
    color: "#555555",
    marginBottom: 6,
  },
  promoSection: {
    width: "100%",
    marginTop: 2,
  },
  promoInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  promoInput: {
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#E7E1DB",
    paddingHorizontal: 12,
    color: "#111111",
  },
  promoApplyButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 12,
    borderCurve: "continuous",
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
    fontFamily: FONT_SEMIBOLD,
    fontSize: 13,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  recoveryHint: {
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    lineHeight: 16,
    color: "#6F7174",
    marginBottom: 8,
  },
  legalText: {
    fontFamily: FONT_REGULAR,
    fontSize: 11,
    lineHeight: 16,
    color: "#A0A0A0",
    textAlign: "center",
    marginBottom: 8,
  },
});
