// components/program/RoutineList.tsx
// Light-themed routine preview screen — shown after WorkoutPreview when the
// user taps Start. Lists today's exercises with per-row duration steppers and
// a sticky start routine CTA.

import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, SquareCheckBig } from "lucide-react-native";

import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
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

const DIN_FONT = "DINNextRounded-Regular";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
function StepperLight({ exerciseId }: { exerciseId: string }) {
  const { getDuration, incrementDuration, decrementDuration } = useExerciseSettings();
  const secs  = getDuration(exerciseId);
  const atMin = secs <= 15;
  const atMax = secs >= 90;
  const minusScale = useSharedValue(1);
  const plusScale = useSharedValue(1);
  const timeScale = useSharedValue(1);

  const minusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: minusScale.value }],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.value }],
  }));
  const timeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timeScale.value }],
  }));

  const popTime = () => {
    timeScale.value = withSequence(
      withTiming(1.06, { duration: 90 }),
      withSpring(1, { damping: 13, stiffness: 260 }),
    );
  };

  return (
    <View style={s.stepperRow}>
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          decrementDuration(exerciseId);
          popTime();
        }}
        onPressIn={() => {
          minusScale.value = withTiming(0.92, { duration: 80 });
        }}
        onPressOut={() => {
          minusScale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        disabled={atMin}
        hitSlop={8}
        style={({ pressed }) => [
          s.stepperBtn,
          atMin && s.stepperBtnDisabled,
          pressed && !atMin && s.stepperBtnPressed,
          minusStyle,
        ]}
      >
        <Text style={s.stepperGlyph}>−</Text>
      </AnimatedPressable>

      <Animated.Text style={[s.stepperTime, timeStyle]}>{formatSecs(secs)}</Animated.Text>

      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          incrementDuration(exerciseId);
          popTime();
        }}
        onPressIn={() => {
          plusScale.value = withTiming(0.92, { duration: 80 });
        }}
        onPressOut={() => {
          plusScale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        disabled={atMax}
        hitSlop={8}
        style={({ pressed }) => [
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
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [style, pressed && pressedStyle, animatedStyle]}
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

      <StepperLight exerciseId={task.exerciseId} />
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
  const todayIndex = useRoutineStore((st) => st.todayIndex);
  const setTodayTasksByAreas = useTasksStore((st) => st.setTodayTasksByAreas);
  const setTodayTasksByIds   = useTasksStore((st) => st.setTodayTasksByIds);
  const completeProtocol     = useTasksStore((st) => st.completeProtocol);
  const shuffleProtocols     = useTasksStore((st) => st.shuffleProtocols);
  const selectedAreas        = useTasksStore((st) => st.today?.selectedAreas ?? null);

  const [areasOpen, setAreasOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);
  const ctaScale = useSharedValue(1);
  const ctaShift = useSharedValue(0);
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaShift.value }, { scale: ctaScale.value }],
  }));

  useEffect(() => {
    if (initialEditOpen) setEditOpen(true);
  }, [initialEditOpen]);

  const totalSecs = useMemo(
    () => tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0),
    [tasks, getDuration],
  );
  const allResolved = tasks.length > 0 && tasks.every((task) => task.status !== "pending");
  const allProtocolsDone = protocols.length === 0 || protocols.every((p) => p.status === "done");
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
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={s.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={10}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={COLORS.lightText} strokeWidth={2.4} />
        </Pressable>
        <View style={s.headerTitleWrap} pointerEvents="none">
          <Text style={s.headerTitle}>{dayLabel}</Text>
          <Text style={s.headerSubtitle}>routine preview</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(360)} style={s.statsCard}>
          <View style={s.statCell}>
            <Text style={s.statNum}>{exerciseCnt}</Text>
            <Text style={s.statLabel}>Exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{durationStr}</Text>
            <Text style={s.statLabel}>Total duration</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{`${protocolDoneCnt}/${protocols.length}`}</Text>
            <Text style={s.statLabel}>Diet</Text>
          </View>
        </Animated.View>

        {/* ── Targeted Areas ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.targetsCard}>
          <View style={s.targetsHeader}>
            <Text style={s.sectionTitle}>Targeted Areas</Text>
            <TactilePill
              onPress={handleSelect}
              style={s.selectPill}
              pressedStyle={s.selectPillPressed}
              accessibilityLabel="Select targeted areas"
            >
              <SquareCheckBig size={ms(16)} color={COLORS.lightText} strokeWidth={2.2} />
              <Text style={s.selectPillText}>Select</Text>
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
        </Animated.View>

        {/* ── Exercises header ── */}
        <Animated.View entering={FadeInDown.delay(180).duration(360)} style={s.exercisesHeader}>
          <Text style={s.sectionTitle}>{`Exercises (${exerciseCnt})`}</Text>
          <TactilePill
            onPress={handleEdit}
            style={s.editPill}
            pressedStyle={s.editPillPressed}
            accessibilityLabel="Edit exercises"
          >
            <Text style={s.editPillText}>Edit</Text>
          </TactilePill>
        </Animated.View>

        {/* ── Exercise rows ── */}
        <View style={s.list}>
          {tasks.map((task, idx) => (
            <Animated.View
              key={task.exerciseId}
              entering={FadeInDown.delay(220 + idx * 50).duration(320)}
            >
              <ExerciseRowLight task={task} />
            </Animated.View>
          ))}
        </View>

        {protocols.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(250 + tasks.length * 45).duration(360)} style={s.dietHeader}>
            <Text style={s.sectionTitle}>{`Diet (${protocols.length})`}</Text>
          </Animated.View>
        ) : null}

        <ProtocolPlanCard
          protocols={protocols}
          onToggle={completeProtocol}
          onShuffle={shuffleProtocols}
          startDelay={260 + tasks.length * 45}
        />
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={s.ctaDock}>
        <View style={s.ctaDivider} />
        <Pressable
          onPress={allResolved ? undefined : handleStart}
          onPressIn={() => {
            if (allResolved) return;
            ctaScale.value = withTiming(0.985, { duration: 90 });
            ctaShift.value = withTiming(1, { duration: 90 });
          }}
          onPressOut={() => {
            ctaScale.value = withSpring(1, { damping: 15, stiffness: 240 });
            ctaShift.value = withSpring(0, { damping: 15, stiffness: 240 });
          }}
          disabled={allResolved}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={allResolved ? { disabled: true } : undefined}
        >
          {({ pressed }) => (
            <Animated.View
              style={[
                s.ctaBtn,
                allResolved && s.ctaBtnDisabled,
                pressed && !allResolved && s.ctaBtnPressed,
                ctaStyle,
              ]}
            >
              <Text style={[s.ctaText, allResolved && s.ctaTextDisabled]}>
                {ctaLabel}
              </Text>
            </Animated.View>
          )}
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
    </SafeAreaView>
  );
}

// ── styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FEF5E4",
  },

  // Header
  header: {
    height: sh(64),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
  },
  backBtn: {
    position: "absolute",
    left: SP[4],
    width: ms(40),
    height: ms(40),
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...TYPE.proximaScreenTitle,
    fontFamily: DIN_FONT,
    fontSize: ms(26),
    color: COLORS.lightText,
    textAlign: "center",
  },
  headerSubtitle: {
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    lineHeight: ms(16),
    color: COLORS.lightSub,
    marginTop: sh(2),
    textAlign: "center",
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
    paddingBottom: sh(140),
  },

  // Stats card
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderRadius: sw(20),
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    minHeight: sh(78),
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(4),
  },
  statDivider: {
    width: 1,
    height: sh(36),
    backgroundColor: COLORS.lightHairline,
  },
  statNum: {
    ...TYPE.proximaStatNum,
    fontFamily: DIN_FONT,
    fontSize: ms(23),
    color: COLORS.lightText,
  },
  statLabel: {
    fontFamily: DIN_FONT,
    fontSize: ms(12),
    lineHeight: ms(15),
    color: COLORS.lightMuted,
  },

  // Targeted Areas card
  targetsCard: {
    marginTop: SP[3],
    backgroundColor: "#F3F4F1",
    borderRadius: sw(18),
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
  },
  targetsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[4],
  },
  sectionTitle: {
    ...TYPE.proximaSection,
    fontFamily: DIN_FONT,
    fontSize: ms(20),
    color: COLORS.lightText,
  },
  selectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.1)",
    paddingHorizontal: sw(14),
    paddingVertical: sh(9),
    borderRadius: RADII.circle,
  },
  selectPillPressed: {
    backgroundColor: "#ECEDEA",
  },
  selectPillText: {
    ...TYPE.proximaPill,
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(8),
  },
  chip: {
    backgroundColor: COLORS.lightChipBg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    borderRadius: sw(12),
    paddingHorizontal: sw(14),
    paddingVertical: sh(8),
  },
  chipText: {
    ...TYPE.proximaPill,
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
  },

  // Exercises header
  exercisesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SP[5],
    marginBottom: SP[3],
  },
  editPill: {
    backgroundColor: COLORS.lightSurfaceAlt,
    paddingHorizontal: sw(18),
    paddingVertical: sh(10),
    borderRadius: RADII.circle,
  },
  editPillPressed: {
    backgroundColor: COLORS.lightBorder,
  },
  editPillText: {
    ...TYPE.proximaPill,
    fontFamily: DIN_FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  dietHeader: {
    marginTop: SP[5],
    marginBottom: SP[3],
  },

  // Rows
  list: {
    gap: sh(2),
    backgroundColor: "#FFFDF8",
    borderRadius: sw(22),
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    shadowColor: "#000000",
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    minHeight: sh(70),
    paddingVertical: sh(6),
  },
  iconTile: {
    width: ms(52),
    height: ms(52),
    borderRadius: sw(13),
    backgroundColor: "#F7F8F4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
  },
  iconImg: {
    width: "92%",
    height: "92%",
    borderRadius: RADII.sm,
    resizeMode: "cover",
  },
  rowText: {
    flex: 1,
    justifyContent: "center",
    gap: sh(2),
  },
  rowTitle: {
    ...TYPE.proximaExerciseTitle,
    fontFamily: DIN_FONT,
    fontSize: ms(15),
    color: COLORS.lightText,
  },
  rowSub: {
    fontFamily: DIN_FONT,
    fontSize: ms(13),
    lineHeight: ms(16),
    color: COLORS.lightMuted,
  },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
  },
  stepperBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: "#F1F2F4",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPressed: {
    backgroundColor: COLORS.lightBorder,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperGlyph: {
    fontFamily: DIN_FONT,
    fontSize: ms(18),
    lineHeight: ms(20),
    color: COLORS.lightText,
    marginTop: -1,
  },
  stepperTime: {
    ...TYPE.proximaStepper,
    fontFamily: DIN_FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
    minWidth: sw(42),
    textAlign: "center",
  },

  // CTA dock
  ctaDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SP[3],
    paddingBottom: SP[4],
    paddingHorizontal: SP[5],
    backgroundColor: "#FEF5E4",
  },
  ctaDivider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.lightDivider,
  },
  ctaBtn: {
    minHeight: sh(58),
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: sh(18),
  },
  ctaBtnPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
  },
  ctaBtnDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  ctaText: {
    fontFamily: DIN_FONT,
    fontSize: ms(17),
    letterSpacing: 0.6,
    color: "#FFFFFF",
    textAlign: "center",
  },
  ctaTextDisabled: {
    color: COLORS.lightSub,
  },
});
