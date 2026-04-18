// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import UpdateModal from "@/components/ui/UpdateModal";
import { checkForUpdate, type UpdateStatus } from "@/lib/updateCheck";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
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
import { flushSyncQueue, hasMigratedHistory, migrateLocalHistory } from "@/lib/supabase/taskSync";
import { useTasksStore } from "@/store/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ available: false });
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    "Poppins-Regular":  Poppins_400Regular,
    "Poppins-Medium":   Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
  });
  const authInitialized = useAuthStore((state) => state.initialized);
  const idToken = useAuthStore((state) => state.idToken);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setBackgroundColorAsync("#0E0B08");
      void NavigationBar.setButtonStyleAsync("light");
    }
  }, []);

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

  // On auth ready: flush any offline-queued writes, then run one-time history migration
  useEffect(() => {
    if (!authInitialized) return;
    const uid = useAuthStore.getState().uid;
    if (!uid) return;

    void flushSyncQueue(uid).catch(() => {});
    void (async () => {
      try {
        const done = await hasMigratedHistory();
        if (!done) {
          const { today, history } = useTasksStore.getState();
          await migrateLocalHistory(uid, history, today);
        }
      } catch {}
    })();
  }, [authInitialized]);

  useEffect(() => {
    if (!authInitialized || !idToken) return;
    // Only log token presence, never the actual value
    logger.log("[Auth] Token present:", idToken ? `${idToken.slice(0, 10)}...` : "none");
  }, [authInitialized, idToken]);

  // Check for app updates once auth is initialized
  useEffect(() => {
    if (!authInitialized) return;
    checkForUpdate().then(setUpdateStatus).catch(() => {});
  }, [authInitialized]);

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
          <View style={{ flex: 1, backgroundColor: "#0E0B08" }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0E0B08" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="loading" />
              <Stack.Screen name="reset-onboarding" />
            </Stack>
            <LoadingOverlay />
            {updateStatus.available && (
              <UpdateModal
                visible={!updateDismissed}
                latestVersion={updateStatus.latestVersion}
                message={updateStatus.message}
                forced={updateStatus.forced}
                onDismiss={() => setUpdateDismissed(true)}
              />
            )}
          </View>
        ) : null}
      </AuthProvider>
    </ErrorBoundary>
  );
}
