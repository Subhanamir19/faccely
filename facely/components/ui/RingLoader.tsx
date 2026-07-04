// components/ui/RingLoader.tsx
// Shared loader primitive for analysis and startup states.
// The public API stays small so existing call sites can reuse it.
import React, { useEffect, useMemo } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { ORANGE_ONBOARDING } from "@/components/onboarding/OrangeOnboardingLayout";
import { SP } from "@/lib/tokens";
import { ms, sw } from "@/lib/responsive";
import {
  ADVANCED_ANALYSIS_FONT,
  ADVANCED_ANALYSIS_FONT_BOLD,
} from "@/lib/advancedAnalysisIcons";

const LIME = "#B4F34D";
const APP_CREAM = "#FEF5E4";
const INK = "#111111";
const WARM_SURFACE = "#FFF9EC";
const WARM_LINE = "rgba(17,17,17,0.10)";

const MASCOT = require("@/assets/sigmamax-logo-for-splash screen.png");
const BRAND = MASCOT;


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
  const { width: winW, height: winH } = useWindowDimensions();

  const sceneW = Math.round(Math.min(winW - sw(32), 360));
  const sceneH = Math.round(Math.min(winH * 0.44, 330));
  const faceD = Math.round(Math.min(sceneW * 0.48, sceneH * 0.53, 176));
  const nodeD = Math.round(Math.min(Math.max(sceneW * 0.17, 52), 66));
  const ringD = faceD + Math.round(nodeD * 0.55);
  const stroke = Math.max(ms(5), Math.round(faceD * 0.035));
  const radius = (ringD - stroke) / 2;
  const svgSize = ringD;

  const resolvedKind: RingLoaderKind =
    kind ?? (photoUri ? "photo" : "mascot");
  const isOnboarding = appearance === "onboarding";
  const accent = isOnboarding ? ORANGE_ONBOARDING.orange : LIME;
  const secondaryAccent = isOnboarding ? ORANGE_ONBOARDING.orangeDark : "#55B7FF";

  const arcPath = useMemo(() => {
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const sweep = 120;
    const offset = -90;
    const start = polar(cx, cy, radius, offset - sweep / 2);
    const end = polar(cx, cy, radius, offset + sweep / 2);
    const large = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
  }, [svgSize, radius]);

  const rotation = useSharedValue(0);
  const scanY = useSharedValue(0);
  const breathe = useSharedValue(0);
  const sweepX = useSharedValue(0);

  useEffect(() => {
    if (!loading) {
      cancelAnimation(rotation);
      cancelAnimation(scanY);
      cancelAnimation(breathe);
      cancelAnimation(sweepX);
      return;
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: 1700, easing: Easing.linear }),
      -1,
      false,
    );

    if (resolvedKind === "photo") {
      scanY.value = 0;
      scanY.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }

    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );

    sweepX.value = 0;
    sweepX.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scanY);
      cancelAnimation(breathe);
      cancelAnimation(sweepX);
    };
  }, [loading, resolvedKind, rotation, scanY, breathe, sweepX]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scanLineHeight = Math.max(ms(2.5), 2);
  const scanRange = faceD - scanLineHeight;
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value * scanRange }],
    opacity: 0.5 + Math.sin(scanY.value * Math.PI) * 0.5,
  }));

  const innerScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.018 }],
  }));

  const tickerSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweepX.value, [0, 1], [-120, 220]) }],
    opacity: interpolate(sweepX.value, [0, 0.18, 0.82, 1], [0, 0.55, 0.55, 0]),
  }));

  const innerImage = (() => {
    if (resolvedKind === "photo" && photoUri) {
      return (
        <>
          <Image
            source={{ uri: photoUri }}
            style={{ width: faceD, height: faceD }}
            resizeMode="cover"
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                width: faceD,
                height: scanLineHeight,
                top: 0,
              },
              scanStyle,
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={["transparent", accent, "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      );
    }

    const source = resolvedKind === "brand" ? BRAND : MASCOT;
    return (
      <Image
        source={source}
        style={{ width: faceD * 0.86, height: faceD * 0.86 }}
        resizeMode="contain"
      />
    );
  })();

  return (
    <View
      style={[styles.root, isOnboarding && styles.onboardingRoot]}
      accessibilityRole="progressbar"
      accessibilityLabel={subtitle ? `${title ?? "Loading"}. ${subtitle}` : title ?? "Loading"}
    >
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <View
            style={[
              styles.scene,
              {
                width: sceneW,
                height: sceneH,
              },
            ]}
          >
            <Svg
              width={sceneW}
              height={sceneH}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <RadialGradient id="surfaceGlow" cx="50%" cy="46%" r="54%">
                  <Stop offset="0%" stopColor={accent} stopOpacity="0.16" />
                  <Stop offset="58%" stopColor={accent} stopOpacity="0.05" />
                  <Stop offset="100%" stopColor={accent} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={sceneW / 2} cy={sceneH * 0.48} r={sceneW * 0.43} fill="url(#surfaceGlow)" />
              {[0.2, 0.36, 0.52, 0.68, 0.84].map((x) => (
                <Line
                  key={`v-${x}`}
                  x1={sceneW * x}
                  y1={sceneH * 0.12}
                  x2={sceneW * x}
                  y2={sceneH * 0.84}
                  stroke={WARM_LINE}
                  strokeWidth={1}
                />
              ))}
              {[0.2, 0.36, 0.52, 0.68, 0.84].map((y) => (
                <Line
                  key={`h-${y}`}
                  x1={sceneW * 0.08}
                  y1={sceneH * y}
                  x2={sceneW * 0.92}
                  y2={sceneH * y}
                  stroke={WARM_LINE}
                  strokeWidth={1}
                />
              ))}
            </Svg>

            <View
              style={[
                styles.ringStage,
                {
                  width: ringD,
                  height: ringD,
                  marginTop: Math.round(sceneH * 0.08),
                },
              ]}
            >
              <Svg
                width={svgSize}
                height={svgSize}
                style={StyleSheet.absoluteFill}
              >
                <Circle
                  cx={svgSize / 2}
                  cy={svgSize / 2}
                  r={radius}
                  stroke={isOnboarding ? ORANGE_ONBOARDING.border : "rgba(17,17,17,0.08)"}
                  strokeWidth={stroke}
                  fill="none"
                />
                <Circle
                  cx={svgSize / 2}
                  cy={svgSize / 2}
                  r={Math.max(radius - stroke * 2.2, 1)}
                  stroke={isOnboarding ? "rgba(189,91,36,0.14)" : "rgba(17,17,17,0.06)"}
                  strokeWidth={1.2}
                  strokeDasharray={`${Math.round(stroke * 1.5)} ${Math.round(stroke * 1.8)}`}
                  fill="none"
                />
              </Svg>

              <Animated.View style={[StyleSheet.absoluteFill, arcStyle]}>
                <Svg width={svgSize} height={svgSize}>
                  <Path
                    d={arcPath}
                    stroke={accent}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </Animated.View>

              <Animated.View
                style={[
                  styles.innerPhoto,
                  {
                    width: faceD,
                    height: faceD,
                    borderRadius: faceD / 2,
                    borderColor: isOnboarding
                      ? ORANGE_ONBOARDING.border
                      : "rgba(255,255,255,0.86)",
                  },
                  innerScale,
                ]}
              >
                {innerImage}
              </Animated.View>
            </View>
          </View>

          {(title || subtitle) && (
            <View style={[styles.copy, { marginTop: ms(26) }]}>
              {!!title && (
                <T
                  style={[
                    styles.title,
                    isOnboarding && styles.onboardingTitle,
                    { fontSize: ms(23), lineHeight: ms(30) },
                  ]}
                  accessibilityRole="header"
                >
                  {title}
                </T>
              )}
              {!!subtitle && (
                <View
                  style={[
                    styles.ticker,
                    isOnboarding && styles.onboardingTicker,
                    { marginTop: ms(12) },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.tickerSweep, tickerSweepStyle]}
                  >
                    <LinearGradient
                      colors={["transparent", "rgba(255,255,255,0.82)", "transparent"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  <View style={[styles.liveDot, { backgroundColor: accent }]} />
                  <T
                    style={[
                      styles.subtitle,
                      isOnboarding && styles.onboardingSubtitle,
                      { fontSize: ms(13) },
                    ]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </T>
                </View>
              )}
              <View style={styles.signalRows} pointerEvents="none">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.signalTrack}>
                    <SignalSweep index={i} accent={i === 1 ? secondaryAccent : accent} loading={loading} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function SignalSweep({
  index,
  accent,
  loading,
}: {
  index: number;
  accent: string;
  loading: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!loading) {
      cancelAnimation(progress);
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1500 + index * 260,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );

    return () => cancelAnimation(progress);
  }, [index, loading, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-92, 130]) },
      { scaleX: interpolate(progress.value, [0, 0.45, 1], [0.45, 1, 0.55]) },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.82, 1], [0, 0.85, 0.75, 0]),
  }));

  return (
    <Animated.View
      style={[
        styles.signalFill,
        {
          backgroundColor: accent,
        },
        style,
      ]}
    />
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_CREAM,
  },
  onboardingRoot: {
    backgroundColor: ORANGE_ONBOARDING.surface,
  },
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(SP[5]),
    paddingBottom: ms(16),
  },
  scene: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringStage: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerPhoto: {
    overflow: "hidden",
    backgroundColor: WARM_SURFACE,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 9,
  },
  copy: {
    alignItems: "center",
    width: "100%",
    maxWidth: 330,
  },
  title: {
    fontFamily: ADVANCED_ANALYSIS_FONT_BOLD,
    color: INK,
    textAlign: "center",
    letterSpacing: 0,
  },
  ticker: {
    minHeight: ms(42),
    width: "100%",
    borderRadius: ms(21),
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
    overflow: "hidden",
    paddingHorizontal: ms(15),
    paddingVertical: ms(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
  },
  tickerSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 90,
  },
  liveDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
  },
  subtitle: {
    flexShrink: 1,
    fontFamily: ADVANCED_ANALYSIS_FONT,
    color: "#4B4B4B",
    textAlign: "center",
    letterSpacing: 0,
  },
  signalRows: {
    width: "78%",
    marginTop: ms(16),
    gap: ms(6),
  },
  signalTrack: {
    height: ms(4),
    borderRadius: ms(2),
    backgroundColor: "rgba(17,17,17,0.08)",
    overflow: "hidden",
  },
  signalFill: {
    width: 78,
    height: "100%",
    borderRadius: ms(2),
  },
  onboardingTitle: {
    fontFamily: ORANGE_ONBOARDING.font,
    color: ORANGE_ONBOARDING.text,
  },
  onboardingTicker: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderColor: ORANGE_ONBOARDING.border,
  },
  onboardingSubtitle: {
    fontFamily: ORANGE_ONBOARDING.font,
    color: ORANGE_ONBOARDING.muted,
  },
});
