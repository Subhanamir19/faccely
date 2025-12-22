// app/_layout.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import "react-native-reanimated";
import { useRoutineStore } from "../store/routineStore";
import { scheduleDaily } from "../lib/time/nextMidnight";
import { AuthProvider } from "@/providers/AuthProvider";
import { useAuthStore } from "@/store/auth";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });
  const authInitialized = useAuthStore((state) => state.initialized);
  const idToken = useAuthStore((state) => state.idToken);
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey || !clerkPublishableKey.trim()) {
    const msg = "[Clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Set it in env/Expo config.";
    console.error(msg);
    throw new Error(msg);
  }
  if (
    process.env.NODE_ENV === "production" &&
    clerkPublishableKey.trim().startsWith("pk_test_")
  ) {
    const msg =
      "[Clerk] Test publishable key detected in production build. Provide a pk_live_* key via EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.";
    console.error(msg);
    throw new Error(msg);
  }

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  // Midnight rollover refresh
  useEffect(() => {
    const refresh = () => useRoutineStore.getState().refreshDayIndex();
    refresh(); // On app start
    const stop = scheduleDaily(refresh);
    return stop;
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    if (!authInitialized || !idToken) return;
    console.log("ID TOKEN:", useAuthStore.getState().idToken);
  }, [authInitialized, idToken]);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <AuthProvider>
        {fontsLoaded || fontError ? (
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="loading" />
              <Stack.Screen name="reset-onboarding" />
            </Stack>
            <LoadingOverlay />
          </View>
        ) : null}
      </AuthProvider>
    </ClerkProvider>
  );
}
