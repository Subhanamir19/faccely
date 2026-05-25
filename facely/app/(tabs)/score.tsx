// app/(tabs)/score.tsx
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
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import type { ScoringMetric } from "@/components/scores/ScoringCarousel";
import StackedScoreDeckPreview from "@/components/scores/StackedScoreDeckPreview";
import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { useScores } from "../../store/scores";
import { useInsights } from "../../store/insights";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";

const FONT = "ProximaNova-Bold";
const SCREEN_BG = "#FEF5E4";

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

// ─── Local light buttons (replace dark PillNavButton) ────────────────────────

function LightPillButton({
  label,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  fill = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
  /** When true, button stretches to fill remaining row width. */
  fill?: boolean;
}) {
  const isPrimary = variant === "primary";
  const bg = disabled
    ? COLORS.lightSurfaceAlt
    : isPrimary
      ? COLORS.ctaBlack
      : COLORS.lightSurfaceAlt;
  const fg = disabled
    ? COLORS.lightSub
    : isPrimary
      ? "#FFFFFF"
      : COLORS.lightText;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        ...(fill ? { flex: 1 } : {}),
        minHeight: sh(54),
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: sw(8),
        paddingVertical: sh(14),
        paddingHorizontal: SP[5],
        opacity: pressed && !disabled ? 0.85 : 1,
      })}
    >
      {loading && <ActivityIndicator color={fg} />}
      <Text style={{ color: fg, fontFamily: FONT, fontSize: ms(13), letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScoreScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();

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

  // Avatar must shrink on shorter screens so it can't crash into the header
  // when the centerStack contents exceed the available vertical space.
  const avatarSize = Math.round(
    Math.min(ms(128), Math.max(72, SH * 0.14))
  );
  const avatarPad = Math.max(2, Math.round(avatarSize * 0.03));

  const handleBack = () => router.back();

  const handleAdvanced = async () => {
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
    <View style={styles.screen}>
      <ConsentModal />

      <View
        style={[
          styles.content,
          {
            paddingTop:    insets.top    + SP[5],
            paddingBottom: insets.bottom + SP[5],
          },
        ]}
      >
        {/* Header — top */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <Text style={styles.title}>Your Scores</Text>
          <Text style={styles.subtitle}>Facial analysis breakdown — all 8 metrics</Text>
        </Animated.View>

        {/* Centered stack: avatar + stacked score deck + counter */}
        <View style={styles.centerStack}>
          {/* User avatar — circular, top of the stack */}
          <Animated.View entering={FadeInDown.duration(420).delay(160)}>
            <View
              style={[
                styles.avatarRing,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  padding: avatarPad,
                },
              ]}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.avatarImg, { borderRadius: avatarSize / 2 }]}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarImg,
                    styles.avatarPlaceholder,
                    { borderRadius: avatarSize / 2 },
                  ]}
                />
              )}
            </View>
          </Animated.View>

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

        {/* Action buttons — docked at bottom */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.buttonRow}>
          <LightPillButton label="Back" onPress={handleBack} />
          <LightPillButton
            label="Advanced Analysis"
            variant="primary"
            onPress={handleAdvanced}
            disabled={explLoading}
            loading={explLoading}
            fill
          />
        </Animated.View>
      </View>
    </View>
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
  header: {
    gap: sh(4),
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(28),
    color: COLORS.lightText,
    lineHeight: ms(32),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },

  // Center column: avatar + stacked score deck + counter, vertically centered in
  // the available space between header and buttons.
  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
    marginTop: sh(8),
  },
  avatarRing: {
    backgroundColor: COLORS.lightCard, // frame colour — barely off-white
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatarImg: {
    width:  "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.iconTileLavender,
  },

  buttonRow: {
    flexDirection: "row",
    gap: SP[3],
  },
});
