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
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useTasksStore, type DailyTask, type ProtocolTask, type DayRecord } from "@/store/tasks";
import { useScores, type Scores } from "@/store/scores";
import { useOnboarding } from "@/store/onboarding";
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
  let count = 0;
  const d = new Date();
  for (let i = 0; i < 5; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const ds = d.toISOString().slice(0, 10);
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

  // Phrase 2 — ready
  phrases.push(`Your plan is ready`);

  return phrases;
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function TasksLoadingScreen() {
  const { currentStreak, history } = useTasksStore();
  const { scores } = useScores();
  const { data: onboardingData } = useOnboarding();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const phrases = useMemo(
    () => buildLoadingPhrases(currentStreak, history, scores, onboardingData.goals ?? null),
    [],
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
        <Text style={styles.loadingTitle}>Today's Workout</Text>

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
// Streak badge
// ---------------------------------------------------------------------------

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakIcon}>🔥</Text>
      <Text style={styles.streakText}>{streak}</Text>
    </View>
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
}: {
  streak: number;
  focusSummary: string;
  overloadLabel: string;
  completedCount: number;
  totalCount: number;
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

  const focusHero = allDone
    ? "All done — great work"
    : focusSummary
      ? focusSummary
          .split(/,\s*|\s*&\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" · ")
      : "Today's Plan";

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
        <StreakBadge streak={streak} />
      </View>

      {/* Hero: focus area */}
      <Animated.Text
        key={allDone ? 1 : 0}
        entering={FadeInDown.duration(320).delay(80)}
        exiting={FadeOut.duration(150)}
        style={styles.heroFocus}
        numberOfLines={1}
      >
        {focusHero}
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

function ExerciseRow({
  task,
  onPress,
}: {
  task: DailyTask;
  onPress: () => void;
}) {
  const isCompleted = task.status === "completed";
  const scale = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isCompleted) scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <Animated.View style={cardAnimStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isCompleted}
        style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}
      >
        <View style={styles.taskRow}>
          {/* Icon */}
          <View style={[styles.exerciseIconWrap, isCompleted && styles.exerciseIconDimmed]}>
            <Image source={getExerciseIcon(task.exerciseId)} style={styles.exerciseIconImg} />
          </View>

          {/* Name + target + reason */}
          <View style={styles.taskLeft}>
            <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]} numberOfLines={1}>
              {task.name}
            </Text>
            <Text style={styles.taskSummary} numberOfLines={1}>
              {task.targets.map((t) => (t === "all" ? "Full Face" : t)).join(", ")}
            </Text>
          </View>

          {/* Right: Start pill + status dot */}
          <View style={styles.taskRight}>
            {!isCompleted && (
              <View style={styles.startPillDepth}>
                <Pressable
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.startPill,
                    { transform: [{ translateY: pressed ? 3 : 0 }] },
                  ]}
                >
                  <Text style={styles.startPillText}>Start</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.statusDot, isCompleted && styles.statusDotDone]}>
              {isCompleted && <Text style={styles.statusCheck}>✓</Text>}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
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
  const scale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={cardAnimStyle}>
      <Pressable
        onPress={isDone ? undefined : onPress}
        onPressIn={() => { if (!isDone) scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        disabled={isDone}
        style={[styles.protocolCard, isDone && styles.protocolCardDone]}
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

  const [showDayComplete, setShowDayComplete]     = useState(false);
  const [showMoodCheck, setShowMoodCheck]         = useState(false);
  const [confirmTask, setConfirmTask]             = useState<DailyTask | null>(null);
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

  // Called from timer screen via route back — check for day completion
  const handleTaskComplete = useCallback((exerciseId: string) => {
    const alreadyCounted = today?.completedOnce;
    const otherPending = today?.tasks.filter(
      (t) => t.exerciseId !== exerciseId && t.status === "pending",
    );
    const willCompleteDay = !otherPending?.length;

    completeTask(exerciseId);

    if (willCompleteDay && !alreadyCounted) {
      setTimeout(() => setShowDayComplete(true), 150);
    }
  }, [today, completeTask]);

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
                onPress={() => handleRowPress(task)}
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

      <DayCompleteModal
        visible={showDayComplete}
        dayNumber={currentStreak + 1}
        streak={currentStreak + 1}
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
        dayNumber={1}
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
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,170,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,170,50,0.3)",
  },
  streakIcon: { fontSize: 15 },
  streakText: { color: "#FFAA32", fontSize: 14, fontFamily: "Poppins-SemiBold" },

  heroFocus: {
    color: COLORS.text,
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

  // Task cards (old green card style)
  taskCard: {
    backgroundColor: "#B4F34D",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.6)",
    borderRadius: RADII.lg,
    padding: SP[4],
    shadowColor: "#B4F34D",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  taskCardCompleted: {
    backgroundColor: "rgba(180,243,77,0.15)",
    borderColor: "rgba(180,243,77,0.2)",
    shadowOpacity: 0,
    elevation: 0,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(11,11,11,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotDone: {
    backgroundColor: "#0B0B0B",
    borderColor: "#0B0B0B",
  },
  statusCheck: {
    color: "#B4F34D",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Protocol cards
  protocolCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADII.lg,
    padding: SP[4],
  },
  protocolCardDone: {
    backgroundColor: "rgba(255,255,255,0.03)",
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
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
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
    backgroundColor: "rgba(0,0,0,0.7)",
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
