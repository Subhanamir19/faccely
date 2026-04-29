// app/(onboarding)/splash.tsx
// First impression — cinematic top-half video bleeds into a clean white shelf
// that holds the headline and primary CTA. The contrast (dark video → light
// surface) does the visual heavy-lifting; copy stays in the bold, restrained
// typography of the rest of the app.

import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Pressable,
  useWindowDimensions,
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

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const SAGE = "#3F7A2A";

const VIDEO = require("../../assets/first screen onboarding.mp4");

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // Video occupies top ~52 % so the shelf has room for headline + CTA.
  const videoHeight = Math.round(winH * 0.52);

  // Shelf slides up + fades in, then copy cascades.
  const shelfY       = useSharedValue(40);
  const shelfOpacity = useSharedValue(0);
  const headOpacity  = useSharedValue(0);
  const headY        = useSharedValue(16);
  const subOpacity   = useSharedValue(0);
  const btnOpacity   = useSharedValue(0);
  const btnY         = useSharedValue(12);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    shelfY.value       = withTiming(0, { duration: 520, easing: ease });
    shelfOpacity.value = withTiming(1, { duration: 420, easing: ease });

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
  const headStyle  = useAnimatedStyle(() => ({
    opacity: headOpacity.value,
    transform: [{ translateY: headY.value }],
  }));
  const subStyle   = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const btnStyle   = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnY.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Video zone ───────────────────────────────────────────── */}
      <View style={[styles.videoZone, { height: videoHeight + insets.top }]}>
        <Video
          source={VIDEO}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
        />
        {/* Feather the bottom edge into the white shelf for a clean seam. */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.4)", COLORS.lightBg]}
          locations={[0.55, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Light shelf — overlaps the video edge with a rounded top ── */}
      <Animated.View
        style={[
          styles.shelf,
          shelfStyle,
          { paddingBottom: Math.max(insets.bottom, sh(24)) },
        ]}
      >
        {/* Drag pill */}
        <View style={styles.pill} />

        {/* Headline */}
        <Animated.Text style={[styles.headline, headStyle]}>
          {"There's a face\nunder your face."}
        </Animated.Text>

        {/* Sub-copy — sage accents the brand promise without shouting */}
        <Animated.Text style={[styles.sub, subStyle]}>
          <T style={styles.subBrand}>SigmaMax</T> helps you unlock it.
        </Animated.Text>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <Pressable
            onPress={() => router.replace("/(onboarding)/warmup")}
            style={({ pressed }) => [
              styles.cta,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
          >
            <T style={styles.ctaText}>CONTINUE</T>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },

  videoZone: {
    width: "100%",
    overflow: "hidden",
  },

  shelf: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    marginTop: -RADII.xl, // overlap video edge
    paddingTop: SP[3],
    paddingHorizontal: SP[6],
  },

  // Subtle handle at the top of the shelf
  pill: {
    alignSelf: "center",
    width: ms(36),
    height: ms(4),
    borderRadius: ms(2),
    backgroundColor: COLORS.lightHairline,
    marginBottom: SP[5],
  },

  headline: {
    fontFamily: FONT_BOLD,
    fontSize: ms(36),
    lineHeight: ms(42),
    letterSpacing: -1.0,
    color: COLORS.lightText,
    marginBottom: SP[3],
  },

  sub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(15),
    lineHeight: ms(22),
    color: COLORS.lightSub,
    marginBottom: SP[6],
  },
  subBrand: {
    fontFamily: FONT_BOLD,
    color: SAGE,
  },

  btnWrap: {
    width: "100%",
    marginTop: "auto",
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
