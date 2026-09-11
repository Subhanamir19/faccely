// app/_layout.tsx
import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import UpdateModal from "@/components/ui/UpdateModal";
import { checkForUpdate, type UpdateStatus } from "@/lib/updateCheck";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
// Per-weight subpaths, not the package barrel: the barrel requires every
// weight's .ttf, so all 18 Poppins faces ship for the 3 the app renders.
import { useFonts } from "expo-font";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Fredoka_400Regular } from "@expo-google-fonts/fredoka/400Regular";
import { Fredoka_500Medium } from "@expo-google-fonts/fredoka/500Medium";
import { Fredoka_600SemiBold } from "@expo-google-fonts/fredoka/600SemiBold";
import { Fredoka_700Bold } from "@expo-google-fonts/fredoka/700Bold";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { CoachHost } from "../components/coach/CoachHost";
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
import { APP_SCREEN_BG } from "@/components/layout/AppGradientBackground";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const reduceMotion = useReducedMotion();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ available: false });
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    "Poppins-Regular":  Poppins_400Regular,
    "Poppins-Medium":   Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    "Fredoka-Regular": Fredoka_400Regular,
    "Fredoka-Medium": Fredoka_500Medium,
    "Fredoka-SemiBold": Fredoka_600SemiBold,
    "Fredoka-Bold": Fredoka_700Bold,
    "ProximaNova-Bold": require("../assets/fonts/ProximaNova-Bold.otf"),
    "DuolingoFeather-Bold": require("../assets/fonts/Duolingo Feather Bold.ttf"),
    "DINNextRounded-Regular": require("../assets/fonts/DIN Next Rounded LT W01 Regular.ttf"),
    "DINNextRounded-Bold": require("../assets/fonts/DIN Next Rounded LT W01 Bold.ttf"),
    "SFProRounded-Regular": require("../assets/fonts/SF-Pro-Rounded-Regular.otf"),
    "SFProRounded-Semibold": require("../assets/fonts/SF-Pro-Rounded-Semibold.otf"),
    "SFProRounded-Bold": require("../assets/fonts/SF-Pro-Rounded-Bold.otf"),
    "Baskerville-Italic": require("../assets/fonts/Baskerville Italic.ttf"),
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
        NavigationBar.setStyle("dark");
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
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0E0B08" }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0E0B08" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="loading" />
              <Stack.Screen name="face-map-preview" options={{ animation: reduceMotion ? "none" : "slide_from_right", contentStyle: { backgroundColor: "#F8F7F2" } }} />
              <Stack.Screen name="reset-onboarding" />
              <Stack.Screen
                name="analysis"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: APP_SCREEN_BG } }}
              />
              <Stack.Screen
                name="history/index"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: APP_SCREEN_BG } }}
              />
              <Stack.Screen
                name="score"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#EEF0F1" } }}
              />
              <Stack.Screen
                name="next-focus"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#FFFFFF" } }}
              />
              <Stack.Screen
                name="new-exercises-preview"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#FFFFFF" } }}
              />
              <Stack.Screen
                name="routine"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#0B0B0B" } }}
              />
              <Stack.Screen
                name="ten-by-ten"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#111111" } }}
              />
              <Stack.Screen
                name="sigma"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#000000" } }}
              />
              <Stack.Screen
                name="protocols"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: APP_SCREEN_BG } }}
              />
              <Stack.Screen
                name="_protocols"
                options={{ animation: reduceMotion ? "fade" : "default", contentStyle: { backgroundColor: "#0B0B0B" } }}
              />
            </Stack>
            {/* Above the navigator so the button survives navigation and the
                sheet floats over the current screen instead of pushing onto
                the stack. */}
            <CoachHost />
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
          </GestureHandlerRootView>
        ) : null}
      </AuthProvider>
    </ErrorBoundary>
  );
}
