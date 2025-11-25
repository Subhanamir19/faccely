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
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

  useEffect(() => {
    if ((fontsLoaded || fontError) && authInitialized) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, authInitialized]);

  // Midnight rollover refresh
  useEffect(() => {
    const refresh = () => useRoutineStore.getState().refreshDayIndex();
    refresh(); // On app start
    const stop = scheduleDaily(refresh);
    return stop;
  }, []);

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
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
