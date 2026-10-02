import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export const APP_SCREEN_BG = "#FFF8EC";

// Warm paper gradient: lighter at the top, slightly deeper at the bottom so the
// glass tab bar has something to read against. APP_SCREEN_BG stays the flat
// fallback for scene/content styles so transitions never flash.
export const APP_SCREEN_GRADIENT = ["#FFFDF9", "#FFF4E2", "#FAE3C2"] as const;
const APP_SCREEN_GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

/** Full-bleed gradient layer for screens that paint their own root View. */
export function AppScreenGradient() {
  return (
    <LinearGradient
      colors={APP_SCREEN_GRADIENT}
      locations={APP_SCREEN_GRADIENT_LOCATIONS}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

type AppGradientBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppGradientBackground({
  children,
  style,
}: AppGradientBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      <AppScreenGradient />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
});
