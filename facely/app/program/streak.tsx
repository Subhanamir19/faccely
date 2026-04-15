// app/program/streak.tsx
// Two-phase streak intro:
//   Phase 1 — fire + number centred on screen (hero moment)
//   Phase 2 — hero slides up via translateY, calendar + CTA reveal below
//
// UX rules applied:
//   • transform-performance  → translateY / opacity only, zero layout reflow
//   • spring-physics          → spring for hero slide, damped spring for cells
//   • stagger-sequence        → 50ms stagger on calendar cells
//   • visual-hierarchy        → size / spacing / contrast establishes rank

import React, { useEffect, useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useTasksStore, type DayRecord } from "@/store/tasks";
import { useScores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { getLocalDateString } from "@/lib/time/nextMidnight";
import LimeButton from "@/components/ui/LimeButton";

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_LABELS  = ["S","M","T","W","T","F","S"];
const HERO_H      = 220; // fire(110) + gap(8) + num(90) + gap(4) + days(22) + pad(8)
const CELL_SIZE   = 42;
const CELL_DEPTH  = 5;
const NUM_H       = 90;  // clipping window height for the slot counter

// ─── Types ──────────────────────────────────────────────────────────────────

type DayStatus = "complete" | "missed" | "today_done" | "today_pending";
type DaySlot   = { dateStr: string; dayLabel: string; dateNum: number; status: DayStatus };

// ─── Data helpers ────────────────────────────────────────────────────────────

function buildSlots(history: DayRecord[], today: DayRecord | null): DaySlot[] {
  const slots: DaySlot[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    let status: DayStatus;
    if (i === 0) {
      status = today?.streakEarned ? "today_done" : "today_pending";
    } else {
      status = history.find((r) => r.date === dateStr)?.streakEarned
        ? "complete" : "missed";
    }
    slots.push({ dateStr, dayLabel: DAY_LABELS[d.getDay()], dateNum: d.getDate(), status });
  }
  return slots;
}

function hookLine(streak: number, scores: any, goals: string[] | null, name: string | null): string {
  if (streak >= 30) return `${streak} days. Legendary.`;
  if (streak >= 14) return `${streak} days — elite consistency.`;
  if (streak >= 7)  return `${streak} days — you're in the zone.`;
  if (streak >= 3)  return `${streak} days in — habit is forming.`;
  if (streak > 0)   return `${streak} day${streak > 1 ? "s" : ""} — keep going.`;
  if (scores) {
    const worst = (Object.entries({
      jawline: "Jawline", cheekbones: "Cheekbones",
      eyes_symmetry: "Eye symmetry", skin_quality: "Skin quality",
    }) as [string,string][]).reduce<{label:string;val:number}|null>((acc,[k,l]) => {
      const v = scores[k];
      return typeof v === "number" && v > 0 && (!acc || v < acc.val) ? {label:l,val:v} : acc;
    }, null);
    if (worst) return `${worst.label} is your focus area today.`;
  }
  if (goals?.length) return `Focusing on your ${goals[0]} goal today.`;
  return name ? `${name}, your plan is ready.` : "Your plan is ready.";
}

// ─── Slot counter — old number slides up, new slides in from bottom ──────────

function SlotCounter({ streak }: { streak: number }) {
  const prev   = Math.max(0, streak - 1);
  const slideY = useSharedValue(0);

  useEffect(() => {
    // Wait 800ms so user reads the old number, then roll to new
    slideY.value = withDelay(
      800,
      withTiming(-NUM_H, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  return (
    // Clip window — only one number visible at a time
    <View style={styles.slotWindow}>
      <Animated.View style={containerStyle}>
        {/* Old number — visible first */}
        <Text style={styles.streakNum}>{prev}</Text>
        {/* New number — slides in from bottom */}
        <Text style={styles.streakNum}>{streak}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Animated fire + number (hero) ──────────────────────────────────────────

function FireHero({ streak }: { streak: number }) {
  return (
    <View style={styles.heroInner}>
      <View style={styles.fireIconWrap}>
        <Video
          source={require("../../fire-video.mp4")}
          style={styles.fireVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
        />
      </View>
      <SlotCounter streak={streak} />
      <Text style={styles.streakUnit}>{streak === 1 ? "day" : "days"}</Text>
    </View>
  );
}

// ─── Duolingo-style circular 3D calendar cell ────────────────────────────────

function CalCell({ slot, index }: { slot: DaySlot; index: number }) {
  const isDone      = slot.status === "complete" || slot.status === "today_done";
  const isToday     = slot.status === "today_done" || slot.status === "today_pending";
  const isTodayPending = slot.status === "today_pending";
  const isMissed    = slot.status === "missed";
  const showCheck   = isDone || isTodayPending;

  const enter      = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkRot   = useSharedValue(-20);

  useEffect(() => {
    const stagger = index * 50;
    // Cell entrance — scale from 0 with spring
    enter.value = withDelay(
      stagger,
      withSpring(1, { damping: 12, stiffness: 190, mass: 0.7 }),
    );
    // Checkmark pop-in after cell lands (done cells + today)
    if (showCheck) {
      checkScale.value = withDelay(stagger + 220,
        withSequence(
          withSpring(1.35, { damping: 5,  stiffness: 420 }),
          withSpring(1.00, { damping: 10, stiffness: 220 }),
        ),
      );
      checkRot.value = withDelay(stagger + 220,
        withSpring(0, { damping: 14, stiffness: 230 }),
      );
    }
  }, []);

  const cellAnim = useAnimatedStyle(() => ({
    transform:   [{ scale: interpolate(enter.value, [0,1], [0.4,1]) }],
    opacity:     interpolate(enter.value, [0, 0.5, 1], [0, 0.6, 1]),
  }));
  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }, { rotate: `${checkRot.value}deg` }],
  }));

  // ── Color tokens ───────────────────────────────────────────────────────────
  // Depth  = darker version of face (shows as 3D rim at bottom)
  // Face   = the visible surface of the circular button
  const depthBg = isDone || isTodayPending
    ? "#4A7A00"
    : isMissed
    ? "#CCCCCC"
    : "#161616";

  const faceBg = isDone || isTodayPending
    ? COLORS.accent
    : isMissed
    ? "#FFFFFF"
    : "#252525";

  return (
    <Animated.View style={[styles.cellWrap, cellAnim]}>
      {/* Day initial */}
      <Text style={[styles.cellLabel, isToday && styles.cellLabelToday]}>
        {slot.dayLabel}
      </Text>

      {/* 3D circle button */}
      <View style={[styles.cellDepth, { backgroundColor: depthBg }]}>
        <View style={[styles.cellFace, { backgroundColor: faceBg }]}>
          {showCheck ? (
            <Animated.Text
              style={[
                styles.cellCheck,
                { color: "#0A1A00" },
                checkAnim,
              ]}
            >✓</Animated.Text>
          ) : isMissed ? (
            <Text style={styles.cellCross}>✕</Text>
          ) : (
            <View style={[
              styles.cellDot,
              { backgroundColor: "rgba(255,255,255,0.22)" },
            ]} />
          )}
        </View>
      </View>

      {/* Date number */}
      <Text style={[styles.cellDate, isToday && styles.cellDateToday]}>
        {slot.dateNum}
      </Text>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function StreakScreen() {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { currentStreak, history, today } = useTasksStore();
  const { scores }           = useScores();
  const { data: onboarding } = useOnboarding();
  const { displayName }      = useProfile();
  const firstName = displayName?.split(" ")[0] ?? null;

  const slots = useMemo(() => buildSlots(history, today), [history, today]);
  const hook  = useMemo(
    () => hookLine(currentStreak, scores, onboarding.goals ?? null, firstName),
    [currentStreak, scores, onboarding.goals, firstName],
  );

  // ── Animation values ────────────────────────────────────────────────────────
  //
  // Hero sits at its final position (top: heroFinalTop).
  // translateY starts at heroStartOffset so it APPEARS vertically centred.
  // It animates to 0 (rests at heroFinalTop) — pure transform, zero layout reflow.

  const heroFinalTop  = insets.top + 56;
  const heroStartOff  = Math.max(0, screenH / 2 - heroFinalTop - HERO_H / 2);

  const heroY         = useSharedValue(heroStartOff);
  const heroOpacity   = useSharedValue(0);
  const contentY      = useSharedValue(36);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    // Instant hero fade-in (it's already in position-via-translate)
    heroOpacity.value = withTiming(1, { duration: 300 });

    // Phase 2: after 1.4 s — slide hero up, reveal content
    const t = setTimeout(() => {
      heroY.value = withSpring(0, { damping: 22, stiffness: 95, mass: 0.9 });
      contentY.value = withDelay(
        160,
        withSpring(0, { damping: 18, stiffness: 130 }),
      );
      contentOpacity.value = withDelay(
        160,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) }),
      );
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  const heroAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: heroY.value }],
    opacity:   heroOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentY.value }],
    opacity:   contentOpacity.value,
  }));

  const handleGo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/program/list");
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  //
  // Both hero and content are position:absolute — no layout reflow during animation.
  // Hero:    top = heroFinalTop,  height = HERO_H
  // Content: top = heroFinalTop + HERO_H + 40,  bottom = 0
  //
  const contentTop = heroFinalTop + HERO_H + 40;

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={["#060606","#000000"]} style={StyleSheet.absoluteFill} />

      {/* ── Phase 1 / Phase 2 hero ── */}
      <Animated.View
        style={[
          styles.hero,
          { top: heroFinalTop },
          heroAnimStyle,
        ]}
      >
        <FireHero streak={currentStreak} />
      </Animated.View>

      {/* ── Content: calendar + hook + CTA ── */}
      <Animated.View
        style={[
          styles.content,
          { top: contentTop },
          contentAnimStyle,
        ]}
      >
        {/* Calendar card */}
        <View style={styles.calCard}>
          <Text style={styles.calTitle}>LAST 7 DAYS</Text>
          <View style={styles.calRow}>
            {slots.map((slot, i) => (
              <CalCell key={slot.dateStr} slot={slot} index={i} />
            ))}
          </View>
        </View>

        {/* Hook line */}
        <Text style={styles.hook}>{hook}</Text>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA */}
        <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, SP[4]) + SP[2] }]}>
          <LimeButton label="Let's Go" onPress={handleGo} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#060606",
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    position:  "absolute",
    left:  0,
    right: 0,
    height: HERO_H,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInner: {
    alignItems: "center",
  },
  fireIconWrap: {
    width:        110,
    height:       110,
    borderRadius: 55,
    overflow:     "hidden",
  },
  fireVideo: {
    width:  "100%",
    height: "100%",
  },
  slotWindow: {
    height:   NUM_H,
    overflow: "hidden",
    alignItems: "center",
    marginTop: 4,
  },
  streakNum: {
    fontSize:           80,
    fontFamily:         "Poppins-SemiBold",
    color:              COLORS.text,
    lineHeight:         NUM_H,
    letterSpacing:      -3,
    includeFontPadding: false,
    textAlign:          "center",
    minWidth:           120,
  },
  streakUnit: {
    fontSize:    18,
    fontFamily:  "Poppins-Regular",
    color:       COLORS.sub,
    letterSpacing: 0.5,
    marginTop:   2,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    position: "absolute",
    left:     SP[5],
    right:    SP[5],
    bottom:   0,
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  calCard: {
    backgroundColor: "rgba(16,16,16,0.92)",
    borderRadius:    RADII.lg,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.07)",
    paddingVertical: SP[5],
    paddingHorizontal: SP[3],
    marginBottom:    SP[5],
  },
  calTitle: {
    fontSize:    10,
    fontFamily:  "Poppins-SemiBold",
    color:       "rgba(255,255,255,0.30)",
    letterSpacing: 2.5,
    textAlign:   "center",
    marginBottom: SP[4],
  },
  calRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-end",
  },

  // ── Calendar cell ─────────────────────────────────────────────────────────
  cellWrap: {
    alignItems: "center",
    gap:        SP[1],
    flex:       1,
  },
  cellLabel: {
    fontSize:   11,
    fontFamily: "Poppins-Medium",
    color:      "rgba(255,255,255,0.28)",
  },
  cellLabelToday: {
    color:      COLORS.text,
    fontFamily: "Poppins-SemiBold",
  },

  // 3D circular button — depth ring + face ring
  cellDepth: {
    width:          CELL_SIZE,
    // Taller by CELL_DEPTH so the depth rim shows at the bottom
    height:         CELL_SIZE + CELL_DEPTH,
    borderRadius:   (CELL_SIZE + CELL_DEPTH) / 2,
    alignItems:     "center",
    justifyContent: "flex-start",   // face sits at top, depth rim at bottom
    overflow:       "hidden",
  },
  cellFace: {
    width:          CELL_SIZE,
    height:         CELL_SIZE,
    borderRadius:   CELL_SIZE / 2,
    alignItems:     "center",
    justifyContent: "center",
  },
  cellCheck: {
    fontSize:   18,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
  cellCross: {
    fontSize:   20,
    fontFamily: "Poppins-SemiBold",
    color:      "#C8112B",           // red ✕ on white face
    lineHeight: 24,
  },
  cellDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  cellDate: {
    fontSize:   10,
    fontFamily: "Poppins-Regular",
    color:      "rgba(255,255,255,0.28)",
  },
  cellDateToday: {
    color:      COLORS.accent,
    fontFamily: "Poppins-SemiBold",
  },

  // ── Hook line ─────────────────────────────────────────────────────────────
  hook: {
    fontSize:    14,
    fontFamily:  "Poppins-Regular",
    color:       COLORS.sub,
    textAlign:   "center",
    lineHeight:  22,
    marginBottom: SP[2],
  },

  spacer:  { flex: 1 },
  ctaWrap: { width: "100%" },
});
