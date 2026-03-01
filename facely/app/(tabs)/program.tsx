// app/(tabs)/program.tsx
// "Tasks" tab — daily adaptive exercise selection

import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useTasksStore, type DailyTask, type DayRecord } from "@/store/tasks";
import { getExerciseIcon } from "@/lib/exerciseIcons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tracks which UTC date the intro splash was last shown.
// Module-level so it persists across tab switches within the same app session.
let lastIntroDate: string | null = null;

// Emoji map for protocol add-on tasks (non facial-exercise)
const PROTOCOL_EMOJIS: Record<string, string> = {
  // Skincare
  "cold-water-splash":   "💧",
  "gua-sha":             "💆",
  "facial-icing":        "🧊",
  "oil-cleanser":        "🫧",
  "bentonite-clay-mask": "🌿",
  "turmeric-mask":       "🟡",
  // Lifestyle
  "sprint-session":      "🏃",
  "nasal-breathing":     "👃",
  "cold-shower":         "🚿",
  "sunlight-exposure":   "☀️",
  "mewing":              "🦷",
  "back-sleeping":       "😴",
  // Dietary
  "lemon-electrolytes":  "🍋",
  "egg-yolk-banana":     "🍳",
  "black-raisins":       "🫐",
  "raw-banana":          "🍌",
  "beef-liver":          "🥩",
  "red-meat":            "🥩",
  "unsalted-cheese":     "🧀",
};

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
        <Text style={styles.loadingTitle}>Today's Routine</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.loadingDot, d1Style]} />
          <Animated.View style={[styles.loadingDot, d2Style]} />
          <Animated.View style={[styles.loadingDot, d3Style]} />
        </View>
        <Text style={styles.loadingSubtext}>Building around your progress</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.calBtn, pressed && { opacity: 0.6 }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      {/* pointerEvents="none" prevents the SVG icon from swallowing the touch */}
      <View pointerEvents="none">
        <Calendar size={18} color={COLORS.text} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function CommitmentCalendar({
  visible,
  onClose,
  history,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  history: DayRecord[];
  today: DayRecord | null;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });

  useEffect(() => {
    if (visible) {
      const now = new Date();
      setViewDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    }
  }, [visible]);

  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();

  const committedDates = new Set<string>();
  const trackedDates = new Set<string>();
  for (const record of history) {
    trackedDates.add(record.date);
    if (record.allComplete) committedDates.add(record.date);
  }
  if (today) {
    trackedDates.add(today.date);
    if (today.allComplete) committedDates.add(today.date);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () =>
    setViewDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  const goNext = () =>
    setViewDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));

  const committedThisMonth = Array.from(committedDates).filter((d) => {
    const [y, m] = d.split("-").map(Number);
    return y === year && m - 1 === month;
  }).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Outer Pressable = backdrop dismiss */}
      <Pressable style={styles.calOverlay} onPress={onClose}>
        {/* Inner Pressable absorbs taps so they don't reach the backdrop */}
        <Pressable style={styles.calSheet}>
          {/* Month navigation */}
          <View style={styles.calHeader}>
            <Pressable onPress={goPrev} style={styles.calNavBtn} hitSlop={8}>
              <ChevronLeft size={18} color={COLORS.text} strokeWidth={2} />
            </Pressable>
            <View style={styles.calMonthWrap}>
              <Text style={styles.calMonthTitle}>
                {MONTH_NAMES[month]} {year}
              </Text>
              <Text style={styles.calMonthSub}>
                {committedThisMonth} day{committedThisMonth !== 1 ? "s" : ""} committed
              </Text>
            </View>
            <Pressable onPress={goNext} style={styles.calNavBtn} hitSlop={8}>
              <ChevronRight size={18} color={COLORS.text} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Week labels */}
          <View style={styles.calWeekRow}>
            {WEEK_LABELS.map((d, i) => (
              <Text key={i} style={styles.calWeekLabel}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.calGrid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.calCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const isCommitted = committedDates.has(dateStr);
              const isTracked = trackedDates.has(dateStr);
              const isMissed = isTracked && !isCommitted && dateStr < todayStr;
              return (
                <View key={i} style={styles.calCell}>
                  <View style={[
                    styles.calDayInner,
                    isCommitted && styles.calDayInnerCommitted,
                    isToday && !isCommitted && styles.calDayInnerToday,
                  ]}>
                    <Text style={[
                      styles.calDayNum,
                      isCommitted && styles.calDayNumCommitted,
                      isToday && !isCommitted && styles.calDayNumToday,
                      isMissed && styles.calDayNumMissed,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.calLegendText}>Committed</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, {
                backgroundColor: "transparent",
                borderWidth: 1.5,
                borderColor: COLORS.accent,
              }]} />
              <Text style={styles.calLegendText}>Today</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
          {task.protocolType && task.protocolType !== "facial_exercise" ? (
            <Text style={styles.protocolEmoji}>
              {PROTOCOL_EMOJIS[task.exerciseId] ?? "✨"}
            </Text>
          ) : (
            <Image
              source={getExerciseIcon(task.exerciseId)}
              style={styles.exerciseIconImg}
            />
          )}
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
    history,
    currentStreak,
    loading,
    initToday,
    completeTask,
    uncompleteTask,
    setMood,
  } = useTasksStore();

  const [showDayComplete, setShowDayComplete] = useState(false);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Intro splash — shown once per day on first tab open.
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [introVisible, setIntroVisible] = useState(lastIntroDate !== todayDateStr);
  const introTimerDoneRef = useRef(false); // true after minimum 1800ms

  // Initialize tasks on mount
  useEffect(() => {
    initToday();
  }, []);

  // Minimum intro display: 1800ms. After timer fires, dismiss if loading is done.
  useEffect(() => {
    if (!introVisible) return;
    const timer = setTimeout(() => {
      introTimerDoneRef.current = true;
      if (!useTasksStore.getState().loading) {
        lastIntroDate = todayDateStr;
        setIntroVisible(false);
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, []); // intentionally runs once per mount

  // When loading finishes, dismiss intro if the minimum timer has already elapsed.
  useEffect(() => {
    if (!introVisible || !introTimerDoneRef.current || loading) return;
    lastIntroDate = todayDateStr;
    setIntroVisible(false);
  }, [loading, introVisible]);

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

  // Show intro splash until both timer and data are ready
  if (introVisible || loading || !today) {
    return <TasksLoadingScreen />;
  }

  const allDone = today.allComplete;
  const pendingCount = today.tasks.filter((t) => t.status === "pending").length;
  const completedCount = today.tasks.filter((t) => t.status === "completed").length;
  const exerciseTasks = today.tasks.filter((t) => t.protocolType === "facial_exercise");
  const protocolTasks = today.tasks.filter((t) => t.protocolType !== "facial_exercise");

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header lives outside ScrollView — guaranteed clean press events */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateTitle}>{formatDateHeader()}</Text>
            <Text style={styles.subtitle}>
              {allDone
                ? "All done for today"
                : `${pendingCount} task${pendingCount !== 1 ? "s" : ""} remaining`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <StreakBadge streak={currentStreak} />
            <CalendarButton onPress={() => setShowCalendar(true)} />
          </View>
        </View>
        <ProgressBar total={today.tasks.length} completed={completedCount} />
        {today.focusSummary ? <FocusBanner text={today.focusSummary} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Exercises section */}
        {exerciseTasks.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              <Text style={styles.sectionHint}>
                {exerciseTasks.every((t) => t.status !== "pending") ? "Done" : `${exerciseTasks.filter((t) => t.status === "pending").length} left`}
              </Text>
            </Animated.View>
            <View style={styles.taskList}>
              {exerciseTasks.map((task, idx) => (
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
          </>
        )}

        {/* Protocols section */}
        {protocolTasks.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.duration(300).delay(350)} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Protocols</Text>
              <Text style={styles.sectionHint}>
                {protocolTasks.every((t) => t.status !== "pending") ? "Done" : `${protocolTasks.filter((t) => t.status === "pending").length} left`}
              </Text>
            </Animated.View>
            <View style={styles.taskList}>
              {protocolTasks.map((task, idx) => (
                <Animated.View
                  key={task.exerciseId}
                  entering={FadeInDown.duration(350).delay(400 + idx * 60)}
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
          </>
        )}
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

      {/* Calendar — Modal renders above everything */}
      <CommitmentCalendar
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        history={history}
        today={today}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgBottom },
  container: { paddingHorizontal: SP[4], paddingTop: SP[1], paddingBottom: SP[6], gap: SP[3] },
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

  // Header (outside ScrollView — no scroll interference)
  headerWrapper: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[3],
  },
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
  protocolEmoji: {
    fontSize: 26,
    lineHeight: 32,
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

  // Header right cluster
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },

  // Calendar button (top-right)
  calBtn: {
    width: 44,
    height: 44,
    borderRadius: RADII.circle,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Calendar overlay — full-screen backdrop inside Modal
  calOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  calSheet: {
    width: "88%",
    backgroundColor: "#161616",
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[5],
  },

  // Calendar header (month nav)
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[4],
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  calMonthWrap: {
    alignItems: "center",
    gap: 2,
  },
  calMonthTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  calMonthSub: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  // Week day labels row
  calWeekRow: {
    flexDirection: "row",
    marginBottom: SP[2],
  },
  calWeekLabel: {
    flex: 1,
    textAlign: "center",
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  // Day grid
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: "14.2857%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  calDayInner: {
    width: 32,
    height: 32,
    borderRadius: RADII.circle,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayInnerCommitted: {
    backgroundColor: COLORS.accent,
  },
  calDayInnerToday: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  calDayNum: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },
  calDayNumCommitted: {
    color: "#0B0B0B",
  },
  calDayNumToday: {
    color: COLORS.accent,
  },
  calDayNumMissed: {
    color: COLORS.sub,
    opacity: 0.5,
  },

  // Legend
  calLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SP[5],
    marginTop: SP[4],
    paddingTop: SP[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  calLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calLegendDot: {
    width: 12,
    height: 12,
    borderRadius: RADII.circle,
  },
  calLegendText: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },
});
