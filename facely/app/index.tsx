import React from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function IndexGate() {
  const status = useAuthStore((state) => state.status);
  const initialized = useAuthStore((state) => state.initialized);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);

  if (!initialized || status === "checking") {
    return null;
  }

  if (status !== "authenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)/take-picture" />;
}
