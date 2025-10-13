// app/(onboarding)/edge.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { router } from "expo-router";

import T from "@/components/ui/T";
import GlassBtn from "@/components/ui/GlassBtn";

/** Tokens */
const ACCENT = "#B4F34D";
const BG_TOP = "#000000";
const BG_BOTTOM = "#0B0B0B";
const CARD_FILL = "rgba(18,18,18,0.90)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const SUB = "rgba(160,160,160,0.80)";
const TRACK_BG = "#141414";
const TRACK_BORDER = "#242424";
const DARK_FILL = "#3A3A3A"; // readable vs TRACK_BG on Android

/** Layout */
const { width } = Dimensions.get("window");
const CARD_W = Math.round(width * 0.86);
const BAR_W = 110;
const BAR_H = 220;
const GAP = 40;

/* ---------------- Vertical Stat Bar ---------------- */
type BarProps = {
  topLine1: string;
  topLine2?: string;
  percent: number; // 0..100
  fill: string;
  pctTextColor: string;
  delay?: number;
};

const VerticalStatBar: React.FC<BarProps> = ({
  topLine1,
  topLine2,
  percent,
  fill,
  pctTextColor,
  delay = 150,
}) => {
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
    [progress, trackHeight],
  );

  // Always replay the animation on mount/refresh
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

    return () => {
      animation.stop();
    };
  }, [progress, percent, delay]);

  const onTrackLayout = (e: any) => {
    const h = e?.nativeEvent?.layout?.height || BAR_H;
    if (!h || h === trackHeightRef.current) return;

    trackHeightRef.current = h;
    setTrackHeight(h);
  };

  return (
    <View style={styles.barCol}>
      <T style={styles.barTitle}>{topLine1}</T>
      {topLine2 ? (
        <T
          style={[
            styles.barTitle,
            topLine2 === "Blueprint" ? { color: ACCENT } : null,
          ]}
        >
          {topLine2}
        </T>
      ) : null}

      <View style={styles.barOanduter} onLayout={onTrackLayout}>
        {/* Bottom-anchored fill; only top corners rounded */}
        <Animated.View
          style={[styles.barFill, { backgroundColor: fill }, fillStyle]}
        >
          <View style={styles.pctWrap}>
            <T style={[styles.pctText, { color: pctTextColor }]}>{percent}%</T>
          </View>
        </Animated.View>

        {/* ultra-faint sheen so dark fills read at low % */}
        <View pointerEvents="none" style={styles.fillSheen} />
      </View>
    </View>
  );
};

/* ---------------- Screen ---------------- */
export default function EdgeScreen() {
  const onContinue = useCallback(() => {
    try {
      require("@/store/onboarding").useOnboarding.getState().finish?.();
    } catch {}
    router.replace("/(tabs)/take-picture");
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[BG_TOP, BG_BOTTOM]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* faint diagonal reflection */}
      <LinearGradient
        colors={["#FFFFFF08", "#00000000"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.diagonalReflection}
      />

      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          <T style={styles.header}>You might already be losing your edge...</T>

          {/* Glass card */}
          <BlurView
            intensity={Platform.OS === "android" ? 34 : 45}
            tint="dark"
            style={[styles.card, styles.cardShadow]}
          >
            <View style={[StyleSheet.absoluteFill, styles.cardOverlay]} />
            <View style={styles.cardHairline} />

            <View style={styles.inner}>
              {/* Bars centered */}
              <View style={styles.barsRow}>
                <VerticalStatBar
                  topLine1="Lifestyle"
                  topLine2="Impact"
                  percent={31}
                  fill={DARK_FILL}
                  pctTextColor="#FFFFFF"
                  delay={100}
                />
                <View style={{ width: GAP }} />
                <VerticalStatBar
                  topLine1="Genetic"
                  topLine2="Blueprint"
                  percent={69}
                  fill={ACCENT}
                  pctTextColor="#000000"
                  delay={220}
                />
              </View>

              <T style={styles.caption}>
                Sigma Max gives you a precision-based plan to unlock your
                aesthetic potential.
              </T>
            </View>
          </BlurView>

          {/* CTA */}
          <View style={styles.ctaWrap}>
            <GlassBtn label="Continue" variant="primary" height={56} onPress={onContinue} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

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
    justifyContent: "space-between",
    paddingTop: 28,
    paddingBottom: 24,
  },

  header: {
    width: CARD_W,
    fontSize: 32,
    lineHeight: 38,
    color: TEXT,
    textAlign: "left",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  card: {
    width: CARD_W,
    borderRadius: 32,
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
    backgroundColor: CARD_FILL,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  inner: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  barsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    height: BAR_H + 48,
  },

  // Bars
  barCol: { width: BAR_W, alignItems: "center" },
  barTitle: {
    color: TEXT,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  barOuter: {
    width: BAR_W,
    height: BAR_H,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: TRACK_BG,
    borderWidth: 1,
    borderColor: TRACK_BORDER,
    overflow: "hidden",
    position: "relative",
  },
  barFill: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  fillSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.02)",
  },
  pctWrap: { alignItems: "center", paddingBottom: 10 },
  pctText: {
    fontSize: 18,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  caption: {
    marginTop: 24,
    color: SUB,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },

  ctaWrap: {
    width: CARD_W,
    marginTop: 8,
    flexDirection: "row",
  },
});
