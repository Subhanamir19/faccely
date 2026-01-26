// facely/components/scores/ScoresSummaryCard.tsx
// Summary card with hero avatar + total score, then metric rings in grid

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Platform, Image } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Text from "@/components/ui/T";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const POP = Platform.select({
  ios: "Poppins-SemiBold",
  android: "Poppins-SemiBold",
  default: "Poppins-SemiBold",
});

const POP_MEDIUM = Platform.select({
  ios: "Poppins-Medium",
  android: "Poppins-Medium",
  default: "Poppins-Medium",
});

// Score color bands
const SCORE_COLOR_BANDS = [
  { max: 39, color: "#EF4444", label: "Needs Work" },
  { max: 59, color: "#BE00E8", label: "Developing" },
  { max: 79, color: "#F59E0B", label: "Good" },
  { max: 100, color: "#B4F34D", label: "Excellent" },
] as const;

function getScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  const band = SCORE_COLOR_BANDS.find(({ max }) => s <= max) ?? SCORE_COLOR_BANDS[3];
  return band.color;
}

function getScoreLabel(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  const band = SCORE_COLOR_BANDS.find(({ max }) => s <= max) ?? SCORE_COLOR_BANDS[3];
  return band.label;
}

function lightenColor(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const parsed = parseInt(normalized, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export type MetricScore = {
  key: string;
  label: string;
  score: number;
};

// ============================================================================
// Hero Score Ring - Large ring with avatar inside
// ============================================================================
const HERO_SIZE = 140;
const HERO_STROKE = 10;
const AVATAR_SIZE = 100;

type HeroScoreRingProps = {
  score: number;
  imageUri: string | null;
  active: boolean;
};

function HeroScoreRing({ score, imageUri, active }: HeroScoreRingProps) {
  const r = (HERO_SIZE - HERO_STROKE) / 2;
  const c = 2 * Math.PI * r;

  const color = getScoreColor(score);
  const colorLight = lightenColor(color, 0.25);
  const label = getScoreLabel(score);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [active]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - Math.max(0, Math.min(100, score)) / 100)],
  });

  return (
    <View style={styles.heroContainer}>
      <View style={styles.heroRingWrapper}>
        <Svg width={HERO_SIZE} height={HERO_SIZE}>
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colorLight} />
              <Stop offset="100%" stopColor={color} />
            </LinearGradient>
          </Defs>

          {/* Track */}
          <Circle
            cx={HERO_SIZE / 2}
            cy={HERO_SIZE / 2}
            r={r}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={HERO_STROKE}
            fill="none"
          />

          {/* Progress */}
          <AnimatedCircle
            cx={HERO_SIZE / 2}
            cy={HERO_SIZE / 2}
            r={r}
            stroke="url(#heroGrad)"
            strokeWidth={HERO_STROKE}
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            originX={HERO_SIZE / 2}
            originY={HERO_SIZE / 2}
          />
        </Svg>

        {/* Avatar inside the ring */}
        <View style={styles.avatarContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>?</Text>
            </View>
          )}
        </View>
      </View>

      {/* Score below */}
      <View style={styles.heroScoreRow}>
        <Text style={[styles.heroScore, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.heroScorePercent}>%</Text>
      </View>

      {/* Label */}
      <Text style={[styles.heroLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ============================================================================
// Mini Score Ring - Circular gauge for individual metrics
// ============================================================================
const MINI_SIZE = 72;
const MINI_STROKE = 6;

type MiniScoreRingProps = {
  label: string;
  score: number;
  delay: number;
  active: boolean;
};

function MiniScoreRing({ label, score, delay, active }: MiniScoreRingProps) {
  const r = (MINI_SIZE - MINI_STROKE) / 2;
  const c = 2 * Math.PI * r;

  const color = getScoreColor(score);
  const colorLight = lightenColor(color, 0.25);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 800,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [active, delay]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - Math.max(0, Math.min(100, score)) / 100)],
  });

  const gradientId = `miniGrad-${label.replace(/\s/g, "")}`;

  return (
    <View style={styles.miniRingContainer}>
      <View style={styles.miniRingWrapper}>
        <Svg width={MINI_SIZE} height={MINI_SIZE}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colorLight} />
              <Stop offset="100%" stopColor={color} />
            </LinearGradient>
          </Defs>

          {/* Background circle */}
          <Circle
            cx={MINI_SIZE / 2}
            cy={MINI_SIZE / 2}
            r={MINI_SIZE / 2 - 2}
            fill="rgba(255,255,255,0.06)"
          />

          {/* Track */}
          <Circle
            cx={MINI_SIZE / 2}
            cy={MINI_SIZE / 2}
            r={r}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={MINI_STROKE}
            fill="none"
          />

          {/* Progress */}
          <AnimatedCircle
            cx={MINI_SIZE / 2}
            cy={MINI_SIZE / 2}
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth={MINI_STROKE}
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            originX={MINI_SIZE / 2}
            originY={MINI_SIZE / 2}
          />
        </Svg>

        {/* Score text inside ring */}
        <View style={styles.miniScoreTextContainer}>
          <Text style={[styles.miniScoreText, { color }]}>{Math.round(score)}%</Text>
        </View>
      </View>

      {/* Metric label below */}
      <Text style={styles.miniMetricLabel} numberOfLines={2}>
        {label}
      </Text>
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

export default function ScoresSummaryCard({
  metrics,
  totalScore,
  width,
  active,
  imageUri,
}: ScoresSummaryCardProps) {
  return (
    <BlurView intensity={60} tint="dark" style={[styles.cardOuter, { width }]}>
      <View style={styles.cardOverlay} pointerEvents="none" />

      {/* Hero Section: Avatar + Total Score */}
      <HeroScoreRing
        score={totalScore}
        imageUri={imageUri ?? null}
        active={active}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Metrics Grid - 2 columns */}
      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => (
          <View key={m.key} style={styles.gridCell}>
            <MiniScoreRing
              label={m.label}
              score={m.score}
              delay={i * 60}
              active={active}
            />
          </View>
        ))}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 24,
    overflow: "hidden",
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  // Hero Section
  heroContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  heroRingWrapper: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContainer: {
    position: "absolute",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
  },
  avatarPlaceholderText: {
    fontSize: 32,
    color: "rgba(255,255,255,0.3)",
    fontFamily: POP,
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 12,
  },
  heroScore: {
    fontSize: 48,
    fontFamily: POP,
    lineHeight: 52,
  },
  heroScorePercent: {
    fontSize: 24,
    color: "rgba(255,255,255,0.6)",
    fontFamily: POP_MEDIUM,
    marginLeft: 2,
  },
  heroLabel: {
    fontSize: 16,
    fontFamily: POP_MEDIUM,
    marginTop: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCell: {
    width: "48%",
    marginBottom: 14,
    alignItems: "center",
  },

  // Mini Ring
  miniRingContainer: {
    alignItems: "center",
    width: "100%",
  },
  miniRingWrapper: {
    width: MINI_SIZE,
    height: MINI_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  miniScoreTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  miniScoreText: {
    fontSize: 14,
    fontFamily: POP,
  },
  miniMetricLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontFamily: POP_MEDIUM,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 100,
  },
});
