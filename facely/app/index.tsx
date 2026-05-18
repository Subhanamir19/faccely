import React, { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import { useSubscriptionStore } from "@/store/subscription";
import { checkSubscriptionStatus } from "@/lib/revenuecat";
import VideoSplash from "@/components/ui/VideoSplash";

const MIN_SPLASH_DURATION = 2500;
const SUBSCRIPTION_CHECK_TIMEOUT_MS = 8000;
const SUBSCRIPTION_STATUS_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const initialized = useAuthStore((state) => state.initialized);
  const uid = useAuthStore((state) => state.uid);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
  const { hydrate, data: onboardingData } = useOnboarding();
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);

  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  const lastVerifiedAt = useSubscriptionStore((state) => state.lastVerifiedAt);
  const isRevenueCatInitialized = useSubscriptionStore((state) => state.isRevenueCatInitialized);
  const hasAccess = revenueCatEntitlement || promoActivated;

  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(initialized);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [subscriptionCheckTimedOut, setSubscriptionCheckTimedOut] = useState(false);
  const lastCheckedUid = useRef<string | null>(null);

  const hasCompletedQuestions = Boolean(onboardingData?.age && onboardingData?.gender);
  const isFreshAnonymousUser = !hasCompletedQuestions && !userEmail;
  const hasRecentSubscriptionVerification =
    typeof lastVerifiedAt === "number" && Date.now() - lastVerifiedAt < SUBSCRIPTION_STATUS_CACHE_MS;
  const shouldVerifySubscription =
    status === "authenticated" &&
    !!uid &&
    !hasAccess &&
    !isFreshAnonymousUser &&
    !hasRecentSubscriptionVerification;

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
    }, MIN_SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await hydrate();
        const done = useOnboarding.getState().completed;
        useAuthStore.getState().setOnboardingCompletedFromOnboarding(done);
      } finally {
        if (!cancelled) setOnboardingHydrated(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  // Only verify subscription when it can affect routing. Fresh users should
  // start onboarding immediately while RevenueCat initializes in the background.
  useEffect(() => {
    if (!shouldVerifySubscription || !isRevenueCatInitialized) return;
    if (lastCheckedUid.current === uid) return;

    let cancelled = false;

    const checkSub = async () => {
      try {
        const hasEntitlement = await checkSubscriptionStatus();
        if (!cancelled) {
          useSubscriptionStore.getState().setRevenueCatEntitlement(hasEntitlement);
          lastCheckedUid.current = uid;
          setSubscriptionChecked(true);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[IndexGate] Subscription check failed:", error);
        }
        if (!cancelled) {
          setSubscriptionCheckTimedOut(true);
        }
      }
    };

    void checkSub();
    return () => {
      cancelled = true;
    };
  }, [shouldVerifySubscription, isRevenueCatInitialized, uid]);

  // Safety timeout for unknown-access returning users. This prevents a permanent
  // splash if RevenueCat never initializes or cannot answer.
  useEffect(() => {
    if (!shouldVerifySubscription || subscriptionChecked || subscriptionCheckTimedOut) return;

    const timer = setTimeout(() => {
      if (!subscriptionChecked) {
        if (__DEV__) {
          console.warn(
            "[IndexGate] Subscription check timed out after 8s (RC initialized:",
            isRevenueCatInitialized,
            ")",
          );
        }
        setSubscriptionCheckTimedOut(true);
      }
    }, SUBSCRIPTION_CHECK_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [shouldVerifySubscription, subscriptionChecked, subscriptionCheckTimedOut, isRevenueCatInitialized]);

  useEffect(() => {
    if (!uid || uid !== lastCheckedUid.current) {
      setSubscriptionChecked(false);
      setSubscriptionCheckTimedOut(false);
    }
  }, [uid]);

  // If access exists locally after purchase/restore but onboarding completion was
  // not persisted, heal it so the user does not get routed back into onboarding.
  useEffect(() => {
    if (hasAccess && !onboardingCompleted && onboardingHydrated) {
      useOnboarding.getState().finish().catch(() => {});
      useAuthStore.getState().setOnboardingCompletedFromOnboarding(true);
    }
  }, [hasAccess, onboardingCompleted, onboardingHydrated]);

  const isLoading = !initialized || !onboardingHydrated || !minSplashElapsed;

  if (isLoading) {
    return <VideoSplash visible={true} />;
  }

  if (hasAccess) {
    return <Redirect href="/(tabs)/program" />;
  }

  if (isFreshAnonymousUser) {
    return <Redirect href="/(onboarding)/splash" />;
  }

  if (shouldVerifySubscription && !subscriptionChecked && !subscriptionCheckTimedOut) {
    return <VideoSplash visible={true} />;
  }

  return <Redirect href="/(onboarding)/paywall" />;
}
