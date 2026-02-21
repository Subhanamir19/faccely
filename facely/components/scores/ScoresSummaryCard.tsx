// facely/components/scores/ScoresSummaryCard.tsx
// Redesigned summary card: profile photo overlapping top + 8 key metrics in compact grid (4x2)

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Image, Dimensions } from "react-native";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII, TYPE, SIZES } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";

// Get screen width for responsive calculations
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Responsive avatar size - scales with screen width but has min/max bounds
// ~36% of screen width, bounded between 120px (small phones) and 160px (tablets)
const AVATAR_SIZE = Math.min(Math.max(SCREEN_WIDTH * 0.36, 120), 160);
const AVATAR_BORDER = 4;
const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_BORDER * 2;

// Score color function - 6 tier system
function getScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s < 40) return COLORS.error;        // Red - needs work
  if (s < 60) return COLORS.errorLight;   // Orange - below average
  if (s < 70) return COLORS.warning;      // Yellow/Amber - average
  if (s < 80) return "#C8DA45";           // Chartreuse - above average
  if (s < 90) return COLORS.accent;       // Lime - great
  return COLORS.success;                   // Bright green - elite
}

export type MetricScore = {
  key: string;
  label: string;
  score: number;
};

// Shorter labels for the compact summary card view
const SHORT_LABELS: Record<string, string> = {
  "Facial Symmetry": "Symmetry",
  "Eye Symmetry": "Eyes",
  "Nose Balance": "Nose",
  "Skin Quality": "Skin quality",
};

// Gender-specific label for sexual dimorphism metric
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

// Tier anchors: 8 labels per metric mapped to score ranges
// Ranges: 0-25 | 26-40 | 41-50 | 51-60 | 61-70 | 71-80 | 81-89 | 90-100
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

// ============================================================================
// Animated Progress Bar
// ============================================================================
type ProgressBarProps = {
  score: number;
  delay: number;
  active: boolean;
};

function AnimatedProgressBar({ score, delay, active }: ProgressBarProps) {
  const width = useRef(new Animated.Value(0)).current;
  const color = getScoreColor(score);
  const clamped = Math.max(0, Math.min(100, score));

  useEffect(() => {
    if (active) {
      width.setValue(0);
      Animated.timing(width, {
        toValue: clamped,
        duration: 800,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [active, clamped, delay]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: animatedWidth,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

// ============================================================================
// Metric Cell - Single metric with label, number, progress bar
// ============================================================================
type MetricCellProps = {
  label: string;
  score: number;
  delay: number;
  active: boolean;
  isLarge?: boolean;
  gender?: string;
};

function MetricCell({ label, score, delay, active, isLarge = false, gender }: MetricCellProps) {
  const clamped = Math.round(Math.max(0, Math.min(100, score)));
  const displayLabel = getShortLabel(label, gender);
  const tierLabel = getTierLabel(label, score);
  const tierColor = getScoreColor(score);

  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricLabel, isLarge && styles.metricLabelLarge]}>
        {displayLabel}
      </Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.metricScore, isLarge && styles.metricScoreLarge]}>
          {clamped}
        </Text>
        <View style={styles.tierChip}>
          <Text style={[styles.tierChipText, isLarge && styles.tierChipTextLarge]}>
            {tierLabel}
          </Text>
        </View>
      </View>
      <AnimatedProgressBar score={score} delay={delay} active={active} />
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================
type ScoresSummaryCardProps = {
  metrics: MetricScore[];
  totalScore: number;
  width: number;
  active: boolean;
  imageUri?: string | null;
};

// All 8 metrics displayed on summary card (4 rows x 2 columns)
const SUMMARY_METRICS = [
  "Overall",           // Row 1
  "Facial Symmetry",
  "Masculinity/Femininity", // Row 2
  "Skin Quality",
  "Jawline",           // Row 3
  "Cheekbones",
  "Eye Symmetry",      // Row 4
  "Nose Balance",
];

export default function ScoresSummaryCard({
  metrics,
  totalScore,
  width,
  active,
  imageUri,
}: ScoresSummaryCardProps) {
  const { data: onboardingData } = useOnboarding();
  const gender = onboardingData?.gender;

  // Add Overall to metrics list
  const allMetrics: MetricScore[] = [
    { key: "overall", label: "Overall", score: totalScore },
    ...metrics,
  ];

  // Filter to only summary metrics and sort in defined order
  const displayMetrics = allMetrics
    .filter(m => SUMMARY_METRICS.includes(m.label))
    .sort((a, b) => SUMMARY_METRICS.indexOf(a.label) - SUMMARY_METRICS.indexOf(b.label));

  // Create pairs for the grid (2 columns, 4 rows)
  const pairs: MetricScore[][] = [];
  for (let i = 0; i < displayMetrics.length; i += 2) {
    pairs.push(displayMetrics.slice(i, i + 2));
  }

  // Calculate how much the photo overflows the card top
  const photoOverflow = AVATAR_TOTAL / 2;

  return (
    <View style={styles.wrapper}>
      {/* Profile Photo - positioned to overlap card top */}
      <View style={styles.photoWrapper}>
        <View style={styles.photoContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>?</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card with top padding to accommodate photo overlap */}
      <View style={[styles.card, { width, paddingTop: photoOverflow + SP[3] }]}>
        {/* Metrics Grid - 4 rows x 2 columns */}
        <View style={styles.metricsContainer}>
          {pairs.map((pair, rowIndex) => (
            <View key={rowIndex} style={styles.metricsRow}>
              {pair.map((metric, colIndex) => (
                <MetricCell
                  key={metric.key}
                  label={metric.label}
                  score={metric.score}
                  delay={(rowIndex * 2 + colIndex) * 60}
                  active={active}
                  isLarge={rowIndex === 0}
                  gender={gender}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer wrapper to handle the overflow
  wrapper: {
    alignItems: "center",
  },

  // Photo wrapper - positioned absolutely to overlap the card
  photoWrapper: {
    zIndex: 10,
    marginBottom: -(AVATAR_TOTAL / 2), // Pull the card up to overlap
  },

  // Card container
  card: {
    backgroundColor: COLORS.bgBottom,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingBottom: SP[4],
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },

  // Profile Photo with ring border
  photoContainer: {
    width: AVATAR_TOTAL,
    height: AVATAR_TOTAL,
    borderRadius: AVATAR_TOTAL / 2,
    padding: AVATAR_BORDER,
    backgroundColor: COLORS.bgBottom,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.track,
  },
  photoPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.track,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    ...TYPE.h3,
    color: COLORS.sub,
  },

  // Metrics Grid
  metricsContainer: {
    gap: SP[4],
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SP[4],
  },

  // Metric Cell
  metricCell: {
    flex: 1,
  },
  metricLabel: {
    ...TYPE.small,
    color: COLORS.text,
    marginBottom: SP[0],
  },
  metricLabelLarge: {
    ...TYPE.caption,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[2],
  },
  metricScore: {
    fontSize: Math.max(30, SCREEN_WIDTH * 0.08),
    lineHeight: Math.max(36, SCREEN_WIDTH * 0.095),
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },
  metricScoreLarge: {
    fontSize: Math.max(38, SCREEN_WIDTH * 0.1),
    lineHeight: Math.max(44, SCREEN_WIDTH * 0.115),
  },
  tierChip: {
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderRadius: 100,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  tierChipText: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
    color: COLORS.sub,
  },
  tierChipTextLarge: {
    fontSize: 13,
  },

  // Progress Bar
  progressTrack: {
    height: SIZES.progressBarLg,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.circle,
  },
});
