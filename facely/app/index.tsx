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
  const initialized = useAuthStore((state) => state.initialized);
  const uid = useAuthStore((state) => state.uid);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);
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
    if (status !== "authenticated" || !uid) {
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
        // Treat failure same as timeout — we don't know subscription status,
        // so route to paywall (not splash) to avoid losing returning subscribers.
        if (!cancelled) {
          setSubscriptionCheckTimedOut(true);
        }
      }
    };

    void checkSub();

    return () => {
      cancelled = true;
    };
  }, [status, uid]);

  // Safety timeout: if subscription check hasn't completed within 5 seconds
  // after auth is ready, stop blocking and fall through.
  // This covers both: network failure AND RevenueCat never initializing.
  useEffect(() => {
    if (subscriptionChecked || subscriptionCheckTimedOut || status !== "authenticated") return;
    const timer = setTimeout(() => {
      if (!subscriptionChecked) {
        if (__DEV__) {
          console.warn("[IndexGate] Subscription check timed out after 5s (RC initialized:", isRevenueCatInitialized, ")");
        }
        setSubscriptionCheckTimedOut(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [subscriptionChecked, subscriptionCheckTimedOut, status]);

  // Reset subscription checked state when user changes
  useEffect(() => {
    if (!uid || uid !== lastCheckedUid.current) {
      setSubscriptionChecked(false);
      setSubscriptionCheckTimedOut(false);
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

  // Wait for subscription status before routing — prevents subscribed users from
  // briefly seeing the paywall or being sent to onboarding on a new device.
  if (!subscriptionChecked && !subscriptionCheckTimedOut) {
    return <VideoSplash visible={true} />;
  }

  // Subscribed user — go straight to main app regardless of local onboarding data.
  // (On a reinstall/new device, age/gender won't be in local store but user is paid.)
  if (hasAccess) {
    return <Redirect href="/(tabs)/program" />;
  }

  // RC timed out — we can't confirm subscription status. Don't punish a returning
  // subscriber by sending them through full onboarding. Paywall has Restore Purchases.
  if (subscriptionCheckTimedOut) {
    return <Redirect href="/(onboarding)/paywall" />;
  }

  // RC confirmed no subscription and user hasn't completed onboarding questions.
  // Only send to splash if they're a truly fresh anonymous user (no email).
  // Email users are always returning users — send to paywall so they can restore/subscribe.
  if (!hasCompletedQuestions && !userEmail) {
    return <Redirect href="/(onboarding)/splash" />;
  }

  // User completed onboarding but has no subscription — free tier.
  // Route to the main app (daily tab is free; locked tabs show upgrade gate).
  if (onboardingCompleted) {
    return <Redirect href="/(tabs)/program" />;
  }

  // Completed questions but hasn't finished the full onboarding funnel — go to paywall.
  return <Redirect href="/(onboarding)/paywall" />;
}
