// app/(onboarding)/splash.tsx
// First impression: cinematic top-half video bleeds into a clean white shelf
// that holds the headline and primary CTA. The contrast does the visual work;
// copy stays in the bold, restrained typography of the rest of the app.

import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
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
import { OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";
import { hapticSelection } from "@/lib/haptics";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, useResponsiveScale } from "@/lib/responsive";

const FONT_BOLD = "DINNextRounded-Bold";
const ORANGE = "#FF7900";
const HEADLINE = "There's a face\nunder your face.";
const HAPTIC_EVERY_CHARS = 3;

const VIDEO = require("../../assets/first screen onboarding.mp4");

function useTypedText(value: string, delayMs: number) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");

    let frame: number | null = null;
    let startedAt = 0;
    let lastLength = 0;
    const duration = Math.max(520, value.length * 34);

    const tick = (timestamp: number) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const nextLength = Math.min(value.length, Math.floor(progress * value.length));

      if (nextLength !== lastLength) {
        lastLength = nextLength;
        if (value[nextLength - 1]?.trim() && nextLength % HAPTIC_EVERY_CHARS === 0) {
          hapticSelection();
        }
        setTyped(value.slice(0, nextLength));
      }

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setTyped(value);
      }
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [delayMs, value]);

  return typed;
}

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveScale();
  const typedHeadline = useTypedText(HEADLINE, 300);

  // Video occupies top ~52 % so the shelf has room for headline + CTA.
  const videoHeight = responsive.clampHeight(0.52, 180, 460);

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

      {/* Video zone */}
      <View style={[styles.videoZone, { height: videoHeight + insets.top }]}>
        <Video
          source={VIDEO}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
        />
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.4)", COLORS.lightBg]}
          locations={[0.55, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Light shelf overlaps the video edge with a rounded top. */}
      <Animated.View
        style={[
          styles.shelf,
          shelfStyle,
          { paddingBottom: Math.max(insets.bottom, sh(24)) },
        ]}
      >
        <ScrollView
          style={styles.shelfScroll}
          contentContainerStyle={styles.shelfContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        {/* Drag pill */}
        <View style={styles.pill} />

        {/* Headline */}
        <Animated.View style={[styles.headlineFrame, headStyle]}>
          <Animated.Text style={[styles.headline, styles.headlineMeasure]} accessible={false}>
            {HEADLINE}
          </Animated.Text>
          <Animated.Text style={[styles.headline, styles.headlineTyped]}>
            {typedHeadline}
          </Animated.Text>
        </Animated.View>

        {/* Sub-copy accents the brand promise without shouting. */}
        <Animated.Text style={[styles.sub, subStyle]}>
          <T style={styles.subBrand}>SigmaMax</T> helps you unlock it.
        </Animated.Text>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <OrangePrimaryButton
            label="Continue"
            onPress={() => router.replace("/(onboarding)/random-glowup")}
          />
        </Animated.View>
        </ScrollView>
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
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -24,
    paddingTop: SP[4],
    paddingHorizontal: SP[5],
  },
  shelfScroll: {
    flex: 1,
  },
  shelfContent: {
    flexGrow: 1,
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
    letterSpacing: 0,
    color: COLORS.lightText,
  },
  headlineFrame: {
    position: "relative",
    marginBottom: SP[3],
  },
  headlineMeasure: {
    opacity: 0,
  },
  headlineTyped: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },

  sub: {
    fontFamily: FONT_BOLD,
    fontSize: ms(15),
    lineHeight: ms(22),
    color: COLORS.lightSub,
    marginBottom: SP[6],
  },
  subBrand: {
    fontFamily: FONT_BOLD,
    color: ORANGE,
  },

  btnWrap: {
    width: "100%",
    marginTop: "auto",
  },
});
