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
  withSpring,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import { useTasksStore, type DailyTask, type ProtocolTask } from "@/store/tasks";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { getExerciseIcon } from "@/lib/exerciseIcons";

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

const STATUS_ICONS: Record<string, string> = {
  completed: "✓",
  skipped:   "✗",
  pending:   "",
};

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
            <Text style={[
              styles.statusBadgeText,
              isCompleted && styles.statusBadgeTextDone,
              isSkipped   && styles.statusBadgeTextSkipped,
            ]}>
              {STATUS_ICONS[task.status]}
            </Text>
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
          <Text style={styles.protocolDoneText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Start button — 3D pressed style
// ---------------------------------------------------------------------------

const BTN_DEPTH = 4;

function StartButton({ label, onPress, disabled }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pressed = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * BTN_DEPTH }],
  }));

  return (
    <View style={[styles.startBtnDepth, disabled && styles.startBtnDepthDisabled]}>
      <Pressable
        onPressIn={() => {
          if (disabled) return;
          pressed.value = withSpring(1, { damping: 10, stiffness: 400 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 10, stiffness: 200 });
        }}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Animated.View style={faceStyle}>
          <LinearGradient
            colors={disabled ? ["#2A2A2A", "#2A2A2A"] : ["#CCFF6B", "#B4F34D"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.startBtnFace}
          >
            <Text style={[styles.startBtnText, disabled && styles.startBtnTextDisabled]}>
              {label}
            </Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
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
        <LinearGradient colors={["#000000", "#0B0B0B"]} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingHeader}>
          <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backBtnText}>←</Text>
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
      <LinearGradient colors={["#000000", "#0B0B0B"]} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(260)} style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>←</Text>
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
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.97)", "#000000"]}
          style={styles.footerGradient}
          pointerEvents="none"
        />

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
    backgroundColor: "#000000",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 22,
    color: COLORS.text,
    fontFamily: "Poppins-Regular",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  progressPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: "center",
  },
  progressPillText: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.sub,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
  },

  // Focus summary
  focusSummary: {
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    marginBottom: SP[4],
    lineHeight: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.muted,
    letterSpacing: 1.5,
    marginBottom: SP[3],
  },

  // Exercise card
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,22,22,0.90)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: SP[3],
    marginBottom: SP[1],
    gap: SP[2],
  },
  exerciseCardDone: {
    backgroundColor: "rgba(22,22,22,0.50)",
    borderColor: "rgba(255,255,255,0.04)",
  },
  exerciseCardSkipped: {
    backgroundColor: "rgba(18,18,18,0.40)",
    borderColor: "rgba(255,255,255,0.04)",
  },
  exerciseIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  exerciseIconDimmed: {
    opacity: 0.38,
  },
  exerciseIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  exerciseInfo: {
    flex: 1,
    gap: 1,
  },
  exerciseName: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  exerciseNameDone: {
    color: COLORS.muted,
    textDecorationLine: "line-through",
  },
  exerciseNameSkipped: {
    color: "rgba(255,255,255,0.28)",
    textDecorationLine: "line-through",
  },
  exerciseMeta: {
    fontSize: 11,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
  },
  exerciseDuration: {
    color: COLORS.muted,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusBadgeDone: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.40)",
  },
  statusBadgeSkipped: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.muted,
  },
  statusBadgeTextDone: {
    color: "#22C55E",
  },
  statusBadgeTextSkipped: {
    color: COLORS.muted,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    opacity: 0.6,
  },

  // Protocol row
  protocolRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,22,22,0.70)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: SP[3],
    marginBottom: SP[2],
    gap: SP[3],
  },
  protocolRowDone: {
    opacity: 0.5,
  },
  protocolEmoji: {
    fontSize: 22,
    width: 36,
    textAlign: "center",
  },
  protocolInfo: {
    flex: 1,
  },
  protocolName: {
    fontSize: 13,
    fontFamily: "Poppins-Medium",
    color: COLORS.text,
  },
  protocolNameDone: {
    textDecorationLine: "line-through",
    color: COLORS.muted,
  },
  protocolQty: {
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    marginTop: 2,
  },
  protocolDoneBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolDoneText: {
    fontSize: 11,
    color: "#22C55E",
    fontFamily: "Poppins-SemiBold",
  },

  // Footer
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
  },
  footerGradient: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    height: 60,
  },
  footerInner: {
    gap: SP[3],
  },

  // Start button (3D)
  startBtnDepth: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.30,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  startBtnDepthDisabled: {
    backgroundColor: "#1E1E1E",
    shadowOpacity: 0,
  },
  startBtnFace: {
    borderRadius: RADII.pill,
    paddingVertical: SP[4],
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -BTN_DEPTH }],
  },
  startBtnText: {
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
    color: "#0A0A0A",
    letterSpacing: -0.3,
  },
  startBtnTextDisabled: {
    color: "#7A7A7A",
  },

  // Skip button
  skipBtn: {
    paddingVertical: SP[3],
    alignItems: "center",
  },
  skipBtnPressed: {
    opacity: 0.55,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
  },

  // Loading state
  loadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    justifyContent: "space-between",
  },
  loadingBody: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    gap: SP[2],
  },
  loadingHint: {
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    color: COLORS.muted,
    marginBottom: SP[3],
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.8)",
    borderRadius: RADII.md,
    paddingVertical: 6,
    paddingHorizontal: SP[3],
    gap: SP[2],
    marginBottom: SP[1],
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
