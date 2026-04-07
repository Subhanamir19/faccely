// app/program/workout-reveal.tsx
// "Today's Workout" reveal screen — shown between streak screen and exercise list.
// Animated exercise cards deal in one by one, building anticipation before the session.

import React, { useEffect, useMemo } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  FadeIn,
  Easing,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useTasksStore } from "@/store/tasks";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import LimeButton from "@/components/ui/LimeButton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, "0")}`;
}

function totalMinutes(ids: string[], getDuration: (id: string) => number): number {
  return Math.round(ids.reduce((acc, id) => acc + getDuration(id), 0) / 60);
}

// ---------------------------------------------------------------------------
// Animated target pill
// ---------------------------------------------------------------------------

function TargetPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single exercise card — deals in with spring stagger
// ---------------------------------------------------------------------------

function ExerciseRevealCard({
  name,
  targets,
  duration,
  index,
  total,
}: {
  name: string;
  targets: string[];
  duration: number;
  index: number;
  total: number;
  exerciseId: string;
  icon: any;
}) {
  const translateY = useSharedValue(60);
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.92);

  useEffect(() => {
    const delay = 400 + index * 110;
    translateY.value = withDelay(delay, withSpring(0,    { damping: 18, stiffness: 160, mass: 0.8 }));
    opacity.value    = withDelay(delay, withTiming(1,    { duration: 280, easing: Easing.out(Easing.ease) }));
    scale.value      = withDelay(delay, withSpring(1,    { damping: 14, stiffness: 200 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity:   opacity.value,
  }));

  const targetLabels = targets.map((t) => (t === "all" ? "Full Face" : t));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      {/* Left: index badge */}
      <View style={styles.cardIndexWrap}>
        <Text style={styles.cardIndex}>{index + 1}</Text>
      </View>

      {/* Center: name + targets */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
        <View style={styles.pillRow}>
          {targetLabels.map((t) => <TargetPill key={t} label={t} />)}
        </View>
      </View>

      {/* Right: duration */}
      <View style={styles.cardRight}>
        <Text style={styles.cardDuration}>{formatDuration(duration)}</Text>
      </View>

      {/* Accent left bar */}
      <View style={[
        styles.cardAccentBar,
        { opacity: interpolate(index / Math.max(total - 1, 1), [0, 1], [1, 0.45]) },
      ]} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Pulsing "ready" dot
// ---------------------------------------------------------------------------

function ReadyPulse() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.readyDotWrap}>
      <Animated.View style={[styles.readyDotRing, pulseStyle]} />
      <View style={styles.readyDot} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WorkoutRevealScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { today } = useTasksStore();
  const getDuration = useExerciseSettings((s) => s.getDuration);

  const tasks    = useMemo(() => today?.tasks ?? [], [today]);
  const pending  = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const showList = pending.length > 0 ? pending : tasks; // fallback to all if all done

  const totalMins = useMemo(
    () => totalMinutes(showList.map((t) => t.exerciseId), getDuration),
    [showList, getDuration],
  );

  // Header animates in immediately
  const headerY   = useSharedValue(-20);
  const headerOp  = useSharedValue(0);
  const ctaY      = useSharedValue(30);
  const ctaOp     = useSharedValue(0);

  useEffect(() => {
    headerY.value  = withSpring(0, { damping: 20, stiffness: 180 });
    headerOp.value = withTiming(1, { duration: 320 });

    // CTA fades in after all cards have dealt
    const ctaDelay = 400 + showList.length * 110 + 300;
    ctaY.value  = withDelay(ctaDelay, withSpring(0,  { damping: 18, stiffness: 160 }));
    ctaOp.value = withDelay(ctaDelay, withTiming(1,  { duration: 280 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity:   headerOp.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaY.value }],
    opacity:   ctaOp.value,
  }));

  const handleGo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/program/list");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={["#060606", "#0A0A0A", "#000000"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <ReadyPulse />
        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>TODAY'S WORKOUT</Text>
          <Text style={styles.headerSub}>
            {showList.length} exercise{showList.length !== 1 ? "s" : ""}
            {"  ·  "}
            ~{totalMins} min
          </Text>
        </View>
      </Animated.View>

      {/* Divider */}
      <Animated.View entering={FadeIn.duration(300).delay(300)} style={styles.divider} />

      {/* Exercise cards */}
      <View style={styles.cardList}>
        {showList.map((task, i) => (
          <ExerciseRevealCard
            key={task.exerciseId}
            exerciseId={task.exerciseId}
            icon={getExerciseIcon(task.exerciseId)}
            name={task.name}
            targets={task.targets}
            duration={getDuration(task.exerciseId)}
            index={i}
            total={showList.length}
          />
        ))}
      </View>

      {/* CTA */}
      <Animated.View
        style={[
          styles.cta,
          { paddingBottom: Math.max(insets.bottom, SP[4]) + SP[2] },
          ctaStyle,
        ]}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.95)", "#000000"]}
          style={styles.ctaGradient}
          pointerEvents="none"
        />
        <LimeButton label="▶  Start Workout" onPress={handleGo} />
        <Pressable
          onPress={() => router.push("/program/list")}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.skipText}>View full plan</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#060606",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SP[3],
    paddingHorizontal: SP[5],
    paddingTop:    SP[4],
    paddingBottom: SP[3],
  },
  headerText: {
    gap: 2,
  },
  headerLabel: {
    fontSize:      11,
    fontFamily:    "Poppins-SemiBold",
    color:         COLORS.accent,
    letterSpacing: 2.5,
  },
  headerSub: {
    fontSize:   13,
    fontFamily: "Poppins-Regular",
    color:      COLORS.sub,
  },

  // Ready pulse dot
  readyDotWrap: {
    width:           20,
    height:          20,
    alignItems:      "center",
    justifyContent:  "center",
  },
  readyDotRing: {
    position:     "absolute",
    width:        20,
    height:       20,
    borderRadius: 10,
    borderWidth:  1.5,
    borderColor:  COLORS.accent,
    opacity:      0.35,
  },
  readyDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.accent,
  },

  divider: {
    height:           1,
    backgroundColor:  "rgba(255,255,255,0.06)",
    marginHorizontal: SP[5],
    marginBottom:     SP[3],
  },

  // Cards
  cardList: {
    flex:              1,
    paddingHorizontal: SP[4],
    paddingTop:        SP[1],
    gap:               SP[2],
  },

  card: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "rgba(18,18,18,0.95)",
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.07)",
    paddingVertical:   SP[3],
    paddingHorizontal: SP[3],
    gap:               SP[3],
    overflow:          "hidden",
  },
  cardAccentBar: {
    position:        "absolute",
    left:            0,
    top:             10,
    bottom:          10,
    width:           3,
    borderRadius:    2,
    backgroundColor: COLORS.accent,
  },

  cardIndexWrap: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems:      "center",
    justifyContent:  "center",
    marginLeft:      SP[1],
  },
  cardIndex: {
    fontSize:   12,
    fontFamily: "Poppins-SemiBold",
    color:      "rgba(255,255,255,0.35)",
  },

  cardInfo: {
    flex: 1,
    gap:  3,
  },
  cardName: {
    fontSize:      14,
    fontFamily:    "Poppins-SemiBold",
    color:         COLORS.text,
    letterSpacing: -0.2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           4,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius:    RADII.pill,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  pillText: {
    fontSize:      10,
    fontFamily:    "Poppins-Regular",
    color:         COLORS.sub,
    textTransform: "capitalize",
  },

  cardRight: {
    alignItems: "flex-end",
  },
  cardDuration: {
    fontSize:   13,
    fontFamily: "Poppins-SemiBold",
    color:      COLORS.accent,
    letterSpacing: 0.3,
  },

  // CTA footer
  cta: {
    paddingHorizontal: SP[5],
    paddingTop:        SP[5],
    gap:               SP[2],
  },
  ctaGradient: {
    position: "absolute",
    top:      -48,
    left:     0,
    right:    0,
    height:   48,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: SP[2],
  },
  skipText: {
    fontSize:   13,
    fontFamily: "Poppins-Regular",
    color:      COLORS.sub,
  },
});
