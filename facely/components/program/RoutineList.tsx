// components/program/RoutineList.tsx
// Light-themed routine preview screen — shown after WorkoutPreview when the
// user taps Start. Lists today's exercises with per-row duration steppers and
// a sticky START ROUTINE CTA.

import React, { useMemo, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { ChevronLeft, SquareCheckBig } from "lucide-react-native";

import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import { CARD_FACE_LABELS } from "@/lib/faceTargets";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import type { TargetArea } from "@/lib/taskSelection";
import type { DailyTask } from "@/store/tasks";
import { useTasksStore } from "@/store/tasks";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { useRoutineStore } from "@/store/routineStore";
import TargetAreasSheet from "./TargetAreasSheet";
import EditExercisesSheet from "./EditExercisesSheet";

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

  return (
    <View style={s.stepperRow}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          decrementDuration(exerciseId);
        }}
        disabled={atMin}
        hitSlop={8}
        style={({ pressed }) => [
          s.stepperBtn,
          atMin && s.stepperBtnDisabled,
          pressed && !atMin && s.stepperBtnPressed,
        ]}
      >
        <Text style={s.stepperGlyph}>−</Text>
      </Pressable>

      <Text style={s.stepperTime}>{formatSecs(secs)}</Text>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          incrementDuration(exerciseId);
        }}
        disabled={atMax}
        hitSlop={8}
        style={({ pressed }) => [
          s.stepperBtn,
          atMax && s.stepperBtnDisabled,
          pressed && !atMax && s.stepperBtnPressed,
        ]}
      >
        <Text style={s.stepperGlyph}>+</Text>
      </Pressable>
    </View>
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
          {task.name.toUpperCase()}
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
  onStart,
  onBack,
}: {
  tasks: DailyTask[];
  onStart: () => void;
  onBack: () => void;
}) {
  const { getDuration } = useExerciseSettings();
  const todayIndex = useRoutineStore((st) => st.todayIndex);
  const setTodayTasksByAreas = useTasksStore((st) => st.setTodayTasksByAreas);
  const setTodayTasksByIds   = useTasksStore((st) => st.setTodayTasksByIds);
  const selectedAreas        = useTasksStore((st) => st.today?.selectedAreas ?? null);

  const [areasOpen, setAreasOpen] = useState(false);
  const [editOpen,  setEditOpen]  = useState(false);

  const totalSecs = useMemo(
    () => tasks.reduce((sum, t) => sum + getDuration(t.exerciseId), 0),
    [tasks, getDuration],
  );
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
  const categoryCnt = uniqueTargets.length;

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
            <Text style={s.statNum}>{categoryCnt}</Text>
            <Text style={s.statLabel}>Categories</Text>
          </View>
        </Animated.View>

        {/* ── Targeted Areas ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.targetsCard}>
          <View style={s.targetsHeader}>
            <Text style={s.sectionTitle}>Targeted Areas</Text>
            <Pressable
              onPress={handleSelect}
              hitSlop={6}
              style={({ pressed }) => [s.selectPill, pressed && s.selectPillPressed]}
            >
              <SquareCheckBig size={ms(16)} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={s.selectPillText}>Select</Text>
            </Pressable>
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
          <Pressable
            onPress={handleEdit}
            hitSlop={6}
            style={({ pressed }) => [s.editPill, pressed && s.editPillPressed]}
          >
            <Text style={s.editPillText}>Edit</Text>
          </Pressable>
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
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={s.ctaDock}>
        <View style={s.ctaDivider} />
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [s.ctaBtn, pressed && s.ctaBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Start routine"
        >
          <Text style={s.ctaText}>START ROUTINE</Text>
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
    backgroundColor: COLORS.lightBg,
  },

  // Header
  header: {
    height: sh(56),
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
    fontSize: ms(28),
    color: COLORS.lightText,
    textAlign: "center",
  },
  headerSubtitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    lineHeight: ms(16),
    color: COLORS.lightSub,
    marginTop: sh(2),
    textAlign: "center",
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: sh(140),
  },

  // Stats card
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBg,
    borderRadius: RADII.lg,
    paddingVertical: SP[4],
    paddingHorizontal: SP[3],
    minHeight: sh(88),
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
    fontSize: ms(24),
    color: COLORS.lightText,
  },
  statLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    lineHeight: ms(16),
    color: COLORS.lightSub,
  },

  // Targeted Areas card
  targetsCard: {
    marginTop: SP[4],
    backgroundColor: COLORS.lightSurface,
    borderRadius: RADII.lg,
    padding: SP[5],
  },
  targetsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[4],
  },
  sectionTitle: {
    ...TYPE.proximaSection,
    fontSize: ms(22),
    color: COLORS.lightText,
  },
  selectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: sw(16),
    paddingVertical: sh(10),
    borderRadius: RADII.circle,
  },
  selectPillPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
  },
  selectPillText: {
    ...TYPE.proximaPill,
    fontSize: ms(14),
    color: "#FFFFFF",
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
    borderRadius: RADII.sm,
    paddingHorizontal: sw(16),
    paddingVertical: sh(10),
  },
  chipText: {
    ...TYPE.proximaPill,
    fontSize: ms(14),
    color: COLORS.lightText,
  },

  // Exercises header
  exercisesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SP[6],
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
    fontSize: ms(14),
    color: COLORS.lightText,
  },

  // Rows
  list: {
    gap: sh(20),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(14),
    paddingVertical: sh(4),
  },
  iconTile: {
    width: ms(56),
    height: ms(56),
    borderRadius: RADII.md,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  rowText: {
    flex: 1,
    justifyContent: "center",
    gap: sh(2),
  },
  rowTitle: {
    ...TYPE.proximaExerciseTitle,
    fontSize: ms(16),
    color: COLORS.lightText,
  },
  rowSub: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(13),
    lineHeight: ms(16),
    color: COLORS.lightSub,
  },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
  },
  stepperBtn: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: COLORS.lightSurfaceAlt,
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
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(20),
    lineHeight: ms(22),
    color: COLORS.lightText,
    marginTop: -1,
  },
  stepperTime: {
    ...TYPE.proximaStepper,
    fontSize: ms(15),
    color: COLORS.lightText,
    minWidth: sw(46),
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
    backgroundColor: COLORS.lightBg,
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
  ctaText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: ms(17),
    letterSpacing: 0.6,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
