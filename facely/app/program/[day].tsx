// app/program/[day].tsx
// Legacy route — redirects to the Tasks tab.
// Kept to avoid breaking any deep links. The exercise list now lives in the tab screen.

import { useEffect } from "react";
import { router } from "expo-router";

export default function ProgramDayRedirect() {
  useEffect(() => {
    router.replace("/(tabs)/program");
  }, []);

  return null;
}
