import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useOnboarding } from "@/store/onboarding";

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

  if (status === "checking" || !onboardingHydrated) {
    return null;
  }

  if (status === "authenticated") {
    if (onboardingCompleted) {
      return <Redirect href="/(tabs)/take-picture" />;
    }
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(auth)/login" />;
}
