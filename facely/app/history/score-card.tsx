// app/history/score-card.tsx
// Historical scan scores — mirrors (tabs)/score.tsx UI, fed by fetchScanDetail.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import ScoringGrid, { type ScoringMetric } from "@/components/scores/ScoringGrid";
import PillNavButton from "@/components/ui/PillNavButton";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";

// ─── Metric definitions — kept in sync with (tabs)/score.tsx ───────────────

type MetricDef = { apiKey: string; label: string; defaultScore: number };

const METRIC_DEFS: MetricDef[] = [
  { apiKey: "jawline",           label: "Jawline",                defaultScore: 64 },
  { apiKey: "facial_symmetry",   label: "Facial Symmetry",        defaultScore: 72 },
  { apiKey: "cheekbones",        label: "Cheekbones",             defaultScore: 58 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity", defaultScore: 81 },
  { apiKey: "skin_quality",      label: "Skin Quality",           defaultScore: 69 },
  { apiKey: "eyes_symmetry",     label: "Eye Symmetry",           defaultScore: 62 },
  { apiKey: "nose_harmony",      label: "Nose Balance",           defaultScore: 74 },
];

function buildMetrics(apiScores: Record<string, number> | null | undefined): ScoringMetric[] {
  return METRIC_DEFS.map(({ apiKey, label, defaultScore }) => {
    const raw = Number(apiScores?.[apiKey]);
    const score = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : defaultScore;
    return { label, score };
  });
}

function computeOverall(metrics: ScoringMetric[]): number {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function HistoryScoreCard() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = params?.scanId;

  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError("Missing scanId");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchScanDetail(scanId);
        if (!cancelled) setDetail(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load scan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  const metrics = useMemo<ScoringMetric[]>(
    () => buildMetrics(detail?.scores as any),
    [detail]
  );
  const totalScore = useMemo(() => computeOverall(metrics), [metrics]);

  const HORIZONTAL_PAD = SP[4];
  const cardWidth = SW - HORIZONTAL_PAD * 2;

  const handleBack = () => router.back();
  const handleAdvanced = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(scanId ?? "")}`);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text variant="captionMedium" color="sub" style={{ marginTop: SP[3] }}>
          Loading scores...
        </Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
        <Text
          variant="captionMedium"
          style={{ color: COLORS.error, textAlign: "center", marginTop: SP[2], paddingHorizontal: SP[6] }}
        >
          {error ?? "Could not load this scan."}
        </Text>
        <View style={{ marginTop: SP[4] }}>
          <PillNavButton label="Back" kind="ghost" onPress={handleBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SP[5], paddingBottom: insets.bottom + SP[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.header}
        >
          <Text variant="h2" color="text">Your Scores</Text>
          <Text variant="caption" color="sub" style={styles.subtitle}>
            Facial analysis breakdown — all 8 metrics
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <ScoringGrid
            metrics={metrics}
            totalScore={totalScore}
            dashboardMetrics={[]}
            overallDelta={null}
            imageUri={detail.images?.front?.url ?? null}
            active
            cardWidth={cardWidth}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={styles.buttonRow}
        >
          <PillNavButton label="Back" kind="ghost" onPress={handleBack} />
          <PillNavButton
            label="Advanced Analysis"
            kind="solid"
            onPress={handleAdvanced}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SP[4],
    gap: SP[4],
  },
  header: {
    gap: SP[1],
  },
  subtitle: {
    marginTop: SP[1],
  },
  buttonRow: {
    flexDirection: "row",
    gap: SP[3],
    marginTop: SP[2],
  },
});
