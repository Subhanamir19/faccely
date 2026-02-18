// app/(tabs)/program.tsx
// "Tasks" tab — daily adaptive exercise selection

import React, { useEffect, useState, useCallback } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  FadeIn,
  LinearTransition,
} from "react-native-reanimated";
import { COLORS, RADII, SP } from "@/lib/tokens";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useTasksStore, type DailyTask } from "@/store/tasks";
import { getExerciseIcon } from "@/lib/exerciseIcons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateHeader(): string {
  const now = new Date();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `Today, ${months[now.getMonth()]} ${now.getDate()}`;
}

function summarizeTargets(targets: string[]): string {
  if (!targets.length) return "Improve facial control.";
  const labels = targets.map((t) => (t === "all" ? "all areas" : t));
  return `Improve ${labels.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

function TasksLoadingScreen() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const cfg = { damping: 12, stiffness: 120 };
    dot1.value = withRepeat(
      withSequence(withSpring(1, cfg), withSpring(0.3, cfg)),
      -1, false
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(withSpring(1, cfg), withSpring(0.3, cfg)),
        -1, false
      );
    }, 200);
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(withSpring(1, cfg), withSpring(0.3, cfg)),
        -1, false
      );
    }, 400);
  }, []);

  const d1Style = useAnimatedStyle(() => ({ opacity: dot1.value, transform: [{ scale: dot1.value }] }));
  const d2Style = useAnimatedStyle(() => ({ opacity: dot2.value, transform: [{ scale: dot2.value }] }));
  const d3Style = useAnimatedStyle(() => ({ opacity: dot3.value, transform: [{ scale: dot3.value }] }));

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(250)}
        style={styles.loadingWrap}
      >
        <Text style={styles.loadingTitle}>Loading your tasks</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.loadingDot, d1Style]} />
          <Animated.View style={[styles.loadingDot, d2Style]} />
          <Animated.View style={[styles.loadingDot, d3Style]} />
        </View>
        <Text style={styles.loadingSubtext}>Personalising for today</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakIcon}>🔥</Text>
      <Text style={styles.streakText}>{streak} day{streak !== 1 ? "s" : ""}</Text>
    </View>
  );
}

function FocusBanner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Text style={styles.bannerIconText}>✓</Text>
      </View>
      <Text style={styles.bannerText} numberOfLines={2}>
        Focusing on {text} today
      </Text>
    </View>
  );
}

/* ── Animated progress bar ── */
function ProgressBar({ total, completed }: { total: number; completed: number }) {
  const progress = total > 0 ? completed / total : 0;
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withSpring(progress, { damping: 18, stiffness: 120 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, barStyle]} />
    </View>
  );
}

/* ── Animated toggle circle ── */
function ToggleDot({
  status,
  onToggle,
}: {
  status: DailyTask["status"];
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Bounce: shrink → overshoot → settle
    scale.value = withSequence(
      withTiming(0.6, { duration: 80, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    onToggle();
  };

  const isCompleted = status === "completed";
  const isSkipped = status === "skipped";

  return (
    <AnimatedPressable onPress={handlePress} hitSlop={8} style={animStyle}>
      {isCompleted ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.statusDot, styles.statusDotDone]}
        >
          <Text style={styles.statusDotText}>✓</Text>
        </Animated.View>
      ) : isSkipped ? (
        <View style={[styles.statusDot, styles.statusDotSkipped]}>
          <Text style={styles.statusDotSkippedText}>—</Text>
        </View>
      ) : (
        <View style={[styles.statusDot, styles.statusDotPending]} />
      )}
    </AnimatedPressable>
  );
}

/* ── Animated Guide pill with spring press ── */
function GuidePill({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel="Open exercise guide"
      style={[styles.startPill, animStyle]}
    >
      <Text style={styles.startPillText}>Guide</Text>
    </AnimatedPressable>
  );
}

/* ── Animated task card with spring press ── */
function TaskCard({
  task,
  onGuide,
  onToggle,
}: {
  task: DailyTask;
  onGuide: () => void;
  onToggle: () => void;
}) {
  const isSkipped = task.status === "skipped";
  const isCompleted = task.status === "completed";
  const isDimmed = isSkipped;

  const cardScale = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePressIn = () => {
    if (!isDimmed) {
      cardScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    }
  };
  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onGuide}
      disabled={isSkipped}
      style={[
        styles.taskCard,
        isDimmed && styles.taskCardDimmed,
        isCompleted && styles.taskCardCompleted,
        cardAnimStyle,
      ]}
    >
      <Animated.View layout={LinearTransition.springify()} style={styles.taskRow}>
        <View style={[styles.exerciseIconWrap, isDimmed && styles.exerciseIconDimmed]}>
          <Image
            source={getExerciseIcon(task.exerciseId)}
            style={styles.exerciseIconImg}
          />
        </View>
        <View style={styles.taskLeft}>
          <Text
            style={[styles.taskTitle, isDimmed && styles.taskTitleDimmed]}
            numberOfLines={1}
          >
            {task.name}
          </Text>
          <Text
            style={[styles.taskSummary, isDimmed && styles.taskSummaryDimmed]}
            numberOfLines={1}
          >
            {summarizeTargets(task.targets)}
          </Text>
        </View>
        <View style={styles.taskRight}>
          {!isSkipped ? (
            <GuidePill onPress={onGuide} />
          ) : null}
          <ToggleDot
            status={task.status}
            onToggle={onToggle}
          />
        </View>
      </Animated.View>
      {isSkipped ? (
        <View style={styles.skippedLabel}>
          <Text style={styles.skippedLabelText}>Skipped</Text>
        </View>
      ) : null}
    </AnimatedPressable>
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
    uncompleteTask,
    setMood,
  } = useTasksStore();

  const [showDayComplete, setShowDayComplete] = useState(false);
  const [showMoodCheck, setShowMoodCheck] = useState(false);

  // Initialize tasks on mount
  useEffect(() => {
    initToday();
  }, []);

  // Midnight UTC check — refresh tasks when date changes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      if (today?.date !== utcDate) {
        initToday();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [today?.date, initToday]);

  // Toggle task completion via the circle
  const handleToggle = useCallback((task: DailyTask) => {
    if (task.status === "completed") {
      uncompleteTask(task.exerciseId);
    } else {
      // Only show day-complete modal the very first time today
      const alreadyCounted = today?.completedOnce;

      const otherPending = today?.tasks.filter(
        (t) => t.exerciseId !== task.exerciseId && t.status === "pending"
      );
      const willCompleteDay = !otherPending?.length;

      completeTask(task.exerciseId);

      if (willCompleteDay && !alreadyCounted) {
        setTimeout(() => setShowDayComplete(true), 150);
      }
    }
  }, [today, completeTask, uncompleteTask]);

  // Loading state
  if (loading || !today) {
    return <TasksLoadingScreen />;
  }

  const allDone = today.allComplete;
  const pendingCount = today.tasks.filter((t) => t.status === "pending").length;
  const completedCount = today.tasks.filter((t) => t.status === "completed").length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.headerRow}>
          <View>
            <Text style={styles.dateTitle}>{formatDateHeader()}</Text>
            <Text style={styles.subtitle}>
              {allDone
                ? "All tasks complete!"
                : `${pendingCount} task${pendingCount !== 1 ? "s" : ""} remaining`}
            </Text>
          </View>
          <StreakBadge streak={currentStreak} />
        </Animated.View>

        {/* Progress bar */}
        <Animated.View entering={FadeInDown.duration(300).delay(80)}>
          <ProgressBar total={today.tasks.length} completed={completedCount} />
        </Animated.View>

        {/* Focus banner */}
        {today.focusSummary ? (
          <Animated.View entering={FadeInDown.duration(300).delay(100)}>
            <FocusBanner text={today.focusSummary} />
          </Animated.View>
        ) : null}

        {/* Section header */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Tasks</Text>
          <Text style={styles.sectionHint}>
            {allDone ? "All done" : "Tap a card to start"}
          </Text>
        </Animated.View>

        {/* Task cards */}
        <View style={styles.taskList}>
          {today.tasks.map((task, idx) => (
            <Animated.View
              key={task.exerciseId}
              entering={FadeInDown.duration(350).delay(200 + idx * 60)}
              layout={LinearTransition.springify()}
            >
              <TaskCard
                task={task}
                onGuide={() => {
                  router.push({
                    pathname: "/program/guide/[exerciseId]",
                    params: { exerciseId: task.exerciseId },
                  });
                }}
                onToggle={() => handleToggle(task)}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* Day Complete Modal */}
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

      {/* Mood Check Modal */}
      <MoodCheckModal
        visible={showMoodCheck}
        dayNumber={1}
        onSelect={(mood) => {
          setMood(mood);
          setShowMoodCheck(false);
        }}
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
  container: { padding: SP[4], gap: SP[3], paddingBottom: SP[6] },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3] },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
  },
  loadingSubtext: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    marginTop: SP[1],
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  dateTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontFamily: "Poppins-SemiBold",
  },
  subtitle: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    marginTop: 2,
  },

  // Streak badge
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,170,50,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,170,50,0.3)",
  },
  streakIcon: { fontSize: 16 },
  streakText: {
    color: "#FFAA32",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },

  // Progress bar
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },

  // Focus banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    padding: SP[3],
    backgroundColor: "rgba(180,243,77,0.08)",
    borderColor: "rgba(180,243,77,0.35)",
    borderWidth: 1,
    borderRadius: RADII.lg,
  },
  bannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(180,243,77,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.35)",
  },
  bannerIconText: { color: COLORS.accent, fontSize: 14, fontFamily: "Poppins-SemiBold" },
  bannerText: { flex: 1, color: COLORS.accent, fontSize: 13, fontFamily: "Poppins-SemiBold", lineHeight: 18 },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SP[1],
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    flex: 1,
  },
  sectionHint: {
    color: COLORS.sub,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },

  // Task cards
  taskList: { gap: SP[3] },
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
  taskCardDimmed: {
    opacity: 0.45,
  },
  taskCardCompleted: {
    backgroundColor: "rgba(180,243,77,0.35)",
    borderColor: "rgba(180,243,77,0.25)",
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
  exerciseIconImg: {
    width: 52,
    height: 52,
    resizeMode: "cover",
  },
  taskLeft: { flex: 1, gap: 4 },
  taskTitle: {
    color: "#0B0B0B",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  taskTitleDimmed: { color: COLORS.sub },
  taskSummary: {
    color: "rgba(11,11,11,0.6)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins-SemiBold",
  },
  taskSummaryDimmed: { color: "rgba(255,255,255,0.3)" },
  taskRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  skippedLabel: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  skippedLabelText: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    fontStyle: "italic",
  },

  // Status dot
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotPending: {
    borderWidth: 2,
    borderColor: "rgba(11,11,11,0.25)",
  },
  statusDotDone: {
    borderWidth: 2,
    borderColor: "#0B0B0B",
    backgroundColor: "#0B0B0B",
  },
  statusDotSkipped: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusDotText: { color: "#B4F34D", fontSize: 14, fontFamily: "Poppins-SemiBold" },
  statusDotSkippedText: { color: COLORS.sub, fontSize: 14, fontFamily: "Poppins-SemiBold" },

  // Guide pill
  startPill: {
    minWidth: 76,
    height: 34,
    paddingHorizontal: SP[3],
    borderRadius: RADII.pill,
    backgroundColor: "#0B0B0B",
    alignItems: "center",
    justifyContent: "center",
  },
  startPillText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Poppins-SemiBold" },
});
