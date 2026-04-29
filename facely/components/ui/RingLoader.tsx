// components/ui/RingLoader.tsx
// Shared loader primitive — circular frame with a lime arc tracing its border.
// Three modes:
//   • mascot — app character inside the ring (startup, daily program build)
//   • photo  — user's frontal photo + sweeping scan line (face analysis)
//   • brand  — brand logomark inside the ring (fallback)
// All dimensions derive from the live window so it scales across phones.
import React, { useEffect, useMemo } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sw } from "@/lib/responsive";

const LIME = "#B4F34D";

const MASCOT = require("@/assets/sigmamax-logo-for-splash screen.png");
const BRAND = MASCOT;

export type RingLoaderKind = "mascot" | "photo" | "brand";

export type RingLoaderProps = {
  kind?: RingLoaderKind;
  photoUri?: string | null;
  title?: string;
  subtitle?: string;
  loading?: boolean;
};

export default function RingLoader({
  kind,
  photoUri,
  title,
  subtitle,
  loading = true,
}: RingLoaderProps) {
  const { width: winW, height: winH } = useWindowDimensions();

  // Adaptive sizing — clamp to the smaller axis so the ring never crowds copy.
  const RING_D  = Math.round(Math.min(winW * 0.62, winH * 0.34));
  const STROKE  = Math.max(ms(6), Math.round(RING_D * 0.034));
  const PADDING = Math.round(RING_D * 0.05);
  const INNER   = RING_D - STROKE * 2 - PADDING * 2;
  const RADIUS  = (RING_D - STROKE) / 2;
  const SVG_SIZE = RING_D;

  const resolvedKind: RingLoaderKind =
    kind ?? (photoUri ? "photo" : "mascot");

  // 120° sweep arc — clockwise from -90° (top) — rotates continuously.
  const arcPath = useMemo(() => {
    const cx = SVG_SIZE / 2;
    const cy = SVG_SIZE / 2;
    const sweep = 120;
    const offset = -90;
    const start = polar(cx, cy, RADIUS, offset - sweep / 2);
    const end   = polar(cx, cy, RADIUS, offset + sweep / 2);
    const large = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
  }, [SVG_SIZE, RADIUS]);

  const rotation = useSharedValue(0);
  const scanY    = useSharedValue(0);
  const breathe  = useSharedValue(0);

  useEffect(() => {
    if (!loading) {
      cancelAnimation(rotation);
      cancelAnimation(scanY);
      cancelAnimation(breathe);
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

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scanY);
      cancelAnimation(breathe);
    };
  }, [loading, resolvedKind, rotation, scanY, breathe]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scanLineHeight = Math.max(ms(2.5), 2);
  const scanRange = INNER - scanLineHeight;
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value * scanRange }],
    opacity: 0.5 + Math.sin(scanY.value * Math.PI) * 0.5,
  }));

  const innerScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.012 }],
  }));

  const innerImage = (() => {
    if (resolvedKind === "photo" && photoUri) {
      return (
        <>
          <Image
            source={{ uri: photoUri }}
            style={{ width: INNER, height: INNER }}
            resizeMode="cover"
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                width: INNER,
                height: scanLineHeight,
                top: 0,
              },
              scanStyle,
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={["transparent", LIME, "transparent"]}
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
        style={{ width: INNER * 0.94, height: INNER * 0.94 }}
        resizeMode="contain"
      />
    );
  })();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.center}>
        <View
          style={{
            width: RING_D,
            height: RING_D,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Track ring */}
          <Svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            style={StyleSheet.absoluteFill}
          >
            <Circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RADIUS}
              stroke={COLORS.lightHairline}
              strokeWidth={STROKE}
              fill="none"
            />
          </Svg>

          {/* Animated lime arc */}
          <Animated.View style={[StyleSheet.absoluteFill, arcStyle]}>
            <Svg width={SVG_SIZE} height={SVG_SIZE}>
              <Path
                d={arcPath}
                stroke={LIME}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {/* Inner content */}
          <Animated.View
            style={[
              {
                width: INNER,
                height: INNER,
                borderRadius: INNER / 2,
                overflow: "hidden",
                backgroundColor: COLORS.lightSurface,
                alignItems: "center",
                justifyContent: "center",
              },
              innerScale,
            ]}
          >
            {innerImage}
          </Animated.View>
        </View>

        {(title || subtitle) && (
          <View style={[styles.copy, { marginTop: ms(36) }]}>
            {!!title && (
              <T
                style={[
                  styles.title,
                  { fontSize: ms(22), lineHeight: ms(28) },
                ]}
                accessibilityRole="header"
              >
                {title}
              </T>
            )}
            {!!subtitle && (
              <T
                style={[
                  styles.subtitle,
                  { fontSize: ms(13), marginTop: ms(8) },
                ]}
              >
                {subtitle}
              </T>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sw(SP[6]),
  },
  copy: {
    alignItems: "center",
    maxWidth: "92%",
  },
  title: {
    fontFamily: "ProximaNova-Bold",
    color: COLORS.lightText,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    color: COLORS.lightSub,
    textAlign: "center",
  },
});
