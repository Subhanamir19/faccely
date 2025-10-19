import React, { useCallback, useEffect, useMemo } from "react";
import {
  SafeAreaView,
  View,
  ImageBackground,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import T from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import GlassBtn from "@/components/ui/GlassBtn";
import { COLORS } from "@/lib/tokens";
import { buildRoutineReq } from "@/lib/api/routine.ts";
import { useRoutine } from "@/store/routine.ts";
import { useScores } from "@/store/scores";
import type { Scores } from "@/store/scores";

const BG = require("../../assets/bg/score-bg.jpg");
const MAX_TASKS = 5;
const METRIC_KEYS: (keyof Scores)[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

export default function RoutineScreen() {
  const data = useRoutine((state) => state.data);
  const currentDay = useRoutine((state) => state.currentDay);
  const progress = useRoutine((state) => state.progress);
  const isLoading = useRoutine((state) => state.isLoading);
  const isRefreshing = useRoutine((state) => state.isRefreshing);
  const error = useRoutine((state) => state.error);
  const fetchPlan = useRoutine((state) => state.fetch);
  const hydrateFromCache = useRoutine((state) => state.hydrateFromCache);
  const setDay = useRoutine((state) => state.setDay);
  const markDone = useRoutine((state) => state.markDone);
  const scores = useScores((state) => state.scores);
  const router = useRouter();

  const request = useMemo(() => {
    if (!scores) return null;
    const mapped = METRIC_KEYS.reduce<Record<string, number | undefined>>((acc, key) => {
      acc[key] = scores[key];
      return acc;
    }, {});
    return buildRoutineReq({
      age: 24,
      gender: undefined,
      ethnicity: undefined,
      scores: mapped,
    });
  }, [scores]);

  useEffect(() => {
    void hydrateFromCache();
  }, [hydrateFromCache]);

  const ensurePlan = useCallback(() => {
    if (!request) return;
    if (!data && !isLoading) {
      fetchPlan(request).catch(() => undefined);
    }
  }, [data, fetchPlan, isLoading, request]);

  useFocusEffect(ensurePlan);

  const day = data?.days[currentDay];
  const doneSet = day ? progress[currentDay] : undefined;
  const tasks = day?.tasks ?? [];

  const completed = tasks.filter((task) => doneSet?.has(task.id)).length;
  const totalTasks = tasks.length || MAX_TASKS;
  const progressPct =
    totalTasks > 0 ? Math.min(100, Math.round((completed / totalTasks) * 100)) : 0;
  const weekIndex = Math.floor(currentDay / 7);
  const weekFocus =
    day?.weekFocus || data?.weekFocusByWeek?.[weekIndex] || `Week ${weekIndex + 1}`;
  const isReviewDay = (currentDay + 1) % 7 === 0;
  const footerLabel = isReviewDay ? "Review" : "Next Day";

  return (
    <ImageBackground source={BG} style={styles.flex} resizeMode="cover">
      <SafeAreaView style={styles.flex}>
        <View style={styles.scrim} />
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <T style={styles.title}>Routine</T>
            <View style={styles.weekChip}>
              <T style={styles.weekChipText} numberOfLines={1}>
                {weekFocus}
              </T>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          {!request ? (
            <GlassCard style={styles.card}>
              <View style={styles.cardInner}>
                <T style={styles.cardText}>Run an analysis to unlock your routine.</T>
                <Pressable
                  style={styles.outlineBtn}
                  onPress={() => router.push("/(tabs)/analysis")}
                >
                  <T style={styles.outlineText}>Go to Analysis</T>
                </Pressable>
              </View>
            </GlassCard>
          ) : isLoading && !day ? (
            <SkeletonList />
          ) : error ? (
            <GlassCard style={styles.card}>
              <View style={styles.cardInner}>
                <T style={styles.errorText}>{error}</T>
                {request ? (
                  <Pressable
                    style={styles.outlineBtn}
                    onPress={() => request && fetchPlan(request)}
                  >
                    <T style={styles.outlineText}>Retry</T>
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(task) => task.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.listGap} />}
              renderItem={({ item }) => (
                <BlurView intensity={50} tint="dark" style={styles.glassRow}>
                  <View style={styles.rowOverlay} pointerEvents="none" />
                  <View style={styles.rowBody}>
                    <View style={styles.rowTextWrap}>
                      <T style={styles.rowHeadline}>{item.headline}</T>
                      {item.category ? (
                        <T style={styles.rowCategory}>{item.category}</T>
                      ) : null}
                      {item.protocol ? (
                        <T style={styles.rowProtocol}>{item.protocol}</T>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => markDone(currentDay, item.id)}
                      style={({ pressed }) => [
                        styles.toggle,
                        doneSet?.has(item.id) && styles.toggleActive,
                        pressed && styles.togglePressed,
                      ]}
                    >
                      <View style={styles.toggleDot} />
                    </Pressable>
                  </View>
                </BlurView>
              )}
            />
          )}
        </View>

        <View style={styles.footer}>
          <GlassBtn label="View Week" onPress={() => setDay(Math.max(0, weekIndex * 7))} />
          <GlassBtn
            label={footerLabel}
            onPress={() =>
              setDay(Math.min((data?.days.length ?? 1) - 1, currentDay + 1))
            }
            variant="primary"
          />
        </View>

        {isRefreshing ? (
          <View style={styles.refreshBadge}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            <T style={styles.refreshText}>Syncing...</T>
          </View>
        ) : null}
      </SafeAreaView>
    </ImageBackground>
  );
}

function SkeletonList() {
  return (
    <View style={styles.listContent}>
      {Array.from({ length: MAX_TASKS }).map((_, index) => (
        <BlurView key={index} intensity={40} tint="dark" style={styles.glassRow}>
          <View style={styles.rowOverlay} pointerEvents="none" />
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonLineLong} />
            <View style={styles.skeletonLineShort} />
          </View>
        </BlurView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 32,
    color: COLORS.text,
  },
  weekChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  weekChipText: {
    fontSize: 14,
    color: COLORS.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 16,
    marginBottom: 24,
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
  },
  cardInner: {
    gap: 16,
  },
  cardText: {
    color: COLORS.text,
    fontSize: 14,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
  },
  outlineBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  outlineText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  listContent: {
    gap: 18,
    paddingBottom: 16,
  },
  listGap: { height: 18 },
  glassRow: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  rowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rowBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  rowHeadline: {
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  rowCategory: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 4,
  },
  rowProtocol: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
  },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  toggleActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(180,243,77,0.18)",
  },
  togglePressed: {
    transform: [{ scale: 0.96 }],
  },
  toggleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
  },
  skeletonRow: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
  },
  skeletonLineLong: {
    height: 14,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    width: "60%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  refreshBadge: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  refreshText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
});
