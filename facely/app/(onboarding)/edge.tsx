// app/(onboarding)/edge.tsx
// "Losing your edge" screen with animated stat bars
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";

import T from "@/components/ui/T";
import Button from "@/components/ui/Button";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";

const { width } = Dimensions.get("window");
const CARD_W = Math.round(width * 0.86);
const BAR_W = 110;
const BAR_H = 200;
const GAP = 40;

// Vertical stat bar component
type BarProps = {
  topLine1: string;
  topLine2?: string;
  percent: number;
  fill: string;
  pctTextColor: string;
  delay?: number;
};

function VerticalStatBar({
  topLine1,
  topLine2,
  percent,
  fill,
  pctTextColor,
  delay = 150,
}: BarProps) {
  const [trackHeight, setTrackHeight] = useState(BAR_H);
  const trackHeightRef = useRef(BAR_H);
  const progress = useRef(new Animated.Value(0)).current;

  const fillStyle = useMemo(
    () => ({
      height: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, trackHeight],
        extrapolate: "clamp",
      }),
    }),
    [progress, trackHeight]
  );

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, {
        toValue: percent / 100,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, percent, delay]);

  const onTrackLayout = (e: any) => {
    const h = e?.nativeEvent?.layout?.height || BAR_H;
    if (!h || h === trackHeightRef.current) return;
    trackHeightRef.current = h;
    setTrackHeight(h);
  };

  return (
    <View style={styles.barCol}>
      <T variant="captionSemiBold" color="text">
        {topLine1}
      </T>
      {topLine2 && (
        <T
          variant="captionSemiBold"
          color={topLine2 === "Blueprint" ? "accent" : "text"}
        >
          {topLine2}
        </T>
      )}
      <View style={styles.barOuter} onLayout={onTrackLayout}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: fill }, fillStyle]}
        >
          <View style={styles.pctWrap}>
            <T variant="bodySemiBold" style={{ color: pctTextColor }}>
              {percent}%
            </T>
          </View>
        </Animated.View>
        <View pointerEvents="none" style={styles.fillSheen} />
      </View>
    </View>
  );
}

export default function EdgeScreen() {
  const insets = useSafeAreaInsets();
  const progress = getProgressForStep("edge");

  const handleContinue = useCallback(() => {
    router.push("/(onboarding)/trust");
  }, []);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.diagonalReflection}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + SP[6],
            paddingBottom: insets.bottom + SP[6],
          },
        ]}
      >
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Back button */}
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backButton}
        >
          <ChevronLeft size={18} color={COLORS.sub} strokeWidth={2.5} />
          <T variant="captionMedium" color="sub">
            Back
          </T>
        </Pressable>

        {/* Header */}
        <T variant="h1" color="text" style={styles.header}>
          You might already be losing your edge...
        </T>

        {/* Glass card with bars */}
        <BlurView
          intensity={Platform.OS === "android" ? 34 : 45}
          tint="dark"
          style={[styles.card, styles.cardShadow]}
        >
          <View style={[StyleSheet.absoluteFill, styles.cardOverlay]} />
          <View style={styles.cardHairline} />

          <View style={styles.inner}>
            <View style={styles.barsRow}>
              <VerticalStatBar
                topLine1="Lifestyle"
                topLine2="Impact"
                percent={31}
                fill="#3A3A3A"
                pctTextColor={COLORS.text}
                delay={100}
              />
              <View style={{ width: GAP }} />
              <VerticalStatBar
                topLine1="Genetic"
                topLine2="Blueprint"
                percent={69}
                fill={COLORS.accent}
                pctTextColor={COLORS.bgBottom}
                delay={220}
              />
            </View>

            <T variant="caption" color="sub" align="center" style={styles.caption}>
              Sigma Max gives you a precision-based plan to unlock your aesthetic
              potential.
            </T>
          </View>
        </BlurView>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Button label="Continue" onPress={handleContinue} variant="primary" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },

  diagonalReflection: {
    position: "absolute",
    left: -50,
    right: -50,
    top: -80,
    height: 260,
    transform: [{ rotate: "12deg" }],
  },

  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SP[6],
  },

  progressTrack: {
    height: 8,
    width: CARD_W,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: SP[3],
    paddingVertical: SP[1],
    paddingRight: SP[2],
    gap: 2,
  },

  header: {
    width: CARD_W,
    textAlign: "left",
    marginBottom: SP[5],
  },

  card: {
    width: CARD_W,
    borderRadius: RADII.card,
    overflow: "hidden",
  },
  cardShadow: {
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 18 },
        }
      : { elevation: 8 }),
  },
  cardOverlay: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.cardHairline,
  },

  inner: {
    paddingHorizontal: SP[8],
    paddingVertical: SP[10],
    alignItems: "center",
    justifyContent: "center",
  },

  barsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    height: BAR_H + 48,
  },

  barCol: { width: BAR_W, alignItems: "center" },
  barOuter: {
    width: BAR_W,
    height: BAR_H,
    marginTop: SP[3],
    borderRadius: RADII.lg,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#242424",
    overflow: "hidden",
    position: "relative",
  },
  barFill: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopLeftRadius: RADII.lg,
    borderTopRightRadius: RADII.lg,
  },
  fillSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADII.lg,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.02)",
  },
  pctWrap: { alignItems: "center", paddingBottom: SP[3] },

  caption: {
    marginTop: SP[6],
    maxWidth: 280,
  },

  ctaWrap: {
    width: CARD_W,
    marginTop: "auto",
    paddingTop: SP[6],
  },
});
