// C:\SS\facely\app\(tabs)\score.tsx
// Simplified score screen - shows only the summary card with Back/Advanced Analysis buttons

import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import MetricCardShell from "@/components/layout/MetricCardShell";
import ScoresSummaryCard from "@/components/scores/ScoresSummaryCard";
import useMetricSizing from "@/components/layout/useMetricSizing";
import PillNavButton from "@/components/ui/PillNavButton";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { useScores } from "../../store/scores";

// ---------------------------------------------------------------------------
// Types & defaults
// ---------------------------------------------------------------------------
type MetricDefinition = {
  apiKey: string;
  label: string;
  defaultScore: number;
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { apiKey: "jawline", label: "Jawline", defaultScore: 64 },
  { apiKey: "facial_symmetry", label: "Facial Symmetry", defaultScore: 72 },
  { apiKey: "cheekbones", label: "Cheekbones", defaultScore: 58 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity", defaultScore: 81 },
  { apiKey: "skin_quality", label: "Skin Quality", defaultScore: 69 },
  { apiKey: "eyes_symmetry", label: "Eye Symmetry", defaultScore: 62 },
  { apiKey: "nose_harmony", label: "Nose Balance", defaultScore: 74 },
];

type MetricScore = {
  key: string;
  label: string;
  score: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function applyApiScores(api: any): MetricScore[] {
  const scores = api?.scores ?? api;
  return METRIC_DEFINITIONS.map(({ apiKey, label, defaultScore }) => {
    const raw = Number(scores?.[apiKey]);
    const val = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
    return {
      key: label,
      label,
      score: val ?? defaultScore,
    };
  });
}

function calculateTotalScore(metrics: MetricScore[]): number {
  if (!metrics.length) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.score, 0);
  return Math.round(sum / metrics.length);
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function ScoreScreen() {
  const insets = useSafeAreaInsets();
  const { imageUri, sideImageUri, scores, explLoading } = useScores();
  const sizing = useMetricSizing();

  // Build metrics from API scores or use defaults
  const metrics = useMemo<MetricScore[]>(() => {
    if (scores) {
      return applyApiScores(scores);
    }
    return METRIC_DEFINITIONS.map(({ label, defaultScore }) => ({
      key: label,
      label,
      score: defaultScore,
    }));
  }, [scores]);

  const totalScore = useMemo(() => calculateTotalScore(metrics), [metrics]);

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Handle advanced analysis navigation
  const handleAdvanced = async () => {
    if (!scores || !imageUri || !sideImageUri) {
      Alert.alert(
        "Advanced analysis unavailable",
        "Advanced analysis needs a recent scan. Please run a new face scan first."
      );
      return;
    }
    router.push({ pathname: "/loading", params: { mode: "advanced", phase: "analysis" } });
  };

  return (
    <View style={styles.screen}>
      {/* Background */}
      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      {/* Content */}
      <View style={[styles.container, { paddingTop: insets.top + SP[4] }]}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <Text variant="h2" color="text">Your Scores</Text>
          <Text variant="caption" color="sub" style={styles.subtitle}>
            Overall facial analysis results
          </Text>
        </Animated.View>

        {/* Score Summary Card */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.cardContainer}
        >
          <MetricCardShell
            withOuterPadding={false}
            renderSurface={false}
            sizing={sizing}
          >
            {(usableWidth) => (
              <ScoresSummaryCard
                metrics={metrics}
                totalScore={totalScore}
                width={usableWidth}
                active={true}
                imageUri={imageUri}
              />
            )}
          </MetricCardShell>
        </Animated.View>

        {/* Footer with buttons */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={[styles.footer, { paddingBottom: insets.bottom + SP[4] }]}
        >
          <View style={styles.buttonRow}>
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
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  container: {
    flex: 1,
    paddingHorizontal: SP[4],
  },
  header: {
    marginBottom: SP[4],
  },
  subtitle: {
    marginTop: SP[1],
  },
  cardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    paddingTop: SP[4],
  },
  buttonRow: {
    flexDirection: "row",
    gap: SP[3],
  },
});
