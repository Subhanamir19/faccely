// app/weak-points-preview.tsx
// Dev route for the "Know your weak points" onboarding screen.
// `variant` isolates the pieces while the iOS crash is being tracked down:
//   full (default) | nohaptics | noimage | static | bare

import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import WeakPointsScanScreen from "@/components/onboarding/WeakPointsScanScreen";

export default function WeakPointsPreviewRoute() {
  const router = useRouter();
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  console.log("[WP] route mounted, variant =", variant ?? "full");

  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/dev");

  const bare = variant === "bare";

  return (
    <ErrorBoundary>
      <WeakPointsScanScreen
        showReplay
        onContinue={back}
        noHaptics={bare || variant === "nohaptics" || variant === "static"}
        noImage={bare || variant === "noimage"}
        staticMode={bare || variant === "static"}
        noPills={bare || variant === "nopills"}
        noChrome={bare || variant === "nochrome"}
        noSweep={bare || variant === "nosweep"}
      />
    </ErrorBoundary>
  );
}
