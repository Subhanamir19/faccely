// facely/app/index.tsx
import React from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);

  // While AuthProvider is still syncing Clerk → store, don’t fight the splash.
  if (status === "checking") {
    return null;
  }

  if (status === "authenticated") {
    if (onboardingCompleted) {
      return <Redirect href="/(tabs)/take-picture" />;
    }
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // Default: not authenticated → login
  return <Redirect href="/(auth)/login" />;
}
