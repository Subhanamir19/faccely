import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";
import VideoSplash from "@/components/ui/VideoSplash";

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const { completed, hydrate } = useOnboarding();
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);

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
  const isLoading = status !== "authenticated" || !onboardingHydrated;

  // Show VideoSplash while checking auth and hydrating onboarding
  if (isLoading) {
    return <VideoSplash visible={true} />;
  }

  if (onboardingCompleted) {
    return <Redirect href="/(tabs)/take-picture" />;
  }
  return <Redirect href="/(onboarding)/welcome" />;
}
