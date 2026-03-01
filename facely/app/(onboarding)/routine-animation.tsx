// app/(onboarding)/routine-animation.tsx
// "Building Your Personalized Routine" animation screen.
// Each item: slides in → circular arc fills around icon → checkmark springs in → next item.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Svg, Circle } from "react-native-svg";
import { router } from "expo-router";

import { useOnboarding } from "@/store/onboarding";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticSuccess } from "@/lib/haptics";

/* =========================================================
   ROUTINE ITEMS — hardcoded
   ========================================================= */
type RoutineItem = {
  key: string;
  label: string;
  sublabel: string;
  iconColor: string;
  iconBg: string;
  symbol: string;
};

const ROUTINE_ITEMS: RoutineItem[] = [
  {
    key: "jaw",
    label: "Jaw & Chin Definition",
    sublabel: "12 exercises added",
    iconColor: "#FFB347",
    iconBg: "rgba(255,179,71,0.15)",
    symbol: "△",
  },
  {
    key: "eye",
    label: "Eye Area Enhancement",
    sublabel: "8 exercises added",
    iconColor: "#C77DFF",
    iconBg: "rgba(199,125,255,0.15)",
    symbol: "◉",
  },
  {
    key: "harmony",
    label: "Facial Harmony",
    sublabel: "10 exercises added",
    iconColor: "#4FC3F7",
    iconBg: "rgba(79,195,247,0.15)",
    symbol: "◎",
  },
  {
    key: "skin",
    label: "Skin & Complexion",
    sublabel: "6 exercises added",
    iconColor: "#57CC99",
    iconBg: "rgba(87,204,153,0.15)",
    symbol: "✦",
  },
  {
    key: "morning",
    label: "Morning Routine",
    sublabel: "5 min daily",
    iconColor: "#FFB347",
    iconBg: "rgba(255,179,71,0.15)",
    symbol: "☀",
  },
  {
    key: "evening",
    label: "Evening Routine",
    sublabel: "10 min daily",
    iconColor: "#4A4E8C",
    iconBg: "rgba(74,78,140,0.15)",
    symbol: "☾",
  },
];

// Arc geometry — circle centered in the 56×56 SVG canvas, radius 25
const ARC_SIZE = 56;
const ARC_RADIUS = 25;
const ARC_CX = ARC_SIZE / 2; // 28
const ARC_CY = ARC_SIZE / 2; // 28
const CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS; // ≈ 157.08

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Timing constants
const ITEM_DELAY = 820;       // ms between each item becoming visible
const SLIDE_DURATION = 270;   // fade + slide duration
const ARC_START_DELAY = 70;   // brief pause before arc begins
const ARC_DURATION = 500;     // arc fill duration
// Time from item visible to checkmark fully sprung ≈ ARC_START_DELAY + ARC_DURATION + ~230ms spring
const ITEM_COMPLETE_MS = ARC_START_DELAY + ARC_DURATION + 250; // ≈ 820ms

/* =========================================================
   ANIMATED ITEM ROW
   ========================================================= */
function RoutineItemRow({
  item,
  visible,
}: {
  item: RoutineItem;
  visible: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  // strokeDashoffset: CIRCUMFERENCE = arc hidden, 0 = arc fully drawn
  const arcOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    if (!visible) return;

    // 1. Slide + fade in (native driver)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Arc fills around the icon (JS driver — SVG prop)
    Animated.timing(arcOffset, {
      toValue: 0,
      duration: ARC_DURATION,
      delay: ARC_START_DELAY,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // 3. Checkmark springs in once arc is complete
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [visible]);

  return (
    <Animated.View
      style={[styles.itemRow, { opacity, transform: [{ translateY }] }]}
    >
      {/* Icon + circular arc */}
      <View style={styles.iconWrapper}>
        {/* SVG arc — absolutely positioned on top of the icon */}
        <Svg
          width={ARC_SIZE}
          height={ARC_SIZE}
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
        >
          {/* Track ring */}
          <Circle
            cx={ARC_CX}
            cy={ARC_CY}
            r={ARC_RADIUS}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2}
            fill="none"
          />
          {/* Animated progress arc */}
          <AnimatedCircle
            cx={ARC_CX}
            cy={ARC_CY}
            r={ARC_RADIUS}
            stroke={COLORS.accent}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={arcOffset}
            strokeLinecap="round"
            // Rotate so arc starts from 12 o'clock
            rotation="-90"
            origin={`${ARC_CX},${ARC_CY}`}
          />
        </Svg>

        {/* The emoji icon, centered inside the wrapper */}
        <View style={[styles.itemIcon, { backgroundColor: item.iconBg }]}>
          <Text style={[styles.itemSymbol, { color: item.iconColor }]}>
            {item.symbol}
          </Text>
        </View>
      </View>

      {/* Label */}
      <View style={styles.itemText}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemSublabel}>{item.sublabel}</Text>
      </View>

      {/* Checkmark */}
      <Animated.View
        style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}
      >
        <Text style={styles.checkMark}>✓</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* =========================================================
   MAIN SCREEN
   ========================================================= */
export default function RoutineAnimationScreen() {
  const insets = useSafeAreaInsets();
  const { finish } = useOnboarding();
  const progress = getProgressForStep("routine-animation");

  const [visibleCount, setVisibleCount] = useState(0);
  const [ctaReady, setCtaReady] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  // Fade header in immediately
  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [headerOpacity]);

  // Stagger items one by one
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    ROUTINE_ITEMS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount((c) => c + 1);
          if (i === ROUTINE_ITEMS.length - 1) {
            // Wait for the last item's full animation (arc + checkmark) before CTA
            setTimeout(() => {
              setCtaReady(true);
              hapticSuccess();
              Animated.timing(ctaOpacity, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start();
            }, ITEM_COMPLETE_MS + 150);
          }
        }, 400 + i * ITEM_DELAY)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [ctaOpacity]);

  const handleContinue = useCallback(async () => {
    if (!ctaReady) return;
    await finish();
    router.replace("/(auth)/login");
  }, [ctaReady, finish]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgTop, "#050508"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.container, { paddingTop: insets.top + SP[3] }]}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <Text style={styles.heading}>We're Building Your{"\n"}Personalized Routine...</Text>
          <Text style={styles.subheading}>
            Finding the best exercises for your unique features
          </Text>
        </Animated.View>

        {/* Items list */}
        <View style={styles.itemList}>
          {ROUTINE_ITEMS.map((item, i) => (
            <RoutineItemRow key={item.key} item={item} visible={i < visibleCount} />
          ))}
        </View>
      </View>

      {/* Sticky CTA */}
      <Animated.View
        style={[
          styles.ctaContainer,
          { paddingBottom: insets.bottom + SP[4], opacity: ctaOpacity },
        ]}
      >
        <View style={styles.ctaDepth}>
          <Pressable
            onPress={handleContinue}
            disabled={!ctaReady}
            style={({ pressed }) => [
              styles.ctaInner,
              { transform: [{ translateY: pressed && ctaReady ? 4 : 0 }] },
            ]}
          >
            <Text style={styles.ctaText}>View My Custom Routine</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* =========================================================
   STYLES
   ========================================================= */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  container: {
    flex: 1,
    paddingHorizontal: SP[5],
  },

  progressTrack: {
    height: 6,
    width: "100%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[5],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },

  header: {
    marginBottom: SP[6],
  },
  heading: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 26,
    lineHeight: 34,
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  subheading: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.5)",
    marginTop: SP[2],
  },

  itemList: {
    gap: SP[3],
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    gap: SP[4],
  },

  // Icon + arc wrapper — sized to fit the SVG overlay
  iconWrapper: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  itemSymbol: {
    fontSize: 17,
  },

  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  itemSublabel: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },

  // Checkmark — now uses the app's accent green
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#0B0B0B",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  ctaContainer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
  ctaDepth: {
    borderRadius: 26,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaInner: {
    borderRadius: 26,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B4F34D",
  },
  ctaText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 17,
    color: "#0B0B0B",
    letterSpacing: -0.2,
  },
});
