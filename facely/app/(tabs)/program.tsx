// app/(tabs)/program.tsx
// Daily exercise screen — workout card (top 70%) + compact exercise list (bottom 30%)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useTasksStore, type DailyTask, type ProtocolTask, type DayRecord } from "@/store/tasks";
import { useScores, type Scores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
import { useProfile } from "@/store/profile";
import { getExerciseIcon } from "@/lib/exerciseIcons";

// Module-level: only show intro splash once per day
let lastIntroDate: string | null = null;

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

function getConsecutiveMissed(history: DayRecord[]): number {
  if (!history.length) return 0;

  // Find the most recent completed day — anchor point for missed-day counting
  const lastComplete = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((r) => r.allComplete);
  if (!lastComplete) return 0;

  // Count days between yesterday and lastComplete that have no completed record
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    if (ds <= lastComplete.date) break; // reached the last completed day — stop
    const record = history.find((r) => r.date === ds);
    if (!record || !record.allComplete) count++;
    else break;
  }
  return count;
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
    d.setUTCDate(d.getUTCDate() - i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    let status: DayStatus;
    if (i === 0) {
      status = today?.allComplete ? "today_done" : "today_pending";
    } else {
      const record = history.find((r) => r.date === dateStr);
      status = record?.allComplete ? "complete" : "missed";
    }

    slots.push({ dateStr, dayInitial: DAY_INITIALS[d.getUTCDay()], dateNum: d.getUTCDate(), status });
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
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakText}>{currentStreak}</Text>
        </Pressable>
      </Animated.View>

      <StreakModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Top workout card (the 70% section)
// ---------------------------------------------------------------------------

function WorkoutCard({
  streak,
  focusSummary,
  overloadLabel,
  completedCount,
  totalCount,
  userName,
}: {
  streak: number;
  focusSummary: string;
  overloadLabel: string;
  completedCount: number;
  totalCount: number;
  userName: string | null;
}) {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const barWidth = useSharedValue(0);
  const numScale = useSharedValue(1);

  useEffect(() => {
    barWidth.value = withSpring(progress, { damping: 18, stiffness: 100 });
  }, [progress]);

  useEffect(() => {
    if (completedCount > 0) {
      numScale.value = withSequence(
        withSpring(1.3, { damping: 5, stiffness: 500 }),
        withSpring(1.0, { damping: 10, stiffness: 200 }),
      );
    }
  }, [completedCount]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
  }));

  const allDone = completedCount === totalCount && totalCount > 0;

  const firstName = userName?.split(" ")[0] ?? null;

  let heroPrefix = "";
  let heroTargets = "";
  if (allDone) {
    heroPrefix = firstName ? `${firstName}'s done — great work` : "All done — great work";
  } else if (focusSummary) {
    heroTargets = focusSummary
      .split(/,\s*|\s*&\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" · ");
    heroPrefix = firstName ? `Workout for ${firstName}'s ` : "Workout for ";
  } else {
    heroPrefix = firstName ? `Workout for ${firstName}` : "Today's Workout";
  }

  return (
    <LinearGradient
      colors={["#282828", "#161616"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.workoutCard}
    >
      {/* Date + streak */}
      <View style={styles.cardTopRow}>
        <Text style={styles.cardDate}>{formatDateHeader()}</Text>
        <StreakBadge />
      </View>

      {/* Hero: focus area */}
      <Animated.Text
        key={allDone ? 1 : 0}
        entering={FadeInDown.duration(320).delay(80)}
        exiting={FadeOut.duration(150)}
        style={styles.heroFocus}
      >
        {heroPrefix}
        {heroTargets ? (
          <Text style={styles.heroFocusTargets}>{heroTargets}</Text>
        ) : null}
      </Animated.Text>

      {/* Tier pill */}
      {overloadLabel !== "Base" && (
        <Animated.View entering={FadeIn.duration(400).delay(220)} style={styles.tierPill}>
          <Text style={styles.tierPillText}>{overloadLabel}</Text>
        </Animated.View>
      )}

      {/* Progress bar + inline count */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, barStyle]} />
        </View>
        <Animated.Text style={[styles.progressCount, numStyle]}>
          {completedCount}/{totalCount}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Compact exercise row
// ---------------------------------------------------------------------------

const TASK_DEPTH = 5;

function ExerciseRow({
  task,
  onStart,
  onMarkDone,
}: {
  task: DailyTask;
  onStart: () => void;
  onMarkDone: () => void;
}) {
  const isCompleted = task.status === "completed";

  return (
    <View style={[styles.taskCardBase, isCompleted && styles.taskCardBaseDone]}>
      <Pressable
        onPress={isCompleted ? undefined : onStart}
        disabled={isCompleted}
        style={({ pressed }) => [
          styles.taskCardFace,
          isCompleted && styles.taskCardFaceDone,
          { transform: [{ translateY: !isCompleted && pressed ? TASK_DEPTH : 0 }] },
        ]}
      >
        {!isCompleted && (
          <LinearGradient
            colors={["#CCFF6B", "#B4F34D"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.taskRow}>
          {/* Icon */}
          <View style={[styles.exerciseIconWrap, isCompleted && styles.exerciseIconDimmed]}>
            <Image source={getExerciseIcon(task.exerciseId)} style={styles.exerciseIconImg} />
          </View>

          {/* Name + target */}
          <View style={styles.taskLeft}>
            <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]} numberOfLines={1}>
              {task.name}
            </Text>
            <Text style={styles.taskSummary} numberOfLines={1}>
              {task.targets.map((t) => (t === "all" ? "Full Face" : t)).join(", ")}
            </Text>
          </View>

          {/* Right: Start pill + status circle */}
          <View style={styles.taskRight}>
            {!isCompleted && (
              <View style={styles.startPillDepth}>
                <View style={styles.startPill}>
                  <Text style={styles.startPillText}>Start</Text>
                </View>
              </View>
            )}

            {/*
              Circle is its own Pressable so it captures the touch before the
              outer card Pressable does — no stopPropagation needed.
              Disabled + non-interactive once completed.
            */}
            <Pressable
              onPress={isCompleted ? undefined : onMarkDone}
              disabled={isCompleted}
              hitSlop={10}
              style={({ pressed }) => [
                styles.statusDot,
                isCompleted ? styles.statusDotDone : styles.statusDotPending,
                !isCompleted && pressed && styles.statusDotPressed,
              ]}
            >
              {isCompleted && <Text style={styles.statusCheck}>✓</Text>}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
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

  return (
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
// Start confirmation modal
// ---------------------------------------------------------------------------

function StartModal({
  visible,
  exerciseName,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  exerciseName: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalBackdrop} onPress={onDismiss}>
        <Animated.View
          entering={FadeInDown.duration(250).springify()}
          style={styles.modalCard}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <Text style={styles.modalTitle}>Ready?</Text>
            <Text style={styles.modalExercise}>{exerciseName}</Text>
            <Text style={styles.modalHint}>Timer will start immediately</Text>

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnGhost} onPress={onDismiss}>
                <Text style={styles.modalBtnGhostText}>Not now</Text>
              </Pressable>

              {/* Lime 3D depth button */}
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
                    <Text style={styles.modalBtnPrimaryText}>Start</Text>
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
  } = useTasksStore();
  const { displayName } = useProfile();

  const [showDayComplete, setShowDayComplete]     = useState(false);
  const [showMoodCheck, setShowMoodCheck]         = useState(false);
  const [confirmTask, setConfirmTask]             = useState<DailyTask | null>(null);
  const [markDoneTask, setMarkDoneTask]           = useState<DailyTask | null>(null);
  const [confirmProtocol, setConfirmProtocol]     = useState<ProtocolTask | null>(null);

  // Intro splash — once per day
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [introVisible, setIntroVisible] = useState(lastIntroDate !== todayDateStr);
  const introTimerDoneRef = useRef(false);

  useEffect(() => { initToday(); }, []);

  useEffect(() => {
    if (!introVisible) return;
    const t = setTimeout(() => {
      introTimerDoneRef.current = true;
      if (!useTasksStore.getState().loading) {
        lastIntroDate = todayDateStr;
        setIntroVisible(false);
      }
    }, 2700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!introVisible || !introTimerDoneRef.current || loading) return;
    lastIntroDate = todayDateStr;
    setIntroVisible(false);
  }, [loading, introVisible]);

  // Midnight refresh
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const utc = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;
      if (today?.date !== utc) initToday();
    }, 60_000);
    return () => clearInterval(interval);
  }, [today?.date, initToday]);

  const handleRowPress = useCallback((task: DailyTask) => {
    if (task.status === "completed") return;
    setConfirmTask(task);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmTask) return;
    setConfirmTask(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/program/timer/[exerciseId]",
      params: { exerciseId: confirmTask.exerciseId },
    });
  }, [confirmTask]);

  // Shared completion path — used by both timer callback and mark-done circle.
  // Reads actual store state after update so day-complete check works with the
  // 3-item streak threshold (not the old all-tasks logic).
  const handleTaskComplete = useCallback((exerciseId: string) => {
    const alreadyCounted = useTasksStore.getState().today?.completedOnce ?? false;
    completeTask(exerciseId);
    const nowCounted = useTasksStore.getState().today?.completedOnce ?? false;
    if (!alreadyCounted && nowCounted) {
      setTimeout(() => setShowDayComplete(true), 150);
    }
  }, [completeTask]);

  // Circle tap → MarkDoneModal confirm
  const handleMarkDoneConfirm = useCallback(() => {
    if (!markDoneTask) return;
    const task = markDoneTask;
    setMarkDoneTask(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleTaskComplete(task.exerciseId);
  }, [markDoneTask, handleTaskComplete]);

  if (introVisible || loading || !today) return <TasksLoadingScreen />;

  const tasks          = today.tasks;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount     = tasks.length;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Top 70%: Workout card ── */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.topSection}
      >
        <WorkoutCard
          streak={currentStreak}
          focusSummary={today.focusSummary}
          overloadLabel={today.tasks[0]?.overloadLabel ?? "Base"}
          completedCount={completedCount}
          totalCount={totalCount}
          userName={displayName}
        />
      </Animated.View>

      {/* ── Bottom section: Exercise list (scrollable) ── */}
      <View style={styles.bottomSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.sectionHint}>
            {tasks.every((t) => t.status !== "pending")
              ? "All done"
              : `${tasks.filter((t) => t.status === "pending").length} left`}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.exerciseList}
        >
          {tasks.map((task, idx) => (
            <Animated.View
              key={task.exerciseId}
              entering={FadeInDown.duration(300).delay(idx * 50)}
            >
              <ExerciseRow
                task={task}
                onStart={() => handleRowPress(task)}
                onMarkDone={() => setMarkDoneTask(task)}
              />
            </Animated.View>
          ))}

          {/* ── Other Protocols ── */}
          {today.protocols?.length > 0 && (
            <>
              <View style={styles.protocolsHeader}>
                <Text style={styles.protocolsTitle}>Daily Stack</Text>
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
        </ScrollView>
      </View>

      {/* ── Modals ── */}
      <StartModal
        visible={confirmTask !== null}
        exerciseName={confirmTask?.name ?? ""}
        onConfirm={handleConfirm}
        onDismiss={() => setConfirmTask(null)}
      />

      <MarkDoneModal
        visible={markDoneTask !== null}
        task={markDoneTask}
        onConfirm={handleMarkDoneConfirm}
        onDismiss={() => setMarkDoneTask(null)}
      />

      <DayCompleteModal
        visible={showDayComplete}
        dayNumber={currentStreak}
        streak={currentStreak}
        autoDismissMs={0}
        dismissOnBackdropPress={false}
        particles
        onClose={() => {
          setShowDayComplete(false);
          setTimeout(() => setShowMoodCheck(true), 200);
        }}
      />

      <MoodCheckModal
        visible={showMoodCheck}
        dayNumber={currentStreak}
        onSelect={(mood) => { setMood(mood); setShowMoodCheck(false); }}
        onSkip={() => setShowMoodCheck(false)}
      />

      <ProtocolConfirmModal
        visible={confirmProtocol !== null}
        protocol={confirmProtocol}
        onDone={() => {
          if (confirmProtocol) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            completeProtocol(confirmProtocol.id, true);
          }
          setConfirmProtocol(null);
        }}
        onDismiss={() => setConfirmProtocol(null)}
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[4] },
  loadingTitle: { color: COLORS.text, fontSize: 22, fontFamily: "Poppins-SemiBold" },
  progressTrackLoading: {
    width: 120,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  progressFillLoading: {
    height: "100%",
    borderRadius: 1,
    backgroundColor: COLORS.accent,
  },
  phraseContainer: {
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: SP[6],
  },
  loadingPhrase: {
    position: "absolute",
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    width: "100%",
  },

  // Layout
  topSection: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[2],
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: SP[4],
    paddingBottom: SP[2],
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  // Workout card
  workoutCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
    padding: SP[4],
    gap: SP[3],
    shadowColor: COLORS.accent,
    shadowOpacity: 0.30,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
    overflow: "hidden",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDate: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  // Streak badge
  streakBadgeWrap: {
    borderRadius: RADII.pill,
    shadowColor: "#FF8C00",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,140,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,140,0,0.35)",
  },
  streakIcon: { fontSize: 15 },
  streakText: { color: "#FFAA32", fontSize: 14, fontFamily: "Poppins-SemiBold" },

  // Streak modal — reuses modalCard/modalBackdrop/modalBtnGhost
  streakBigNum: {
    color: "#FFAA32",
    fontSize: 64,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -3,
    textAlign: "center",
    lineHeight: 70,
    marginBottom: SP[1],
  },
  streakDivider: {
    width: "100%",
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: SP[4],
  },
  streakDotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SP[3],
  },
  streakDotCol: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  streakDotLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    textTransform: "uppercase",
  },
  streakDotLabelToday: {
    color: COLORS.accent,
  },
  streakDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  streakDotCheck: {
    color: "#0B0B0B",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  streakDotDate: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
  },
  streakDotDateToday: {
    color: COLORS.accent,
  },

  heroFocus: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.3,
  },
  heroFocusTargets: {
    color: COLORS.accent,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.3,
  },
  tierPill: {
    alignSelf: "flex-start",
    paddingHorizontal: SP[3],
    paddingVertical: 4,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
  },
  tierPillText: {
    color: COLORS.accent,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  progressSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  progressCount: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    minWidth: 28,
    textAlign: "right",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SP[3],
    paddingBottom: SP[2],
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  sectionHint: {
    color: COLORS.sub,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },

  // Exercise list
  exerciseList: { gap: SP[3], paddingBottom: SP[2] },

  // Task cards — 3D depth style
  taskCardBase: {
    borderRadius: RADII.lg,
    backgroundColor: "#6B9A1E",
    paddingBottom: TASK_DEPTH,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  taskCardBaseDone: {
    backgroundColor: "rgba(180,243,77,0.08)",
    shadowOpacity: 0,
    elevation: 0,
  },
  taskCardFace: {
    borderRadius: RADII.lg,
    padding: SP[4],
    overflow: "hidden",
  },
  taskCardFaceDone: {
    backgroundColor: "rgba(180,243,77,0.10)",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  exerciseIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(11,11,11,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exerciseIconDimmed: { opacity: 0.5 },
  exerciseIconImg: { width: 52, height: 52, resizeMode: "cover" },
  taskLeft: { flex: 1, gap: 3 },
  taskTitle: {
    color: "#0B0B0B",
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  taskTitleDone: { color: "rgba(11,11,11,0.45)" },
  taskSummary: {
    color: "rgba(11,11,11,0.55)",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    textTransform: "capitalize",
  },
  taskReason: {
    color: "rgba(11,11,11,0.40)",
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    marginTop: 1,
  },
  taskRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  startPillDepth: {
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    paddingBottom: 3,
  },
  startPill: {
    height: 32,
    paddingHorizontal: SP[3],
    borderRadius: 16,
    backgroundColor: "#0B0B0B",
    alignItems: "center",
    justifyContent: "center",
  },
  startPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotPending: {
    borderColor: "rgba(11,11,11,0.30)",
    backgroundColor: "transparent",
  },
  statusDotDone: {
    backgroundColor: "#0B0B0B",
    borderColor: "#0B0B0B",
  },
  statusDotPressed: {
    borderColor: "rgba(11,11,11,0.70)",
    backgroundColor: "rgba(11,11,11,0.10)",
    transform: [{ scale: 0.88 }],
  },
  statusCheck: {
    color: "#B4F34D",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Protocol cards — 3D depth style
  protocolCardBase: {
    borderRadius: RADII.lg,
    backgroundColor: "#2A2A2A",
    paddingBottom: TASK_DEPTH,
    shadowColor: "#000000",
    shadowOpacity: 0.40,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  protocolCardBaseDone: {
    backgroundColor: "#1A1A1A",
    shadowOpacity: 0,
    elevation: 0,
  },
  protocolCardFace: {
    borderRadius: RADII.lg,
    padding: SP[4],
    backgroundColor: "#222222",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  protocolCardFaceDone: {
    backgroundColor: "#181818",
    borderColor: "rgba(255,255,255,0.05)",
  },
  protocolIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolEmoji: { fontSize: 26 },
  protocolTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  protocolTitleDone: { color: "rgba(255,255,255,0.30)" },
  protocolQuantity: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 12,
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
    paddingTop: SP[4],
    paddingBottom: SP[2],
  },
  protocolsTitle: {
    flex: 1,
    color: COLORS.sub,
    fontSize: 13,
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
    paddingBottom: 40,
    paddingHorizontal: SP[4],
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[5],
    alignItems: "center",
  },
  modalTitle: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: SP[2],
  },
  modalExercise: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: SP[1],
  },
  modalHint: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: SP[5],
  },
  modalBtns: {
    flexDirection: "row",
    gap: SP[3],
    width: "100%",
  },
  modalBtnGhost: {
    flex: 1,
    height: 48,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhostText: {
    color: COLORS.sub,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  modalBtnDepth: {
    flex: 2,
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalBtnPressable: {
    height: 48,
    borderRadius: RADII.pill,
    overflow: "hidden",
  },
  modalBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
  },
  modalBtnPrimaryText: {
    color: "#0B0B0B",
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
});
