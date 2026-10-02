// components/ui/RingLoader.tsx
// Shared loader primitive for analysis and startup states.
// Modelled on the Face ID enrolment ring: a circle of ticks around the
// subject that light up as work progresses, a large title, one line of
// secondary text, and a quiet privacy footnote. No decorative chrome.
// The public API stays small so existing call sites can reuse it.
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { ORANGE_ONBOARDING } from "@/components/onboarding/OrangeOnboardingLayout";
import { ms, sw } from "@/lib/responsive";
import {
  ADVANCED_ANALYSIS_FONT,
  ADVANCED_ANALYSIS_FONT_BOLD,
} from "@/lib/advancedAnalysisIcons";

const ORANGE = ORANGE_ONBOARDING.orange;
const INK = "#050505";
const SECONDARY = "rgba(60,60,67,0.6)"; // iOS secondaryLabel
const TICK_IDLE = "rgba(60,60,67,0.18)";
const PAPER = "#FFFCF7";

const MASCOT = require("@/assets/sigmamax-logo-for-splash screen.png");
const BRAND = MASCOT;

const TICK_COUNT = 72;
// Progress eases toward this ceiling while waiting, then fills on completion.
const WAIT_CEILING = 0.92;
const WAIT_TIME_CONSTANT_MS = 9000;
const TICK_INTERVAL_MS = 120;
// Completion sweep: ~0.1 of the ring every 25ms, so a full fill takes ~250ms.
const FINISH_STEP = 0.1;
const FINISH_INTERVAL_MS = 25;

export type RingLoaderKind = "mascot" | "photo" | "brand";

export type RingLoaderProps = {
  kind?: RingLoaderKind;
  photoUri?: string | null;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  appearance?: "default" | "onboarding";
};

export default function RingLoader({
  kind,
  photoUri,
  title,
  subtitle,
  loading = true,
  appearance = "default",
}: RingLoaderProps) {
  const { width: winW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const ringD = Math.round(Math.min(winW - sw(96), 280));
  const tickLen = Math.round(ringD * 0.055);
  const tickGap = Math.round(ringD * 0.035);
  const faceD = ringD - 2 * (tickLen + tickGap) - 4;

  const resolvedKind: RingLoaderKind =
    kind ?? (photoUri ? "photo" : "mascot");
  const isOnboarding = appearance === "onboarding";

  const progress = useIndeterminateProgress(loading);
  const lit = Math.round(progress * TICK_COUNT);

  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!loading || reduceMotion) {
      cancelAnimation(breathe);
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [loading, reduceMotion, breathe]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.015 }],
  }));

  const center = ringD / 2;
  const outerR = ringD / 2 - 1;
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
    const on = i < lit;
    // Lit ticks grow outward slightly, as in Face ID enrolment.
    const len = on ? tickLen : tickLen * 0.7;
    const r2 = outerR - (tickLen - len);
    const r1 = r2 - len;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return (
      <Line
        key={i}
        x1={center + r1 * cos}
        y1={center + r1 * sin}
        x2={center + r2 * cos}
        y2={center + r2 * sin}
        stroke={on ? ORANGE : TICK_IDLE}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  });

  const inner =
    resolvedKind === "photo" && photoUri ? (
      <Image
        source={{ uri: photoUri }}
        style={{ width: faceD, height: faceD }}
        resizeMode="cover"
      />
    ) : (
      <Image
        source={resolvedKind === "brand" ? BRAND : MASCOT}
        style={{ width: faceD * 0.72, height: faceD * 0.72 }}
        resizeMode="contain"
      />
    );

  const a11yLabel = [title ?? "Loading", subtitle].filter(Boolean).join(". ");

  return (
    <View
      style={[styles.root, { backgroundColor: isOnboarding ? "#FFFFFF" : PAPER }]}
      accessibilityRole="progressbar"
      accessibilityLabel={a11yLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <View style={{ width: ringD, height: ringD }}>
            <Svg width={ringD} height={ringD} style={StyleSheet.absoluteFill}>
              {ticks}
            </Svg>
            <View style={styles.faceSlot}>
              <Animated.View
                style={[
                  styles.face,
                  { width: faceD, height: faceD, borderRadius: faceD / 2 },
                  breatheStyle,
                ]}
              >
                {inner}
              </Animated.View>
            </View>
          </View>

          <View style={[styles.copy, { marginTop: ms(40) }]}>
            {!!title && (
              <T
                style={[styles.title, { fontSize: ms(28), lineHeight: ms(34) }]}
                accessibilityRole="header"
              >
                {title}
              </T>
            )}
            <View style={[styles.subtitleSlot, { height: ms(44), marginTop: ms(8) }]}>
              {!!subtitle && (
                <Animated.View
                  key={subtitle}
                  entering={reduceMotion ? undefined : FadeIn.duration(350)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(200)}
                  style={styles.subtitleInner}
                >
                  <T
                    style={[styles.subtitle, { fontSize: ms(17), lineHeight: ms(22) }]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </T>
                </Animated.View>
              )}
            </View>
          </View>
        </View>

        {resolvedKind === "photo" && (
          <View style={[styles.footnote, { paddingBottom: ms(12) }]}>
            <Ionicons name="lock-closed" size={ms(12)} color={SECONDARY} />
            <T style={[styles.footnoteText, { fontSize: ms(13) }]}>
              Your photos stay private
            </T>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// Time-based progress with no backend signal: eases toward WAIT_CEILING so it
// never stalls visibly or claims to be done early, then fills once loading ends.
function useIndeterminateProgress(loading: boolean) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!loading) {
      // Sweep the remaining ticks in quickly instead of jumping to full.
      const t = setInterval(() => {
        setProgress((p) => {
          const next = Math.min(1, p + FINISH_STEP);
          if (next >= 1) clearInterval(t);
          return next;
        });
      }, FINISH_INTERVAL_MS);
      return () => clearInterval(t);
    }
    startRef.current = Date.now();
    setProgress(0);
    const t = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setProgress(WAIT_CEILING * (1 - Math.exp(-elapsed / WAIT_TIME_CONSTANT_MS)));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loading]);

  return progress;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(24),
    paddingBottom: ms(24),
  },
  faceSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    overflow: "hidden",
    backgroundColor: "#F2F2F7", // iOS systemGray6
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  title: {
    fontFamily: ADVANCED_ANALYSIS_FONT_BOLD,
    color: INK,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  subtitleSlot: {
    width: "100%",
    alignItems: "center",
  },
  subtitleInner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
  },
  subtitle: {
    fontFamily: ADVANCED_ANALYSIS_FONT,
    color: SECONDARY,
    textAlign: "center",
  },
  footnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footnoteText: {
    fontFamily: ADVANCED_ANALYSIS_FONT,
    color: SECONDARY,
  },
});
