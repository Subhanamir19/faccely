import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export const APP_SCREEN_BG = "#FEF5E4";
export const APP_SCREEN_GRADIENT_BOTTOM = "#FFE8D2";
export const APP_SCREEN_GRADIENT = {
  colors: ["#FFF8EC", "#FFF1E2", "#FFE8D2"] as [string, string, string],
  locations: [0, 0.52, 1] as [number, number, number],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

type AppGradientBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppGradientBackground({
  children,
  style,
}: AppGradientBackgroundProps) {
  return (
    <LinearGradient
      colors={APP_SCREEN_GRADIENT.colors}
      locations={APP_SCREEN_GRADIENT.locations}
      start={APP_SCREEN_GRADIENT.start}
      end={APP_SCREEN_GRADIENT.end}
      style={[styles.root, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
});
