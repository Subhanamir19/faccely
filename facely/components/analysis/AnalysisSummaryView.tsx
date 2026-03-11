// components/analysis/AnalysisSummaryView.tsx
// The redesigned primary analysis view.
// Shows overall score, archetype, top 3 priority findings, and recommended exercises.

import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import Text from "@/components/ui/T";
import type { MetricKey } from "@/store/scores";
import {
  buildInsightSentence,
  getArchetype,
  getMetricPriorities,
  getOverallScore,
  METRIC_LABELS,
  METRIC_TOP_EXERCISES,
  EXERCISE_DISPLAY_NAMES,
} from "@/lib/analysisInsights";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  scores: Partial<Record<MetricKey, number>>;
  explanations: Partial<Record<MetricKey, string[]>> | null;
  onSeeFullBreakdown: () => void;
};

// ---------------------------------------------------------------------------
// Score color helpers (match existing analysis.tsx)
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score <= 39) return COLORS.error;
  if (score <= 59) return COLORS.errorLight;
  if (score <= 79) return COLORS.warning;
  return COLORS.success;
}

function getScoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 50) return "Average";
  return "Needs Work";
}

// ---------------------------------------------------------------------------
// Overall header — score + archetype
// ---------------------------------------------------------------------------

function OverallHeader({
  overallScore,
  archetype,
}: {
  overallScore: number | null;
  archetype: string;
}) {
  const color = overallScore != null ? getScoreColor(overallScore) : COLORS.sub;
  const band = overallScore != null ? getScoreBand(overallScore) : "";

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.overallHeader}>
      <View style={styles.overallLeft}>
        <Text variant="caption" color="sub" style={styles.overallLabel}>
          Overall Score
        </Text>
        <Text variant="h3" style={[styles.overallScore, { color }]}>
          {overallScore ?? "--"}
          <Text variant="captionMedium" style={{ color }}> · {band}</Text>
        </Text>
        <Text variant="caption" color="sub" style={styles.archetype}>
          {archetype}
        </Text>
      </View>

      {/* Simple score ring */}
      <View style={[styles.scoreRing, { borderColor: color, shadowColor: color }]}>
        <Text style={[styles.scoreRingText, { color }]}>
          {overallScore ?? "--"}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Priority finding card
// ---------------------------------------------------------------------------

function FindingCard({
  metric,
  score,
  labels,
  index,
}: {
  metric: MetricKey;
  score: number;
  labels: string[];
  index: number;
}) {
  const color = getScoreColor(score);
  const band = getScoreBand(score);
  const insight = buildInsightSentence(metric, labels, score);
  const exercises = METRIC_TOP_EXERCISES[metric] ?? [];

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(index * 80)}
      style={styles.findingCard}
    >
      {/* Card header */}
      <View style={styles.findingHeader}>
        <View style={styles.findingTitleRow}>
          <Text variant="captionSemiBold" color="text">
            {METRIC_LABELS[metric]}
          </Text>
          <View style={[styles.bandPill, { borderColor: color }]}>
            <Text style={[styles.bandText, { color }]}>{band}</Text>
          </View>
        </View>
        <Text style={[styles.findingScore, { color }]}>{Math.round(score)}</Text>
      </View>

      {/* Score bar */}
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>

      {/* Insight sentence */}
      <Text variant="caption" color="sub" style={styles.insightText}>
        {insight}
      </Text>

      {/* Exercise pills */}
      {exercises.length > 0 && (
        <View style={styles.exercisePills}>
          {exercises.map((exId) => (
            <View key={exId} style={styles.exercisePill}>
              <Text style={styles.exercisePillText}>
                {EXERCISE_DISPLAY_NAMES[exId] ?? exId}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AnalysisSummaryView({
  scores,
  explanations,
  onSeeFullBreakdown,
}: Props) {
  const overallScore = getOverallScore(scores);
  const archetype = getArchetype(scores);
  const priorities = getMetricPriorities(scores);

  // Top 3 worst metrics that have a score
  const top3 = priorities
    .filter((m) => typeof scores[m] === "number")
    .slice(0, 3);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Overall score + archetype */}
      <OverallHeader overallScore={overallScore} archetype={archetype} />

      {/* Section label */}
      <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.sectionLabelRow}>
        <Text variant="smallSemiBold" color="sub" style={styles.sectionLabel}>
          YOUR TOP PRIORITIES
        </Text>
        <Text variant="small" color="sub" style={styles.sectionSub}>
          Lowest scoring · highest impact
        </Text>
      </Animated.View>

      {/* Priority finding cards */}
      {top3.map((metric, i) => {
        const score = scores[metric] as number;
        const labels = explanations?.[metric] ?? [];
        return (
          <FindingCard
            key={metric}
            metric={metric}
            score={score}
            labels={labels}
            index={i}
          />
        );
      })}

      {/* See full breakdown button */}
      <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.breakdownWrapper}>
        <TouchableOpacity
          onPress={onSeeFullBreakdown}
          style={styles.breakdownBtn}
          activeOpacity={0.7}
        >
          <Text variant="captionMedium" style={styles.breakdownBtnText}>
            See full breakdown
          </Text>
          <Text style={styles.breakdownArrow}>→</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sh(32),
    gap: sh(12),
  },

  // Overall header
  overallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: sw(16),
    paddingVertical: sh(16),
    marginTop: sh(8),
  },
  overallLeft: {
    flex: 1,
    gap: sh(2),
  },
  overallLabel: {
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontSize: ms(10, 0.3),
  },
  overallScore: {
    fontSize: ms(26, 0.4),
    fontFamily: "Poppins-SemiBold",
  },
  archetype: {
    marginTop: sh(2),
    fontSize: ms(12, 0.3),
    color: COLORS.sub,
  },
  scoreRing: {
    width: ms(56, 0.6),
    height: ms(56, 0.6),
    borderRadius: ms(28, 0.6),
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.whiteGlass,
    shadowOpacity: 0.35,
    shadowRadius: ms(10),
    shadowOffset: { width: 0, height: sh(2) },
    elevation: 6,
  },
  scoreRingText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(18, 0.4),
  },

  // Section label
  sectionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: sw(2),
  },
  sectionLabel: {
    letterSpacing: 0.8,
    fontSize: ms(10, 0.3),
    color: COLORS.sub,
  },
  sectionSub: {
    fontSize: ms(10, 0.3),
    color: COLORS.muted,
  },

  // Finding card
  findingCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: sw(16),
    paddingVertical: sh(14),
    gap: sh(10),
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  findingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
    flex: 1,
  },
  bandPill: {
    borderWidth: 1,
    borderRadius: RADII.circle,
    paddingHorizontal: sw(7),
    paddingVertical: sh(2),
  },
  bandText: {
    fontFamily: "Poppins-Medium",
    fontSize: ms(10, 0.3),
  },
  findingScore: {
    fontFamily: "Poppins-SemiBold",
    fontSize: ms(18, 0.4),
    minWidth: sw(32),
    textAlign: "right",
  },

  // Score bar
  scoreBarTrack: {
    height: sh(3),
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: RADII.circle,
  },

  // Insight
  insightText: {
    fontSize: ms(13, 0.3),
    lineHeight: sh(20),
    color: COLORS.sub,
  },

  // Exercise pills
  exercisePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(6),
  },
  exercisePill: {
    backgroundColor: COLORS.whiteGlass,
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    paddingHorizontal: sw(10),
    paddingVertical: sh(4),
  },
  exercisePillText: {
    fontFamily: "Poppins-Medium",
    fontSize: ms(11, 0.3),
    color: COLORS.accent,
  },

  // Breakdown button
  breakdownWrapper: {
    marginTop: sh(4),
  },
  breakdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingVertical: sh(14),
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.whiteGlass,
  },
  breakdownBtnText: {
    color: COLORS.dim,
    fontSize: ms(13, 0.3),
  },
  breakdownArrow: {
    color: COLORS.sub,
    fontSize: ms(13, 0.3),
    fontFamily: "Poppins-Regular",
  },
});
