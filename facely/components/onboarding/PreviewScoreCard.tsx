// components/onboarding/PreviewScoreCard.tsx
// Blurred preview score card to show value before paywall
import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Lock } from "lucide-react-native";

import T from "@/components/ui/T";
import { COLORS, RADII, SP, SHADOWS } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.82);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Sample metrics to show (blurred)
const PREVIEW_METRICS = [
  { label: "Jawline", score: 72 },
  { label: "Symmetry", score: 85 },
  { label: "Cheekbones", score: 68 },
  { label: "Overall", score: 78 },
];

type PreviewScoreCardProps = {
  /** Whether the card is visible/active (triggers animations) */
  active?: boolean;
  /** Optional custom width */
  width?: number;
};

export default function PreviewScoreCard({
  active = true,
  width = CARD_WIDTH,
}: PreviewScoreCardProps) {
  const ringSize = 100;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ringProgress = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.95);

  useEffect(() => {
    if (active) {
      cardOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      cardScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      ringProgress.value = withDelay(
        200,
        withTiming(0.78, { duration: 1000, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [active, cardOpacity, cardScale, ringProgress]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
  }));

  return (
    <Animated.View style={[styles.container, { width }, cardAnimatedStyle]}>
      {/* Card background with gradient */}
      <View style={[styles.card, Platform.OS === "ios" && SHADOWS.cardSubtle]}>
        <LinearGradient
          colors={["rgba(25,25,25,0.95)", "rgba(15,15,15,0.98)"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top section with ring */}
        <View style={styles.topSection}>
          <View style={styles.ringContainer}>
            <Svg width={ringSize} height={ringSize}>
              <Defs>
                <SvgGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={COLORS.accentLight} />
                  <Stop offset="100%" stopColor={COLORS.accent} />
                </SvgGradient>
              </Defs>

              {/* Track */}
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke={COLORS.track}
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Progress */}
              <AnimatedCircle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="url(#scoreGrad)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                animatedProps={ringAnimatedProps}
                strokeLinecap="round"
                rotation="-90"
                originX={ringSize / 2}
                originY={ringSize / 2}
              />
            </Svg>

            {/* Score text (blurred) */}
            <View style={styles.ringCenter}>
              <T variant="h2" color="text">78</T>
              <T variant="small" color="sub">Overall</T>
            </View>
          </View>
        </View>

        {/* Metrics grid (blurred) */}
        <View style={styles.metricsGrid}>
          {PREVIEW_METRICS.slice(0, 3).map((metric) => (
            <View key={metric.label} style={styles.metricItem}>
              <T variant="h4" color="text">{metric.score}</T>
              <T variant="small" color="sub">{metric.label}</T>
            </View>
          ))}
        </View>

        {/* Blur overlay */}
        <BlurView
          intensity={Platform.OS === "android" ? 25 : 40}
          tint="dark"
          style={styles.blurOverlay}
        >
          <View style={styles.lockContainer}>
            <View style={styles.lockCircle}>
              <Lock size={24} color={COLORS.accent} strokeWidth={2.5} />
            </View>
            <T variant="bodySemiBold" color="text" align="center" style={styles.lockText}>
              Unlock your full analysis
            </T>
            <T variant="caption" color="sub" align="center">
              Subscribe to see your detailed scores and personalized recommendations
            </T>
          </View>
        </BlurView>

        {/* Accent glow at bottom */}
        <LinearGradient
          colors={["transparent", `${COLORS.accent}15`]}
          style={styles.bottomGlow}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  card: {
    width: "100%",
    borderRadius: RADII.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    elevation: 8,
  },
  topSection: {
    alignItems: "center",
    paddingTop: SP[8],
    paddingBottom: SP[6],
  },
  ringContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: SP[4],
    paddingBottom: SP[8],
  },
  metricItem: {
    alignItems: "center",
    minWidth: 70,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SP[6],
  },
  lockContainer: {
    alignItems: "center",
    maxWidth: 240,
  },
  lockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(180,243,77,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[4],
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  lockText: {
    marginBottom: SP[2],
  },
  bottomGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
});

export { PreviewScoreCard };
