// components/onboarding/OnboardingCard.tsx
// Consistent glass card wrapper for all onboarding screens
import React from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  ViewStyle,
  DimensionValue,
} from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, RADII, SP, BLUR, SHADOWS, ELEVATION } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.86);

type OnboardingCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  width?: DimensionValue;
  maxHeight?: DimensionValue;
  blurIntensity?: number;
};

export default function OnboardingCard({
  children,
  style,
  contentStyle,
  width = CARD_WIDTH,
  maxHeight,
  blurIntensity = BLUR.card,
}: OnboardingCardProps) {
  // Map blur px to expo-blur intensity (0-100 scale)
  const intensity = Platform.OS === "android"
    ? Math.min(blurIntensity * 2.5, 50)
    : Math.min(blurIntensity * 3.5, 70);

  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={[
        styles.card,
        { width },
        maxHeight !== undefined && { maxHeight },
        Platform.OS === "ios" ? SHADOWS.cardSubtle : { elevation: ELEVATION.cardAndroid },
        style,
      ]}
    >
      {/* Glass overlay with border */}
      <View style={styles.glassOverlay} pointerEvents="none" />

      {/* Top reflective hairline */}
      <View style={styles.hairline} pointerEvents="none" />

      {/* Inner content */}
      <View style={[styles.inner, contentStyle]}>
        {children}
      </View>
    </BlurView>
  );
}

// Export card width for external use
export const ONBOARDING_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.card,
    overflow: "hidden",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.card,
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.cardHairline,
  },
  inner: {
    paddingHorizontal: SP[6],
    paddingTop: SP[6],
    paddingBottom: SP[6],
  },
});

export { OnboardingCard };
