// components/scores/ShareCard.tsx
// Off-screen shareable card captured as PNG via react-native-view-shot.
// Render it with position: absolute, left: -9999 in the parent.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ShareMetric = {
  key: string;
  label: string;
  score: number;
};

interface ShareCardProps {
  metrics: ShareMetric[];
  totalScore: number;
  streak: number;
  cardRef: React.RefObject<View | null>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TIER_THRESHOLDS = [
  { min: 85, label: "ELITE",   color: COLORS.verdictElite },
  { min: 70, label: "GREAT",   color: COLORS.verdictGreat },
  { min: 55, label: "GOOD",    color: COLORS.verdictGood },
  { min: 40, label: "AVERAGE", color: COLORS.verdictAverage },
  { min: 0,  label: "POOR",    color: COLORS.verdictPoor },
];

function getTier(score: number): { label: string; color: string } {
  return TIER_THRESHOLDS.find((t) => score >= t.min) ?? TIER_THRESHOLDS[4];
}

// Abbreviated labels to fit card width
const LABEL_MAP: Record<string, string> = {
  "Jawline": "Jawline",
  "Facial Symmetry": "Symmetry",
  "Cheekbones": "Cheekbones",
  "Masculinity/Femininity": "Masc / Fem",
  "Skin Quality": "Skin Quality",
  "Eye Symmetry": "Eye Symmetry",
  "Nose Balance": "Nose Balance",
};

const CARD_WIDTH = 375;
const BAR_MAX_WIDTH = 160;

// ---------------------------------------------------------------------------
// MetricRow
// ---------------------------------------------------------------------------
function MetricRow({ metric }: { metric: ShareMetric }) {
  const fill = Math.max(0, Math.min(100, metric.score));
  const barWidth = Math.round((fill / 100) * BAR_MAX_WIDTH);
  const label = LABEL_MAP[metric.label] ?? metric.label;

  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricBarTrack}>
        <View style={[styles.metricBarFill, { width: barWidth }]} />
      </View>
      <Text style={styles.metricScore}>{metric.score}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ShareCard
// ---------------------------------------------------------------------------
export default function ShareCard({
  metrics,
  totalScore,
  streak,
  cardRef,
}: ShareCardProps) {
  const tier = getTier(totalScore);

  return (
    <View ref={cardRef} style={styles.card} collapsable={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandText}>FACELY</Text>
        <Text style={styles.headerLabel}>SIGMA SCORE</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Tier badge + big score */}
      <View style={styles.scoreSection}>
        <View style={[styles.tierBadge, { borderColor: tier.color }]}>
          <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
        </View>
        <Text style={[styles.bigScore, { color: tier.color }]}>{totalScore}</Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsSection}>
        {metrics.map((m) => (
          <MetricRow key={m.key} metric={m} />
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerStreak}>🔥 {streak} day{streak !== 1 ? "s" : ""} streak</Text>
        <Text style={styles.footerWatermark}>facely.app</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#0B0B0B",
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandText: {
    color: COLORS.accent,
    fontSize: 20,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 3,
  },
  headerLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(180,243,77,0.18)",
  },
  scoreSection: {
    alignItems: "center",
    gap: 8,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 2,
  },
  bigScore: {
    fontSize: 64,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 72,
  },
  metricsSection: {
    gap: 10,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    width: 80,
  },
  metricBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  metricBarFill: {
    height: 5,
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  metricScore: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    width: 28,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerStreak: {
    color: "#FFAA32",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  footerWatermark: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
  },
});
