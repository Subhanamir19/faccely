// app/program/complete.tsx
// Session completion screen — dopamine hit, streak display, tomorrow preview.
// Navigated to from session.tsx after all exercises finish.

import React, { useEffect, useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useTasksStore } from "@/store/tasks";
import { useProfile } from "@/store/profile";
import { getExerciseDetail } from "@/lib/exerciseDetails";
import LimeButton from "@/components/ui/LimeButton";

// ---------------------------------------------------------------------------
// Confetti particle
// ---------------------------------------------------------------------------

type ParticleProps = {
  index: number;
  color: string;
  startX: number;
};

function ConfettiParticle({ index, color, startX }: ParticleProps) {
  const y      = useSharedValue(0);
  const x      = useSharedValue(0);
  const opac   = useSharedValue(0);
  const scale  = useSharedValue(0);
  const rot    = useSharedValue(0);

  useEffect(() => {
    const delay  = index * 40 + Math.random() * 100;
    const dist   = -200 - Math.random() * 180;
    const drift  = (Math.random() - 0.5) * 120;
    const dur    = 800 + Math.random() * 500;

    y.value      = withDelay(delay, withTiming(dist, { duration: dur, easing: Easing.out(Easing.quad) }));
    x.value      = withDelay(delay, withTiming(drift, { duration: dur }));
    scale.value  = withDelay(delay, withSequence(
      withSpring(1.2, { damping: 8, stiffness: 300 }),
      withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
    ));
    opac.value   = withDelay(delay, withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(dur - 300, withTiming(0, { duration: 300 })),
    ));
    rot.value    = withDelay(delay, withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: dur }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opac.value,
  }));

  const size = 8 + Math.random() * 6;

  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          left: startX,
          bottom: 0,
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: color,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Confetti burst
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  COLORS.accent,
  "#FFFFFF",
  "#FB923C",
  "#A78BFA",
  "#38BDF8",
  "#F472B6",
  "#86EFAC",
];

function ConfettiBurst({ screenWidth }: { screenWidth: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        startX: screenWidth * 0.1 + Math.random() * screenWidth * 0.8,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} index={p.id} color={p.color} startX={p.startX} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated streak ring
// ---------------------------------------------------------------------------

function StreakRing({ streak }: { streak: number }) {
  const RING_SIZE  = 90;
  const STROKE     = 6;
  const radius     = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress   = useSharedValue(0);
  const scale      = useSharedValue(0.7);
  const numScale   = useSharedValue(0.5);

  useEffect(() => {
    scale.value    = withDelay(200, withSpring(1, { damping: 8, stiffness: 160 }));
    progress.value = withDelay(300, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    numScale.value = withDelay(600, withSequence(
      withSpring(1.25, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 }),
    ));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
  }));

  const dashOffset = circumference * 0; // always full ring on complete screen

  return (
    <Animated.View style={[styles.ringContainer, containerStyle]}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Fill */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={COLORS.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>

      {/* Center: streak count + flame */}
      <View style={styles.ringCenter}>
        <Animated.Text style={[styles.ringStreak, numStyle]}>
          {streak}
        </Animated.Text>
        <Text style={styles.ringFlame}>🔥</Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Stat pill
// ---------------------------------------------------------------------------

function StatPill({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay).springify()} style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { doneCount: rawDone, total: rawTotal } = useLocalSearchParams<{
    doneCount?: string;
    total?: string;
  }>();

  const { currentStreak, today } = useTasksStore();
  const { displayName } = useProfile();
  const firstName = displayName?.split(" ")[0] ?? null;

  const doneCount = Number(rawDone ?? today?.tasks.filter((t) => t.status === "completed").length ?? 0);
  const total     = Number(rawTotal ?? today?.tasks.length ?? 0);

  // Tomorrow preview: first exercise name from today's task list (they rotate)
  const firstExercise = today?.tasks[0];
  const tomorrowExName = firstExercise
    ? getExerciseDetail(firstExercise.exerciseId)?.name ?? firstExercise.name
    : null;

  const focusSummary = today?.focusSummary;

  // Trigger haptic on mount — celebration moment
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Second pulse after ring animation
    const t = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/program");
  };

  const headlineText = firstName
    ? `${firstName}, you showed up.`
    : "You showed up.";

  const streakCopy = currentStreak >= 30
    ? "Legendary. You're built different."
    : currentStreak >= 14
    ? "Two weeks of consistency. Compounding."
    : currentStreak >= 7
    ? "One full week — elite territory."
    : currentStreak >= 3
    ? "The habit is building. Keep going."
    : currentStreak > 0
    ? "Every day counts. This is day " + currentStreak + "."
    : "Day 1 complete. The journey starts now.";

  return (
    <SafeAreaView style={styles.safe}>

      {/* Background gradient with lime tint at top */}
      <LinearGradient
        colors={["rgba(180,243,77,0.06)", "#000000", "#0B0B0B"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Confetti on mount */}
      <ConfettiBurst screenWidth={screenWidth} />

      <View style={[styles.inner, { paddingBottom: Math.max(insets.bottom, SP[5]) }]}>

        {/* ── Check icon (supporting accent, not hero) ── */}
        <Animated.View
          entering={FadeIn.duration(280).delay(100)}
          style={styles.checkCircle}
        >
          <LinearGradient
            colors={[COLORS.accentLight, COLORS.accent]}
            style={styles.checkGradient}
          >
            <Text style={styles.checkGlyph}>✓</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Headline ── */}
        <Animated.Text
          entering={FadeInDown.duration(340).delay(180).springify()}
          style={styles.headline}
        >
          {headlineText}
        </Animated.Text>

        {/* ── Streak copy ── */}
        <Animated.Text
          entering={FadeInDown.duration(300).delay(260)}
          style={styles.subline}
        >
          {streakCopy}
        </Animated.Text>

        {/* ── Stats row — what you did (before the streak reward) ── */}
        <View style={styles.statsRow}>
          <StatPill
            value={`${doneCount}/${total}`}
            label="Exercises"
            delay={340}
          />
          {focusSummary ? (
            <StatPill
              value={focusSummary.split(/,\s*|\s*&\s*/)[0]?.trim() ?? focusSummary}
              label="Focus Area"
              delay={420}
            />
          ) : null}
        </View>

        {/* ── Streak ring — celebration reward, after the stats ── */}
        <Animated.View entering={FadeIn.duration(300).delay(480)} style={styles.ringRow}>
          <StreakRing streak={currentStreak} />
        </Animated.View>

        {/* ── Tomorrow preview ── */}
        {tomorrowExName && (
          <Animated.View
            entering={FadeInUp.duration(340).delay(560).springify()}
            style={styles.tomorrowCard}
          >
            <View style={styles.tomorrowAccent} />
            <Text style={styles.tomorrowLabel}>TOMORROW</Text>
            <Text style={styles.tomorrowText}>
              Starting with: {tomorrowExName}
            </Text>
          </Animated.View>
        )}

        <View style={styles.spacer} />

        {/* ── Done CTA ── */}
        <Animated.View
          entering={FadeInUp.duration(380).delay(640).springify()}
          style={styles.btnWrap}
        >
          <LimeButton label="Done" onPress={handleDone} />
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  inner: {
    flex: 1,
    paddingHorizontal: SP[6],
    paddingTop: SP[8],
    alignItems: "center",
  },

  // Check circle — demoted to supporting icon, not hero element
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: SP[3],
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  checkGradient: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  checkGlyph: {
    fontSize: 22,
    color: "#0A0A0A",
    fontFamily: "Poppins-SemiBold",
    lineHeight: 28,
  },

  // Headlines
  headline: {
    fontSize: 28,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.6,
    marginBottom: SP[2],
  },
  subline: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SP[5],
    paddingHorizontal: SP[4],
  },

  // Streak ring — proportionally tighter, single clear hero number
  ringRow: {
    marginBottom: SP[5],
  },
  ringContainer: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  ringStreak: {
    fontSize: 28,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    lineHeight: 32,
    includeFontPadding: false,
  },
  ringFlame: {
    fontSize: 14,
    lineHeight: 18,
  },

  // Stats — equal flex width so both cards are balanced
  statsRow: {
    flexDirection: "row",
    gap: SP[3],
    marginBottom: SP[4],
    width: "100%",
  },
  statPill: {
    flex: 1,
    backgroundColor: "rgba(22,22,22,0.90)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Poppins-Regular",
    color: COLORS.muted,
    marginTop: 3,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Tomorrow card — matches stat card pattern; thin lime top accent instead of full border
  tomorrowCard: {
    width: "100%",
    backgroundColor: "rgba(22,22,22,0.90)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SP[4],
    paddingHorizontal: SP[5],
    alignItems: "center",
    overflow: "hidden",
  },
  tomorrowAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.accent,
  },
  tomorrowLabel: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.accent,
    letterSpacing: 2,
    marginBottom: SP[1],
  },
  tomorrowText: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    textAlign: "center",
  },

  spacer: {
    flex: 1,
  },

  btnWrap: {
    width: "100%",
    marginBottom: SP[2],
  },
});
