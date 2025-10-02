// facely/app/(tabs)/recommendations.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  ImageBackground,
  ActivityIndicator,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";

// ✅ use our default Text (Poppins)
import Text from "@/components/ui/T";

import { useRecommendations } from "../../store/recommendations";
import { useScores } from "../../store/scores";

/* ============================================================================
   Rebranded Recommendations → “Today’s Routine”
   - Matches score.tsx glassmorphism and spacing
   - Header with date + lime progress
   - Single glass card with rows (title + description + hollow check)
   - Bottom pills: View Week / Add Task (stubbed)
   ========================================================================== */

const COLORS = {
  pageBg: "#0A0B0C",
  text: "rgba(255,255,255,0.92)",
  textDim: "rgba(255,255,255,0.64)",
  cardBorder: "rgba(255,255,255,0.12)",
  divider: "rgba(255,255,255,0.08)",
  progressTrack: "rgba(255,255,255,0.12)",
  progressFill: "#8FA31E",
  darkPillBg: "rgba(0,0,0,0.22)",
  hi: "#8FA31E",
  danger: "#9A1C1C",
  warn: "#8C6B00",
  ok: "#0B5134",
};

// Reuse the score background for now. Swap if you have a dedicated routine bg.
const BG = require("../../assets/bg/score-bg.jpg");

// Keep keys consistent with backend
const METRIC_KEYS = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

type LocalTask = {
  id: string;
  title: string;
  desc: string;
  completed: boolean;
};

export default function RecommendationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // pull scores to build the request payload, like before
  const scores = useScores((s: any) => s?.scores) as Partial<
    Record<MetricKey, number>
  > | null;

  // if you later add demographics in the store, wire them here
  const age = 24 as number;
  const gender = undefined as "male" | "female" | "other" | undefined;
  const ethnicity = undefined as string | undefined;

  const metrics = useMemo(
    () =>
      METRIC_KEYS.flatMap((k: MetricKey) => {
        const raw = scores?.[k];
        if (typeof raw !== "number") return [];
        const clamped = Math.max(0, Math.min(100, Math.round(raw)));
        return [{ key: k, score: clamped }];
      }),
    [scores]
  );

  const req = useMemo(
    () => ({ age, gender, ethnicity, metrics }),
    [age, gender, ethnicity, metrics]
  );

  const { data, isLoading, error, get, reset } = useRecommendations();

  useEffect(() => {
    if (metrics.length > 0) get(req);
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(req)]);

  // Transform backend items → local tappable “tasks”
  const initialTasks: LocalTask[] = useMemo(() => {
    if (!data?.items?.length) return [];
    // prefer the top 4 for today, keep order stable
    return data.items.slice(0, 4).map((it: any, i: number) => ({
      id: `${it.metric}-${i}`,
      title: titleFromItem(it),
      desc: descFromItem(it),
      completed: false,
    }));
  }, [data]);

  const [tasks, setTasks] = useState<LocalTask[]>(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const done = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const cardW = Math.min(760, Math.max(320, width * 0.82));

  const hasScores = metrics.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.pageBg }}>
      <ImageBackground source={BG} style={styles.page} resizeMode="cover">
        <View style={styles.scrim} />

        {/* Header */}
        <View style={[styles.header, { width: cardW }]}>
          <Text style={styles.h1}>Today’s Routine</Text>
          <Text style={styles.h2}>{formatToday()}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* Glass card */}
        <BlurView intensity={60} tint="dark" style={[styles.card, { width: cardW }]}>
          <View style={styles.cardOverlay} pointerEvents="none" />

          {!hasScores && (
            <View style={{ padding: 16 }}>
              <Text style={styles.text}>
                No scores found. Run an analysis first.
              </Text>
              <View style={styles.shadow}>
                <Pressable
                  onPress={() => router.push("/(tabs)/analysis")}
                  style={({ pressed }) => [
                    styles.btnLime,
                    pressed && { transform: [{ translateY: 1 }] },
                  ]}
                >
                  <Text style={styles.btnLimeLabel}>Go to Analysis</Text>
                </Pressable>
              </View>
            </View>
          )}

          {hasScores && isLoading && (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={[styles.textDim, { marginTop: 8, fontSize: 12 }]}>
                Thinking…
              </Text>
            </View>
          )}

          {hasScores && !isLoading && !!error && (
            <View style={{ padding: 16 }}>
              <Text style={[styles.text, { color: COLORS.danger, marginBottom: 6 }]}>
                {String(error)}
              </Text>
              <View style={styles.shadow}>
                <Pressable
                  onPress={() => get(req)}
                  style={({ pressed }) => [
                    styles.btnLime,
                    pressed && { transform: [{ translateY: 1 }] },
                  ]}
                >
                  <Text style={styles.btnLimeLabel}>Retry</Text>
                </Pressable>
              </View>
            </View>
          )}

          {hasScores && !isLoading && !error && tasks.length > 0 && (
            <FlatList
              data={tasks}
              keyExtractor={(t) => t.id}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === item.id ? { ...t, completed: !t.completed } : t
                      )
                    )
                  }
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.92, transform: [{ translateY: 1 }] },
                  ]}
                >
                  {/* Icon placeholder; swap with your icons later */}
                  <View style={styles.iconWrap}>
                    <View style={styles.iconDot} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowDesc}>{item.desc}</Text>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      item.completed && styles.checkCircleOn,
                    ]}
                  >
                    {item.completed ? <View style={styles.checkInner} /> : null}
                  </View>
                </Pressable>
              )}
              contentContainerStyle={{ paddingVertical: 10 }}
            />
          )}
        </BlurView>

        {/* Bottom pills */}
        <View style={styles.bottomButtons}>
          <View style={styles.shadow}>
            <Pressable
              style={({ pressed }) => [
                styles.btnDark,
                pressed && { transform: [{ translateY: 1 }] },
              ]}
              onPress={() => {
                /* wire week view later */
              }}
            >
              <Text style={styles.btnDarkLabel}>View Week</Text>
            </Pressable>
          </View>

          <View style={styles.shadow}>
            <Pressable
              style={({ pressed }) => [
                styles.btnLime,
                pressed && { transform: [{ translateY: 1 }] },
              ]}
              onPress={() => {
                /* open add-task sheet later */
              }}
            >
              <Text style={styles.btnLimeLabel}>Add Task</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

/* ----------------- helpers ----------------- */
function formatToday() {
  const d = new Date();
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const monthShort = d.toLocaleDateString(undefined, { month: "short" });
  const date = d.getDate();
  return `${day}, ${monthShort} ${date}`;
}
function titleFromItem(it: any) {
  // Prefer short imperative title; fallback to metric name
  if (typeof it.title === "string" && it.title.trim()) return it.title.trim();
  return niceMetric(it.metric);
}
function descFromItem(it: any) {
  // Prefer recommendation text; fallback to finding
  if (typeof it.recommendation === "string" && it.recommendation.trim())
    return it.recommendation.trim();
  if (typeof it.finding === "string" && it.finding.trim()) return it.finding.trim();
  return "Follow the recommended action today.";
}
function niceMetric(k: string) {
  switch (k) {
    case "facial_symmetry":
      return "Facial symmetry";
    case "skin_quality":
      return "Skin quality";
    case "eyes_symmetry":
      return "Eye symmetry";
    case "nose_harmony":
      return "Nose harmony";
    case "sexual_dimorphism":
      return "Sexual dimorphism";
    default:
      return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/* ----------------- styles ----------------- */
const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },

  header: { marginTop: 32, alignSelf: "center" },
  h1: { fontSize: 28, color: COLORS.text },
  h2: { marginTop: 6, fontSize: 16, color: COLORS.textDim },

  progressTrack: {
    marginTop: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.progressTrack,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: COLORS.progressFill },

  card: {
    marginTop: 18,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  row: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: { height: 1, backgroundColor: COLORS.divider, marginHorizontal: 16 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(143,163,30,0.9)",
  },

  rowTitle: { fontSize: 18, color: COLORS.text },
  rowDesc: { marginTop: 4, fontSize: 14, color: COLORS.textDim },

  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  checkCircleOn: { borderColor: COLORS.progressFill },
  checkInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.progressFill },

  bottomButtons: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  shadow: {
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  btnDark: {
    backgroundColor: COLORS.darkPillBg,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 160,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  btnDarkLabel: { fontSize: 16, color: "#FFFFFF" },

  btnLime: {
    backgroundColor: COLORS.hi,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 160,
    alignItems: "center",
  },
  btnLimeLabel: { fontSize: 16, color: "#0F0F0F" },

  // NEW: referenced in the component, must exist
  text: { color: COLORS.text },
  textDim: { color: COLORS.textDim },
});
