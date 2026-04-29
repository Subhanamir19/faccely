// app/(onboarding)/hook.tsx
// Returning-user re-entry hook. Cinematic video on top, white sheet below
// with cascading copy and a black-pill CTA. Mirrors the splash's structure
// so the visual language is consistent for new and returning users alike.

import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Pressable,
  SafeAreaView,
  useWindowDimensions,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const SAGE = "#3F7A2A";

export default function HookScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const videoHeight = Math.round(H * 0.62);

  const headOpacity   = useSharedValue(0);
  const headTranslate = useSharedValue(22);
  const sub1Opacity   = useSharedValue(0);
  const sub2Opacity   = useSharedValue(0);
  const ctaOpacity    = useSharedValue(0);
  const ctaTranslate  = useSharedValue(16);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    headOpacity.value   = withDelay(600,  withTiming(1, { duration: 480, easing: ease }));
    headTranslate.value = withDelay(600,  withTiming(0, { duration: 480, easing: ease }));
    sub1Opacity.value   = withDelay(940,  withTiming(1, { duration: 380, easing: ease }));
    sub2Opacity.value   = withDelay(1160, withTiming(1, { duration: 380, easing: ease }));
    ctaOpacity.value    = withDelay(1400, withTiming(1, { duration: 380, easing: ease }));
    ctaTranslate.value  = withDelay(1400, withTiming(0, { duration: 380, easing: ease }));
  }, []);

  const headStyle = useAnimatedStyle(() => ({
    opacity: headOpacity.value,
    transform: [{ translateY: headTranslate.value }],
  }));
  const sub1Style = useAnimatedStyle(() => ({ opacity: sub1Opacity.value }));
  const sub2Style = useAnimatedStyle(() => ({ opacity: sub2Opacity.value }));
  const ctaStyle  = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Video hero */}
      <View style={[styles.videoWrap, { width: W, height: videoHeight }]}>
        <Video
          source={require("@/assets/first screen onboarding.mp4")}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
        />
        {/* Feather into white sheet for a clean seam */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.4)", COLORS.lightBg]}
          locations={[0.6, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Bottom sheet */}
      <SafeAreaView style={styles.bottom}>
        <Animated.View style={headStyle}>
          <T style={styles.headline}>
            Your potential face{"\n"}already exists.
          </T>
        </Animated.View>

        <Animated.View style={[styles.subWrap, sub1Style]}>
          <T style={styles.sub}>Most people never find their way to it.</T>
        </Animated.View>

        <Animated.View style={[styles.subWrap, sub2Style]}>
          <T style={styles.sub}>
            <T style={styles.brand}>SigmaMax</T>
            {" "}shows you the path.
          </T>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable
            onPress={() => router.replace("/(onboarding)/intro")}
            style={({ pressed }) => [
              styles.cta,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
          >
            <T style={styles.ctaText}>LET'S GO</T>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },

  videoWrap: {
    overflow: "hidden",
  },

  bottom: {
    flex: 1,
    paddingHorizontal: SP[6],
    paddingTop: SP[5],
    paddingBottom: SP[2],
  },
  headline: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(32),
    lineHeight: ms(40),
    letterSpacing: -0.8,
    marginBottom: SP[3],
  },
  subWrap: {
    marginTop: 2,
  },
  sub: {
    color: COLORS.lightSub,
    fontFamily: "Poppins-Regular",
    fontSize: ms(16),
    lineHeight: ms(24),
  },
  brand: {
    color: SAGE,
    fontFamily: FONT_BOLD,
  },

  spacer: { flex: 1 },

  ctaWrap: {
    marginBottom: SP[4],
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
