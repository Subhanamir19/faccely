// app/_layout.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import "react-native-reanimated";
import { useRoutineStore } from "../store/routineStore";
import { scheduleDaily } from "../lib/time/nextMidnight";
import { AuthProvider } from "@/providers/AuthProvider";
import { useAuthStore } from "@/store/auth";
import { initializeRevenueCat, addCustomerInfoUpdateListener } from "@/lib/revenuecat";
import { useSubscriptionStore } from "@/store/subscription";
import { logger } from '@/lib/logger';
import ErrorBoundary from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });
  const authInitialized = useAuthStore((state) => state.initialized);
  const idToken = useAuthStore((state) => state.idToken);

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
    if (!authInitialized || !idToken) return;
    // Only log token presence, never the actual value
    logger.log("[Auth] Token present:", idToken ? `${idToken.slice(0, 10)}...` : "none");
  }, [authInitialized, idToken]);

  // Initialize RevenueCat after auth is ready and set up customer info listener
  useEffect(() => {
    if (!authInitialized) return;

    let unsubscribeListener: (() => void) | null = null;

    const initRC = async () => {
      try {
        const uid = useAuthStore.getState().uid;
        await initializeRevenueCat(uid || undefined);

        // After successful initialization, add the customer info listener
        // This handles real-time subscription changes (renewals, expiry, refunds)
        if (useSubscriptionStore.getState().isRevenueCatInitialized) {
          unsubscribeListener = addCustomerInfoUpdateListener();
          logger.log("[Layout] RevenueCat customer info listener added");
        }
      } catch (error) {
        logger.error("[App] Failed to initialize RevenueCat:", error);
      }
    };

    void initRC();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribeListener) {
        unsubscribeListener();
        logger.log("[Layout] RevenueCat customer info listener removed");
      }
    };
  }, [authInitialized]);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
