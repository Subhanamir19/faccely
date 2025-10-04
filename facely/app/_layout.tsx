// C:\SS\facely\app\_layout.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import LoadingOverlay from "../components/ui/LoadingOverlay"; // ← switched to relative path

// keep splash visible until fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // show a solid background while loading to avoid a flash of system font
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#F7EEE9" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <LoadingOverlay />
    </View>
  );
}
