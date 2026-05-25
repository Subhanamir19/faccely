// app/program/list.tsx
// Exercise list screen — shows today's pending/done exercises with Start Routine CTA.
// Placed between StreakScreen and SessionScreen in the daily flow.

import React, { useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, ChevronLeft, X } from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useTasksStore, type DailyTask, type ProtocolTask } from "@/store/tasks";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { getExerciseIcon } from "@/lib/exerciseIcons";

const FONT_DIN = "DINNextRounded-Regular";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonCard({ index }: { index: number }) {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withDelay(
      index * 80,
      withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, []);

  const shimStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  return (
    <Animated.View style={[styles.skeletonCard, shimStyle]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { width: "60%" }]} />
        <View style={[styles.skeletonLine, { width: "40%", marginTop: 6 }]} />
      </View>
      <View style={styles.skeletonBadge} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Exercise card
// ---------------------------------------------------------------------------

function ExerciseCard({ task, index, getDuration }: {
  task: DailyTask;
  index: number;
  getDuration: (id: string) => number;
}) {
  const isCompleted = task.status === "completed";
  const isSkipped   = task.status === "skipped";
  const isPending   = !isCompleted && !isSkipped;
  const secs        = getDuration(task.exerciseId);
  const targets     = task.targets.map((t) => (t === "all" ? "Full Face" : t)).join(", ");

  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(index * 60 + 80).springify().damping(18).stiffness(160)}
    >
      <View style={[
        styles.exerciseCard,
        isCompleted && styles.exerciseCardDone,
        isSkipped   && styles.exerciseCardSkipped,
      ]}>

        {/* Icon */}
        <View style={[styles.exerciseIconWrap, !isPending && styles.exerciseIconDimmed]}>
          <Image source={getExerciseIcon(task.exerciseId)} style={styles.exerciseIcon} />
        </View>

        {/* Info */}
        <View style={styles.exerciseInfo}>
          <Text
            style={[
              styles.exerciseName,
              isCompleted && styles.exerciseNameDone,
              isSkipped   && styles.exerciseNameSkipped,
            ]}
            numberOfLines={1}
          >
            {task.name}
          </Text>
          <Text style={styles.exerciseMeta} numberOfLines={1}>
            {targets}
            {isPending ? <Text style={styles.exerciseDuration}>  ·  {formatDuration(secs)}</Text> : null}
          </Text>
        </View>

        {/* Status badge */}
        {!isPending && (
          <View style={[
            styles.statusBadge,
            isCompleted && styles.statusBadgeDone,
            isSkipped   && styles.statusBadgeSkipped,
          ]}>
            {isCompleted ? (
              <Check size={15} color="#58BF19" strokeWidth={3} />
            ) : (
              <X size={14} color={COLORS.lightSub} strokeWidth={2.7} />
            )}
          </View>
        )}

        {/* Pending indicator */}
        {isPending && (
          <View style={styles.pendingDot} />
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Protocol row
// ---------------------------------------------------------------------------

const PROTOCOL_EMOJI: Record<string, string> = {
  "sprint-session":          "🏃",
  "facial-icing":            "🧊",
  "high-intensity-exercise": "🏋️",
  "nasal-breathing":         "👃",
  "cold-shower":             "🚿",
  "sunlight-exposure":       "☀️",
  "mewing":                  "👅",
  "back-sleeping":           "🛏️",
  "lemon-electrolytes":      "🍋",
  "egg-yolk-banana":         "🍳",
  "black-raisins":           "🍇",
  "raw-banana":              "🍌",
  "beef-liver":              "🫀",
  "red-meat":                "🥩",
  "unsalted-cheese":         "🧀",
  "ashwagandha":             "🌿",
  "raw-milk":                "🥛",
  "cold-water-splash":       "💧",
  "gua-sha":                 "🪨",
  "facial-icing-skin":       "🧊",
  "oil-cleanser":            "🫧",
  "bentonite-clay-mask":     "🏺",
  "turmeric-mask":           "🟡",
};

function ProtocolRow({ protocol, index }: { protocol: ProtocolTask; index: number }) {
  const isDone = protocol.status === "done";
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(index * 50 + 80).springify().damping(18)}
      style={[styles.protocolRow, isDone && styles.protocolRowDone]}
    >
      <Text style={styles.protocolEmoji}>{PROTOCOL_EMOJI[protocol.id] ?? "💊"}</Text>
      <View style={styles.protocolInfo}>
        <Text style={[styles.protocolName, isDone && styles.protocolNameDone]} numberOfLines={1}>
          {protocol.name}
        </Text>
        <Text style={styles.protocolQty} numberOfLines={1}>{protocol.quantity}</Text>
      </View>
      {isDone && (
        <View style={styles.protocolDoneBadge}>
          <Check size={15} color="#58BF19" strokeWidth={3} />
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Start button
// ---------------------------------------------------------------------------

function StartButton({ label, onPress, disabled }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.startBtn,
        disabled && styles.startBtnDisabled,
        pressed && !disabled && styles.startBtnPressed,
      ]}
    >
      <Text style={[styles.startBtnText, disabled && styles.startBtnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExerciseListScreen() {
  const insets = useSafeAreaInsets();
  const { today, loading } = useTasksStore();
  const getDuration = useExerciseSettings((s) => s.getDuration);

  const tasks     = today?.tasks ?? [];
  const protocols = today?.protocols ?? [];
  const pending   = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");
  const skipped   = tasks.filter((t) => t.status === "skipped");

  const hasStarted = completed.length > 0 || skipped.length > 0;
  const allDone    = pending.length === 0;
  const exerciseProgress = tasks.length > 0 ? completed.length / tasks.length : 0;

  const handleStart = useCallback(() => {
    if (pending.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/program/session");
  }, [pending.length]);

  const handleSkipToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Just go back — tasks stay as-is, user can start anytime from program tab
    router.replace("/(tabs)/program");
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  // ── Loading state ──
  if (loading || !today) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingHeader}>
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <ChevronLeft size={26} color={COLORS.lightText} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>Today's Routine</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.loadingBody}>
          <Animated.Text entering={FadeIn.duration(300)} style={styles.loadingHint}>
            Calibrating your routine...
          </Animated.Text>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} index={i} />)}
        </View>
      </SafeAreaView>
    );
  }

  const btnLabel = allDone
    ? "All Done"
    : hasStarted
    ? `Resume (${pending.length} left)`
    : `Start Routine`;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(260)} style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <ChevronLeft size={26} color={COLORS.lightText} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Today's Routine</Text>
        {/* Right: Progress count */}
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>
            {completed.length}/{tasks.length}
          </Text>
        </View>
      </Animated.View>

      {/* ── Exercise list ── */}
      <Animated.View entering={FadeIn.duration(260).delay(70)} style={styles.topProgressTrack}>
        <View style={[styles.topProgressFill, { width: `${Math.max(0.03, exerciseProgress) * 100}%` }]} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, SP[5]) + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Focus summary */}
        {today.focusSummary ? (
          <Animated.Text
            entering={FadeInDown.duration(300).delay(40)}
            style={styles.focusSummary}
          >
            Today's focus: {today.focusSummary}
          </Animated.Text>
        ) : null}

        {/* Exercises section */}
        <Animated.Text
          entering={FadeInDown.duration(260).delay(60)}
          style={styles.sectionLabel}
        >
          EXERCISES
        </Animated.Text>

        {tasks.map((task, i) => (
          <ExerciseCard
            key={task.exerciseId}
            task={task}
            index={i}
            getDuration={getDuration}
          />
        ))}

        {/* Protocols section */}
        {protocols.length > 0 && (
          <>
            <Animated.Text
              entering={FadeInDown.duration(260).delay(tasks.length * 60 + 80)}
              style={[styles.sectionLabel, { marginTop: SP[6] }]}
            >
              PROTOCOLS
            </Animated.Text>
            {protocols.map((p, i) => (
              <ProtocolRow key={p.id} protocol={p} index={tasks.length + i} />
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Footer CTAs ── */}
      <Animated.View
        entering={FadeInDown.duration(380).delay(200).springify()}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SP[4]) + SP[2] }]}
      >
        <View style={styles.footerInner}>
          <StartButton
            label={btnLabel}
            onPress={handleStart}
            disabled={allDone}
          />

          {!allDone && (
            <Pressable
              onPress={handleSkipToday}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Skip today"
            >
              <Text style={styles.skipBtnText}>Skip Today</Text>
            </Pressable>
          )}

          {allDone && (
            <Pressable
              onPress={() => router.replace("/(tabs)/program")}
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
            >
              <Text style={styles.skipBtnText}>Back to Home</Text>
            </Pressable>
          )}
        </View>
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
    backgroundColor: "#FEF5E4",
  },

  // Header
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 27,
    lineHeight: 31,
    fontFamily: FONT_DIN,
    color: COLORS.lightText,
    flex: 1,
    textAlign: "center",
  },
  progressPill: {
    backgroundColor: COLORS.lightSurfaceAlt,
    borderRadius: RADII.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 48,
    alignItems: "center",
  },
  progressPillText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT_DIN,
    color: COLORS.lightMuted,
  },
  topProgressTrack: {
    height: 5,
    marginHorizontal: SP[5],
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  topProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.lightText,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
  },

  // Focus summary
  focusSummary: {
    fontSize: 15,
    fontFamily: FONT_DIN,
    color: COLORS.lightMuted,
    marginBottom: SP[5],
    lineHeight: 21,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT_DIN,
    color: COLORS.lightSub,
    letterSpacing: 1.2,
    marginBottom: SP[3],
  },

  // Exercise card
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    paddingVertical: 7,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightDivider,
  },
  exerciseCardDone: {
    opacity: 0.58,
  },
  exerciseCardSkipped: {
    opacity: 0.42,
  },
  exerciseIconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseIconDimmed: {
    opacity: 0.54,
  },
  exerciseIcon: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  exerciseInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  exerciseName: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT_DIN,
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  exerciseNameDone: {
    color: COLORS.lightSub,
    textDecorationLine: "line-through",
  },
  exerciseNameSkipped: {
    color: COLORS.lightSub,
    textDecorationLine: "line-through",
  },
  exerciseMeta: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FONT_DIN,
    color: COLORS.lightSub,
  },
  exerciseDuration: {
    color: COLORS.lightMuted,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  statusBadgeDone: {
    backgroundColor: "#EFFAE9",
  },
  statusBadgeSkipped: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#58BF19",
  },

  // Protocol row
  protocolRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    paddingVertical: 7,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightDivider,
  },
  protocolRowDone: {
    opacity: 0.58,
  },
  protocolEmoji: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightSurface,
    overflow: "hidden",
    fontSize: 25,
    lineHeight: 56,
    textAlign: "center",
  },
  protocolInfo: {
    flex: 1,
    minWidth: 0,
  },
  protocolName: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT_DIN,
    color: COLORS.lightText,
  },
  protocolNameDone: {
    textDecorationLine: "line-through",
    color: COLORS.lightSub,
  },
  protocolQty: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FONT_DIN,
    color: COLORS.lightSub,
    marginTop: 3,
  },
  protocolDoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFFAE9",
    alignItems: "center",
    justifyContent: "center",
  },
  // Footer
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    backgroundColor: "#FEF5E4",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lightDivider,
  },
  footerInner: {
    gap: SP[2],
  },

  startBtn: {
    minHeight: 58,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 18,
  },
  startBtnPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
    transform: [{ translateY: 1 }],
  },
  startBtnDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  startBtnText: {
    fontSize: 17,
    lineHeight: 20,
    fontFamily: FONT_DIN,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  startBtnTextDisabled: {
    color: COLORS.lightSub,
  },

  // Skip button
  skipBtn: {
    paddingVertical: SP[2],
    alignItems: "center",
  },
  skipBtnPressed: {
    opacity: 0.55,
  },
  skipBtnText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_DIN,
    color: COLORS.lightSub,
  },

  // Loading state
  loadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    height: 58,
    paddingHorizontal: SP[4],
    justifyContent: "space-between",
  },
  loadingBody: {
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    gap: SP[2],
  },
  loadingHint: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FONT_DIN,
    color: COLORS.lightMuted,
    marginBottom: SP[3],
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    paddingVertical: 7,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightDivider,
  },
  skeletonIcon: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightSurface,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    height: 13,
    borderRadius: 6,
    backgroundColor: COLORS.lightSurface,
  },
  skeletonBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.lightSurface,
  },
});
