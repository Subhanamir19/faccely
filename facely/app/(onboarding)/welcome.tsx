// app/(onboarding)/welcome.tsx
import React, { useCallback, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";

const ACCENT = "#B4F34D";
const BG_TOP = "#000000";
const BG_BOTTOM = "#0B0B0B";
const WHITE = "#FFFFFF";
const TAGLINE = "rgba(255,255,255,0.92)";
const SUBTEXT = "rgba(160,160,160,0.80)";
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
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(1);
  const emblemScale = useSharedValue(reducedMotion ? 1 : 0.96);
  const titleOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const taglineOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const subOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ctaTranslate = useSharedValue(reducedMotion ? 0 : CTA_OFFSET);
  const ctaScale = useSharedValue(1);

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
    router.push({ pathname: "/(onboarding)/age", params: { autofocus: "1" } });
  }, []);

  const handlePressIn = useCallback(() => {
    ctaScale.value = withTiming(0.98, { duration: 80, easing: Easing.linear });
  }, [ctaScale]);

  const handlePressOut = useCallback(() => {
    ctaScale.value = withSpring(1, { damping: 12, stiffness: 220 });
  }, [ctaScale]);

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
    transform: [
      { translateY: ctaTranslate.value },
      { scale: ctaScale.value },
    ],
  }));

  const paddingTop = Math.max(insets.top, 44);
  const paddingBottom = Math.max(insets.bottom, 34);

  return (
    <View style={[styles.screen, { paddingTop, paddingBottom }]}> 
      <LinearGradient
        colors={[BG_TOP, BG_BOTTOM]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.radialGlow} />

      <View style={styles.content}>
        <Animated.View style={[styles.emblemWrap, emblemStyle]}>
          <Animated.View style={[styles.ring, ringStyle]}>
            <LinearGradient
              colors={["rgba(180,243,77,0.18)", "#B4F34D", "rgba(201,250,105,0.75)", "#B4F34D"]}
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
              accessibilityIgnoresInvertColors
              importantForAccessibility="no-hide-descendants"
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
            <Text style={styles.subtext} accessibilityRole="text">
              Advanced AI aesthetics analysis begins here.
            </Text>
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.ctaContainer, ctaStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Begin onboarding"
          accessibilityHint="Navigates to age selection"
          hitSlop={8}
          onPress={handleBegin}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.ctaButton}
        >
          <T style={styles.ctaLabel}>Begin</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: "#000",
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
    color: WHITE,
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
    marginTop: 48,
    width: "100%",
  },
  ctaButton: {
    height: 64,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    width: "100%",
  },
  ctaLabel: {
    fontSize: 18,
    lineHeight: 22,
    color: "#0B0B0B",
    textAlign: "center",
  },
});