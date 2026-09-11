// app/score.tsx
// Scoring screen — swipeable stacked deck of 8 metric cards.
//
// Data sources:
//   useScores()   → current scan scores (always present after any scan)
//   useInsights() → per-metric deltas + overall delta (scan_count ≥ 2 only)

import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import type { ScoringMetric } from "@/components/scores/ScoringCarousel";
import StackedScoreDeckPreview from "@/components/scores/StackedScoreDeckPreview";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { useScores } from "../store/scores";
import { useInsights } from "../store/insights";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { hapticLight } from "@/lib/haptics";

const FONT_REGULAR = "SFProRounded-Regular";
const FONT_SEMIBOLD = "SFProRounded-Semibold";
const FONT_BOLD = "SFProRounded-Bold";
const SCREEN_BG = "#EEF0F1";

// ─── Metric definitions ───────────────────────────────────────────────────────
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

// ─── Advanced analysis CTA ───────────────────────────────────────────────

type AdvancedAnalysisButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

function AdvancedAnalysisButton({ onPress, disabled, loading }: AdvancedAnalysisButtonProps) {
  const inactive = Boolean(disabled || loading);

  return (
    <View style={[styles.advancedButtonBase, inactive && styles.advancedButtonBaseDisabled]}>
      <Pressable
        accessibilityRole="button"
        disabled={inactive}
        onPress={onPress}
        style={({ pressed }) => [
          styles.advancedButtonFace,
          pressed && !inactive && styles.advancedButtonFacePressed,
          inactive && styles.advancedButtonFaceDisabled,
        ]}
      >
        <LinearGradient
          colors={inactive ? [COLORS.lightSurfaceAlt, COLORS.lightSurfaceAlt] : ["#FF6A00", "#F4510B"]}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.advancedButtonGradient}
        >
          {loading ? (
            <ActivityIndicator color={inactive ? COLORS.lightSub : "#FFFFFF"} />
          ) : (
            <View style={styles.ctaContent}>
              <Text style={[styles.advancedButtonText, inactive && styles.advancedButtonTextDisabled]}>
                ADVANCED ANALYSIS
              </Text>
              <ChevronRight size={ms(17)} color={inactive ? COLORS.lightSub : "#FFFFFF"} strokeWidth={2.5} />
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function ScoreScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();

  const { imageUri, sideImageUri, scores, explLoading } = useScores();
  const { data: insightData } = useInsights();
  const { checkAndPromptConsent, ConsentModal } = useAdvancedAnalysisConsent();

  const metrics = useMemo<ScoringMetric[]>(
    () => buildMetrics(scores as any),
    [scores],
  );
  const totalScore = useMemo(() => computeOverall(metrics), [metrics]);

  const dashboardMetrics = insightData?.metrics ?? [];
  const overallDelta = useMemo<number | null>(() => {
    const overall = insightData?.overall;
    if (!overall) return null;
    return overall.current - overall.baseline;
  }, [insightData]);

  // Viewport width passed to the card deck — the screen has SP[5] horizontal pad
  const HORIZONTAL_PAD = SP[5];
  const viewportWidth  = SW - HORIZONTAL_PAD * 2;

  const handleAdvanced = async () => {
    hapticLight();
    if (!scores || !imageUri || !sideImageUri) {
      Alert.alert(
        "Advanced analysis unavailable",
        "Advanced analysis needs a recent scan. Please run a new face scan first.",
      );
      return;
    }
    const canProceed = await checkAndPromptConsent();
    if (!canProceed) return;
    router.push({ pathname: "/loading", params: { mode: "advanced", phase: "analysis" } });
  };

  return (
    <LinearGradient
      colors={["#FEFFFF", "#F4F5F6", "#EEF0F1"]}
      locations={[0, 0.42, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ConsentModal />

      <View
        style={[
          styles.content,
          {
            paddingTop:    insets.top    + SP[5],
            paddingBottom: Math.max(insets.bottom + SP[5], FLOATING_TAB_BAR.contentClearance + SP[3]),
          },
        ]}
      >
        {/* Header + deck scroll if short screens need extra vertical space. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: sh(24) }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <Animated.View entering={FadeInDown.duration(420).delay(80)}>
              <Text style={styles.title}>Your Scores</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(420).delay(150)}>
              <Text style={styles.subtitle}>A quick read of your current scan</Text>
            </Animated.View>
          </View>

        {/* Centered stack: stacked score deck + counter */}
        <View
          style={[
            styles.centerStack,
            {
              gap: sh(12),
              marginTop: sh(8),
            },
          ]}
        >
          {/* Stacked score deck + counter */}
          <Animated.View entering={FadeInDown.duration(500).delay(220)} style={{ width: "100%" }}>
            <StackedScoreDeckPreview
              metrics={metrics}
              totalScore={totalScore}
              dashboardMetrics={dashboardMetrics}
              overallDelta={overallDelta}
              viewportWidth={viewportWidth}
              embedded
              showHeader={false}
              showReset={false}
              showBackground={false}
            />
          </Animated.View>
        </View>

        </ScrollView>

        {/* Action button - docked at bottom */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.buttonRow}>
          <AdvancedAnalysisButton
            onPress={handleAdvanced}
            disabled={explLoading}
            loading={explLoading}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    flex: 1,
    paddingHorizontal: SP[5],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: sh(12),
  },
  header: {
    width: "100%",
    gap: sh(4),
  },
  title: {
    fontFamily: FONT_BOLD,
    fontSize: ms(26, 0.2),
    color: "#1C1C1E",
    lineHeight: ms(31),
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(12.5, 0.2),
    color: "rgba(28,28,30,0.58)",
    lineHeight: ms(17),
    includeFontPadding: false,
  },

  // Score deck gets the primary vertical space below the compact header.
  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
    marginTop: sh(8),
  },
  advancedButtonBase: {
    width: "100%",
    maxWidth: sw(520),
    borderRadius: 17,
    backgroundColor: "#C94308",
    paddingBottom: sh(4),
    shadowColor: "#F4510B",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  advancedButtonBaseDisabled: {
    backgroundColor: COLORS.lightBorder,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  advancedButtonFace: {
    height: Math.max(54, sh(56)),
    borderRadius: 17,
    overflow: "hidden",
  },
  advancedButtonFacePressed: {
    transform: [{ translateY: sh(4) }],
  },
  advancedButtonFaceDisabled: {
    opacity: 0.86,
  },
  advancedButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(5),
  },
  advancedButtonText: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: ms(14, 0.2),
    letterSpacing: 0.7,
    color: "#FFFFFF",
  },
  advancedButtonTextDisabled: {
    color: COLORS.lightSub,
  },
  buttonRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: sh(10),
  },
});
