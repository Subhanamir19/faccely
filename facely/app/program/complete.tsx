// app/program/complete.tsx
// Redesigned session completion screen. Keeps the existing completion route
// behavior while presenting the session result as a focused summary.

import React, { useEffect, useMemo } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flame,
  Target,
} from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useTasksStore } from "@/store/tasks";
import { useProfile } from "@/store/profile";
import { getNewExerciseTitle } from "@/lib/newExerciseCatalog";

const FONT_BOLD = "ProximaNova-Bold";
const FONT_REGULAR = "Poppins-Regular";
const FONT_SEMIBOLD = "Poppins-SemiBold";

const INK = "#090909";
const MUTED = "#777A80";
const PANEL = "#F4F5F2";
const LINE = "#E6E7E4";
const SAGE = "#3F7A2A";
const SAGE_SOFT = "#E8F3E1";

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 4,
} as const;

function titleCase(value: string | null | undefined) {
  if (!value) return "Today's routine";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function ProgressSegments({
  doneCount,
  total,
}: {
  doneCount: number;
  total: number;
}) {
  const segmentCount = Math.max(1, Math.min(total || 1, 8));
  const filledCount = total > 0
    ? Math.max(0, Math.min(segmentCount, Math.round((doneCount / total) * segmentCount)))
    : segmentCount;

  return (
    <View style={styles.segmentRow} accessibilityLabel={`${doneCount} of ${total || doneCount} exercises completed`}>
      {Array.from({ length: segmentCount }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            index < filledCount ? styles.segmentFilled : styles.segmentEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function MetricTile({
  icon,
  label,
  value,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(delay)} style={styles.metricTile}>
      <View style={styles.metricIcon}>{icon}</View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const { doneCount: rawDone, total: rawTotal } = useLocalSearchParams<{
    doneCount?: string;
    total?: string;
  }>();

  const { currentStreak, today } = useTasksStore();
  const { displayName } = useProfile();
  const firstName = displayName?.split(" ")[0] ?? null;

  const doneCount = Number(rawDone ?? today?.tasks.filter((t) => t.status === "completed").length ?? 0);
  const total = Number(rawTotal ?? today?.tasks.length ?? 0);
  const safeTotal = total > 0 ? total : doneCount || 1;
  const isFullSession = doneCount >= safeTotal;

  const firstExercise = today?.tasks[0];
  const tomorrowExName = firstExercise
    ? getNewExerciseTitle(firstExercise.exerciseId) ?? firstExercise.name
    : null;

  const focusSummary = titleCase(today?.focusSummary);
  const streakValue = currentStreak === 1 ? "1 day" : `${currentStreak} days`;

  const headline = useMemo(() => {
    if (!isFullSession) return "Progress saved.";
    if (firstName) return `${firstName}, session complete.`;
    return "Session complete.";
  }, [firstName, isFullSession]);

  const subline = currentStreak >= 14
    ? "You are building visible consistency. Keep tomorrow easy to start."
    : currentStreak >= 7
    ? "A full week is banked. The routine is becoming automatic."
    : currentStreak >= 3
    ? "The habit is taking shape. Same small win tomorrow."
    : "One clean session is enough for today. Return tomorrow and stack it.";

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/program");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, SP[5]) + SP[2] },
        ]}
      >
        <Animated.View entering={FadeIn.duration(220)} style={styles.statusPill}>
          <View style={styles.statusIcon}>
            <Check size={17} color={SAGE} strokeWidth={3} />
          </View>
          <Text style={styles.statusText}>Session logged</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(320).delay(80)} style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.kicker}>Today</Text>
              <Text style={styles.heroTitle}>{headline}</Text>
            </View>
            <View style={styles.completionBadge}>
              <Text style={styles.completionNumber}>{doneCount}</Text>
              <Text style={styles.completionTotal}>/{safeTotal}</Text>
            </View>
          </View>

          <Text style={styles.heroBody}>{subline}</Text>
          <ProgressSegments doneCount={doneCount} total={safeTotal} />
        </Animated.View>

        <View style={styles.metricsGrid}>
          <MetricTile
            delay={160}
            icon={<Target size={18} color={INK} strokeWidth={2.4} />}
            label="Focus"
            value={focusSummary}
          />
          <MetricTile
            delay={220}
            icon={<Flame size={18} color={SAGE} strokeWidth={2.4} />}
            label="Streak"
            value={streakValue}
          />
        </View>

        <Animated.View entering={FadeInUp.duration(300).delay(280)} style={styles.nextPanel}>
          <View style={styles.nextIcon}>
            <CalendarDays size={20} color={INK} strokeWidth={2.2} />
          </View>
          <View style={styles.nextCopy}>
            <Text style={styles.nextLabel}>Next session</Text>
            <Text style={styles.nextTitle} numberOfLines={1} adjustsFontSizeToFit>
              {tomorrowExName ? `Starts with ${tomorrowExName}` : "Fresh routine tomorrow"}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.footerSpace} />

        <Animated.View entering={FadeInUp.duration(320).delay(360)} style={styles.ctaWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={handleDone}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaText}>Done</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FEF5E4",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SP[6],
    paddingTop: SP[5],
  },
  statusPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PANEL,
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 14,
    marginBottom: SP[5],
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 13,
    color: INK,
  },
  heroPanel: {
    backgroundColor: INK,
    borderRadius: 30,
    padding: SP[6],
    marginBottom: SP[4],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SP[4],
  },
  kicker: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 12,
    color: "#AEB4AA",
    textTransform: "uppercase",
    marginBottom: SP[2],
  },
  heroTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 32,
    lineHeight: 36,
    color: "#FFFFFF",
    maxWidth: 210,
  },
  completionBadge: {
    minWidth: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[2],
  },
  completionNumber: {
    fontFamily: FONT_BOLD,
    fontSize: 28,
    color: INK,
    includeFontPadding: false,
  },
  completionTotal: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 15,
    color: MUTED,
    marginTop: 8,
  },
  heroBody: {
    fontFamily: FONT_REGULAR,
    fontSize: 15,
    lineHeight: 23,
    color: "#D8DAD4",
    marginTop: SP[5],
    marginBottom: SP[5],
  },
  segmentRow: {
    flexDirection: "row",
    gap: 7,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  segmentFilled: {
    backgroundColor: "#FFFFFF",
  },
  segmentEmpty: {
    backgroundColor: "#3A3A3A",
  },
  metricsGrid: {
    flexDirection: "row",
    gap: SP[3],
    marginBottom: SP[4],
  },
  metricTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: RADII.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LINE,
    padding: SP[4],
    justifyContent: "space-between",
    ...CARD_SHADOW,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PANEL,
    alignItems: "center",
    justifyContent: "center",
  },
  metricCopy: {
    gap: 2,
  },
  metricLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
  },
  metricValue: {
    fontFamily: FONT_BOLD,
    fontSize: 20,
    color: INK,
  },
  nextPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
    borderRadius: RADII.lg,
    backgroundColor: PANEL,
    padding: SP[4],
  },
  nextIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nextCopy: {
    flex: 1,
  },
  nextLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  nextTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 17,
    color: INK,
  },
  footerSpace: {
    flex: 1,
    minHeight: SP[8],
  },
  ctaWrap: {
    width: "100%",
  },
  cta: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaPressed: {
    backgroundColor: COLORS.ctaBlackPressed,
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
