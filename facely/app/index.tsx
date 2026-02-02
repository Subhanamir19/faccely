import React, { useEffect, useState, useRef } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import { useSubscriptionStore } from "@/store/subscription";
import { checkSubscriptionStatus } from "@/lib/revenuecat";
import VideoSplash from "@/components/ui/VideoSplash";

const MIN_SPLASH_DURATION = 2500; // 2.5 seconds minimum splash display

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const isAnonymous = useAuthStore((state) => state.isAnonymous);
  const initialized = useAuthStore((state) => state.initialized);
  const uid = useAuthStore((state) => state.uid);
  const { completed, hydrate, data: onboardingData } = useOnboarding();
  // Get both sources of access - promo OR RevenueCat entitlement grants access
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  const isRevenueCatInitialized = useSubscriptionStore((state) => state.isRevenueCatInitialized);
  const hasAccess = revenueCatEntitlement || promoActivated;
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const lastCheckedUid = useRef<string | null>(null);

  // Check if user has completed the onboarding questions (but may not have subscribed yet)
  // If they have age and gender set, they've gone through all the question screens
  const hasCompletedQuestions = Boolean(onboardingData?.age && onboardingData?.gender);

  // Ensure minimum splash duration
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

  // Check subscription status when user authenticates
  useEffect(() => {
    // Only check if authenticated and RevenueCat is ready
    if (status !== "authenticated" || !uid || !isRevenueCatInitialized) {
      return;
    }

    // Don't re-check for the same user
    if (lastCheckedUid.current === uid) {
      return;
    }

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
        // Still mark as checked so we don't block forever
        if (!cancelled) {
          setSubscriptionChecked(true);
        }
      }
    };

    void checkSub();

    return () => {
      cancelled = true;
    };
  }, [status, uid, isRevenueCatInitialized]);

  // Reset subscription checked state when user changes
  useEffect(() => {
    if (!uid || uid !== lastCheckedUid.current) {
      setSubscriptionChecked(false);
    }
  }, [uid]);

  // Wait for auth to be initialized, onboarding hydrated, and minimum splash time
  const isLoading = !initialized || !onboardingHydrated || !minSplashElapsed;

  // Show VideoSplash while checking auth, hydrating onboarding, and during minimum splash time
  if (isLoading) {
    return <VideoSplash visible={true} />;
  }

  // If onboarding questions not completed, go to onboarding first (no auth required yet)
  if (!hasCompletedQuestions) {
    return <Redirect href="/(onboarding)/use-case" />;
  }

  // Questions done - now require auth before paywall
  // This ensures users have a stable identity for subscription recovery
  if (status !== "authenticated" || isAnonymous) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for subscription status to be checked before routing to paywall or main app
  // This prevents users with valid subscriptions from seeing the paywall briefly
  if (!subscriptionChecked && isRevenueCatInitialized) {
    return <VideoSplash visible={true} />;
  }

  // Authenticated but no subscription - go to paywall
  if (!hasAccess) {
    return <Redirect href="/(onboarding)/paywall" />;
  }

  // Onboarding questions done, authenticated, and subscribed - go to main app
  return <Redirect href="/(tabs)/take-picture" />;
}
