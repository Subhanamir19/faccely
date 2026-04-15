// app/(tabs)/program.tsx
// Daily exercise screen — workout card (top 70%) + compact exercise list (bottom 30%)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { getLocalDateString } from "@/lib/time/nextMidnight";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Flame, Check } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import LimeButton from "@/components/ui/LimeButton";
import ComebackModal from "@/components/ui/ComebackModal";
import StreakCelebrationModal from "@/components/ui/StreakCelebrationModal";
import HalfwayHypeModal from "@/components/ui/HalfwayHypeModal";
import DidYouKnowModal from "@/components/ui/DidYouKnowModal";
import {
  canShowComeback,
  canShowDidYouKnow,
  canShowHalfway,
  getShownMilestones,
  markMilestoneShown,
} from "@/lib/lifeModals";
import { useTasksStore, getConsecutiveMissed, type DailyTask, type ProtocolTask, type DayRecord } from "@/store/tasks";
import { useScores, type Scores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { getJSON, setJSON } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Face header images — maps dominant target area to analysis image
// ---------------------------------------------------------------------------

const CARD_FACE_IMAGES: Record<string, any> = {
  cheekbones: require("../../assets/analysis-image-new/midface-area.jpeg"),
  jawline:    require("../../assets/analysis-image-new/jawline analysis.jpeg"),
  eyes:       require("../../assets/analysis-image-new/eye area naalysis.jpeg"),
  skin:       require("../../assets/analysis-image-new/skin analysis.jpeg"),
};

const CARD_FACE_LABELS: Record<string, string> = {
  jawline:    "Lower Face",
  cheekbones: "Midface",
  eyes:       "Eye Area",
  nose:       "Nose",
  skin:       "Skin",
  all:        "Full Face",
};

// Vertical crop — focus on the relevant facial zone
const CARD_FACE_FOCUS: Record<string, string> = {
  cheekbones: "center 42%",
  jawline:    "center 62%",
  eyes:       "center 26%",
  skin:       "center 36%",
};

// Speech bubble annotation text per zone
const BUBBLE_TEXT: Record<string, string> = {
  cheekbones: "fixing the\nmid-face",
  jawline:    "fixing the\nlower face",
  eyes:       "lifting the\neye area",
  skin:       "improving\nskin tone",
};

// Absolute position of the right bubble per zone
const BUBBLE_CONFIG: Record<string, {
  top: string;
  right?: number;
  left?: number;
}> = {
  cheekbones: { top: "28%", right: 14 },
  jawline:    { top: "52%", right: 14 },
  eyes:       { top: "14%", right: 14 },
  skin:       { top: "32%", right: 14 },
};

// Primary muscle targeted per zone — shown in top-left bubble
const MUSCLE_TEXT: Record<string, string> = {
  cheekbones: "Zygomaticus\nmuscle",
  jawline:    "tightens your\njawline",
  eyes:       "Orbicularis\noculi",
  skin:       "Frontalis\nmuscle",
};

function resolveCardTarget(tasks: { targets: string[] }[]): string {
  const counts: Record<string, number> = {};
  const priority = ["jawline", "cheekbones", "eyes", "skin"];
  for (const task of tasks) {
    for (const t of task.targets) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  // Pick the highest-priority target that appears at least once
  for (const p of priority) {
    if (counts[p]) return p;
  }
  return "cheekbones";
}

// ---------------------------------------------------------------------------
// Screen metrics — used for proportional card sizing
// ---------------------------------------------------------------------------

const SCREEN_H       = Dimensions.get("window").height;
const CARD_TOTAL_H   = Math.round(SCREEN_H * 0.25);   // 25% of screen
const TOPBAR_H       = 50;
const PROGRESS_ROW_H = 34;
const HERO_IMAGE_H   = CARD_TOTAL_H - TOPBAR_H - PROGRESS_ROW_H;

// Module-level: only show intro splash once per day
let lastIntroDate: string | null = null;

// In-session guard — prevents double-navigation within the same JS runtime.
// Persisted date in AsyncStorage is the cross-session guard.
let lastStreakNavDate: string | null = null;

const DAILY_FLOW_KEY = "daily_flow_shown_date";

/** Returns true only if the daily flow hasn't been shown today (checks storage). */
async function shouldShowDailyFlow(todayStr: string): Promise<boolean> {
  if (lastStreakNavDate === todayStr) return false;
  const stored = await getJSON<string | null>(DAILY_FLOW_KEY, null);
  return stored !== todayStr;
}

/** Mark the daily flow as shown for today in both memory and storage. */
async function markDailyFlowShown(todayStr: string): Promise<void> {
  lastStreakNavDate = todayStr;
  await setJSON(DAILY_FLOW_KEY, todayStr);
}

// Module-level: life modal session flags (same pattern as lastIntroDate)
let _comebackChecked = false;
let _didYouKnowChecked = false;


// ---------------------------------------------------------------------------
// Loading screen — helpers
// ---------------------------------------------------------------------------

const SCORE_FIELD_LABELS: Record<string, string> = {
  jawline:           "Jawline",
  cheekbones:        "Cheekbones",
  eyes_symmetry:     "Eye symmetry",
  nose_harmony:      "Nose harmony",
  facial_symmetry:   "Facial symmetry",
  skin_quality:      "Skin quality",
  sexual_dimorphism: "Facial structure",
};

const LOADING_GOAL_LABELS: Record<string, string> = {
  jawline:    "jawline",
  cheekbones: "cheekbones",
  symmetry:   "symmetry",
  skin:       "skin",
  eyes:       "eyes",
  overall:    "overall improvement",
};

function findWeakestField(scores: Scores | null): { label: string; value: number } | null {
  if (!scores) return null;
  let worst: { label: string; value: number } | null = null;
  for (const [field, label] of Object.entries(SCORE_FIELD_LABELS)) {
    const v = (scores as Record<string, number>)[field];
    if (typeof v === "number" && v > 0 && (!worst || v < worst.value)) {
      worst = { label, value: Math.round(v) };
    }
  }
  return worst;
}


function buildLoadingPhrases(
  streak: number,
  history: DayRecord[],
  scores: Scores | null,
  goals: string[] | null,
  firstName: string | null,
): string[] {
  const missed = getConsecutiveMissed(history);
  const phrases: string[] = [];

  // Phrase 0 — streak / context
  if (missed > 1) {
    phrases.push(`Back after ${missed} days — starting light`);
  } else if (streak >= 14) {
    phrases.push(`${streak}-day streak — Week 4 intensity active`);
  } else if (streak >= 7) {
    phrases.push(`${streak}-day streak — Week 2 intensity active`);
  } else if (streak > 0) {
    phrases.push(`${streak}-day streak — keep going`);
  } else {
    phrases.push(`Day 1 — let's build the habit`);
  }

  // Phrase 1 — score or goal insight
  const weakest = findWeakestField(scores);
  if (weakest) {
    phrases.push(`${weakest.label} needs work — prioritizing today`);
  } else if (goals?.length) {
    const label = LOADING_GOAL_LABELS[goals[0]] ?? goals[0];
    phrases.push(`Focusing on your ${label} goal`);
  } else {
    phrases.push(`Building your personalized plan`);
  }

  // Phrase 2 — ready (personalized)
  phrases.push(firstName ? `${firstName}'s plan is ready` : `Your plan is ready`);

  return phrases;
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function TasksLoadingScreen() {
  const { currentStreak, history } = useTasksStore();
  const { scores } = useScores();
  const { data: onboardingData } = useOnboarding();
  const { displayName } = useProfile();
  const firstName = displayName?.split(" ")[0] ?? null;

  const phrases = useMemo(
    () => buildLoadingPhrases(currentStreak, history, scores, onboardingData.goals ?? null, firstName),
    // Stable deps — all sourced from persisted stores, correct on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStreak, scores, onboardingData.goals, firstName],
  );

  const [phraseIndex, setPhraseIndex] = useState(0);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(1, { duration: 2700 });
    const tick = setInterval(() => {
      setPhraseIndex((i) => Math.min(i + 1, phrases.length - 1));
    }, 900);
    return () => clearInterval(tick);
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(250)} style={styles.loadingWrap}>
        <Text style={styles.loadingTitle}>{firstName ? `${firstName}'s Workout` : "Today's Workout"}</Text>

        <View style={styles.progressTrackLoading}>
          <Animated.View style={[styles.progressFillLoading, barStyle]} />
        </View>

        <View style={styles.phraseContainer}>
          <Animated.Text
            key={phraseIndex}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(250)}
            style={styles.loadingPhrase}
          >
            {phrases[phraseIndex]}
          </Animated.Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateHeader(): string {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]} ${now.getDate()}`;
}

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

type DayStatus = "complete" | "missed" | "today_done" | "today_pending";

type DaySlot = {
  dateStr: string;
  dayInitial: string;
  dateNum: number;
  status: DayStatus;
};

function buildLast7Days(history: DayRecord[], today: DayRecord | null): DaySlot[] {
  const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
  const slots: DaySlot[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i); // local date arithmetic
    const dateStr = getLocalDateString(d);

    let status: DayStatus;
    if (i === 0) {
      status = today?.streakEarned ? "today_done" : "today_pending";
    } else {
      const record = history.find((r) => r.date === dateStr);
      status = record?.streakEarned ? "complete" : "missed";
    }

    slots.push({ dateStr, dayInitial: DAY_INITIALS[d.getDay()], dateNum: d.getDate(), status });
  }
  return slots;
}

function streakMotivationCopy(streak: number): string {
  if (streak === 0) return "Complete today's workout to start your streak";
  if (streak === 1) return "Day 1 — the hardest part is starting";
  if (streak < 3)   return `${streak} days in — building the habit`;
  if (streak < 7)   return `${streak} days strong — keep going`;
  if (streak === 7) return "One full week — you're consistent";
  if (streak < 14)  return `${streak} days — you're in the zone`;
  if (streak === 14) return "Two weeks straight — elite consistency";
  if (streak < 30)  return `${streak} days — serious commitment`;
  return `${streak} days — legendary streak`;
}

// ---------------------------------------------------------------------------
// Streak modal
// ---------------------------------------------------------------------------

function StreakModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { currentStreak, history, today } = useTasksStore();
  const slots = buildLast7Days(history, today);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Animated.View
          entering={FadeInDown.duration(280).springify().damping(20).stiffness(180)}
          style={styles.modalCard}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>

            {/* Header label */}
            <Text style={styles.modalTitle}>🔥  Streak</Text>

            {/* Big streak number */}
            <Text style={styles.streakBigNum}>{currentStreak}</Text>

            {/* Motivation copy */}
            <Text style={styles.modalHint}>{streakMotivationCopy(currentStreak)}</Text>

            {/* Divider */}
            <View style={styles.streakDivider} />

            {/* 7-day calendar row */}
            <View style={styles.streakDotRow}>
              {slots.map((slot) => {
                const isDone   = slot.status === "complete" || slot.status === "today_done";
                const isToday  = slot.status === "today_done" || slot.status === "today_pending";
                return (
                  <View key={slot.dateStr} style={styles.streakDotCol}>
                    <Text style={[styles.streakDotLabel, isToday && styles.streakDotLabelToday]}>
                      {slot.dayInitial}
                    </Text>
                    <View style={[
                      styles.streakDot,
                      isDone  && styles.streakDotDone,
                      isToday && !isDone && styles.streakDotToday,
                    ]}>
                      {isDone   && <Text style={styles.streakDotCheck}>✓</Text>}
                      {isToday && !isDone && <View style={styles.streakDotPip} />}
                    </View>
                    <Text style={[styles.streakDotDate, isToday && styles.streakDotDateToday]}>
                      {slot.dateNum}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Close */}
            <Pressable style={[styles.modalBtnGhost, { marginTop: SP[2] }]} onPress={onClose}>
              <Text style={styles.modalBtnGhostText}>Done</Text>
            </Pressable>

          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Streak badge
// ---------------------------------------------------------------------------

function StreakBadge() {
  const { currentStreak } = useTasksStore();
  const [modalVisible, setModalVisible] = useState(false);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.3);

  // Subtle pulse glow when streak is active
  useEffect(() => {
    if (currentStreak > 0) {
      glow.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [currentStreak]);

  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.45,
  }));

  return (
    <>
      <Animated.View style={[styles.streakBadgeWrap, badgeAnimStyle]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          onPressIn={() => { scale.value = withSpring(0.90, { damping: 12, stiffness: 400 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }}
          style={styles.streakBadge}
        >
          <Flame size={16} color="rgba(255,255,255,0.75)" strokeWidth={1.5} fill="rgba(255,255,255,0.18)" />
          <Text style={styles.streakText}>{currentStreak}</Text>
        </Pressable>
      </Animated.View>

      <StreakModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Speech bubble annotation — floats over the hero face image
// ---------------------------------------------------------------------------

function SpeechBubble({
  text,
  top,
  right,
  left,
  delay = 240,
  floatPhase = 0,
}: {
  text: string;
  top: string | number;
  right?: number;
  left?: number;
  delay?: number;
  floatPhase?: number;  // ms offset so bubbles float out of sync
}) {
  const [displayed, setDisplayed] = useState("");
  const floatY = useSharedValue(0);

  // Typewriter
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 52);
    }, delay + 160);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, delay]);

  // Float — starts after entrance, limited to ±3.5px, phase-offset per bubble
  useEffect(() => {
    const t = setTimeout(() => {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-3.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming( 3.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, delay + floatPhase + 400);
    return () => clearTimeout(t);
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(380).springify().damping(18).stiffness(160)}
      style={[
        styles.bubbleWrap,
        { top: top as any, ...(right !== undefined ? { right } : { left }) },
        floatStyle,
      ]}
      accessibilityLabel={text}
    >
      <Text style={styles.bubbleText}>{displayed}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Face target card — images + info
// ---------------------------------------------------------------------------

const AREA_LABELS: Record<string, string> = {
  cheekbones: "Cheekbones",
  jawline:    "Jawline",
  eyes:       "Eye Area",
  skin:       "Skin",
  nose:       "Nasolabial Area",
  all:        "Full Face",
};

const AREA_BENEFIT: Record<string, string> = {
  jawline:    "jawline definition",
  cheekbones: "midface sculpting",
  eyes:       "eye symmetry & lift",
  nose:       "nose contour",
  skin:       "skin circulation",
  all:        "full face balance",
};

function parseFocusAreas(focusSummary: string): string[] {
  if (!focusSummary) return [];
  return focusSummary
    .split(/,|\s*&\s*/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 2); // cap at 2 for layout
}

/** Collapses 5 task intensities into one session-level descriptor. */
function aggregateIntensity(tasks: DailyTask[]): "high" | "medium" | "low" {
  if (!tasks.length) return "medium";
  const counts = { high: 0, medium: 0, low: 0 };
  for (const t of tasks) counts[t.intensity] = (counts[t.intensity] ?? 0) + 1;
  if (counts.high >= 3) return "high";
  if (counts.low >= 3)  return "low";
  return "medium";
}

const INTENSITY_VERB: Record<string, string> = {
  high:   "Intense",
  medium: "Sculpting",
  low:    "Gentle",
};

function buildRoutineDescription(
  tasks: DailyTask[],
  focusSummary: string,
  overloadLabel: string,
): string {
  const areas = parseFocusAreas(focusSummary);
  const intensity = aggregateIntensity(tasks);
  const verb = INTENSITY_VERB[intensity] ?? "Sculpting";

  if (areas.length === 0) {
    return `${verb} session — full face activation.`;
  }

  if (areas.length === 1) {
    const benefit = AREA_BENEFIT[areas[0]] ?? (AREA_LABELS[areas[0]] ?? areas[0]);
    return `${verb} session — ${benefit}.`;
  }

  const b0 = AREA_BENEFIT[areas[0]] ?? (AREA_LABELS[areas[0]] ?? areas[0]);
  const b1 = AREA_BENEFIT[areas[1]] ?? (AREA_LABELS[areas[1]] ?? areas[1]);
  return `${verb} session — ${b0} & ${b1}.`;
}

function ProgressSegment({ filled }: { filled: boolean }) {
  const scaleY     = useSharedValue(filled ? 1 : 0.45);
  const glow       = useSharedValue(filled ? 0.75 : 0);
  const prevFilled = useRef(filled);

  useEffect(() => {
    if (filled && !prevFilled.current) {
      scaleY.value = withSequence(
        withSpring(1.22, { damping: 3, stiffness: 520 }),
        withSpring(1.0,  { damping: 16, stiffness: 280 }),
      );
      glow.value = withTiming(0.75, { duration: 220 });
    } else if (!filled && prevFilled.current) {
      scaleY.value = withTiming(0.45, { duration: 160, easing: Easing.out(Easing.cubic) });
      glow.value   = withTiming(0,    { duration: 160 });
    }
    prevFilled.current = filled;
  }, [filled]);

  const animStyle = useAnimatedStyle(() => ({
    transform:    [{ scaleY: scaleY.value }],
    shadowOpacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.segPill, filled && styles.segPillFilled, animStyle]} />
  );
}

function WorkoutCard({
  tasks,
  focusSummary,
  overloadLabel,
  completedCount,
  totalCount,
}: {
  tasks: DailyTask[];
  focusSummary: string;
  overloadLabel: string;
  completedCount: number;
  totalCount: number;
}) {
  const numScale = useSharedValue(1);

  // ── Header metrics ──────────────────────────────────────────────────────
  const { getDuration } = useExerciseSettings();
  const totalSecs  = tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0);
  const totalMins  = Math.max(1, Math.round(totalSecs / 60));
  const intensity  = aggregateIntensity(tasks);
  const boostPct   = intensity === "high" ? 3 : intensity === "low" ? 1 : 2;

  useEffect(() => {
    if (completedCount > 0) {
      numScale.value = withSequence(
        withSpring(1.3, { damping: 4, stiffness: 500 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
      );
    }
  }, [completedCount]);

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
  }));

  const allDone = completedCount === totalCount && totalCount > 0;

  const cardTarget    = resolveCardTarget(tasks);
  const cardFaceImage = CARD_FACE_IMAGES[cardTarget] ?? CARD_FACE_IMAGES.cheekbones;
  const cardFaceFocus = CARD_FACE_FOCUS[cardTarget] ?? "center";
  const bubbleText    = BUBBLE_TEXT[cardTarget] ?? "full face session";
  const bubbleCfg     = BUBBLE_CONFIG[cardTarget] ?? BUBBLE_CONFIG.cheekbones;
  const muscleText    = MUSCLE_TEXT[cardTarget] ?? "Facial\nmuscle";

  return (
    <View style={styles.workoutCard}>

      {/* ── Top bar: streak badge + session label + metrics ── */}
      <View style={styles.cardTopBar}>
        {/* Row 1: badge + heading */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.cardTopRow}>
          <StreakBadge />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrowLabel} numberOfLines={1}>
              {allDone ? "COMPLETED" : "TODAY'S WORKOUT"}
            </Text>
          </View>
        </Animated.View>
        {/* Row 2: metrics — full card width */}
        <Animated.View entering={FadeIn.delay(80).duration(300)} style={styles.metricsRow}>
          <Text style={styles.metricChip}>~{totalMins} min</Text>
          <Text style={styles.metricChip}>+{boostPct}% lift</Text>
        </Animated.View>
      </View>

      {/* ── Hero image container ── */}
      <View style={styles.heroImageWrap}>
        <ExpoImage
          key={`card-face-${cardTarget}`}
          source={cardFaceImage}
          style={styles.heroImage}
          contentFit="contain"
          contentPosition="center"
          transition={400}
        />

        {/* Top edge fade — blends into card bg above */}
        <LinearGradient
          colors={["rgba(0,0,0,0.28)", "transparent"]}
          style={styles.heroTopFade}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        {/* Bottom edge fade — depth without label */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.48)"]}
          style={styles.heroBottomFade}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        {/* Right bubble — target area */}
        {!allDone && (
          <SpeechBubble
            text={bubbleText}
            top={bubbleCfg.top}
            right={bubbleCfg.right}
            left={bubbleCfg.left}
          />
        )}

        {/* Left bubble — primary muscle */}
        {!allDone && (
          <SpeechBubble
            text={muscleText}
            top="12%"
            left={14}
            delay={480}
            floatPhase={900}
          />
        )}

        {/* All-done overlay */}
        {allDone && (
          <View style={styles.allDoneImgOverlay}>
            <View style={styles.allDoneCircle}>
              <Check size={sw(22)} color="#000" strokeWidth={2.5} />
            </View>
          </View>
        )}
      </View>

      {/* ── Progress row ── */}
      <View style={styles.progressRow}>
        <View style={styles.segPillsRow}>
          {Array.from({ length: totalCount }).map((_, i) => (
            <ProgressSegment key={i} filled={i < completedCount} />
          ))}
        </View>
        <View style={styles.countWrap}>
          <Animated.Text style={[styles.countCompleted, numStyle]}>
            {completedCount}
          </Animated.Text>
          <Text style={styles.countTotal}>/{totalCount}</Text>
        </View>
      </View>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Compact exercise row
// ---------------------------------------------------------------------------

const TASK_DEPTH = 5;

// Formats seconds → "0:30" / "1:00" / "1:30"
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DurationStepper({
  exerciseId,
  isPending,
}: {
  exerciseId: string;
  isPending: boolean;
}) {
  const { getDuration, incrementDuration, decrementDuration } = useExerciseSettings();
  const secs = getDuration(exerciseId);
  const atMin = secs <= 15;
  const atMax = secs >= 90;

  return (
    <View style={styles.durationWrap}>
      {/* Decrease */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); decrementDuration(exerciseId); }}
        disabled={!isPending || atMin}
        hitSlop={8}
        style={({ pressed }) => [
          styles.durationBtn,
          (!isPending || atMin) && styles.durationBtnDisabled,
          pressed && isPending && !atMin && styles.durationBtnPressed,
        ]}
      >
        <Text style={styles.durationBtnText}>−</Text>
      </Pressable>

      {/* Time display */}
      <Text style={[styles.durationText, !isPending && styles.durationTextDark]}>
        {formatDuration(secs)}
      </Text>

      {/* Increase */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); incrementDuration(exerciseId); }}
        disabled={!isPending || atMax}
        hitSlop={8}
        style={({ pressed }) => [
          styles.durationBtn,
          (!isPending || atMax) && styles.durationBtnDisabled,
          pressed && isPending && !atMax && styles.durationBtnPressed,
        ]}
      >
        <Text style={styles.durationBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function ExerciseRow({
  task,
  onStart,
  onMarkDone,
}: {
  task: DailyTask;
  onStart: () => void;
  onMarkDone: () => void;
}) {
  const { uncompleteTask } = useTasksStore();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const isCompleted = task.status === "completed";
  const isSkipped   = task.status === "skipped";
  const isPending   = !isCompleted && !isSkipped;

  // Scale bounce when task transitions to completed
  const rowScale = useSharedValue(1);
  const prevCompletedRef = useRef(false);
  useEffect(() => {
    if (isCompleted && !prevCompletedRef.current) {
      rowScale.value = withSequence(
        withSpring(1.04, { damping: 5, stiffness: 600 }),
        withSpring(1.0,  { damping: 14, stiffness: 200 }),
      );
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted]);
  const rowAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: rowScale.value }] }));

  const confirmCopy = isCompleted
    ? {
        emoji: "↩️",
        title: "Undo completion?",
        body: "This exercise will go back to pending so you can redo it.",
        confirmText: "Yes, undo",
      }
    : {
        emoji: "🔥",
        title: "Add back to list?",
        body: `Add ${task.name} back to today's exercises and complete it for full credit.`,
        confirmText: "Add back",
      };

  const handleStatusPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmVisible(true);
  };

  const handleSkippedCardPress = () => {
    if (!isSkipped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmVisible(true);
  };

  const handleConfirm = () => {
    setConfirmVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    uncompleteTask(task.exerciseId);
  };

  const handleCancel = () => {
    setConfirmVisible(false);
  };

  return (
    <>
      <Animated.View style={rowAnimStyle}>
      <View style={[
        styles.taskCardBase,
        isCompleted && styles.taskCardBaseDone,
        isSkipped   && styles.taskCardBaseSkipped,
      ]}>
        <Pressable
          onPress={isPending ? onStart : isSkipped ? handleSkippedCardPress : undefined}
          disabled={isCompleted}
          style={({ pressed }) => [
            styles.taskCardFace,
            isCompleted && styles.taskCardFaceDone,
            isSkipped   && styles.taskCardFaceSkipped,
            { transform: [{ translateY: isPending && pressed ? TASK_DEPTH : 0 }] },
          ]}
        >
          <View style={styles.taskRow}>
            {/* Icon */}
            <View style={[
              styles.exerciseIconWrap,
              !isPending && styles.exerciseIconDimmed,
            ]}>
              <Image source={getExerciseIcon(task.exerciseId)} style={styles.exerciseIconImg} />
            </View>

            {/* Name + target */}
            <View style={styles.taskLeft}>
              <Text
                style={[
                  styles.taskTitle,
                  isPending   && styles.taskTitlePending,
                  isCompleted && styles.taskTitleDone,
                  isSkipped   && styles.taskTitleSkipped,
                ]}
                numberOfLines={1}
              >
                {task.name}
              </Text>
              <Text
                style={[
                  styles.taskSummary,
                  isPending && styles.taskSummaryPending,
                ]}
                numberOfLines={1}
              >
                {task.targets.map((t) => (t === "all" ? "Full Face" : t)).join(", ")}
              </Text>
            </View>

            {/* Duration stepper — only for pending */}
            {isPending && (
              <DurationStepper exerciseId={task.exerciseId} isPending={isPending} />
            )}

            {/* Status button — only for completed or skipped */}
            {!isPending && (
              <View style={styles.taskRight}>
                <View style={[
                  styles.statusBtnDepth,
                  isCompleted && styles.statusBtnDepthDone,
                  isSkipped   && styles.statusBtnDepthSkipped,
                ]}>
                  <Pressable
                    onPress={handleStatusPress}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.statusBtnFace,
                      isCompleted && styles.statusBtnFaceDone,
                      isSkipped   && styles.statusBtnFaceSkipped,
                      { transform: [{ translateY: pressed ? 3 : 0 }] },
                    ]}
                  >
                    <Text style={[
                      styles.statusBtnGlyph,
                      isCompleted && styles.statusBtnGlyphDone,
                      isSkipped   && styles.statusBtnGlyphSkipped,
                    ]}>
                      {isCompleted ? "✓" : "✗"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </View>
      </Animated.View>

      {/* Confirmation bottom sheet */}
      <Modal
        transparent
        visible={confirmVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.confirmBackdrop} onPress={handleCancel}>
          <Animated.View entering={FadeInDown.duration(240).springify()} style={styles.confirmSheet}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <View style={styles.confirmHandle} />
              <Text style={styles.confirmEmoji}>{confirmCopy.emoji}</Text>
              <Text style={styles.confirmTitle}>{confirmCopy.title}</Text>
              <Text style={styles.confirmBody}>{confirmCopy.body}</Text>
              <View style={styles.confirmBtns}>
                {/* Confirm */}
                <Pressable
                  onPress={handleConfirm}
                  style={({ pressed }) => [
                    isSkipped ? styles.confirmBtnLime : styles.confirmBtnPrimary,
                    { opacity: pressed ? 0.82 : 1 },
                  ]}
                >
                  <Text style={isSkipped ? styles.confirmBtnLimeText : styles.confirmBtnPrimaryText}>
                    {confirmCopy.confirmText}
                  </Text>
                </Pressable>
                {/* Cancel */}
                <Pressable onPress={handleCancel} style={styles.confirmBtnGhost}>
                  <Text style={styles.confirmBtnGhostText}>{isSkipped ? "Keep skipped" : "Keep it"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Protocol row
// ---------------------------------------------------------------------------

const PROTOCOL_EMOJI: Record<string, string> = {
  // lifestyle
  "sprint-session":         "🏃",
  "facial-icing":           "🧊",
  "high-intensity-exercise":"🏋️",
  "nasal-breathing":        "👃",
  "cold-shower":            "🚿",
  "sunlight-exposure":      "☀️",
  "mewing":                 "👅",
  "back-sleeping":          "🛏️",
  // dietary
  "lemon-electrolytes":     "🍋",
  "egg-yolk-banana":        "🍳",
  "black-raisins":          "🍇",
  "raw-banana":             "🍌",
  "beef-liver":             "🫀",
  "red-meat":               "🥩",
  "unsalted-cheese":        "🧀",
  "ashwagandha":            "🌿",
  "raw-milk":               "🥛",
  // skincare
  "cold-water-splash":      "💧",
  "gua-sha":                "🪨",
  "facial-icing-skin":      "🧊",
  "oil-cleanser":           "🫧",
  "bentonite-clay-mask":    "🏺",
  "turmeric-mask":          "🟡",
};

function ProtocolRow({
  protocol,
  onPress,
}: {
  protocol: ProtocolTask;
  onPress: () => void;
}) {
  const isDone = protocol.status === "done";

  const rowScale = useSharedValue(1);
  const prevDoneRef = useRef(false);
  useEffect(() => {
    if (isDone && !prevDoneRef.current) {
      rowScale.value = withSequence(
        withSpring(1.04, { damping: 5, stiffness: 600 }),
        withSpring(1.0,  { damping: 14, stiffness: 200 }),
      );
    }
    prevDoneRef.current = isDone;
  }, [isDone]);
  const rowAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: rowScale.value }] }));

  return (
    <Animated.View style={rowAnimStyle}>
    <View style={[styles.protocolCardBase, isDone && styles.protocolCardBaseDone]}>
      <Pressable
        onPress={isDone ? undefined : onPress}
        disabled={isDone}
        style={({ pressed }) => [
          styles.protocolCardFace,
          isDone && styles.protocolCardFaceDone,
          { transform: [{ translateY: !isDone && pressed ? TASK_DEPTH : 0 }] },
        ]}
      >
        <View style={styles.taskRow}>
          <View style={[styles.protocolIconWrap, isDone && styles.exerciseIconDimmed]}>
            <Text style={styles.protocolEmoji}>{PROTOCOL_EMOJI[protocol.id] ?? PROTOCOL_EMOJI[protocol.type] ?? "💊"}</Text>
          </View>
          <View style={styles.taskLeft}>
            <Text style={[styles.protocolTitle, isDone && styles.protocolTitleDone]} numberOfLines={1}>
              {protocol.name}
            </Text>
            <Text style={styles.protocolQuantity} numberOfLines={1}>
              {protocol.quantity}
            </Text>
          </View>
          <View style={styles.taskRight}>
            <View style={[styles.statusDot, styles.protocolStatusDot, isDone && styles.protocolStatusDotDone]}>
              {isDone && <Text style={styles.statusCheck}>✓</Text>}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Protocol confirmation modal
// ---------------------------------------------------------------------------

function ProtocolConfirmModal({
  visible,
  protocol,
  onDone,
  onDismiss,
}: {
  visible: boolean;
  protocol: ProtocolTask | null;
  onDone: () => void;
  onDismiss: () => void;
}) {
  if (!protocol) return null;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalBackdrop} onPress={onDismiss}>
        <Animated.View entering={FadeInDown.duration(250).springify()} style={styles.modalCard}>
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <Text style={styles.modalTitle}>Did you complete this?</Text>
            <Text style={styles.modalExercise}>{protocol.name}</Text>
            <Text style={styles.modalHint}>{protocol.reason}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnGhost} onPress={onDismiss}>
                <Text style={styles.modalBtnGhostText}>Not yet</Text>
              </Pressable>
              <View style={styles.modalBtnDepth}>
                <Pressable
                  onPress={onDone}
                  style={({ pressed }) => [
                    styles.modalBtnPressable,
                    { transform: [{ translateY: pressed ? 5 : 0 }] },
                  ]}
                >
                  <LinearGradient
                    colors={["#CCFF6B", "#B4F34D"]}
                    locations={[0, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.modalBtnGradient}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Done ✓</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Mark-done confirmation modal
// Shown when user taps the circle on an exercise row — skips the timer.
// ---------------------------------------------------------------------------

function MarkDoneModal({
  visible,
  task,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  task: DailyTask | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  if (!task) return null;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalBackdrop} onPress={onDismiss}>
        <Animated.View entering={FadeInDown.duration(250).springify()} style={styles.modalCard}>
          {/* Inner Pressable absorbs taps so backdrop doesn't close on card tap */}
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <Text style={styles.modalTitle}>Done already?</Text>
            <Text style={styles.modalExercise}>{task.name}</Text>
            <Text style={styles.modalHint}>Mark as complete — skip the timer</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnGhost} onPress={onDismiss}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>
              <View style={styles.modalBtnDepth}>
                <Pressable
                  onPress={onConfirm}
                  style={({ pressed }) => [
                    styles.modalBtnPressable,
                    { transform: [{ translateY: pressed ? 5 : 0 }] },
                  ]}
                >
                  <LinearGradient
                    colors={["#CCFF6B", "#B4F34D"]}
                    locations={[0, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.modalBtnGradient}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Mark Done ✓</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// AllDoneOverlay — shown every visit when today's tasks are all complete
// ---------------------------------------------------------------------------

function AllDoneOverlay({
  streak,
  onGotIt,
  onViewTasks,
}: {
  streak: number;
  onGotIt: () => void;
  onViewTasks: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={overlayStyles.root}>
      {/* Dark blurred backdrop */}
      <LinearGradient
        colors={["rgba(0,0,0,0.97)", "rgba(11,11,11,0.97)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={overlayStyles.inner}>
        {/* Icon */}
        <View style={overlayStyles.iconWrap}>
          <Text style={overlayStyles.iconEmoji}>🏆</Text>
        </View>

        {/* Headline */}
        <Text style={overlayStyles.headline}>You're done for today.</Text>

        {/* Sub-copy */}
        <Text style={overlayStyles.body}>
          Every rep counts. Every day compounds.{"\n"}
          Come back tomorrow to keep your{" "}
          <Text style={overlayStyles.streakHighlight}>
            {streak}-day streak
          </Text>{" "}
          alive.
        </Text>

        {/* Streak pill */}
        <View style={overlayStyles.streakPill}>
          <Text style={overlayStyles.streakPillText}>🔥 {streak} day{streak !== 1 ? "s" : ""} strong</Text>
        </View>

        {/* Buttons */}
        <View style={overlayStyles.btnRow}>
          <LimeButton label="Got it" onPress={onGotIt} />

          {/* Secondary: View tasks anyway */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewTasks();
            }}
            style={({ pressed }) => [overlayStyles.btnSecondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={overlayStyles.btnSecondaryText}>View tasks anyway</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: sw(SP[6]),
  },
  inner: {
    width: "100%",
    alignItems: "center",
    gap: sh(SP[4]),
  },
  iconWrap: {
    width: sw(80),
    height: sw(80),
    borderRadius: sw(40),
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sh(SP[2]),
  },
  iconEmoji: {
    fontSize: ms(38),
  },
  headline: {
    fontSize: ms(28),
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: ms(15),
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: ms(24),
  },
  streakHighlight: {
    color: COLORS.accent,
    fontFamily: "Poppins-SemiBold",
  },
  streakPill: {
    paddingHorizontal: sw(SP[5]),
    paddingVertical: sh(SP[2]),
    borderRadius: sw(RADII.pill),
    backgroundColor: "rgba(251,146,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.30)",
  },
  streakPillText: {
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    color: "#FB923C",
  },
  btnRow: {
    width: "100%",
    gap: sh(SP[3]),
    marginTop: sh(SP[2]),
  },
  btnSecondary: {
    paddingVertical: sh(SP[3]),
    alignItems: "center",
  },
  btnSecondaryText: {
    fontSize: ms(14),
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    textDecorationLine: "underline",
  },
});

// ---------------------------------------------------------------------------
// Start Session button — self-contained with breathing glow
// ---------------------------------------------------------------------------

function StartSessionBtn({ onPress }: { onPress: () => void }) {
  const glowOpacity = useSharedValue(0.35);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(0.75, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const depthAnimStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.startSessionDepth, depthAnimStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.startSessionBtn,
          { transform: [{ translateY: pressed ? 4 : 0 }] },
        ]}
      >
        <LinearGradient
          colors={["#CCFF6B", "#B4F34D"]}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.startSessionGradient}
        >
          <Text style={styles.startSessionText}>▶  Start Session</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TasksScreen() {
  const {
    today,
    currentStreak,
    loading,
    initToday,
    completeTask,
    completeProtocol,
    setMood,
    markCompletionModalShown,
    completionModalShownDate,
  } = useTasksStore();
  const { displayName } = useProfile();

  const [showMoodCheck, setShowMoodCheck]         = useState(false);
  const [markDoneTask, setMarkDoneTask]           = useState<DailyTask | null>(null);
  const [confirmProtocol, setConfirmProtocol]     = useState<ProtocolTask | null>(null);
  const [showAllDoneOverlay, setShowAllDoneOverlay] = useState(false);

  // Life modals
  type LifeModal = "comeback" | "streak" | "halfway" | "didyouknow";
  const [activeLifeModal, setActiveLifeModal]     = useState<LifeModal | null>(null);
  const activeLifeModalRef                        = useRef<LifeModal | null>(null);
  const [missedDays, setMissedDays]               = useState(0);
  const [celebMilestone, setCelebMilestone]       = useState(0);
  const [currentFact, setCurrentFact]             = useState("");
  // Streak celebration is deferred until after DayComplete + MoodCheck flow
  const [pendingStreakMilestone, setPendingStreakMilestone] = useState(0);

  const showLifeModal = useCallback((type: LifeModal) => {
    if (activeLifeModalRef.current !== null) return;
    if (introVisibleRef.current) return; // never interrupt the intro splash
    activeLifeModalRef.current = type;
    setActiveLifeModal(type);
  }, []);

  const closeLifeModal = useCallback(() => {
    activeLifeModalRef.current = null;
    setActiveLifeModal(null);
  }, []);

  // On screen focus: show AllDoneOverlay if tasks are all done, and also detect
  // when exercises were completed in the session screen (show MoodCheckModal).
  useFocusEffect(
    useCallback(() => {
      const state = useTasksStore.getState();

      if (state.today?.allComplete) {
        setShowAllDoneOverlay(true);
      }

      // If completedOnce became true while we were in the session screen and we
      // haven't shown the completion modal for today yet, show MoodCheck now.
      // Uses persisted completionModalShownDate so force-kill + reopen doesn't
      // re-show the modal.
      if (
        state.today?.completedOnce &&
        state.completionModalShownDate !== state.today.date
      ) {
        state.markCompletionModalShown(state.today.date);
        setTimeout(() => setShowMoodCheck(true), 300);
      }
    }, [])
  );

  // Life modal: comeback + did-you-know (once per session each)
  useFocusEffect(
    useCallback(() => {
      setTimeout(() => {
        // Never interrupt intro splash or show over the all-done overlay
        if (introVisibleRef.current) return;
        if (useTasksStore.getState().today?.allComplete) return;

        // Priority 1: Comeback — user missed 2+ consecutive days.
        // _comebackChecked is an in-session guard (prevents duplicate async calls
        // within one JS runtime). canShowComeback() is the persistent guard —
        // it writes to AsyncStorage so hot-reloads and force-kill/reopen don't
        // re-show the modal for the same streak-break window.
        if (!_comebackChecked) {
          _comebackChecked = true;
          const history = useTasksStore.getState().history ?? [];
          const missed   = getConsecutiveMissed(history);
          if (missed >= 2) {
            const lastCompletedDate =
              [...history]
                .filter((r) => r.streakEarned)
                .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
            canShowComeback(lastCompletedDate, getLocalDateString()).then((can) => {
              if (can) {
                setMissedDays(missed);
                showLifeModal("comeback");
              }
            });
            return;
          }
        }
        // Priority 2: Did You Know — at most once per 2 days
        if (!_didYouKnowChecked) {
          _didYouKnowChecked = true;
          canShowDidYouKnow(getLocalDateString()).then(({ show, fact }) => {
            if (show) {
              setCurrentFact(fact);
              showLifeModal("didyouknow");
            }
          });
        }
      }, 600);
    }, [showLifeModal])
  );

  // Life modal: streak milestone (3 or 7 days) — queued for after DayComplete+MoodCheck flow
  useEffect(() => {
    if (currentStreak !== 3 && currentStreak !== 7) return;
    getShownMilestones().then((shown) => {
      if (shown.includes(currentStreak)) return;
      markMilestoneShown(currentStreak);
      setCelebMilestone(currentStreak);
      // pendingStreakMilestone is flushed after MoodCheck closes.
      setPendingStreakMilestone(currentStreak);
    });
  }, [currentStreak]);

  // Intro splash — once per day
  const todayDateStr = getLocalDateString();
  const [introVisible, setIntroVisible] = useState(lastIntroDate !== todayDateStr);
  // Ref so event callbacks (showLifeModal, useFocusEffect) can read intro state without stale closures
  const introVisibleRef = useRef(introVisible);
  useEffect(() => { introVisibleRef.current = introVisible; }, [introVisible]);
  const introTimerDoneRef = useRef(false);

  useEffect(() => { initToday(); }, []);

  useEffect(() => {
    if (!introVisible) return;
    const t = setTimeout(() => {
      introTimerDoneRef.current = true;
      if (!useTasksStore.getState().loading) {
        lastIntroDate = todayDateStr;
        setIntroVisible(false);
        // Navigate to streak screen only on the first app open of the day
        shouldShowDailyFlow(todayDateStr).then((should) => {
          if (should) {
            markDailyFlowShown(todayDateStr);
            router.push("/program/streak");
          }
        });
      }
    }, 2700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!introVisible || !introTimerDoneRef.current || loading) return;
    lastIntroDate = todayDateStr;
    setIntroVisible(false);
    // Navigate to streak screen only on the first app open of the day
    shouldShowDailyFlow(todayDateStr).then((should) => {
      if (should) {
        markDailyFlowShown(todayDateStr);
        router.push("/program/streak");
      }
    });
  }, [loading, introVisible]);

  // Midnight refresh — polls every 60s using local date so rollover matches local midnight
  useEffect(() => {
    const interval = setInterval(() => {
      if (today?.date !== getLocalDateString()) initToday();
    }, 60_000);
    return () => clearInterval(interval);
  }, [today?.date, initToday]);

  // Shared completion path — used by both timer callback and mark-done circle.
  // Reads actual store state after update so day-complete check works with the
  // 3-item streak threshold (not the old all-tasks logic).
  const handleTaskComplete = useCallback((exerciseId: string) => {
    const alreadyCounted = useTasksStore.getState().today?.completedOnce ?? false;
    completeTask(exerciseId);
    const newState = useTasksStore.getState();
    const nowCounted = newState.today?.completedOnce ?? false;
    if (!alreadyCounted && nowCounted && newState.today) {
      markCompletionModalShown(newState.today.date);
      setTimeout(() => setShowMoodCheck(true), 150);
    }
  }, [completeTask, markCompletionModalShown]);

  // Circle tap → MarkDoneModal confirm
  const handleMarkDoneConfirm = useCallback(() => {
    if (!markDoneTask) return;
    const task = markDoneTask;
    setMarkDoneTask(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleTaskComplete(task.exerciseId);
  }, [markDoneTask, handleTaskComplete]);

  // Compute before early return so halfway effect can use these values
  const tasks          = today?.tasks ?? [];
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount     = tasks.length;
  const halfwayReached = totalCount > 0 && completedCount >= totalCount / 2;

  // Life modal: halfway hype — once per day when 50% of exercises are done.
  // Guard: don't fire while intro is showing or tasks are still loading.
  // Including introVisible + loading in deps means the effect re-evaluates when
  // intro clears — so if halfway was reached during loading it shows right after.
  useEffect(() => {
    if (!halfwayReached || introVisible || loading || !today) return;
    canShowHalfway(getLocalDateString()).then((can) => {
      if (can) showLifeModal("halfway");
    });
  }, [halfwayReached, introVisible, loading, today, showLifeModal]);

  // Card fade-away on scroll — must stay above early return (rules of hooks)
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const cardFadeStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(scrollY.value, [0, 140], [1, 0],  Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 140], [0, -18], Extrapolation.CLAMP) }],
  }));

  if (introVisible || loading || !today) return <TasksLoadingScreen />;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Single scrollable body ── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          tasks.some((t) => t.status === "pending") && styles.scrollContentWithBtn,
        ]}
      >
        {/* Workout card — fades away on scroll */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.cardSection, cardFadeStyle]}
        >
          <WorkoutCard
            tasks={tasks}
            focusSummary={today.focusSummary}
            overloadLabel={today.tasks[0]?.overloadLabel ?? "Base"}
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </Animated.View>

        {/* Thin divider between card and list */}
        <View style={styles.listDivider} />

        {/* Exercises section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionAccentBar} />
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.sectionHint}>
            {tasks.every((t) => t.status !== "pending")
              ? "All done"
              : `${tasks.filter((t) => t.status === "pending").length} left`}
          </Text>
        </View>

        {/* Exercise rows */}
        <View style={styles.exerciseList}>
          {tasks.map((task, idx) => (
            <Animated.View
              key={task.exerciseId}
              entering={FadeInDown.duration(300).delay(idx * 50)}
            >
              <ExerciseRow
                task={task}
                onStart={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/program/guide/[exerciseId]",
                    params: { exerciseId: task.exerciseId },
                  });
                }}
                onMarkDone={() => setMarkDoneTask(task)}
              />
            </Animated.View>
          ))}

          {/* ── Protocols ── */}
          {today.protocols?.length > 0 && (
            <>
              <View style={styles.protocolsHeader}>
                <View style={styles.sectionAccentBar} />
                <Text style={styles.protocolsTitle}>Diet</Text>
                <Text style={styles.sectionHint}>
                  {today.protocols.every((p) => p.status === "done") ? "All done" : `${today.protocols.filter((p) => p.status === "pending").length} left`}
                </Text>
              </View>
              {today.protocols.map((protocol, idx) => (
                <Animated.View
                  key={protocol.id}
                  entering={FadeInDown.duration(300).delay((tasks.length + idx) * 50)}
                >
                  <ProtocolRow
                    protocol={protocol}
                    onPress={() => setConfirmProtocol(protocol)}
                  />
                </Animated.View>
              ))}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Floating Start Session button — sits above scroll ── */}
      {tasks.some((t) => t.status === "pending") && (
        <View style={styles.floatingBtnWrap} pointerEvents="box-none">
          <StartSessionBtn
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/program/session");
            }}
          />
        </View>
      )}

      {/* ── Modals ── */}
      <MarkDoneModal
        visible={markDoneTask !== null}
        task={markDoneTask}
        onConfirm={handleMarkDoneConfirm}
        onDismiss={() => setMarkDoneTask(null)}
      />

      <MoodCheckModal
        visible={showMoodCheck}
        dayNumber={currentStreak}
        onSelect={(mood) => {
          setMood(mood);
          setShowMoodCheck(false);
          if (pendingStreakMilestone > 0) {
            setPendingStreakMilestone(0);
            setTimeout(() => showLifeModal("streak"), 300);
          }
        }}
        onSkip={() => {
          setShowMoodCheck(false);
          if (pendingStreakMilestone > 0) {
            setPendingStreakMilestone(0);
            setTimeout(() => showLifeModal("streak"), 300);
          }
        }}
      />

      <ProtocolConfirmModal
        visible={confirmProtocol !== null}
        protocol={confirmProtocol}
        onDone={() => {
          if (confirmProtocol) {
            const alreadyCounted = useTasksStore.getState().today?.completedOnce ?? false;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            completeProtocol(confirmProtocol.id, true);
            const newState = useTasksStore.getState();
            const nowCounted = newState.today?.completedOnce ?? false;
            if (!alreadyCounted && nowCounted && newState.today) {
              markCompletionModalShown(newState.today.date);
              setTimeout(() => setShowMoodCheck(true), 150);
            }
          }
          setConfirmProtocol(null);
        }}
        onDismiss={() => setConfirmProtocol(null)}
      />

      {/* All-done overlay — shown every visit when today is fully complete */}
      {showAllDoneOverlay && (
        <AllDoneOverlay
          streak={currentStreak}
          onGotIt={() => setShowAllDoneOverlay(false)}
          onViewTasks={() => setShowAllDoneOverlay(false)}
        />
      )}

      {/* ── Life moment modals ── */}
      <ComebackModal
        visible={activeLifeModal === "comeback"}
        missedDays={missedDays}
        onClose={closeLifeModal}
      />
      <StreakCelebrationModal
        visible={activeLifeModal === "streak"}
        streakDays={celebMilestone}
        onClose={closeLifeModal}
      />
      <HalfwayHypeModal
        visible={activeLifeModal === "halfway"}
        completedCount={completedCount}
        totalCount={totalCount}
        onClose={closeLifeModal}
      />
      <DidYouKnowModal
        visible={activeLifeModal === "didyouknow"}
        fact={currentFact}
        onClose={closeLifeModal}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgBottom },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: sh(SP[4]) },
  loadingTitle: { color: COLORS.text, fontSize: ms(22), fontFamily: "Poppins-SemiBold" },
  progressTrackLoading: {
    width: sw(120),
    height: sh(2),
    borderRadius: sw(1),
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressFillLoading: {
    height: "100%",
    borderRadius: sw(1),
    backgroundColor: COLORS.accent,
  },
  phraseContainer: {
    height: sh(18),
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: sw(SP[6]),
  },
  loadingPhrase: {
    position: "absolute",
    color: COLORS.sub,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    width: "100%",
  },

  // Layout — unified scroll
  scrollContent: {
    paddingHorizontal: sw(SP[4]),
    paddingBottom: sh(SP[4]),
  },
  scrollContentWithBtn: {
    paddingBottom: sh(100),
  },
  cardSection: {
    paddingTop: sh(SP[3]),
    paddingBottom: sh(SP[2]),
  },
  listDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginBottom: sh(SP[1]),
  },

  // Start Session button
  startSessionDepth: {
    borderRadius: sw(RADII.pill),
    backgroundColor: COLORS.accentDepth,
    paddingBottom: sh(4),
    marginBottom: sh(SP[3]),
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: sw(16),
    shadowOffset: { width: 0, height: sh(6) },
    elevation: 10,
  },
  startSessionBtn: {
    height: sh(48),
    borderRadius: sw(RADII.pill),
    overflow: "hidden",
  },
  startSessionGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: sw(RADII.pill),
  },
  startSessionText: {
    color: "#0B0B0B",
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },

  // ── Face target card ────────────────────────────────────────────────────────
  workoutCard: {
    borderRadius: sw(20),
    overflow: "hidden",
    backgroundColor: "#0F0F0F",
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: sw(28),
    shadowOffset: { width: 0, height: sh(10) },
    elevation: 14,
  },

  // Images
  targetImagesRow: {
    flexDirection: "row",
    height: sh(148),
    position: "relative",
  },
  targetImageWrap: {
    flex: 1,
    overflow: "hidden",
  },
  targetImageGap: {
    marginLeft: sw(2),
  },
  targetImage: {
    width: "100%",
    height: "100%",
  },

  // Area chip overlay on each image (bottom-left)
  areaChip: {
    position: "absolute",
    bottom: sh(10),
    left: sw(10),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: sw(20),
    paddingHorizontal: sw(10),
    paddingVertical: sh(4),
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.25)",
  },
  areaChipDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: COLORS.accent,
  },
  areaChipText: {
    color: "#FFFFFF",
    fontSize: ms(11),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
  },

  allDoneImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems: "center",
    justifyContent: "center",
  },
  allDoneCircle: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Top bar: streak badge + session label ──────────────────────────────
  cardTopBar: {
    flexDirection: "column",
    justifyContent: "center",
    gap: sh(3),
    height: TOPBAR_H,
    paddingHorizontal: sw(16),
    paddingVertical: sh(5),
  },
  // Row 1: badge + heading
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
  },
  // Label row (● TODAY'S WORKOUT)
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    flex: 1,
  },
  // Row 2: metrics spanning full card width
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrowDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: COLORS.accent,
  },
  eyebrowLabel: {
    color: "rgba(255,255,255,0.88)",
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    flex: 1,
    textAlign: "center",
  },
  metricChip: {
    color: "rgba(255,255,255,0.55)",
    fontSize: ms(10.5),
    fontFamily: "Poppins-Regular",
    letterSpacing: 0.3,
  },

  // ── Hero image ──────────────────────────────────────────────────────────
  heroImageWrap: {
    marginHorizontal: sw(16),
    height: HERO_IMAGE_H,
    borderRadius: sw(14),
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: sh(52),
  },
  heroBottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: sh(64),
  },

  // ── Speech bubble annotation ────────────────────────────────────────────
  bubbleWrap: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: sw(6),
    paddingHorizontal: sw(6),
    paddingVertical: sh(4),
    minWidth: sw(64),
    maxWidth: sw(82),
    minHeight: sh(24),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: sh(1.5) },
    shadowOpacity: 0.16,
    shadowRadius: sw(4),
    elevation: 4,
  },
  bubbleText: {
    fontSize: ms(8),
    fontFamily: "Poppins-SemiBold",
    color: "#0D0D0D",
    letterSpacing: 0.1,
    lineHeight: ms(11.5),
    textAlign: "left",
  },
  // ── Progress row ────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    height: PROGRESS_ROW_H,
    paddingHorizontal: sw(16),
    gap: sw(14),
  },
  // Segmented pill track
  segPillsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
  },
  segPill: {
    flex: 1,
    height: sh(7),
    borderRadius: sw(4),
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  segPillFilled: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowRadius: sw(6),
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  // Counter
  countWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: sw(1),
  },
  countCompleted: {
    color: COLORS.text,
    fontSize: ms(16),
    fontFamily: "Poppins-SemiBold",
    fontVariant: ["tabular-nums"],
    lineHeight: ms(20),
  },
  countTotal: {
    color: "rgba(255,255,255,0.35)",
    fontSize: ms(11),
    fontFamily: "Poppins-Regular",
    fontVariant: ["tabular-nums"],
  },
  // Streak badge
  streakBadgeWrap: {
    borderRadius: sw(RADII.pill),
    shadowColor: "#000000",
    shadowRadius: sw(8),
    shadowOffset: { width: 0, height: sh(2) },
    shadowOpacity: 0.4,
    elevation: 4,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    paddingHorizontal: sw(SP[3]),
    paddingVertical: sh(SP[1] + 1),
    borderRadius: sw(RADII.pill),
    backgroundColor: "#1C1C1C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  streakText: { color: COLORS.text, fontSize: ms(13), fontFamily: "Poppins-SemiBold" },

  // Streak modal
  streakBigNum: {
    color: "#FFAA32",
    fontSize: ms(64),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -3,
    textAlign: "center",
    lineHeight: ms(70),
    marginBottom: sh(SP[1]),
  },
  streakDivider: {
    width: "100%",
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: sh(SP[4]),
  },
  streakDotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: sh(SP[3]),
  },
  streakDotCol: {
    alignItems: "center",
    gap: sh(6),
    flex: 1,
  },
  streakDotLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: ms(11),
    fontFamily: "Poppins-SemiBold",
    textTransform: "uppercase",
  },
  streakDotLabelToday: {
    color: COLORS.accent,
  },
  streakDot: {
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakDotDone: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  streakDotToday: {
    borderColor: COLORS.accent,
    borderWidth: 2,
    backgroundColor: "rgba(180,243,77,0.08)",
  },
  streakDotPip: {
    width: sw(7),
    height: sw(7),
    borderRadius: sw(4),
    backgroundColor: COLORS.accent,
  },
  streakDotCheck: {
    color: "#0B0B0B",
    fontSize: ms(12),
    fontFamily: "Poppins-SemiBold",
  },
  streakDotDate: {
    color: "rgba(255,255,255,0.25)",
    fontSize: ms(10),
    fontFamily: "Poppins-SemiBold",
  },
  streakDotDateToday: {
    color: COLORS.accent,
  },

  tierPill: {
    alignSelf: "flex-start",
    paddingHorizontal: sw(SP[3]),
    paddingVertical: sh(4),
    borderRadius: sw(RADII.pill),
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
  },
  tierPillText: {
    color: COLORS.accent,
    fontSize: ms(11),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: sh(SP[3]),
    paddingBottom: sh(SP[2]),
    gap: sw(8),
  },
  sectionAccentBar: {
    width: sw(3),
    height: sh(16),
    borderRadius: sw(2),
    backgroundColor: COLORS.accent,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
  },
  sectionHint: {
    color: COLORS.sub,
    fontSize: ms(12),
    fontFamily: "Poppins-SemiBold",
  },

  // Exercise list
  exerciseList: { gap: sh(SP[2]) },
  floatingBtnWrap: {
    position: "absolute",
    bottom: sh(SP[4]),
    left: sw(SP[4]),
    right: sw(SP[4]),
  },

  // Task cards — 3D depth style
  taskCardBase: {
    borderRadius: sw(RADII.lg),
    backgroundColor: "#CCCCCC",
    paddingBottom: TASK_DEPTH,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: sw(10),
    shadowOffset: { width: 0, height: sh(4) },
    elevation: 4,
  },
  taskCardBaseDone: {
    backgroundColor: "rgba(180,243,77,0.20)",
    shadowOpacity: 0,
    elevation: 0,
  },
  taskCardBaseSkipped: {
    backgroundColor: "rgba(239,68,68,0.15)",
    shadowOpacity: 0,
    elevation: 0,
  },
  taskCardFace: {
    borderRadius: sw(RADII.lg),
    paddingVertical: sh(10),
    paddingHorizontal: sw(SP[3]),
    backgroundColor: "#FFFFFF",
  },
  taskCardFaceDone: {
    backgroundColor: "rgba(180,243,77,0.08)",
  },
  taskCardFaceSkipped: {
    backgroundColor: "rgba(239,68,68,0.07)",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(SP[2]),
  },
  exerciseIconWrap: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(8),
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseIconDimmed: { opacity: 0.45 },
  exerciseIconImg: { width: sw(34), height: sw(34), resizeMode: "cover" },
  taskLeft: { flex: 1, gap: sh(1) },
  taskTitle: {
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },
  taskTitlePending: { color: "#111111" },
  taskTitleDone:    { color: COLORS.sub },
  taskTitleSkipped: { color: COLORS.sub },
  taskSummary: {
    fontSize: ms(11),
    fontFamily: "Poppins-SemiBold",
    textTransform: "capitalize",
    color: COLORS.sub,
  },
  taskSummaryPending: { color: "rgba(0,0,0,0.50)" },
  taskReason: {
    color: "rgba(11,11,11,0.40)",
    fontSize: ms(10),
    fontFamily: "Poppins-SemiBold",
    marginTop: 0,
  },
  taskRight: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Duration stepper: − 0:30 +
  durationWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    marginRight: sw(SP[1]),
  },
  durationBtn: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(13),
    backgroundColor: "rgba(0,0,0,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBtnPressed: {
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  durationBtnDisabled: {
    opacity: 0.30,
  },
  durationBtnText: {
    color: "rgba(0,0,0,0.65)",
    fontSize: ms(16),
    fontFamily: "Poppins-SemiBold",
    lineHeight: ms(19),
  },
  durationText: {
    color: "rgba(0,0,0,0.50)",
    fontSize: ms(12),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.4,
    minWidth: sw(28),
    textAlign: "center",
  },
  durationTextDark: {
    color: COLORS.sub,
  },

  // Undo confirmation bottom sheet
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "flex-end",
  },
  confirmSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: sw(RADII.xl),
    borderTopRightRadius: sw(RADII.xl),
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: sw(SP[5]),
    paddingBottom: sh(40),
    alignItems: "center",
  },
  confirmHandle: {
    width: sw(36),
    height: sh(4),
    borderRadius: sw(2),
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginTop: sh(SP[3]),
    marginBottom: sh(SP[4]),
  },
  confirmEmoji: {
    fontSize: ms(36),
    textAlign: "center",
    marginBottom: sh(SP[2]),
  },
  confirmTitle: {
    color: COLORS.text,
    fontSize: ms(18),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: sh(SP[2]),
  },
  confirmBody: {
    color: COLORS.sub,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    lineHeight: ms(20),
    marginBottom: sh(SP[5]),
    paddingHorizontal: sw(SP[2]),
  },
  confirmBtns: {
    width: "100%",
    gap: sh(SP[2]),
  },
  confirmBtnPrimary: {
    height: sh(50),
    borderRadius: sw(RADII.pill),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnPrimaryText: {
    color: COLORS.text,
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
  },
  confirmBtnLime: {
    height: sh(50),
    borderRadius: sw(RADII.pill),
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnLimeText: {
    color: "#0A1A00",
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
  },
  confirmBtnGhost: {
    height: sh(48),
    borderRadius: sw(RADII.pill),
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnGhostText: {
    color: COLORS.sub,
    fontSize: ms(14),
    fontFamily: "Poppins-SemiBold",
  },

  // Protocol status dot
  statusDot: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(13),
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCheck: {
    color: "#B4F34D",
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
  },

  // Unified 3D status button: shows ○ / ✓ / ✗
  statusBtnDepth: {
    borderRadius: sw(17),
    backgroundColor: "#999999",
    paddingBottom: sh(3),
  },
  statusBtnDepthDone: {
    backgroundColor: COLORS.accentDepth,
  },
  statusBtnDepthSkipped: {
    backgroundColor: "#991B1B",
  },
  statusBtnFace: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(17),
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBtnFaceDone: {
    backgroundColor: COLORS.accent,
  },
  statusBtnFaceSkipped: {
    backgroundColor: "#EF4444",
  },
  statusBtnGlyph: {
    fontSize: ms(14),
    fontFamily: "Poppins-SemiBold",
    color: COLORS.sub,
    lineHeight: ms(17),
  },
  statusBtnGlyphDone: {
    color: "#0B0B0B",
  },
  statusBtnGlyphSkipped: {
    color: "#0B0B0B",
  },

  // Protocol cards — 3D depth style
  protocolCardBase: {
    borderRadius: sw(RADII.lg),
    backgroundColor: "#2A2A2A",
    paddingBottom: TASK_DEPTH,
    shadowColor: "#000000",
    shadowOpacity: 0.40,
    shadowRadius: sw(10),
    shadowOffset: { width: 0, height: sh(4) },
    elevation: 6,
  },
  protocolCardBaseDone: {
    backgroundColor: "#1A1A1A",
    shadowOpacity: 0,
    elevation: 0,
  },
  protocolCardFace: {
    borderRadius: sw(RADII.lg),
    paddingVertical: sh(6),
    paddingHorizontal: sw(SP[3]),
    backgroundColor: "#222222",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  protocolCardFaceDone: {
    backgroundColor: "#181818",
    borderColor: "rgba(255,255,255,0.05)",
  },
  protocolIconWrap: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(8),
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolEmoji: { fontSize: ms(18) },
  protocolTitle: {
    color: COLORS.text,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
  },
  protocolTitleDone: { color: "rgba(255,255,255,0.30)" },
  protocolQuantity: {
    color: "rgba(255,255,255,0.50)",
    fontSize: ms(11),
    fontFamily: "Poppins-SemiBold",
  },
  protocolStatusDot: {
    borderColor: "rgba(255,255,255,0.25)",
  },
  protocolStatusDotDone: {
    backgroundColor: "#0B0B0B",
    borderColor: "#0B0B0B",
  },

  // Protocols section header
  protocolsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: sh(SP[4]),
    paddingBottom: sh(SP[2]),
    gap: sw(8),
  },
  protocolsTitle: {
    flex: 1,
    color: COLORS.sub,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Confirmation modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: sh(40),
    paddingHorizontal: sw(SP[4]),
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: sw(RADII.xl),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: sw(SP[5]),
    alignItems: "center",
  },
  modalTitle: {
    color: COLORS.sub,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: sh(SP[2]),
  },
  modalExercise: {
    color: COLORS.text,
    fontSize: ms(24),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: sh(SP[1]),
  },
  modalHint: {
    color: COLORS.sub,
    fontSize: ms(13),
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: sh(SP[5]),
  },
  modalBtns: {
    flexDirection: "row",
    gap: sw(SP[3]),
    width: "100%",
  },
  modalBtnGhost: {
    flex: 1,
    height: sh(48),
    borderRadius: sw(RADII.pill),
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhostText: {
    color: COLORS.sub,
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
  },
  modalBtnDepth: {
    flex: 2,
    borderRadius: sw(RADII.pill),
    backgroundColor: "#6B9A1E",
    paddingBottom: sh(5),
    shadowColor: "#B4F34D",
    shadowOpacity: 0.45,
    shadowRadius: sw(18),
    shadowOffset: { width: 0, height: sh(8) },
    elevation: 10,
  },
  modalBtnPressable: {
    height: sh(48),
    borderRadius: sw(RADII.pill),
    overflow: "hidden",
  },
  modalBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: sw(RADII.pill),
  },
  modalBtnPrimaryText: {
    color: "#0B0B0B",
    fontSize: ms(15),
    fontFamily: "Poppins-SemiBold",
  },
});
