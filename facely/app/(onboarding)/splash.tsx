// app/(onboarding)/splash.tsx
// First screen — top-half video bleed + dark rounded shelf with copy & CTA.

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import LimeButton from "@/components/ui/LimeButton";
import { COLORS, RADII } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VIDEO = require("../../assets/first screen onboarding.mp4");

const FONT: string = Platform.select({
  ios: "Poppins-SemiBold",
  android: "Poppins-SemiBold",
  default: "Poppins-SemiBold",
}) as string;

const { height: SH } = Dimensions.get("window");
// Video zone = top 52 % of screen
const VIDEO_H = Math.round(SH * 0.52);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SplashScreen() {
  const insets = useSafeAreaInsets();

  // Shelf slides up + fades in
  const shelfY       = useSharedValue(40);
  const shelfOpacity = useSharedValue(0);

  // Copy items stagger inside the shelf
  const headOpacity  = useSharedValue(0);
  const headY        = useSharedValue(16);
  const subOpacity   = useSharedValue(0);
  const btnOpacity   = useSharedValue(0);
  const btnY         = useSharedValue(12);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // Shelf arrives first
    shelfY.value       = withTiming(0,  { duration: 520, easing: ease });
    shelfOpacity.value = withTiming(1,  { duration: 420, easing: ease });

    // Then text cascades in
    headOpacity.value  = withDelay(260, withTiming(1, { duration: 380, easing: ease }));
    headY.value        = withDelay(260, withTiming(0, { duration: 380, easing: ease }));

    subOpacity.value   = withDelay(420, withTiming(1, { duration: 340, easing: ease }));

    btnOpacity.value   = withDelay(580, withTiming(1, { duration: 320, easing: ease }));
    btnY.value         = withDelay(580, withTiming(0, { duration: 320, easing: ease }));
  }, []);

  const shelfStyle = useAnimatedStyle(() => ({
    opacity: shelfOpacity.value,
    transform: [{ translateY: shelfY.value }],
  }));

  const headStyle = useAnimatedStyle(() => ({
    opacity: headOpacity.value,
    transform: [{ translateY: headY.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnY.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Video zone (top half, edge-to-edge) ─────────────────── */}
      <View style={[styles.videoZone, { height: VIDEO_H + insets.top }]}>
        <Video
          source={VIDEO}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
        />
        {/* Gradient feathers the bottom edge into the shelf */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.18)", "#000"]}
          locations={[0.55, 0.8, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Dark shelf (overlaps the video bottom by ~OVERLAP) ──── */}
      <Animated.View
        style={[
          styles.shelf,
          shelfStyle,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        {/* Drag pill */}
        <View style={styles.pill} />

        {/* Headline */}
        <Animated.Text style={[styles.headline, headStyle]}>
          {"There's a face\nunder your face."}
        </Animated.Text>

        {/* Sub-copy */}
        <Animated.Text style={[styles.sub, subStyle]}>
          SigmaMax helps you unlock it.
        </Animated.Text>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <LimeButton
            label="Continue"
            onPress={() => router.replace("/(onboarding)/use-case")}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Video fills top half, edge-to-edge including status bar
  videoZone: {
    width: "100%",
    overflow: "hidden",
  },

  // Shelf: dark card that slides up from below, overlapping the video bottom
  shelf: {
    flex: 1,
    backgroundColor: "#000",
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    marginTop: -RADII.xl,            // pulls up to overlap video edge
    paddingTop: 16,
    paddingHorizontal: 28,
    gap: 0,
    // Thin lime hairline along the top curve
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(180,243,77,0.20)",
  },

  // Subtle drag-handle pill at the top of the shelf
  pill: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 28,
  },

  headline: {
    fontFamily: FONT,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.1,
    color: "#FFFFFF",
    marginBottom: 12,
  },

  sub: {
    fontFamily: FONT,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
    color: COLORS.accent,
    marginBottom: 36,
  },

  btnWrap: {
    width: "100%",
  },
});
