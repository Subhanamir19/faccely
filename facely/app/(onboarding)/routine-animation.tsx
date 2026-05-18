// app/(onboarding)/routine-animation.tsx
// "Building Your Personalized Routine" — each card glows while its arc fills,
// cycling AI status text makes the screen feel genuinely alive.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Svg, Circle, Path, Line, Ellipse } from "react-native-svg";
import { router } from "expo-router";
import Reanimated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from "react-native-reanimated";

import { useOnboarding } from "@/store/onboarding";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticSuccess } from "@/lib/haptics";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — progress, arcs, tint, check chip
const LIME_BORDER_RGBA = "180,243,77"; // matches LIME, used in animated border interpolations

/* ── Hand-drawn SVG icons ────────────────────────────────────
   Same illustrated style as building-plan.tsx for visual
   consistency across the onboarding flow.
   ─────────────────────────────────────────────────────────── */
const S = 26;

function JawlineIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Path
        d="M 13 3 C 19 3 22 7 22 12 C 22 18 19 22 13 23 C 7 22 4 18 4 12 C 4 7 7 3 13 3 Z"
        fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"
      />
      <Path
        d="M 6 18 L 9 22 L 13 23 L 17 22 L 20 18"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <Ellipse cx="13" cy="23" rx="1" ry="1" fill={color} />
    </Svg>
  );
}

function EyeAreaIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Path
        d="M 2 13 C 5 7 9 5 13 5 C 17 5 21 7 24 13 C 21 19 17 21 13 21 C 9 21 5 19 2 13 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <Circle cx="13" cy="13" r="3.5" fill="none" stroke={color} strokeWidth="1.5" />
      <Circle cx="13" cy="13" r="1" fill={color} />
      <Line x1="13" y1="2"   x2="13" y2="4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="9.5" y1="3"  x2="10.5" y2="5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="16.5" y1="3" x2="15.5" y2="5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

function HarmonyIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Path d="M 13 3 C 8 3 4 7 4 13 C 4 19 7 23 13 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M 13 3 C 18 3 22 7 22 13 C 22 19 19 23 13 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="13" y1="2"  x2="13" y2="24" stroke={color} strokeWidth="1"   strokeDasharray="2,2" opacity="0.8" />
      <Line x1="6"  y1="9"  x2="20" y2="9"  stroke={color} strokeWidth="0.8" opacity="0.5" />
      <Line x1="6"  y1="15" x2="20" y2="15" stroke={color} strokeWidth="0.8" opacity="0.5" />
    </Svg>
  );
}

function SkinIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Path
        d="M 13 4 C 13 4 20 13 20 17 A 7 7 0 0 1 6 17 C 6 13 13 4 13 4 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <Line x1="19"   y1="4"   x2="19"   y2="9"   stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16.5" y1="6.5" x2="21.5" y2="6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M 10 14 Q 11 12 12 13" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}

function MorningIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Line x1="2"  y1="18" x2="24" y2="18" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Path d="M 5 18 A 8 8 0 0 1 21 18" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="13" y1="2"  x2="13" y2="5"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="5"  y1="6"  x2="7"  y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="21" y1="6"  x2="19" y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="2"  y1="11" x2="4"  y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <Line x1="24" y1="11" x2="22" y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

function ProtocolStackIcon({ color }: { color: string }) {
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26">
      <Path d="M 4 8 L 13 4 L 22 8 L 13 12 Z" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M 4 13 L 13 17 L 22 13" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <Path d="M 4 18 L 13 22 L 22 18" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15">
      <Path
        d="M 2.5 7.5 L 6 11 L 12.5 4"
        fill="none" stroke="#0B0B0B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── Routine items ───────────────────────────────────────────── */
type RoutineItem = {
  key: string;
  label: string;
  sublabel: string;
  color: string;
  Icon: React.ComponentType<{ color: string }>;
};

const ROUTINE_ITEMS: RoutineItem[] = [
  { key: "jaw",       label: "Jawline Training",         sublabel: "Structural jaw exercises",    color: "#FF8C42", Icon: JawlineIcon       },
  { key: "eye",       label: "Eye Area & Symmetry",      sublabel: "Orbital & lid work",          color: "#9B72F2", Icon: EyeAreaIcon       },
  { key: "harmony",   label: "Cheekbone & Structure",    sublabel: "Midface definition work",     color: "#4FC3F7", Icon: HarmonyIcon       },
  { key: "skin",      label: "Skin & Complexion",        sublabel: "Skincare protocols",          color: "#34D399", Icon: SkinIcon          },
  { key: "protocols", label: "Daily Protocol Stack",     sublabel: "Lifestyle & habit protocols", color: "#F59E0B", Icon: ProtocolStackIcon },
];

/* ── AI status text cycle ────────────────────────────────────── */
const STATUS_TEXTS = [
  "Calibrating exercises to your facial structure…",
  "Mapping jaw angles & chin projection…",
  "Analyzing eye area & orbital symmetry…",
  "Checking skin quality & complexion needs…",
  "Selecting your daily habit protocols…",
  "Finalizing your personalized plan…",
  "Your routine is ready ✓",
] as const;

/* ── Arc geometry ────────────────────────────────────────────── */
const ARC_SIZE       = 56;
const ARC_RADIUS     = 25;
const ARC_CX         = ARC_SIZE / 2;
const ARC_CY         = ARC_SIZE / 2;
const CIRCUMFERENCE  = 2 * Math.PI * ARC_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ── Timing ──────────────────────────────────────────────────── */
const ITEM_DELAY      = 820;  // ms between each card's entrance
const ARC_START_DELAY = 80;   // brief pause before arc begins
const ARC_DURATION    = 500;  // arc fill duration
// Total time from a card appearing to its checkmark: ARC_START_DELAY + ARC_DURATION + spring ≈ 820ms

/* ── Item row ────────────────────────────────────────────────── */
function RoutineItemRow({
  item,
  index,
  onDone,
}: {
  item: RoutineItem;
  index: number;
  onDone: () => void;
}) {
  // SVG arc still uses old Animated — animating a native SVG prop requires JS driver
  const arcOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  // Reanimated handles all visual state: glow, tint, checkmark
  const glowValue  = useSharedValue(0); // 0 = idle, 1 = scanning, 0.12 = done
  const tintValue  = useSharedValue(0); // opacity multiplier for lime tint overlay
  const checkScale = useSharedValue(0);

  const cardDelay = 400 + index * ITEM_DELAY;

  useEffect(() => {
    // Wait until the card's FadeInDown entrance has started, then activate
    const timer = setTimeout(() => {
      glowValue.value = withTiming(1, { duration: 300 });
      tintValue.value = withTiming(1, { duration: 300 });

      Animated.timing(arcOffset, {
        toValue: 0,
        duration: ARC_DURATION,
        delay: ARC_START_DELAY,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        // Arc complete → spring checkmark in, soften glow
        checkScale.value = withSpring(1, { damping: 8, stiffness: 200 });
        glowValue.value  = withTiming(0.12, { duration: 600 });
        tintValue.value  = withTiming(0.28, { duration: 600 });
        onDone();
      });
    }, cardDelay);

    return () => clearTimeout(timer);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(${LIME_BORDER_RGBA},${interpolate(glowValue.value, [0, 0.12, 1], [0, 0.28, 0.65])})`,
    shadowColor: LIME,
    shadowOpacity: interpolate(glowValue.value, [0, 0.12, 1], [0.06, 0.14, 0.30]),
    shadowRadius: 18,
  }));

  const tintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tintValue.value, [0, 0.28, 1], [0, 0.06, 0.18]),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  return (
    <Reanimated.View
      entering={FadeInDown.duration(320).delay(cardDelay)}
      style={[styles.itemRow, cardStyle]}
    >
      {/* Lime tint — active while scanning, fades to subtle hint when done */}
      <Reanimated.View
        style={[StyleSheet.absoluteFill, styles.tintOverlay, tintStyle]}
        pointerEvents="none"
      />

      {/* Icon + circular progress arc */}
      <View style={styles.iconWrapper}>
        <Svg
          width={ARC_SIZE}
          height={ARC_SIZE}
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
        >
          {/* Track ring */}
          <Circle
            cx={ARC_CX} cy={ARC_CY} r={ARC_RADIUS}
            stroke="rgba(0,0,0,0.07)" strokeWidth={2} fill="none"
          />
          {/* Animated progress arc */}
          <AnimatedCircle
            cx={ARC_CX} cy={ARC_CY} r={ARC_RADIUS}
            stroke={LIME} strokeWidth={3.5}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={arcOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${ARC_CX},${ARC_CY}`}
          />
        </Svg>
        <View style={[styles.itemIcon, { backgroundColor: item.color + "22" }]}>
          <item.Icon color={item.color} />
        </View>
      </View>

      {/* Labels */}
      <View style={styles.itemText}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemSublabel}>{item.sublabel}</Text>
      </View>

      {/* Checkmark — springs in once arc completes */}
      <Reanimated.View style={[styles.checkCircle, checkStyle]}>
        <CheckIcon />
      </Reanimated.View>
    </Reanimated.View>
  );
}

/* ── Screen ──────────────────────────────────────────────────── */
export default function RoutineAnimationScreen() {
  const insets = useSafeAreaInsets();
  const { finish } = useOnboarding();
  const progress = getProgressForStep("routine-animation");

  const [doneCount,  setDoneCount]  = useState(0);
  const [ctaReady,   setCtaReady]   = useState(false);
  const [statusIdx,  setStatusIdx]  = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle AI status text independently of item timing
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setStatusIdx((prev) => {
        if (prev >= STATUS_TEXTS.length - 1) {
          clearInterval(intervalRef.current!);
          return STATUS_TEXTS.length - 1;
        }
        return prev + 1;
      });
    }, 1100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleDone = useCallback(() => {
    setDoneCount((c) => {
      const next = c + 1;
      // CTA appears as soon as 2nd item completes — user can proceed early
      if (next === 2) setCtaReady(true);
      // Haptic fires when the last item finishes
      if (next === ROUTINE_ITEMS.length) setTimeout(() => hapticSuccess(), 150);
      return next;
    });
  }, []);

  const handleContinue = useCallback(async () => {
    if (!ctaReady) return;
    await finish();
    router.replace("/(tabs)/program");
  }, [ctaReady, finish]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Progress bar */}
      <View style={[styles.progressTrack, { marginTop: insets.top + SP[3] }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <Reanimated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Text style={styles.heading}>Building Your{"\n"}Daily Routine…</Text>
        <Text style={styles.subheading}>
          Tailored to your facial structure and goals
        </Text>
      </Reanimated.View>

      {/* Item cards */}
      <View style={styles.itemList}>
        {ROUTINE_ITEMS.map((item, i) => (
          <RoutineItemRow key={item.key} item={item} index={i} onDone={handleDone} />
        ))}
      </View>

      {/* Cycling AI status text */}
      <View style={styles.statusWrap}>
        <Reanimated.View key={statusIdx} entering={FadeIn.duration(300)}>
          <Text style={styles.statusText}>{STATUS_TEXTS[statusIdx]}</Text>
        </Reanimated.View>
      </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + SP[4] }]}>
        {ctaReady && (
          <Reanimated.View entering={FadeInDown.duration(420)}>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.cta,
                pressed && { backgroundColor: COLORS.ctaBlackPressed },
              ]}
            >
              <Text style={styles.ctaText}>VIEW MY CUSTOM ROUTINE</Text>
            </Pressable>
          </Reanimated.View>
        )}
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SP[3],
  },

  progressTrack: {
    height: sh(6),
    marginHorizontal: SP[5],
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
    marginBottom: SP[5],
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  header: {
    paddingHorizontal: SP[5],
    marginBottom: SP[4],
  },
  heading: {
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    marginTop: SP[2],
  },

  itemList: {
    flex: 1,
    paddingHorizontal: SP[5],
    gap: SP[3],
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    borderWidth: 1,
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    gap: SP[4],
    overflow: "hidden",
    // Idle/scanning shadow lives in cardStyle (animated). Keep a soft default
    // so the card has weight even before its animation starts.
    shadowOffset: { width: 0, height: 4 },
  },
  tintOverlay: {
    borderRadius: RADII.lg,
    backgroundColor: LIME,
  },

  iconWrapper: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    alignItems: "center",
    justifyContent: "center",
  },

  itemText: { flex: 1 },
  itemLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  itemSublabel: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(12),
    color: COLORS.lightSub,
    marginTop: 2,
  },

  checkCircle: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },

  statusWrap: {
    paddingHorizontal: SP[5],
    paddingVertical: SP[3],
    alignItems: "center",
    minHeight: sh(40),
  },
  statusText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0.2,
    textAlign: "center",
  },

  ctaContainer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
