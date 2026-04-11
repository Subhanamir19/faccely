// facely/components/scores/ScoresSummaryCard.tsx
// Redesigned summary card: profile photo overlapping top + 8 key metrics in compact grid (4x2)
// All sizing is derived from live useWindowDimensions — no module-level screen constants.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing, Image, useWindowDimensions } from "react-native";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII, SIZES } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";

// ─── Score helpers ─────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s < 40) return COLORS.error;
  if (s < 60) return COLORS.errorLight;
  if (s < 70) return COLORS.warning;
  if (s < 80) return "#C8DA45";
  if (s < 90) return COLORS.accent;
  return COLORS.success;
}

export type MetricScore = {
  key: string;
  label: string;
  score: number;
};

const SHORT_LABELS: Record<string, string> = {
  "Facial Symmetry": "Symmetry",
  "Eye Symmetry": "Eyes",
  "Nose Balance": "Nose",
  "Skin Quality": "Skin quality",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Masculinity",
  female: "Femininity",
};

function getShortLabel(label: string, gender?: string): string {
  if (label === "Masculinity/Femininity") {
    return GENDER_LABELS[gender || "male"] || "Masculinity";
  }
  return SHORT_LABELS[label] || label;
}

const ANCHORS: Record<string, [string, string, string, string, string, string, string, string]> = {
  "Overall":                 ["Weak",        "Below Avg",    "Developing",  "Decent",      "Mediocre",    "Strong",       "Elite",        "Top-tier"],
  "Jawline":                 ["Undefined",   "Soft",         "Mild",        "Average",     "Basic",       "Sharp",        "Chiseled",     "Razor-sharp"],
  "Cheekbones":              ["Recessed",    "Flat",         "Mild",        "Average",     "Modest",      "Prominent",    "High-set",     "Sculpted"],
  "Facial Symmetry":         ["Asymmetric",  "Off-center",   "Uneven",      "Minor shift", "Passable",    "Balanced",     "Near-perfect", "Mirror-like"],
  "Eye Symmetry":            ["Uneven",      "Misaligned",   "Slight off",  "Minor offset","Ordinary",    "Aligned",      "Harmonious",   "Perfect"],
  "Skin Quality":            ["Damaged",     "Rough",        "Dull",        "Average",     "Fair",        "Clear",        "Radiant",      "Glass-like"],
  "Nose Balance":            ["Misaligned",  "Off-center",   "Unbalanced",  "Average",     "Plain",       "Proportioned", "Refined",      "Ideal"],
  "Masculinity/Femininity":  ["Faint",       "Subtle",       "Mild",        "Average",     "Common",      "Pronounced",   "Strong",       "Peak"],
};

function getTierLabel(label: string, score: number): string {
  const anchors = ANCHORS[label] ?? ["Weak", "Below Avg", "Developing", "Decent", "Good", "Strong", "Elite", "Top-tier"];
  const s = Math.max(0, Math.min(100, score));
  if (s <= 25) return anchors[0];
  if (s <= 40) return anchors[1];
  if (s <= 50) return anchors[2];
  if (s <= 60) return anchors[3];
  if (s <= 70) return anchors[4];
  if (s <= 80) return anchors[5];
  if (s <= 89) return anchors[6];
  return anchors[7];
}

// ─── Responsive sizing ─────────────────────────────────────────────────────────
// All values derived from live window dimensions — call inside components only.

function useCardSizing(cardWidth: number) {
  const { width: SW, height: SH } = useWindowDimensions();

  return useMemo(() => {
    // Avatar
    const avatarSize   = Math.min(Math.max(Math.round(SW * 0.29), 96), 136);
    const avatarBorder = 3;
    const avatarTotal  = avatarSize + avatarBorder * 2;

    // Card internal padding
    const cardPadH     = Math.max(14, Math.round(SW * 0.044));
    const cardPadBot   = Math.max(12, Math.round(SH * 0.02));
    const cardPadTop   = Math.round(avatarTotal / 2) + Math.max(8, Math.round(SH * 0.012));

    // Grid gaps — tighter on small screens
    const rowGap = Math.max(8,  Math.round(SH * 0.013));
    const colGap = Math.max(10, Math.round(SH * 0.015));

    // Per-cell width (two equal columns)
    const cellWidth = (cardWidth - cardPadH * 2 - colGap) / 2;

    // Typography — scaled to cell width
    const scoreFontSize      = Math.max(22, Math.round(cellWidth * 0.21));
    const scoreFontSizeLarge = Math.max(26, Math.round(cellWidth * 0.25));
    const tierFontSize       = Math.max(9,  Math.round(cellWidth * 0.072));
    const labelFontSize      = Math.max(11, Math.round(cellWidth * 0.084));
    const labelFontSizeLarge = Math.max(12, Math.round(cellWidth * 0.094));

    // Row spacing inside each metric cell
    const scoreMB = Math.max(3, Math.round(SH * 0.006));

    return {
      avatarSize, avatarBorder, avatarTotal,
      cardPadH, cardPadBot, cardPadTop,
      rowGap, colGap, cellWidth,
      scoreFontSize, scoreFontSizeLarge,
      tierFontSize,
      labelFontSize, labelFontSizeLarge,
      scoreMB,
    };
  }, [SW, SH, cardWidth]);
}

// ─── Animated progress bar ─────────────────────────────────────────────────────

type ProgressBarProps = { score: number; delay: number; active: boolean };

function AnimatedProgressBar({ score, delay, active }: ProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const clamped   = Math.max(0, Math.min(100, score));
  const color     = getScoreColor(score);

  useEffect(() => {
    if (active) {
      widthAnim.setValue(0);
      Animated.timing(widthAnim, {
        toValue: clamped,
        duration: 800,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [active, clamped, delay]);

  const animWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={staticStyles.progressTrack}>
      <Animated.View style={[staticStyles.progressFill, { width: animWidth, backgroundColor: color }]} />
    </View>
  );
}

// ─── Metric cell ───────────────────────────────────────────────────────────────

type MetricCellProps = {
  label: string;
  score: number;
  delay: number;
  active: boolean;
  isLarge?: boolean;
  gender?: string;
  sizing: ReturnType<typeof useCardSizing>;
};

function MetricCell({ label, score, delay, active, isLarge = false, gender, sizing }: MetricCellProps) {
  const clamped      = Math.round(Math.max(0, Math.min(100, score)));
  const displayLabel = getShortLabel(label, gender);
  const tierLabel    = getTierLabel(label, score);

  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (active) {
      countAnim.setValue(0);
      const id = countAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
      Animated.timing(countAnim, {
        toValue: clamped,
        duration: 900,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => countAnim.removeListener(id));
      return () => countAnim.removeListener(id);
    }
  }, [active, clamped, delay]);

  const { scoreFontSize, scoreFontSizeLarge, tierFontSize, labelFontSize, labelFontSizeLarge, scoreMB } = sizing;

  const activeLabelSize = isLarge ? labelFontSizeLarge : labelFontSize;
  const activeScoreSize = isLarge ? scoreFontSizeLarge : scoreFontSize;

  return (
    <View style={staticStyles.metricCell}>
      <Text
        style={[
          staticStyles.metricLabel,
          { fontSize: activeLabelSize, lineHeight: Math.round(activeLabelSize * 1.35) },
        ]}
      >
        {displayLabel}
      </Text>

      <View style={[staticStyles.scoreRow, { marginBottom: scoreMB }]}>
        <Text
          style={[
            staticStyles.metricScore,
            { fontSize: activeScoreSize, lineHeight: Math.round(activeScoreSize * 1.2) },
          ]}
        >
          {displayScore}
        </Text>
        <View style={staticStyles.tierChip}>
          <Text style={[staticStyles.tierChipText, { fontSize: tierFontSize, lineHeight: Math.round(tierFontSize * 1.4) }]}>
            {tierLabel}
          </Text>
        </View>
      </View>

      <AnimatedProgressBar score={score} delay={delay} active={active} />
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const SUMMARY_METRICS = [
  "Overall",
  "Jawline",
  "Cheekbones",
  "Eye Symmetry",
  "Facial Symmetry",
  "Masculinity/Femininity",
  "Skin Quality",
  "Nose Balance",
];

type ScoresSummaryCardProps = {
  metrics: MetricScore[];
  totalScore: number;
  width: number;
  active: boolean;
  imageUri?: string | null;
};

export default function ScoresSummaryCard({
  metrics,
  totalScore,
  width,
  active,
  imageUri,
}: ScoresSummaryCardProps) {
  const { data: onboardingData } = useOnboarding();
  const gender  = onboardingData?.gender;
  const sizing  = useCardSizing(width);

  const {
    avatarSize, avatarBorder, avatarTotal,
    cardPadH, cardPadBot, cardPadTop,
    rowGap, colGap,
  } = sizing;

  const allMetrics: MetricScore[] = useMemo(() => [
    { key: "overall", label: "Overall", score: totalScore },
    ...metrics,
  ], [metrics, totalScore]);

  const pairs: MetricScore[][] = useMemo(() => {
    const display = allMetrics
      .filter(m => SUMMARY_METRICS.includes(m.label))
      .sort((a, b) => SUMMARY_METRICS.indexOf(a.label) - SUMMARY_METRICS.indexOf(b.label));
    const result: MetricScore[][] = [];
    for (let i = 0; i < display.length; i += 2) result.push(display.slice(i, i + 2));
    return result;
  }, [allMetrics]);

  return (
    <View style={staticStyles.wrapper}>
      {/* Profile photo — overlaps card top */}
      <View style={{ zIndex: 10, marginBottom: -(avatarTotal / 2) }}>
        <View
          style={[
            staticStyles.photoContainer,
            {
              width: avatarTotal,
              height: avatarTotal,
              borderRadius: avatarTotal / 2,
              padding: avatarBorder,
            },
          ]}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: COLORS.track }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                staticStyles.photoPlaceholder,
                { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              ]}
            >
              <Text style={staticStyles.photoPlaceholderText}>?</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card */}
      <View
        style={[
          staticStyles.card,
          {
            width,
            paddingTop: cardPadTop,
            paddingBottom: cardPadBot,
            paddingHorizontal: cardPadH,
          },
        ]}
      >
        <View style={{ gap: rowGap }}>
          {pairs.map((pair, rowIndex) => (
            <View key={rowIndex} style={[staticStyles.metricsRow, { gap: colGap }]}>
              {pair.map((metric, colIndex) => (
                <MetricCell
                  key={metric.key}
                  label={metric.label}
                  score={metric.score}
                  delay={(rowIndex * 2 + colIndex) * 60}
                  active={active}
                  isLarge={rowIndex === 0}
                  gender={gender}
                  sizing={sizing}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Static styles (no dynamic values) ────────────────────────────────────────

const staticStyles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },

  card: {
    backgroundColor: COLORS.bgBottom,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  photoContainer: {
    backgroundColor: COLORS.bgBottom,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholder: {
    backgroundColor: COLORS.track,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.sub,
  },

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  metricCell: {
    flex: 1,
  },
  metricLabel: {
    color: COLORS.text,
    fontFamily: "Poppins-Regular",
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricScore: {
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },
  tierChip: {
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    flexShrink: 1,
  },
  tierChipText: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
    color: COLORS.sub,
  },

  progressTrack: {
    height: SIZES.progressBarMd,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.circle,
  },
});
