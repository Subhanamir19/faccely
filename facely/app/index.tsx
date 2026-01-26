import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import { useSubscriptionStore } from "@/store/subscription";
import VideoSplash from "@/components/ui/VideoSplash";

const MIN_SPLASH_DURATION = 2500; // 2.5 seconds minimum splash display

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const { completed, hydrate } = useOnboarding();
  // Get both sources of access - promo OR RevenueCat entitlement grants access
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  const hasAccess = revenueCatEntitlement || promoActivated;
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

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

  const onboardingCompleted = completed;
  // Wait for both: data to be ready AND minimum splash time elapsed
  const isLoading = status !== "authenticated" || !onboardingHydrated || !minSplashElapsed;

  // Show VideoSplash while checking auth, hydrating onboarding, and during minimum splash time
  if (isLoading) {
    return <VideoSplash visible={true} />;
  }

  // If onboarding not completed, go directly to first onboarding screen (skip welcome)
  if (!onboardingCompleted) {
    return <Redirect href="/(onboarding)/use-case" />;
  }

  // If onboarding completed but no access (neither RevenueCat nor promo), go to paywall
  if (onboardingCompleted && !hasAccess) {
    return <Redirect href="/(onboarding)/paywall" />;
  }

  // If onboarding completed and subscribed, go to main app
  return <Redirect href="/(tabs)/take-picture" />;
}
