// components/program/RoutineList.tsx
// Light-themed routine preview screen — shown after WorkoutPreview when the
// user taps Start. Lists today's exercises with per-row duration steppers and
// a sticky start routine CTA.

import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Play, SlidersHorizontal } from "lucide-react-native";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import { CARD_FACE_LABELS } from "@/lib/faceTargets";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import type { TargetArea } from "@/lib/taskSelection";
import type { DailyTask, ProtocolTask } from "@/store/tasks";
import { useTasksStore } from "@/store/tasks";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { useRoutineStore } from "@/store/routineStore";
import TargetAreasSheet from "./TargetAreasSheet";
import EditExercisesSheet from "./EditExercisesSheet";
import ProtocolPlanCard from "./ProtocolPlanCard";

// Vertical space the floating tab bar occupies, so the sticky CTA and the
// scroll content clear it instead of sitting under the pill.
const TAB_BAR_CLEARANCE = FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom;

const DIN_FONT = "DINNextRounded-Regular";
const DIN_FONT_BOLD = "DINNextRounded-Bold";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SCREEN_BG = "#FFFFFF";
const INK = "#171512";
const SECONDARY = "#736E67";
const GROUPED = "#F7F6F3";
const INSET = "#EFEDE9";
const SEPARATOR = "rgba(23,21,18,0.09)";
const BRAND_GREEN = "#4D9800";
const CTA_TEXT = "#FAF9F7";
const ROUTINE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);

  return reduced;
}

function RoutineDockMaterial({ reduced }: { reduced: boolean }) {
  if (ROUTINE_LIQUID_GLASS && !reduced) {
    return (
      <GlassView
        glassEffectStyle="clear"
        tintColor="rgba(255,255,255,0.18)"
        pointerEvents="none"
        style={s.dockMaterial}
      />
    );
  }

  return (
    <View pointerEvents="none" style={[s.dockMaterial, reduced && s.dockMaterialSolid]}>
      {!reduced ? (
        <BlurView
          tint="systemUltraThinMaterialLight"
          intensity={Platform.OS === "android" ? 30 : 68}
          blurMethod="dimezisBlurView"
          blurReductionFactor={3}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={s.dockMaterialTint} />
    </View>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────
function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function targetLabel(t: string): string {
  return CARD_FACE_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

// ── stepper (light variant) ─────────────────────────────────────────────
function StepperLight({
  exerciseId,
  exerciseName,
}: {
  exerciseId: string;
  exerciseName: string;
}) {
  const { getDuration, incrementDuration, decrementDuration } = useExerciseSettings();
  const secs  = getDuration(exerciseId);
  const atMin = secs <= 15;
  const atMax = secs >= 90;
  const reduceMotion = useReducedMotion();
  const minusScale = useSharedValue(1);
  const plusScale = useSharedValue(1);
  const timeScale = useSharedValue(1);

  const minusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: minusScale.get() }],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.get() }],
  }));
  const timeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timeScale.get() }],
  }));

  const popTime = () => {
    if (reduceMotion) return;
    timeScale.set(withSequence(
      withTiming(1.025, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) }),
    ));
  };

  return (
    <View style={s.stepperRow}>
      <AnimatedPressable
        onPress={() => {
          Haptics.selectionAsync();
          decrementDuration(exerciseId);
          popTime();
        }}
        onPressIn={() => {
          if (!reduceMotion) minusScale.set(withTiming(0.96, { duration: 100 }));
        }}
        onPressOut={() => {
          minusScale.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
        }}
        disabled={atMin}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${exerciseName} duration`}
        accessibilityHint={atMin ? "Minimum duration reached" : `Current duration ${formatSecs(secs)}`}
        accessibilityState={{ disabled: atMin }}
        style={({ pressed }: PressableStateCallbackType) => [
          s.stepperBtn,
          atMin && s.stepperBtnDisabled,
          pressed && !atMin && s.stepperBtnPressed,
          minusStyle,
        ]}
      >
        <Text style={s.stepperGlyph}>−</Text>
      </AnimatedPressable>

      <Animated.Text
        accessibilityLabel={`${formatSecs(secs)} duration`}
        style={[s.stepperTime, timeStyle]}
      >
        {formatSecs(secs)}
      </Animated.Text>

      <AnimatedPressable
        onPress={() => {
          Haptics.selectionAsync();
          incrementDuration(exerciseId);
          popTime();
        }}
        onPressIn={() => {
          if (!reduceMotion) plusScale.set(withTiming(0.96, { duration: 100 }));
        }}
        onPressOut={() => {
          plusScale.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
        }}
        disabled={atMax}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${exerciseName} duration`}
        accessibilityHint={atMax ? "Maximum duration reached" : `Current duration ${formatSecs(secs)}`}
        accessibilityState={{ disabled: atMax }}
        style={({ pressed }: PressableStateCallbackType) => [
          s.stepperBtn,
          atMax && s.stepperBtnDisabled,
          pressed && !atMax && s.stepperBtnPressed,
          plusStyle,
        ]}
      >
        <Text style={s.stepperGlyph}>+</Text>
      </AnimatedPressable>
    </View>
  );
}

function TactilePill({
  children,
  onPress,
  style,
  pressedStyle,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style: object;
  pressedStyle: object;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion) scale.set(withTiming(0.97, { duration: 100 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { duration: 400, dampingRatio: 1 }));
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }: PressableStateCallbackType) => [style, pressed && pressedStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ── exercise row ────────────────────────────────────────────────────────
function ExerciseRowLight({ task }: { task: DailyTask }) {
  const targetLabels = task.targets.map(targetLabel).join(", ");

  return (
    <View style={s.row}>
      <View style={s.iconTile}>
        <Image source={getExerciseIcon(task.exerciseId)} style={s.iconImg} />
      </View>

      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {task.name}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {targetLabels}
        </Text>
      </View>

      <StepperLight exerciseId={task.exerciseId} exerciseName={task.name} />
    </View>
  );
}

// ── main screen ─────────────────────────────────────────────────────────
export default function RoutineList({
  tasks,
  protocols,
  onStart,
  onBack,
  initialEditOpen = false,
}: {
  tasks: DailyTask[];
  protocols: ProtocolTask[];
  onStart: () => void;
  onBack: () => void;
  initialEditOpen?: boolean;
}) {
  const { getDuration } = useExerciseSettings();
  const insets = useSafeAreaInsets();
  const todayIndex = useRoutineStore((st) => st.todayIndex);
  const setTodayTasksByAreas = useTasksStore((st) => st.setTodayTasksByAreas);
  const setTodayTasksByIds   = useTasksStore((st) => st.setTodayTasksByIds);
  const completeProtocol     = useTasksStore((st) => st.completeProtocol);
  const shuffleProtocols     = useTasksStore((st) => st.shuffleProtocols);
  const selectedAreas        = useTasksStore((st) => st.today?.selectedAreas ?? null);

  const [areasOpen, setAreasOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();
  const ctaPulse = useSharedValue(0);

  useEffect(() => {
    if (initialEditOpen) setEditOpen(true);
  }, [initialEditOpen]);

  const totalSecs = useMemo(
    () => tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0),
    [tasks, getDuration],
  );
  const allResolved = tasks.length > 0 && tasks.every((task) => task.status !== "pending");
  const allProtocolsDone = protocols.length === 0 || protocols.every((p) => p.status === "done");

  useEffect(() => {
    cancelAnimation(ctaPulse);
    ctaPulse.set(0);
    if (reduceMotion || allResolved) return;

    ctaPulse.set(withRepeat(
      withTiming(1, {
        duration: 2600,
        easing: Easing.out(Easing.cubic),
      }),
      -1,
      false,
    ));

    return () => cancelAnimation(ctaPulse);
  }, [allResolved, ctaPulse, reduceMotion]);

  const ctaRingStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(ctaPulse.get(), [0, 1], [0.34, 0]),
    transform: [{ scale: interpolate(ctaPulse.get(), [0, 1], [1, 1.07]) }],
  }));
  // Chip row: prefer the user's explicit selection (pinned by the Select sheet)
  // over the derived union of every exercise's tags — the union surfaces stray
  // chips like "Nose" when the user only picked "Midface".
  const uniqueTargets = useMemo(() => {
    if (selectedAreas && selectedAreas.length > 0) return selectedAreas;
    const set = new Set<string>();
    for (const t of tasks) for (const tg of t.targets) set.add(tg);
    return Array.from(set);
  }, [tasks, selectedAreas]);

  const dayLabel    = `Day ${todayIndex + 1}`;
  const exerciseCnt = tasks.length;
  const durationStr = formatSecs(totalSecs);
  const protocolDoneCnt = protocols.filter((p) => p.status === "done").length;

  const handleBack = () => {
    Haptics.selectionAsync();
    onBack();
  };
  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };
  const handleSelect = () => {
    Haptics.selectionAsync();
    setAreasOpen(true);
  };
  const handleEdit = () => {
    Haptics.selectionAsync();
    setEditOpen(true);
  };
  const ctaLabel = allResolved
    ? allProtocolsDone
      ? "Done for today"
      : "Finish diet below"
    : "Start routine";

  const currentAreas = useMemo<TargetArea[]>(() => {
    if (selectedAreas && selectedAreas.length > 0) return selectedAreas;
    const set = new Set<TargetArea>();
    for (const t of tasks) for (const tg of t.targets) set.add(tg as TargetArea);
    return Array.from(set);
  }, [tasks, selectedAreas]);

  const currentIds = useMemo(() => tasks.map((t) => t.exerciseId), [tasks]);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={SCREEN_BG} />
      {/* ── Header ── */}
      <View style={[s.header, { minHeight: insets.top + 58, paddingTop: insets.top }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={({ pressed }) => [s.backBtn, pressed && s.headerControlPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(25)} color={INK} strokeWidth={2.4} />
        </Pressable>
        <View style={s.headerTitleWrap} pointerEvents="none">
          <Text style={s.headerTitle}>{dayLabel}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom + sh(126), sh(142)) + TAB_BAR_CLEARANCE },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats card ── */}
        <View style={s.summaryStrip}>
          <View style={s.statCell}>
            <Text style={s.statNum}>{exerciseCnt}</Text>
            <Text style={s.statLabel}>Exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{durationStr}</Text>
            <Text style={s.statLabel}>Duration</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{`${protocolDoneCnt}/${protocols.length}`}</Text>
            <Text style={s.statLabel}>Diet tasks</Text>
          </View>
        </View>

        {/* ── Targeted Areas ── */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Target areas</Text>
            <TactilePill
              onPress={handleSelect}
              style={s.textAction}
              pressedStyle={s.textActionPressed}
              accessibilityLabel="Edit targeted areas"
            >
              <SlidersHorizontal size={ms(15)} color={BRAND_GREEN} strokeWidth={2.3} />
              <Text style={s.textActionLabel}>Edit areas</Text>
            </TactilePill>
          </View>

          <View style={s.chipsWrap}>
            {uniqueTargets.length === 0 ? (
              <View style={s.chip}>
                <Text style={s.chipText}>Full Face</Text>
              </View>
            ) : (
              uniqueTargets.map((t) => (
                <View key={t} style={s.chip}>
                  <Text style={s.chipText}>{targetLabel(t)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── Exercises header ── */}
        <View style={[s.sectionHeader, s.exercisesHeader]}>
          <Text style={s.sectionTitle}>Exercises</Text>
          <TactilePill
            onPress={handleEdit}
            style={s.textAction}
            pressedStyle={s.textActionPressed}
            accessibilityLabel="Edit exercises"
          >
            <Text style={s.textActionLabel}>Edit list</Text>
          </TactilePill>
        </View>

        {/* ── Exercise rows ── */}
        <View style={s.list}>
          {tasks.length > 0 ? (
            tasks.map((task, idx) => (
              <React.Fragment key={task.exerciseId}>
                <ExerciseRowLight task={task} />
                {idx < tasks.length - 1 ? <View style={s.rowDivider} /> : null}
              </React.Fragment>
            ))
          ) : (
            <View style={s.emptyList}>
              <Text style={s.emptyListTitle}>No exercises selected</Text>
              <Text style={s.emptyListBody}>Use Edit list to add exercises to today&apos;s routine.</Text>
            </View>
          )}
        </View>

        {protocols.length > 0 ? (
          <View style={[s.sectionHeader, s.dietHeader]}>
            <Text style={s.sectionTitle}>Diet tasks</Text>
            <Text style={s.sectionCount}>{protocols.length}</Text>
          </View>
        ) : null}

        <ProtocolPlanCard
          protocols={protocols}
          onToggle={completeProtocol}
          onShuffle={shuffleProtocols}
          variant="native"
        />
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View
        style={[
          s.ctaDock,
          { paddingBottom: Math.max(insets.bottom, 12) + TAB_BAR_CLEARANCE },
        ]}
      >
        <RoutineDockMaterial reduced={reduceTransparency} />
        <Pressable
          onPress={allResolved ? undefined : handleStart}
          disabled={allResolved}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={allResolved ? { disabled: true } : undefined}
          hitSlop={4}
          style={({ pressed }) => [
            s.ctaBtn,
            allResolved && s.ctaBtnDisabled,
            pressed && !allResolved && s.ctaBtnPressed,
          ]}
        >
          {!allResolved ? (
            <>
              <Animated.View pointerEvents="none" style={[s.ctaPulseRing, ctaRingStyle]} />
              <LinearGradient
                pointerEvents="none"
                colors={["#2B2B2E", "#0A0A0B", "#0A0A0B"]}
                locations={[0, 0.6, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={s.ctaGradient}
              />
              <Play size={ms(17)} color={CTA_TEXT} fill={CTA_TEXT} strokeWidth={2} />
            </>
          ) : null}
          <Text style={[s.ctaText, allResolved && s.ctaTextDisabled]}>
            {ctaLabel}
          </Text>
        </Pressable>
      </View>

      <TargetAreasSheet
        visible={areasOpen}
        initialAreas={currentAreas}
        onConfirm={(areas) => {
          setTodayTasksByAreas(areas);
          setAreasOpen(false);
        }}
        onDismiss={() => setAreasOpen(false)}
      />

      <EditExercisesSheet
        visible={editOpen}
        initialIds={currentIds}
        onConfirm={(ids) => {
          setTodayTasksByIds(ids);
          setEditOpen(false);
        }}
        onDismiss={() => setEditOpen(false)}
      />
    </View>
  );
}

// ── styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    backgroundColor: SCREEN_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEPARATOR,
  },
  backBtn: {
    position: "absolute",
    left: SP[4],
    bottom: 9,
    width: ms(40),
    height: ms(40),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ms(20),
  },
  headerControlPressed: {
    backgroundColor: GROUPED,
    transform: [{ scale: 0.97 }],
  },
  headerTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(25),
    lineHeight: ms(30),
    letterSpacing: -0.25,
    color: INK,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
  summaryStrip: {
    minHeight: sh(72),
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: SEPARATOR,
    paddingVertical: SP[3],
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(3),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sh(34),
    backgroundColor: SEPARATOR,
  },
  statNum: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(21),
    lineHeight: ms(25),
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontFamily: DIN_FONT,
    fontSize: ms(11.5),
    lineHeight: ms(15),
    color: SECONDARY,
    textAlign: "center",
  },
  sectionBlock: {
    paddingTop: SP[5],
  },
  sectionHeader: {
    minHeight: ms(44),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(19),
    lineHeight: ms(24),
    letterSpacing: -0.15,
    color: INK,
  },
  sectionCount: {
    minWidth: ms(30),
    height: ms(28),
    borderRadius: ms(14),
    paddingHorizontal: sw(9),
    backgroundColor: GROUPED,
    color: SECONDARY,
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(12),
    lineHeight: ms(28),
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  textAction: {
    minHeight: ms(44),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingHorizontal: sw(10),
    borderRadius: ms(14),
  },
  textActionPressed: {
    backgroundColor: GROUPED,
  },
  textActionLabel: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(13),
    lineHeight: ms(17),
    color: BRAND_GREEN,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(8),
    paddingTop: SP[2],
  },
  chip: {
    minHeight: ms(36),
    justifyContent: "center",
    backgroundColor: GROUPED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEPARATOR,
    borderRadius: ms(18),
    paddingHorizontal: sw(14),
    paddingVertical: sh(8),
  },
  chipText: {
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    lineHeight: ms(17),
    color: INK,
  },
  exercisesHeader: {
    marginTop: SP[5],
    marginBottom: SP[2],
  },
  dietHeader: {
    marginTop: SP[5],
    marginBottom: SP[2],
  },
  list: {
    backgroundColor: GROUPED,
    borderRadius: ms(20),
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEPARATOR,
    overflow: "hidden",
  },
  row: {
    minHeight: sh(76),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(11),
    paddingHorizontal: sw(12),
    paddingVertical: sh(10),
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: sw(74),
    backgroundColor: SEPARATOR,
  },
  iconTile: {
    width: ms(50),
    height: ms(50),
    borderRadius: ms(14),
    borderCurve: "continuous",
    backgroundColor: INSET,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEPARATOR,
  },
  iconImg: {
    width: "94%",
    height: "94%",
    borderRadius: ms(12),
    resizeMode: "cover",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: sh(2),
  },
  rowTitle: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(15.5),
    lineHeight: ms(19),
    color: INK,
  },
  rowSub: {
    fontFamily: DIN_FONT,
    fontSize: ms(12.5),
    lineHeight: ms(16),
    color: SECONDARY,
  },
  stepperRow: {
    minWidth: sw(122),
    height: ms(40),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INSET,
    borderRadius: ms(20),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEPARATOR,
    overflow: "hidden",
  },
  stepperBtn: {
    width: ms(40),
    height: ms(40),
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPressed: {
    backgroundColor: "rgba(23,21,18,0.07)",
  },
  stepperBtnDisabled: {
    opacity: 0.32,
  },
  stepperGlyph: {
    fontFamily: DIN_FONT,
    fontSize: ms(19),
    lineHeight: ms(21),
    color: INK,
    marginTop: -1,
  },
  stepperTime: {
    minWidth: sw(43),
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(13),
    lineHeight: ms(17),
    color: INK,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  emptyList: {
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[6],
  },
  emptyListTitle: {
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(16),
    color: INK,
  },
  emptyListBody: {
    marginTop: sh(4),
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    lineHeight: ms(18),
    color: SECONDARY,
    textAlign: "center",
  },
  ctaDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingTop: SP[3],
    paddingHorizontal: SP[5],
  },
  dockMaterial: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.86)",
  },
  dockMaterialSolid: {
    backgroundColor: "rgba(255,255,255,0.98)",
  },
  dockMaterialTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.52)",
  },
  ctaBtn: {
    position: "relative",
    minHeight: ms(54),
    width: "100%",
    borderRadius: 999,
    overflow: "visible",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(9),
    paddingHorizontal: SP[6],
    paddingVertical: sh(16),
    boxShadow: "0 10px 18px rgba(0,0,0,0.24)",
  },
  ctaBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaBtnDisabled: {
    backgroundColor: INSET,
    boxShadow: "none",
  },
  ctaPulseRing: {
    position: "absolute",
    top: -5,
    right: -5,
    bottom: -5,
    left: -5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.20)",
  },
  ctaGradient: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
  },
  ctaText: {
    zIndex: 1,
    fontFamily: DIN_FONT_BOLD,
    fontSize: ms(16),
    lineHeight: ms(20),
    letterSpacing: 0.2,
    color: CTA_TEXT,
    textAlign: "center",
  },
  ctaTextDisabled: {
    color: SECONDARY,
  },
});
