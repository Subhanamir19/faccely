// app/(onboarding)/welcome.tsx
import React, { useCallback, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import Screen from "@/components/layout/Screen";
import { COLORS, SP } from "@/lib/tokens";
import T from "@/components/ui/T";
import LimeButton from "@/components/ui/LimeButton";

const ACCENT = COLORS.accent;
const TAGLINE = "rgba(255,255,255,0.92)";
const SUBTEXT = COLORS.sub;
const CTA_OFFSET = 12;

const FACE = require("@/assets/loading/face-loader.jpg");

const globalTrack =
  typeof globalThis !== "undefined" &&
  (globalThis as { analytics?: { track?: (event: string) => void } }).analytics?.track
    ? (event: string) => {
        try {
          (globalThis as { analytics?: { track?: (event: string) => void } }).analytics?.track?.(event);
        } catch {
          // noop
        }
      }
    : (_event: string) => {};

export default function WelcomeIntroScreen() {
  const reducedMotion = useReducedMotion();

  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(1);
  const emblemScale = useSharedValue(reducedMotion ? 1 : 0.96);
  const titleOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const taglineOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const subOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaTranslate = useSharedValue(reducedMotion ? 0 : CTA_OFFSET);
  const announcedRef = useRef(false);

  useEffect(() => {
    if (!announcedRef.current) {
      announcedRef.current = true;
      try {
        AccessibilityInfo.announceForAccessibility("Welcome to Sigma Max. Begin.");
      } catch {
        // ignore
      }
    }
    globalTrack("welcome_screen_shown");
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      ringRotation.value = 0;
      ringOpacity.value = 1;
      emblemScale.value = 1;
      titleOpacity.value = 1;
      taglineOpacity.value = 1;
      subOpacity.value = 1;
      ctaOpacity.value = 1;
      ctaTranslate.value = 0;
      return;
    }

    ringRotation.value = 0;
    ringRotation.value = withRepeat(
      withTiming(360, {
        duration: 8000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    emblemScale.value = 0.96;
    titleOpacity.value = 0;
    taglineOpacity.value = 0;
    subOpacity.value = 0;
    ctaOpacity.value = 0;
    ctaTranslate.value = CTA_OFFSET;

    emblemScale.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    titleOpacity.value = withDelay(
      160,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
    taglineOpacity.value = withDelay(
      280,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
    subOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
    ctaOpacity.value = withDelay(
      460,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
    ctaTranslate.value = withDelay(
      460,
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
  }, [
    reducedMotion,
    ringOpacity,
    ringRotation,
    emblemScale,
    titleOpacity,
    taglineOpacity,
    subOpacity,
    ctaOpacity,
    ctaTranslate,
  ]);

  const handleBegin = useCallback(() => {
    globalTrack("welcome_screen_begin_tapped");
    router.push("/(onboarding)/use-case");
  }, []);

  const emblemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emblemScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
    opacity: ringOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslate.value }],
  }));

  return (
    <Screen
      scroll
      contentContainerStyle={styles.contentContainer}
      footer={
        <Animated.View style={[styles.ctaContainer, ctaStyle]}>
          <LimeButton label="Begin" onPress={handleBegin} />
        </Animated.View>
      }
    >
      <View pointerEvents="none" style={styles.radialGlow} />

      <View style={styles.content}>
        <Animated.View style={[styles.emblemWrap, emblemStyle]}>
          <Animated.View style={[styles.ring, ringStyle]}>
            <LinearGradient
              colors={[
                "rgba(180,243,77,0.18)",
                "#B4F34D",
                "rgba(201,250,105,0.75)",
                "#B4F34D",
              ]}
              locations={[0, 0.5, 0.75, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ringFill}
            />
          </Animated.View>

          <View style={styles.diskShadow} />
          <View style={styles.disk}>
            <LinearGradient
              colors={["rgba(255,255,255,0.18)", "rgba(0,0,0,0.45)"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={FACE}
              style={styles.face}
              resizeMode="cover"
              accessible={false}
            />
          </View>
        </Animated.View>

        <View style={styles.textStack}>
          <Animated.View style={titleStyle}>
            <T style={styles.title}>SIGMA MAX</T>
          </Animated.View>

          <Animated.View style={taglineStyle}>
            <T style={styles.tagline}>Your face, defined by precision.</T>
          </Animated.View>

          <Animated.View style={subStyle}>
            <Text style={styles.subtext}>
              Advanced AI aesthetics analysis begins here.
            </Text>
          </Animated.View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: SP[6],
    paddingTop: SP[6] + SP[4],
    position: "relative",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  radialGlow: {
    position: "absolute",
    top: "18%",
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(180,243,77,0.16)",
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.6,
  },
  emblemWrap: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: "rgba(180,243,77,0.32)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
  },
  ringFill: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 120,
    opacity: 0.8,
  },
  diskShadow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(0,0,0,0.65)",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  disk: {
    width: 188,
    height: 188,
    borderRadius: 94,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,12,12,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: "100%",
    height: "100%",
  },
  textStack: {
    marginTop: 36,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  tagline: {
    fontSize: 20,
    lineHeight: 26,
    color: TAGLINE,
    textAlign: "center",
    marginTop: 12,
  },
  subtext: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: SUBTEXT,
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
    marginTop: 12,
  },
  ctaContainer: {
    marginTop: SP[6] * 2,
    marginBottom: SP[4],
    width: "100%",
  },
});
