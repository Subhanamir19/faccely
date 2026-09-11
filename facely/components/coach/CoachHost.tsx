import React from "react";
import { usePathname } from "expo-router";

import { useAuthStore } from "@/store/auth";

import { CoachOrb } from "./CoachOrb";
import { CoachSheet } from "./CoachSheet";

/* ============================================================================
 * Mounts Coach above the navigator.
 *
 * Rendered once in the root layout, outside the Stack, so the button survives
 * navigation and the sheet floats over whatever screen is showing rather than
 * being pushed onto the stack.
 *
 * Nothing renders until the user is signed in and past onboarding. Coach reads
 * scan data and costs money per message; neither is meaningful before then.
 * ========================================================================== */

export function CoachHost() {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);

  if (status !== "authenticated" || !onboardingCompleted) return null;

  return (
    <>
      <CoachOrb />
      <CoachSheet screen={pathname?.split("?")[0] ?? null} />
    </>
  );
}
