// app/(tabs)/program.tsx
// Daily exercise screen — workout card (top 70%) + compact exercise list (bottom 30%)

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Dimensions,
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
  withSequence,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useTasksStore, type DailyTask } from "@/store/tasks";
import { getExerciseIcon } from "@/lib/exerciseIcons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Module-level: only show intro splash once per day
let lastIntroDate: string | null = null;

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function TasksLoadingScreen() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const cfg = { damping: 12, stiffness: 120 };
    dot1.value = withRepeat(withSequence(withSpring(1, cfg), withSpring(0.3, cfg)), -1, false);
    setTimeout(() => {
      dot2.value = withRepeat(withSequence(withSpring(1, cfg), withSpring(0.3, cfg)), -1, false);
    }, 200);
    setTimeout(() => {
      dot3.value = withRepeat(withSequence(withSpring(1, cfg), withSpring(0.3, cfg)), -1, false);
    }, 400);
  }, []);

  const d1 = useAnimatedStyle(() => ({ opacity: dot1.value, transform: [{ scale: dot1.value }] }));
  const d2 = useAnimatedStyle(() => ({ opacity: dot2.value, transform: [{ scale: dot2.value }] }));
  const d3 = useAnimatedStyle(() => ({ opacity: dot3.value, transform: [{ scale: dot3.value }] }));

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(250)} style={styles.loadingWrap}>
        <Text style={styles.loadingTitle}>Today's Workout</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.loadingDot, d1]} />
          <Animated.View style={[styles.loadingDot, d2]} />
          <Animated.View style={[styles.loadingDot, d3]} />
        </View>
        <Text style={styles.loadingSubtext}>Selecting exercises for you</Text>
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
  completedCount,
  totalCount,
}: {
  streak: number;
  focusSummary: string;
  completedCount: number;
  totalCount: number;
}) {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring(progress, { damping: 18, stiffness: 100 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const allDone = completedCount === totalCount && totalCount > 0;

  return (
    <View style={styles.workoutCard}>
      {/* Day label + streak */}
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.cardDate}>{formatDateHeader()}</Text>
          <Text style={styles.cardSubtitle}>
            {allDone ? "All done — great work" : `${totalCount - completedCount} exercises left`}
          </Text>
        </View>
        <StreakBadge streak={streak} />
      </View>

      {/* Big completion counter */}
      <View style={styles.completionRow}>
        <Text style={styles.completionNum}>{completedCount}</Text>
        <Text style={styles.completionDenom}>/{totalCount}</Text>
        <Text style={styles.completionLabel}> done</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, barStyle]} />
      </View>

      {/* Focus area */}
      {focusSummary ? (
        <View style={styles.focusRow}>
          <View style={styles.focusDot} />
          <Text style={styles.focusText} numberOfLines={1}>
            Targeting {focusSummary}
          </Text>
        </View>
      ) : null}

    </View>
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

          {/* Name + target */}
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
    setMood,
  } = useTasksStore();

  const [showDayComplete, setShowDayComplete] = useState(false);
  const [showMoodCheck, setShowMoodCheck]     = useState(false);
  const [confirmTask, setConfirmTask]         = useState<DailyTask | null>(null);

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
    }, 1800);
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
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgBottom },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3] },
  loadingTitle: { color: COLORS.text, fontSize: 22, fontFamily: "Poppins-SemiBold" },
  loadingSubtext: { color: COLORS.sub, fontSize: 13, fontFamily: "Poppins-SemiBold", marginTop: SP[1] },
  dotsRow: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  loadingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },

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
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[4],
    gap: SP[3],
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardDate: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardSubtitle: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    marginTop: 2,
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

  completionRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  completionNum: {
    color: COLORS.accent,
    fontSize: 36,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 40,
  },
  completionDenom: {
    color: COLORS.sub,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 24,
  },
  completionLabel: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },

  progressTrack: {
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

  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  focusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  focusText: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    flex: 1,
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
