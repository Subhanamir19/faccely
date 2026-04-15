// app/(tabs)/score.tsx
// Scoring screen — Quench-Rating-style 2-col metric grid.
//
// Data sources:
//   useScores()   → current scan scores (always present after any scan)
//   useInsights() → per-metric deltas + overall delta (scan_count ≥ 2 only)

import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import ScoringGrid, { type ScoringMetric } from "@/components/scores/ScoringGrid";
import PillNavButton from "@/components/ui/PillNavButton";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { useScores } from "../../store/scores";
import { useInsights } from "../../store/insights";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";

// ─── Metric definitions ───────────────────────────────────────────────────────
// Maps API key → display label used in ScoringGrid / ANCHORS.

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMetrics(apiScores: Record<string, number> | null): ScoringMetric[] {
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScoreScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();

  const { imageUri, sideImageUri, scores, explLoading } = useScores();
  const { data: insightData } = useInsights();
  const { checkAndPromptConsent, ConsentModal } = useAdvancedAnalysisConsent();

  // ── Current scores
  const metrics = useMemo<ScoringMetric[]>(
    () => buildMetrics(scores as any),
    [scores]
  );
  const totalScore = useMemo(() => computeOverall(metrics), [metrics]);

  // ── Delta data (only meaningful when scan_count ≥ 2)
  const dashboardMetrics = insightData?.metrics ?? [];
  const overallDelta = useMemo<number | null>(() => {
    const overall = insightData?.overall;
    if (!overall) return null;
    return overall.current - overall.baseline;
  }, [insightData]);

  // ── Card width: full screen minus horizontal padding
  const HORIZONTAL_PAD = SP[4]; // 16 each side
  const cardWidth = SW - HORIZONTAL_PAD * 2;

  // ── Navigation
  const handleBack = () => router.back();

  const handleAdvanced = async () => {
    if (!scores || !imageUri || !sideImageUri) {
      Alert.alert(
        "Advanced analysis unavailable",
        "Advanced analysis needs a recent scan. Please run a new face scan first."
      );
      return;
    }
    const canProceed = await checkAndPromptConsent();
    if (!canProceed) return;
    router.push({ pathname: "/loading", params: { mode: "advanced", phase: "analysis" } });
  };

  return (
    <View style={styles.screen}>
      <ConsentModal />

      {/* Background */}
      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SP[5], paddingBottom: insets.bottom + SP[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.header}
        >
          <Text variant="h2" color="text">Your Scores</Text>
          <Text variant="caption" color="sub" style={styles.subtitle}>
            Facial analysis breakdown — all 8 metrics
          </Text>
        </Animated.View>

        {/* Scoring grid */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <ScoringGrid
            metrics={metrics}
            totalScore={totalScore}
            dashboardMetrics={dashboardMetrics}
            overallDelta={overallDelta}
            imageUri={imageUri}
            active
            cardWidth={cardWidth}
          />
        </Animated.View>

        {/* Action buttons */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={styles.buttonRow}
        >
          <PillNavButton
            label="Back"
            kind="ghost"
            onPress={handleBack}
          />
          <PillNavButton
            label="Advanced Analysis"
            kind="solid"
            onPress={handleAdvanced}
            disabled={explLoading}
            loading={explLoading}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
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
