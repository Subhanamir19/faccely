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
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  // Get both sources of access - promo OR RevenueCat entitlement grants access
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  const isRevenueCatInitialized = useSubscriptionStore((state) => state.isRevenueCatInitialized);
  const hasAccess = revenueCatEntitlement || promoActivated;
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  // Skip the minimum splash delay if auth is already initialized (not a cold launch).
  // This avoids a 2.5s delay when navigating back from paywall after purchase.
  const [minSplashElapsed, setMinSplashElapsed] = useState(initialized);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [subscriptionCheckTimedOut, setSubscriptionCheckTimedOut] = useState(false);
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

  // Safety timeout: if subscription check hasn't completed within 5 seconds
  // (e.g. RevenueCat failed to initialize), stop blocking and fall through.
  useEffect(() => {
    if (subscriptionChecked) return;
    const timer = setTimeout(() => {
      if (!subscriptionChecked) {
        if (__DEV__) {
          console.warn("[IndexGate] Subscription check timed out after 5s");
        }
        setSubscriptionCheckTimedOut(true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [subscriptionChecked]);

  // Reset subscription checked state when user changes
  useEffect(() => {
    if (!uid || uid !== lastCheckedUid.current) {
      setSubscriptionChecked(false);
    }
  }, [uid]);

  // Auto-heal: if user has access (paid/promo) but onboarding flag wasn't persisted
  // (e.g. app killed mid-purchase), mark onboarding complete so they're not stuck.
  // This is safe because hasCompletedQuestions (checked later) guarantees the data exists.
  useEffect(() => {
    if (hasAccess && !onboardingCompleted && onboardingHydrated) {
      useOnboarding.getState().finish().catch(() => {});
      useAuthStore.getState().setOnboardingCompletedFromOnboarding(true);
    }
  }, [hasAccess, onboardingCompleted, onboardingHydrated]);

  // Wait for auth to be initialized, onboarding hydrated, and minimum splash time
  const isLoading = !initialized || !onboardingHydrated || !minSplashElapsed;

  // Show VideoSplash while checking auth, hydrating onboarding, and during minimum splash time
  if (isLoading) {
    return <VideoSplash visible={true} />;
  }

  // If onboarding questions not completed, show hook screen first
  if (!hasCompletedQuestions) {
    return <Redirect href="/(onboarding)/hook" />;
  }

  // Questions done - now require auth before paywall
  // This ensures users have a stable identity for subscription recovery
  if (status !== "authenticated" || isAnonymous) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for subscription status to be checked before routing to paywall or main app.
  // This prevents users with valid subscriptions from seeing the paywall briefly.
  // We must wait regardless of whether RevenueCat is initialized yet — otherwise
  // an already-subscribed user could be sent to the paywall before the check runs.
  // However, if RevenueCat never initializes (network issue, etc.), we fall through
  // after the timeout so the user isn't stuck forever.
  if (!subscriptionChecked && !subscriptionCheckTimedOut) {
    return <VideoSplash visible={true} />;
  }

  // Authenticated but no subscription - go to paywall
  if (!hasAccess) {
    return <Redirect href="/(onboarding)/paywall" />;
  }

  // Onboarding questions done, authenticated, and subscribed - go to main app
  // Note: if onboardingCompleted was false, the auto-heal effect above already fixed it
  return <Redirect href="/(tabs)/take-picture" />;
}
