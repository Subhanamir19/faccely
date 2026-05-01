// app/(tabs)/dashboard.tsx
// Progress Dashboard — full redesign with lime design system

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
  Dimensions,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Path,
  Line,
  Text as SvgText,
} from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
import { TrendingUp, TrendingDown, Flame } from "lucide-react-native";
import Text from "@/components/ui/T";
import InsightPulseCard from "@/components/ui/InsightPulseCard";
import { COLORS, SP, RADII, TYPE, SHADOWS } from "@/lib/tokens";
import { useInsights } from "@/store/insights";
import { useNotifications } from "@/store/notifications";
import { useScores } from "@/store/scores";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useTasksStore } from "@/store/tasks";
import { useAuthStore } from "@/store/auth";
import { useProfile } from "@/store/profile";
import type {
  DashboardMetric,
  DashboardHistoryItem,
  InsightContent,
  DashboardOverall,
  LatestAdvanced,
} from "@/lib/api/insights";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import { pickTopFive } from "@/lib/submetrics";
import { TopFiveCard } from "@/components/dashboard/TopFiveCard";
import { PotentialFaceCard } from "@/components/dashboard/PotentialFaceCard";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/* -------------------------------------------------------------------------- */
/*  Design tokens — lime palette                                               */
/* -------------------------------------------------------------------------- */

// Theme — every accent is folded into the monochrome light palette so any
// existing consumer of LIME / VERDICT / CHANGE / DIR colors automatically
// renders in the new restrained style.
const LIME = {
  primary: COLORS.lightText,           // formerly accent → now solid dark
  light:   COLORS.lightText,
  dark:    COLORS.lightMuted,
  dim:     COLORS.lightSub,
  glow:    "rgba(0,0,0,0.06)",
  border:  COLORS.lightBorder,
  bg:      COLORS.lightSurfaceAlt,
  track:   COLORS.lightHairline,
};

const DIR_COLOR: Record<string, string> = {
  up:   COLORS.lightText,
  down: COLORS.lightSub,
  flat: COLORS.lightMuted,
};

const VERDICT_COLOR: Record<string, string> = {
  improved: COLORS.lightText,
  same:     COLORS.lightSub,
  declined: COLORS.lightMuted,
};

const VERDICT_BG: Record<string, string> = {
  improved: COLORS.lightSurfaceAlt,
  same:     COLORS.lightSurface,
  declined: COLORS.lightSurface,
};

const CHANGE_COLOR: Record<string, string> = {
  improving: COLORS.lightText,
  same:      COLORS.lightSub,
  worse:     COLORS.lightMuted,
};

const CHANGE_ICON: Record<string, string> = {
  improving: "↑",
  same:      "→",
  worse:     "↓",
};

const METRIC_LABELS: Record<string, string> = {
  jawline:           "Jawline",
  facial_symmetry:   "Symmetry",
  skin_quality:      "Skin Quality",
  cheekbones:        "Cheekbones",
  eyes_symmetry:     "Eye Symmetry",
  nose_harmony:      "Nose Harmony",
  sexual_dimorphism: "Masculinity",
};

/* -------------------------------------------------------------------------- */
/*  Sub-metric config                                                          */
/* -------------------------------------------------------------------------- */

type SubMetricDef = { key: string; label: string };

const SUBMETRIC_MAP: Partial<Record<string, { groupKey: keyof AdvancedAnalysis; items: SubMetricDef[] }>> = {
  cheekbones: {
    groupKey: "cheekbones",
    items: [
      { key: "width",          label: "Cheekbone Width" },
      { key: "maxilla",        label: "Maxilla Development" },
      { key: "bone_structure", label: "Bone Structure" },
      { key: "face_fat",       label: "Face Fat" },
    ],
  },
  jawline: {
    groupKey: "jawline",
    items: [
      { key: "development",  label: "Development" },
      { key: "gonial_angle", label: "Gonial Angle" },
      { key: "projection",   label: "Chin Projection" },
    ],
  },
  eyes_symmetry: {
    groupKey: "eyes",
    items: [
      { key: "canthal_tilt", label: "Canthal Tilt" },
      { key: "eye_type",     label: "Eye Type" },
      { key: "brow_volume",  label: "Brow Volume" },
      { key: "symmetry",     label: "Symmetry" },
    ],
  },
  skin_quality: {
    groupKey: "skin",
    items: [
      { key: "color",   label: "Skin Color" },
      { key: "quality", label: "Skin Quality" },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDelta(d: number): string {
  if (d > 0) return `+${d.toFixed(1)}`;
  if (d < 0) return d.toFixed(1);
  return "0";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSubMetricTag(score: number): { label: string; color: string } {
  if (score >= 91) return { label: "EXCEPTIONAL", color: "#10B981" };
  if (score >= 76) return { label: "STRONG",      color: "#B4F34D" };
  if (score >= 61) return { label: "ACCEPTABLE",  color: "#7DD3FC" };
  if (score >= 46) return { label: "AVERAGE",     color: "#F59E0B" };
  if (score >= 31) return { label: "BELOW AVG",   color: "#F97316" };
  if (score >= 16) return { label: "WEAK",        color: "#EF4444" };
  return                  { label: "POOR",        color: "#DC2626" };
}

function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "ELITE",      color: "#7DFF6A" };
  if (score >= 70) return { label: "STRONG",     color: "#B4F34D" };
  if (score >= 55) return { label: "GOOD",       color: "#C8DA45" };
  if (score >= 40) return { label: "AVERAGE",    color: "#F5C842" };
  if (score >= 25) return { label: "BELOW AVG",  color: "#F08C5A" };
  return                  { label: "WEAK",       color: "#EF4444" };
}

/** Tier thresholds in order (low → high) — derived from getScoreTier above. */
const TIER_THRESHOLDS = [25, 40, 55, 70, 85] as const;

/**
 * Next tier the score is approaching. Returns null when already at top tier
 * (≥85). Drives the "X TO ELITE" milestone pill.
 */
function nextTier(score: number): { threshold: number; label: string } | null {
  for (const t of TIER_THRESHOLDS) {
    if (score < t) return { threshold: t, label: getScoreTier(t).label };
  }
  return null;
}

/**
 * Spotlight metric — biggest opportunity = (room to grow) × (current momentum,
 * normalized). Falls back to lowest current score when no positive momentum
 * exists. Always returns when metrics non-empty.
 */
function pickSpotlight(metrics: DashboardMetric[]): DashboardMetric | null {
  if (!metrics.length) return null;
  const scored = metrics.map((m) => ({
    m,
    score: (100 - m.current) * Math.max(0, m.delta + 0.1),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (top.score > 0) return top.m;
  // No positive momentum anywhere — surface lowest current as the focus.
  return [...metrics].sort((a, b) => a.current - b.current)[0];
}

function pickRising(metrics: DashboardMetric[]): DashboardMetric | null {
  if (!metrics.length) return null;
  return [...metrics].sort((a, b) => b.delta - a.delta)[0];
}

function pickFalling(metrics: DashboardMetric[]): DashboardMetric | null {
  if (!metrics.length) return null;
  return [...metrics].sort((a, b) => a.delta - b.delta)[0];
}

/**
 * Linear-regression projection of the next N days of overall scores.
 * Returns null when too few points to fit a believable line.
 */
function projectGraph(points: number[], daysAhead: number): number[] | null {
  if (points.length < 5) return null;
  // Fit y = a + b*x using least squares with x = 0..n-1.
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += points[i];
    sumXY += i * points[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;

  const out: number[] = [];
  for (let i = 1; i <= daysAhead; i++) {
    const y = a + b * (n - 1 + i);
    out.push(Math.max(0, Math.min(100, y)));
  }
  return out;
}

/**
 * 7-day ribbon driven by tasks-store history. Each cell:
 *   { day: "M"|"T"|... , done: boolean, isToday: boolean, date: string }
 * Cells are ordered Monday → Sunday so the row reads naturally.
 */
function buildWeekRibbon(
  history: { date: string; streakEarned?: boolean }[],
  todayRecord: { date: string; streakEarned?: boolean } | null,
): { day: string; done: boolean; isToday: boolean; date: string }[] {
  const dayLetters = ["M", "T", "W", "T", "F", "S", "S"]; // Mon..Sun
  const allRecords = todayRecord
    ? [todayRecord, ...history.filter((h) => h.date !== todayRecord.date)]
    : history;
  const byDate = new Map(allRecords.map((r) => [r.date, !!r.streakEarned]));

  const today = new Date();
  // Monday-anchor — JS Sunday=0; shift so Monday=0.
  const jsDow = today.getDay();
  const monOffset = (jsDow + 6) % 7; // 0 if Monday, 6 if Sunday
  const monday = new Date(today);
  monday.setDate(today.getDate() - monOffset);

  const cells: { day: string; done: boolean; isToday: boolean; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isToday = iso === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    cells.push({
      day: dayLetters[i],
      done: byDate.get(iso) ?? false,
      isToday,
      date: iso,
    });
  }
  return cells;
}

/* -------------------------------------------------------------------------- */
/*  Metric images                                                              */
/* -------------------------------------------------------------------------- */

const METRIC_IMAGES: Record<string, any> = {
  jawline:           require("@/assets/analysis-image-new/lower-face-vector.png"),
  cheekbones:        require("@/assets/analysis-image-new/midface-vector.png"),
  eyes_symmetry:     require("@/assets/analysis-image-new/eyearea-vector.png"),
  skin_quality:      require("@/assets/analysis-image-new/fullface-vector.png"),
  facial_symmetry:   require("@/assets/analysis-image-new/fullface-vector.png"),
  nose_harmony:      require("@/assets/analysis-image-new/nose-vector.png"),
  sexual_dimorphism: require("@/assets/analysis-image-new/fullface-vector.png"),
};

const METRIC_PLACEHOLDER_EMOJI: Record<string, string> = {
  facial_symmetry:   "⚖️",
  nose_harmony:      "👃",
  sexual_dimorphism: "💪",
};

/* -------------------------------------------------------------------------- */
/*  ZigzagArrow — angular stock-market style trend arrow                       */
/* -------------------------------------------------------------------------- */


function ZigzagArrow({ direction, color: colorOverride }: { direction: "up" | "down" | "flat"; color?: string }) {
  const color = colorOverride ?? (
    direction === "up"   ? LIME.primary :
    direction === "down" ? "#EF4444"    :
    "rgba(255,255,255,0.50)"
  );

  // Full path = zigzag body + arrowhead in one combined path
  const d =
    direction === "up"
      ? "M 2,15 L 7,9 L 11,12 L 17,4 M 13,4 L 17,4 L 17,8"
      : direction === "down"
      ? "M 2,5 L 7,11 L 11,8 L 17,16 M 13,16 L 17,16 L 17,12"
      : "M 2,10 L 18,10 M 14,6 L 18,10 L 14,14";

  return (
    <Svg width={22} height={20}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricDetailSheet — bottom sheet shown when a metric card is pressed       */
/* -------------------------------------------------------------------------- */

function MetricDetailSheet({
  metric,
  latestAdvanced,
  previousAdvanced,
  onClose,
}: {
  metric: DashboardMetric;
  latestAdvanced: LatestAdvanced | null;
  previousAdvanced: LatestAdvanced | null;
  onClose: () => void;
}) {
  const tier      = getScoreTier(metric.current);
  const label     = METRIC_LABELS[metric.key] ?? metric.key;
  const img       = METRIC_IMAGES[metric.key];
  const placeholder = METRIC_PLACEHOLDER_EMOJI[metric.key] ?? "📊";
  const subMap    = SUBMETRIC_MAP[metric.key];
  const advGroup  = subMap && latestAdvanced ? (latestAdvanced as any)[subMap.groupKey] : null;

  const barColor  =
    metric.direction === "up"   ? LIME.primary :
    metric.direction === "down" ? "#EF4444"    : tier.color;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View entering={FadeInDown.duration(320)} style={styles.sheetContainer}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Header: image + name + close */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetThumb}>
            {img ? (
              <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 32 }}>{placeholder}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: SP[1] }}>
            <Text style={styles.sheetMetricName}>{label}</Text>
            <View style={[styles.tierPill, { alignSelf: "flex-start" }]}>
              <Text style={styles.tierText}>{tier.label}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.sheetCloseBtn} hitSlop={12}>
            <Text style={{ color: COLORS.lightMuted, fontSize: 18, lineHeight: 20 }}>✕</Text>
          </Pressable>
        </View>

        {/* Score comparison row — monochrome, three cells with hairline dividers */}
        <View style={styles.sheetScoreRow}>
          <View style={styles.sheetScoreBox}>
            <Text style={styles.sheetScoreLabel}>BASELINE</Text>
            <Text style={styles.sheetScoreValue}>{metric.baseline.toFixed(1)}</Text>
          </View>
          <View style={styles.sheetScoreArrow}>
            <Text style={styles.sheetScoreDelta}>{formatDelta(metric.delta)}</Text>
            <Text style={{ color: COLORS.lightSub, fontSize: 16, lineHeight: 18 }}>→</Text>
          </View>
          <View style={styles.sheetScoreBox}>
            <Text style={styles.sheetScoreLabel}>NOW</Text>
            <Text style={styles.sheetScoreValue}>{metric.current.toFixed(1)}</Text>
          </View>
          <View style={styles.sheetScoreBox}>
            <Text style={styles.sheetScoreLabel}>BEST</Text>
            <Text style={styles.sheetScoreValue}>
              {metric.best.toFixed(1)}{metric.current >= metric.best ? " 🏆" : ""}
            </Text>
          </View>
        </View>

        {/* Sub-metrics */}
        {advGroup && subMap ? (
          <View style={styles.sheetSubList}>
            {subMap.items.map((item) => {
              const rawScore = advGroup[`${item.key}_score`];
              const score    = typeof rawScore === "number" ? rawScore : null;
              const tag      = score !== null ? getSubMetricTag(score) : null;
              const change   = compareAdvanced(latestAdvanced, previousAdvanced, subMap.groupKey as any, `${item.key}_score`);
              const dir: "up" | "down" | "flat" =
                change === "improving" ? "up" :
                change === "worse"     ? "down" : "flat";
              const arrowColor =
                dir === "up"   ? COLORS.lightText :
                dir === "down" ? COLORS.lightSub  : COLORS.lightMuted;

              return (
                <View key={item.key} style={styles.sheetSubRow}>
                  <ZigzagArrow direction={dir} color={arrowColor} />
                  <Text style={styles.sheetSubLabel}>{item.label}</Text>
                  {score !== null && tag && (
                    <View style={styles.sheetSubBarWrap}>
                      <View style={[styles.sheetSubBarFill, { width: `${Math.min(100, score)}%` as any }]} />
                    </View>
                  )}
                  {tag && (
                    <View style={styles.subTag3dBase}>
                      <View style={styles.subTag3dFace}>
                        <Text style={styles.subTag3dText}>{tag.label}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.sheetNoSub}>No sub-metric data yet. Complete an analysis to unlock details.</Text>
        )}
      </Animated.View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricCard3D — horizontal exercise-style metric row card                   */
/* -------------------------------------------------------------------------- */

const METRIC_DEPTH = 5;
const METRIC_COL_W = (Dimensions.get("window").width - SP[4] * 2 - SP[3]) / 2;

function MetricCard3D({
  metric,
  delay,
  onPress,
}: {
  metric: DashboardMetric;
  delay: number;
  onPress: () => void;
}) {
  const tier        = getScoreTier(metric.current);
  const label       = METRIC_LABELS[metric.key] ?? metric.key;
  const img         = METRIC_IMAGES[metric.key];
  const placeholder = METRIC_PLACEHOLDER_EMOJI[metric.key] ?? "📊";

  const dirLabel =
    metric.direction === "up"   ? "IMPROVED" :
    metric.direction === "down" ? "DECLINED" : "STABLE";

  // Arrow color on the dark pill
  const arrowColor =
    metric.direction === "up"   ? LIME.primary :
    metric.direction === "down" ? "#EF4444"    :
    "rgba(255,255,255,0.50)";

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      {/* Base layer — dark lime, gives 3D depth */}
      <View style={styles.metricRowBase}>
        <Pressable
          onPress={onPress}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={({ pressed }) => [
            styles.metricRowFace,
            { transform: [{ translateY: pressed ? METRIC_DEPTH : 0 }] },
          ]}
        >
          <LinearGradient
            colors={["#FAF7EF", "#EFE8D7"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Thumbnail */}
          <View style={styles.metricRowThumb}>
            {img ? (
              <Image source={img} style={styles.metricRowThumbImg} resizeMode="cover" />
            ) : (
              <View style={styles.metricRowThumbPlaceholder}>
                <Text style={{ fontSize: 26 }}>{placeholder}</Text>
              </View>
            )}
          </View>

          {/* Name + tier */}
          <View style={styles.metricRowInfo}>
            <Text style={styles.metricRowName} numberOfLines={1}>{label}</Text>
            <Text style={[styles.metricRowTier]}>{tier.label}</Text>
          </View>

          {/* Arrow pill */}
          <View style={styles.metricRowArrowBtn}>
            <ZigzagArrow direction={metric.direction} color={arrowColor} />
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricGrid — vertical list of metric row cards                             */
/* -------------------------------------------------------------------------- */

function MetricGrid({
  metrics,
  latestAdvanced,
  previousAdvanced,
}: {
  metrics: DashboardMetric[];
  latestAdvanced: LatestAdvanced | null;
  previousAdvanced: LatestAdvanced | null;
}) {
  const router = useRouter();
  const filtered = metrics.filter((m) => m.key !== "sexual_dimorphism");
  const [selected, setSelected] = useState<DashboardMetric | null>(null);
  const [showAll, setShowAll]   = useState(false);

  // Rank: spotlight (most opportunity) → rising → falling → the rest by current desc.
  const spotlight = pickSpotlight(filtered);
  const rising    = pickRising(filtered);
  const falling   = pickFalling(filtered);

  const featuredIds = new Set<string>();
  if (spotlight) featuredIds.add(spotlight.key);
  // Only feature rising/falling when distinct from spotlight AND meaningful (delta != 0).
  const risingIsDistinct  = rising  && !featuredIds.has(rising.key)  && Math.abs(rising.delta) > 0.05;
  const fallingIsDistinct = falling && !featuredIds.has(falling.key) && falling.delta < -0.05 && falling.key !== rising?.key;
  if (risingIsDistinct)  featuredIds.add(rising!.key);
  if (fallingIsDistinct) featuredIds.add(falling!.key);

  const rest = filtered
    .filter((m) => !featuredIds.has(m.key))
    .sort((a, b) => b.current - a.current);
  const restVisible = showAll ? rest : rest.slice(0, 0);

  const handleTrainSpotlight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/program");
  };

  return (
    <>
      {/* Section header */}
      <View style={styles.focusHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.focusTitle}>Where to focus</Text>
          <Text style={styles.focusSub}>Ranked by where to move next</Text>
        </View>
        {rest.length > 0 && (
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.focusSeeAll, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.focusSeeAllText}>
              {showAll ? "Hide" : `See all ${filtered.length} →`}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Spotlight metric — L2 elevated */}
      {spotlight && (
        <Pressable onPress={() => setSelected(spotlight)}>
          <View style={styles.spotlightCard}>
            <View style={styles.spotlightHeader}>
              <View style={styles.spotlightIcon}>
                <Image
                  source={METRIC_IMAGES[spotlight.key]}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.spotlightLabel}>FOCUS METRIC</Text>
                <Text style={styles.spotlightName}>
                  {(METRIC_LABELS[spotlight.key] ?? spotlight.key).toUpperCase()}
                </Text>
              </View>
              <View style={styles.spotlightScoreCol}>
                <Text style={styles.spotlightScore}>{spotlight.current.toFixed(0)}</Text>
                <Text
                  style={[
                    styles.spotlightDelta,
                    spotlight.delta < 0 && { color: COLORS.declineRed },
                  ]}
                >
                  {spotlight.delta >= 0 ? "↑ " : "↓ "}
                  {Math.abs(spotlight.delta).toFixed(1)}
                </Text>
              </View>
            </View>

            <Text style={styles.spotlightInsight}>
              {spotlight.delta > 0
                ? "Most room to grow — your gains here will move the overall fastest."
                : spotlight.delta < 0
                  ? "This one slipped — your next session should hit it."
                  : "Untapped potential — start here for the biggest swing."}
            </Text>

            <Pressable
              onPress={handleTrainSpotlight}
              style={({ pressed }) => [styles.spotlightCta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.spotlightCtaText}>TRAIN THIS METRIC →</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Mid-row — Rising | Falling */}
      {(risingIsDistinct || fallingIsDistinct) && (
        <View style={styles.midRow}>
          {risingIsDistinct && rising && (
            <Pressable onPress={() => setSelected(rising)} style={{ flex: 1 }}>
              <View style={styles.midCard}>
                <Text style={styles.midTag}>↑ ON THE RISE</Text>
                <Text style={styles.midName} numberOfLines={1}>
                  {(METRIC_LABELS[rising.key] ?? rising.key).toUpperCase()}
                </Text>
                <View style={styles.midRowScore}>
                  <Text style={styles.midScore}>{rising.current.toFixed(0)}</Text>
                  <Text style={styles.midDelta}>
                    {rising.delta >= 0 ? "+" : ""}{rising.delta.toFixed(1)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          {fallingIsDistinct && falling && (
            <Pressable onPress={() => setSelected(falling)} style={{ flex: 1 }}>
              <View style={styles.midCard}>
                <Text style={[styles.midTag, styles.midTagDown]}>↓ NEEDS CARE</Text>
                <Text style={styles.midName} numberOfLines={1}>
                  {(METRIC_LABELS[falling.key] ?? falling.key).toUpperCase()}
                </Text>
                <View style={styles.midRowScore}>
                  <Text style={styles.midScore}>{falling.current.toFixed(0)}</Text>
                  <Text style={[styles.midDelta, { color: COLORS.declineRed }]}>
                    {falling.delta.toFixed(1)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Reference list — collapsed by default */}
      {restVisible.length > 0 && (
        <View style={styles.refList}>
          {restVisible.map((m, i) => (
            <Pressable key={m.key} onPress={() => setSelected(m)}>
              <View style={[styles.refRow, i < restVisible.length - 1 && styles.refRowDivider]}>
                <View style={styles.refIcon}>
                  <Image
                    source={METRIC_IMAGES[m.key]}
                    style={{ width: "100%", height: "100%" }}
                  />
                </View>
                <Text style={styles.refName} numberOfLines={1}>
                  {(METRIC_LABELS[m.key] ?? m.key).toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.refDelta,
                    m.delta < 0 && { color: COLORS.declineRed },
                  ]}
                >
                  {m.delta > 0 ? "↑ " : m.delta < 0 ? "↓ " : "→ "}
                  {m.delta >= 0 ? "+" : ""}{m.delta.toFixed(1)}
                </Text>
                <Text style={styles.refScore}>{m.current.toFixed(0)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {selected && (
        <MetricDetailSheet
          metric={selected}
          latestAdvanced={latestAdvanced}
          previousAdvanced={previousAdvanced}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  GlassCard                                                                  */
/* -------------------------------------------------------------------------- */

function GlassCard({
  children,
  style,
  accentLeft,
}: {
  children: React.ReactNode;
  style?: object;
  accentLeft?: boolean;
}) {
  return (
    <View style={[styles.card, style]}>
      <BlurView
        intensity={Platform.OS === "android" ? 20 : 45}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardInner} />
      {accentLeft && <View style={styles.cardAccentLeft} />}
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ScoreRing — animated SVG arc                                               */
/* -------------------------------------------------------------------------- */

const AnimatedCircle  = Animated.createAnimatedComponent(Circle);
const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

function ScoreRing({
  score,
  size = 148,
  strokeWidth = 10,
  light = false,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  light?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withDelay(
      80,
      withTiming(score / 100, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const cx = size / 2;
  const cy = size / 2;
  const glowColor  = "rgba(0,0,0,0.06)";
  const trackColor = COLORS.lightSurfaceAlt;
  const arcGradId  = light ? "ringGradLight" : "ringGrad";

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0%" stopColor={LIME.primary} />
            <Stop offset="100%" stopColor={LIME.light} />
          </SvgGradient>
          <SvgGradient id="ringGradLight" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0%" stopColor="#000000" />
            <Stop offset="100%" stopColor="#000000" />
          </SvgGradient>
        </Defs>
        {/* Glow layer */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={glowColor}
          strokeWidth={strokeWidth + 6}
          fill="none"
          opacity={0.18}
        />
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={`url(#${arcGradId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MiniGraph — animated SVG area chart                                        */
/* -------------------------------------------------------------------------- */

const { width: SCREEN_W } = Dimensions.get("window");
const GRAPH_H = 100;
const GRAPH_W = SCREEN_W - SP[4] * 2 - SP[6] * 2;

/* Regular dot — static, always visible */
function GraphDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <Circle cx={cx} cy={cy} r={3.5} fill="#000" stroke={LIME.primary} strokeWidth={1.5} />
  );
}

/* Last dot — always visible, perpetually pulsing lime ring */
function LastDot({ cx, cy }: { cx: number; cy: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const ringProps = useAnimatedProps(() => ({
    r:       7 + pulse.value * 10,
    opacity: (1 - pulse.value) * 0.60,
  }));

  return (
    <>
      {/* Pulsing lime ring */}
      <AnimatedCircle cx={cx} cy={cy} fill="none" stroke={LIME.primary} strokeWidth={1.5} animatedProps={ringProps} />
      {/* Static black core with lime border — always visible */}
      <Circle cx={cx} cy={cy} r={5} fill="#000000" stroke={LIME.primary} strokeWidth={2} />
    </>
  );
}

function MiniGraph({
  points,
  width = GRAPH_W,
  height = GRAPH_H,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const padX      = 24; // room for Y-axis labels on the left
  const padXRight = 22; // extra room so the last dot's pulse ring isn't clipped
  const padY      = 8;
  const innerW    = width - padX - padXRight;
  const innerH    = height - padY * 2;

  const toX = (i: number) => padX + (i / (points.length - 1)) * innerW;
  const toY = (p: number) => padY + (1 - p / 100) * innerH;

  const coords   = points.map((p, i) => ({ x: toX(i), y: toY(p) }));
  const firstC   = coords[0];
  const lastC    = coords[coords.length - 1];
  const fillPath = `M ${firstC.x},${firstC.y} ${coords.slice(1).map((c) => `L ${c.x},${c.y}`).join(" ")} L ${lastC.x},${height} L ${firstC.x},${height} Z`;
  const linePath = `M ${coords[0].x},${coords[0].y} ${coords.slice(1).map((c) => `L ${c.x},${c.y}`).join(" ")}`;

  // Generous upper bound — same approach as onboarding score-projection
  const DASH_LEN = Math.ceil(width * 2.5);

  const drawOffset = useSharedValue(DASH_LEN);
  const fillAnim   = useSharedValue(0);

  // Re-animate on mount and whenever points data changes
  useEffect(() => {
    drawOffset.value = DASH_LEN;
    fillAnim.value   = 0;
    drawOffset.value = withDelay(120, withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.cubic) }));
    fillAnim.value   = withDelay(900, withTiming(1, { duration: 700,  easing: Easing.out(Easing.quad)  }));
  }, [points]);

  const lineProps     = useAnimatedProps(() => ({ strokeDashoffset: drawOffset.value }));
  const lineGlowProps = useAnimatedProps(() => ({ strokeDashoffset: drawOffset.value }));
  const fillProps     = useAnimatedProps(() => ({ fillOpacity: fillAnim.value * 0.45 }));

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="graphFill2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={LIME.primary} stopOpacity="1" />
          <Stop offset="100%" stopColor={LIME.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      {/* Subtle grid lines */}
      {[0.33, 0.66].map((frac, i) => (
        <Line
          key={i}
          x1={padX} y1={padY + frac * innerH}
          x2={width - padXRight} y2={padY + frac * innerH}
          stroke="rgba(0,0,0,0.06)" strokeWidth={1} strokeDasharray="3,5"
        />
      ))}

      {/* Fill — fades in after line draws */}
      <AnimatedSvgPath d={fillPath} fill="url(#graphFill2)" animatedProps={fillProps} />

      {/* Glow layer — wide soft halo, same draw animation */}
      <AnimatedSvgPath
        d={linePath}
        fill="none"
        stroke={LIME.primary}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.13}
        strokeDasharray={DASH_LEN}
        animatedProps={lineGlowProps}
      />

      {/* Main line — draws left to right via strokeDashoffset */}
      <AnimatedSvgPath
        d={linePath}
        fill="none"
        stroke={LIME.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH_LEN}
        animatedProps={lineProps}
      />

      {/* Y-axis score labels — fixed 0/50/100 scale */}
      {[100, 50, 0].map((score) => (
        <SvgText
          key={score}
          x={2}
          y={toY(score) + 4}
          fontSize="9"
          fontFamily="ProximaNova-Bold"
          fill="rgba(0,0,0,0.35)"
          textAnchor="start"
        >
          {score}
        </SvgText>
      ))}

      {/* Regular dots */}
      {coords.slice(0, -1).map((c, i) => (
        <GraphDot key={i} cx={c.x} cy={c.y} />
      ))}

      {/* Last dot — always visible, pulsing */}
      <LastDot cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  JourneyCard — light cream card with dashed progress graph                 */
/* -------------------------------------------------------------------------- */

// Journey card — monochrome, matches the routine-preview surface vocabulary.
const JOURNEY_GREEN      = COLORS.lightText;       // graph stroke + dot
const JOURNEY_GREEN_DEEP = COLORS.lightMuted;      // (legacy depth color, now unused visually)
const JOURNEY_GREEN_SOFT = "rgba(0,0,0,0.08)";     // graph area fill
const JOURNEY_CARD_BG    = COLORS.lightBg;
const JOURNEY_INK        = COLORS.lightText;
const JOURNEY_SUB        = COLORS.lightSub;

const JOURNEY_GRAPH_W = SCREEN_W - SP[4] * 2 - SP[5] * 2;
const JOURNEY_GRAPH_H = 96;

function JourneyGraph({
  points,
  projection = null,
  stroke      = JOURNEY_GREEN,
  width       = JOURNEY_GRAPH_W,
  height      = JOURNEY_GRAPH_H,
}: {
  points: number[];
  projection?: number[] | null;
  stroke?: string;
  width?:  number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const padLeft  = 22; // room for Y-axis labels (0/50/100)
  const padRight = 10;
  const padTop   = 8;
  const padBot   = 10;
  const innerW   = width - padLeft - padRight;
  const innerH   = height - padTop - padBot;

  // X axis spans actual + projected points so the projected segment fits.
  const projLen = projection?.length ?? 0;
  const totalLen = points.length + projLen;
  const toX = (i: number) => padLeft + (i / Math.max(1, totalLen - 1)) * innerW;
  const toY = (p: number) => padTop + (1 - Math.max(0, Math.min(100, p)) / 100) * innerH;

  const coords   = points.map((p, i) => ({ x: toX(i), y: toY(p) }));
  const first    = coords[0];
  const last     = coords[coords.length - 1];
  const linePath = `M ${first.x},${first.y} ${coords.slice(1).map((c) => `L ${c.x},${c.y}`).join(" ")}`;
  const fillPath = `${linePath} L ${last.x},${height - padBot + 2} L ${first.x},${height - padBot + 2} Z`;

  // Projection path — dashed continuation from `last` through projected points.
  const projCoords = projection
    ? projection.map((p, i) => ({ x: toX(points.length + i), y: toY(p) }))
    : [];
  const projPath = projCoords.length
    ? `M ${last.x},${last.y} ${projCoords.map((c) => `L ${c.x},${c.y}`).join(" ")}`
    : "";
  const projEnd = projCoords[projCoords.length - 1];

  // Reveal: fade + upward settle for the line, fill fades in after
  const lineOpacity = useSharedValue(0);
  const lineShift   = useSharedValue(8);
  const fillA       = useSharedValue(0);
  const dotScale    = useSharedValue(0);

  useEffect(() => {
    lineOpacity.value = 0;
    lineShift.value   = 8;
    fillA.value       = 0;
    dotScale.value    = 0;
    lineOpacity.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    lineShift.value   = withDelay(120, withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }));
    fillA.value       = withDelay(400, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    dotScale.value    = withDelay(900, withSpring(1, { damping: 10, stiffness: 180 }));
  }, [points]);

  const lineStyle = useAnimatedStyle(() => ({
    opacity:   lineOpacity.value,
    transform: [{ translateY: lineShift.value }],
  }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fillA.value }));
  const dotProps  = useAnimatedProps(() => ({ r: 5 * dotScale.value }));
  const haloProps = useAnimatedProps(() => ({ r: 9 * dotScale.value, opacity: 0.22 * dotScale.value }));

  return (
    <Animated.View style={[{ width, height }, lineStyle]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="journeyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={JOURNEY_GREEN_SOFT} stopOpacity="0.75" />
            <Stop offset="100%" stopColor={JOURNEY_GREEN_SOFT} stopOpacity="0.00" />
          </SvgGradient>
        </Defs>

        {/* Horizontal grid lines at 50 (mid) */}
        <Line
          x1={padLeft} y1={toY(50)}
          x2={width - padRight} y2={toY(50)}
          stroke="rgba(28,36,24,0.08)"
          strokeWidth={1}
          strokeDasharray="3,4"
        />

        {/* Y-axis score labels — 0 / 50 / 100 */}
        {[100, 50, 0].map((score) => (
          <SvgText
            key={score}
            x={2}
            y={toY(score) + 3}
            fontSize="9"
            fontFamily="ProximaNova-Bold"
            fill="rgba(28,36,24,0.45)"
            textAnchor="start"
          >
            {score}
          </SvgText>
        ))}

        {/* Soft green area under the line */}
        <AnimatedSvgPath
          d={fillPath}
          fill="url(#journeyFill)"
          animatedProps={fillProps}
        />

        {/* Solid actual line */}
        <Path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Forward projection — dotted continuation */}
        {projPath && (
          <Path
            d={projPath}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2,5"
            opacity={0.45}
          />
        )}

        {/* Endpoint of projection — hollow ring at the projected score */}
        {projEnd && (
          <Circle
            cx={projEnd.x}
            cy={projEnd.y}
            r={4}
            fill={COLORS.lightBg}
            stroke={stroke}
            strokeWidth={1.5}
          />
        )}

        {/* Current endpoint — pulsing halo + solid dot */}
        <AnimatedCircle cx={last.x} cy={last.y} fill={stroke} animatedProps={haloProps} />
        <AnimatedCircle cx={last.x} cy={last.y} fill={stroke} animatedProps={dotProps} />
      </Svg>
    </Animated.View>
  );
}

function JourneyCard({
  scanCount,
  joinedDaysAgo,
  overallDelta,
  graphPoints,
}: {
  scanCount:     number;
  joinedDaysAgo: number;
  overallDelta:  number;
  graphPoints:   number[];
}) {
  const isUp        = overallDelta >= 0;
  const deltaStr    = `${isUp ? "+" : "−"}${Math.abs(overallDelta).toFixed(1)}`;
  const dayUnit     = joinedDaysAgo === 1 ? "day" : "days";
  const deltaColor  = isUp ? COLORS.lightText : COLORS.declineRed;
  const pillBg      = isUp ? COLORS.lightSurfaceAlt : COLORS.declineRedSoft;

  // Forward projection — gated to ≥5 scans for fit credibility.
  const projection = projectGraph(graphPoints, Math.max(7, joinedDaysAgo));
  const projectedTarget = projection ? projection[projection.length - 1] : null;
  const projectedTier   = projectedTarget !== null ? getScoreTier(projectedTarget).label : null;
  const currentTier     = graphPoints.length ? getScoreTier(graphPoints[graphPoints.length - 1]).label : null;
  // Only celebrate the projection when it actually predicts a tier *jump*.
  const willJumpTier = projectedTier && currentTier && projectedTier !== currentTier;

  return (
    <View style={styles.journeyBase}>
      <View style={styles.journeyFace}>
        {/* Header — punchline, not label */}
        <View style={styles.journeyHeader}>
          <View style={{ flex: 1, paddingRight: SP[2] }}>
            <Text style={[styles.journeyTitle, { color: deltaColor }]}>
              {`${deltaStr} pts in ${joinedDaysAgo} ${dayUnit}`}
            </Text>
            <Text style={styles.journeySubtitle} numberOfLines={1}>
              {willJumpTier
                ? `On pace for ${projectedTier}`
                : `${scanCount} ${scanCount === 1 ? "scan" : "scans"} tracked`}
            </Text>
          </View>
          <View style={[styles.journeyPillFace, { backgroundColor: pillBg }]}>
            {isUp ? (
              <TrendingUp size={18} color={deltaColor} strokeWidth={2.6} />
            ) : (
              <TrendingDown size={18} color={deltaColor} strokeWidth={2.6} />
            )}
          </View>
        </View>

        {/* Graph */}
        <View style={styles.journeyGraphWrap}>
          <JourneyGraph points={graphPoints} projection={projection} stroke={deltaColor} />
          <View style={styles.journeyDayLabels}>
            <Text style={styles.journeyDayLabel}>DAY 1</Text>
            <Text style={styles.journeyDayLabel}>
              {projection ? "PROJECTED" : "TODAY"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  IdentityStrip — caption + week ribbon                                      */
/* -------------------------------------------------------------------------- */

function IdentityStrip({
  userName,
  joinedDaysAgo,
  currentStreak,
}: {
  userName: string | null;
  joinedDaysAgo: number;
  currentStreak: number;
}) {
  const history     = useTasksStore((s) => s.history);
  const todayRecord = useTasksStore((s) => s.today);
  const cells       = buildWeekRibbon(history, todayRecord);

  // Day count derives from joinedDaysAgo (clamped at 1 — Day 1 minimum).
  const dayN = Math.max(1, joinedDaysAgo + 1);

  return (
    <Animated.View entering={FadeInDown.delay(0).duration(360)} style={styles.identityWrap}>
      <View style={styles.identityHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.identityCaption}>
            {`Day ${dayN}${userName ? ` · ${userName}'s transformation` : " of your transformation"}`}
          </Text>
        </View>
        {currentStreak > 0 && (
          <View style={styles.identityStreak}>
            <Flame size={13} color={COLORS.lightText} strokeWidth={2.4} />
            <Text style={styles.identityStreakNum}>{currentStreak}</Text>
          </View>
        )}
      </View>

      <View style={styles.ribbonRow}>
        {cells.map((c, i) => (
          <View key={i} style={styles.ribbonCell}>
            <View
              style={[
                styles.ribbonDot,
                c.done    && styles.ribbonDotDone,
                c.isToday && styles.ribbonDotToday,
                c.isToday && !c.done && styles.ribbonDotTodayPending,
              ]}
            />
            <Text style={[styles.ribbonDay, c.isToday && styles.ribbonDayToday]}>
              {c.day}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroCard — side-by-side: ring left, score info right                      */
/* -------------------------------------------------------------------------- */

function HeroCard({
  overall,
  overallDelta,
  scanCount,
  joinedDaysAgo,
}: {
  overall: DashboardOverall;
  overallDelta: number;
  verdict: string;
  scanCount: number;
  joinedDaysAgo: number;
  userName: string | null;
}) {
  const scoreVal    = useSharedValue(0);
  const deltaVal    = useSharedValue(0);

  useEffect(() => {
    scoreVal.value = 0;
    deltaVal.value = 0;
    const cfg = { duration: 1400, easing: Easing.out(Easing.cubic) };
    scoreVal.value = withTiming(overall.current, cfg);
    deltaVal.value = withDelay(100, withTiming(Math.abs(overallDelta), cfg));
  }, [overall.current, overallDelta]);

  const scoreProps = useAnimatedProps(() => ({
    text: String(Math.round(scoreVal.value)),
    defaultValue: "",
  } as any));
  const deltaProps = useAnimatedProps(() => ({
    text: `${overallDelta >= 0 ? "+" : "−"}${deltaVal.value.toFixed(1)}`,
    defaultValue: "",
  } as any));

  // ── Derived signals — minimal, data-driven ──
  const isPB          = scanCount >= 2 && overall.current >= overall.best;
  const next          = nextTier(overall.current);
  const currentTier   = getScoreTier(overall.current);
  const deltaPositive = overallDelta >= 0;
  const toNext        = next ? Math.max(1, Math.ceil(next.threshold - overall.current)) : null;

  return (
    <View style={styles.heroBase}>
      {/* Top meta strip — what this score IS · PB badge */}
      <View style={styles.heroMeta}>
        <Text style={styles.heroMetaText}>OVERALL RATING</Text>
        {isPB && (
          <Text style={styles.heroMetaPB}>★ PERSONAL BEST</Text>
        )}
      </View>

      {/* Centered score + tier identity — the entire visual centerpiece */}
      <View style={styles.heroCenter}>
        <AnimatedTextInput
          animatedProps={scoreProps}
          editable={false}
          style={[styles.heroScoreHuge, { padding: 0 }]}
        />
        <Text style={styles.heroTierIdentity}>
          {currentTier.label.split("").join(" ")}
        </Text>
      </View>

      {/* Bottom context strip — delta (or BASELINE on first scan) · next tier */}
      <View style={styles.heroBottom}>
        <View style={styles.heroBottomCol}>
          {scanCount === 1 ? (
            <>
              <View style={styles.heroBaselinePill}>
                <Text style={styles.heroBaselinePillText}>BASELINE</Text>
              </View>
              <Text style={styles.heroBottomLabel}>STARTING POINT</Text>
            </>
          ) : (
            <>
              <AnimatedTextInput
                animatedProps={deltaProps}
                editable={false}
                style={[
                  styles.heroBottomNum,
                  { padding: 0, color: deltaPositive ? COLORS.accent : COLORS.declineRed },
                ]}
              />
              <Text style={styles.heroBottomLabel}>FROM START</Text>
            </>
          )}
        </View>
        {toNext !== null && next && (
          <View style={[styles.heroBottomCol, { alignItems: "flex-end" }]}>
            <Text style={[styles.heroBottomNum, { color: COLORS.accent }]}>
              ↑{toNext}
            </Text>
            <Text style={styles.heroBottomLabel}>{`TO ${next.label}`}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricRow — individual pressable card                                      */
/* -------------------------------------------------------------------------- */

function MetricRow({
  metric,
  insightVerdict,
  advancedData,
  delay,
}: {
  metric: DashboardMetric;
  insightVerdict?: { delta: number; verdict: string } | null;
  advancedData: AdvancedAnalysis | null;
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const scale = useSharedValue(1);
  const barProgress = useSharedValue(0);

  useEffect(() => {
    barProgress.value = withTiming(metric.current / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [metric.current]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${barProgress.value * 100}%` as any,
  }));

  const tier = getScoreTier(metric.current);
  // Bar color follows score tier for absolute context, but green/red tint for direction
  const barColor = metric.direction === "up"
    ? LIME.primary
    : metric.direction === "down"
      ? "#EF4444"
      : tier.color;
  const label = METRIC_LABELS[metric.key] ?? metric.key;
  const subMap = SUBMETRIC_MAP[metric.key];
  const advGroup = subMap && advancedData ? (advancedData as any)[subMap.groupKey] : null;

  // Baseline position on bar (0–100 → 0–1)
  const baselinePos = Math.min(100, Math.max(0, metric.baseline));

  const dirLabel =
    metric.direction === "up" ? "↑ IMPROVED" :
    metric.direction === "down" ? "↓ DECLINED" :
    "→ STABLE";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.98, { damping: 14, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    });
    setExpanded((v) => !v);
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Animated.View style={animStyle}>
        <GlassCard style={styles.metricCard}>
          <Pressable onPress={handlePress} style={styles.metricPressable}>
            {/* Header row */}
            <View style={styles.metricHeaderRow}>
              <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 14, color: COLORS.lightText, flex: 1, letterSpacing: 0.2 }}>
                {label.toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SP[2] }}>
                {/* Score tier pill — neutral; tier conveyed by label only */}
                <View style={styles.tierPillSmall}>
                  <Text style={styles.tierTextSmall}>{tier.label}</Text>
                </View>
                <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 16, color: COLORS.lightText, minWidth: 32, textAlign: "right" }}>
                  {metric.current.toFixed(1)}
                </Text>
                <Text style={{ color: COLORS.lightSub, fontSize: 13 }}>
                  {expanded ? "▴" : "▾"}
                </Text>
              </View>
            </View>

            {/* Dual-marker progress bar */}
            <View style={styles.barTrack}>
              {/* Current fill */}
              <Animated.View style={[styles.barFill, barStyle, { backgroundColor: barColor }]} />
              {/* Baseline tick */}
              <View
                style={[
                  styles.baselineTick,
                  { left: `${baselinePos}%` as any },
                ]}
              />
            </View>

            {/* Direction badge — monochrome chip, sign carries direction */}
            <View style={styles.directionRow}>
              <View style={[styles.dirBadge, { backgroundColor: COLORS.lightSurfaceAlt }]}>
                <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 11, color: COLORS.lightText, letterSpacing: 0.4 }}>
                  {dirLabel}
                </Text>
              </View>
              <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 11, color: COLORS.lightSub }}>
                {formatDelta(metric.delta)}
              </Text>
            </View>

            {/* Expanded panel */}
            {expanded && (
              <Animated.View entering={FadeIn.duration(250)} style={styles.expandedPanel}>
                {/* Divider */}
                <View style={styles.expandDivider} />

                {/* Before → After comparison */}
                <View style={styles.beforeAfterRow}>
                  {/* Baseline box */}
                  <View style={styles.beforeBox}>
                    <Text style={styles.beforeLabel}>BASELINE</Text>
                    <Text style={styles.beforeValue}>{metric.baseline.toFixed(1)}</Text>
                  </View>
                  {/* Arrow + delta — monochrome */}
                  <View style={styles.arrowCol}>
                    <Text style={styles.arrowText}>→</Text>
                    <Text style={styles.arrowDelta}>
                      {formatDelta(metric.delta)}
                    </Text>
                  </View>
                  {/* Current box */}
                  <View style={styles.afterBox}>
                    <Text style={styles.afterLabel}>NOW</Text>
                    <Text style={styles.afterValue}>{metric.current.toFixed(1)}</Text>
                  </View>
                  {/* Best Ever */}
                  <View style={styles.bestBox}>
                    <Text style={styles.beforeLabel}>BEST</Text>
                    <Text style={styles.beforeValue}>
                      {metric.best.toFixed(1)}{metric.current >= metric.best ? " 🏆" : ""}
                    </Text>
                  </View>
                </View>

                {/* Sub-metrics from advanced data */}
                {advGroup && subMap && (
                  <>
                    <View style={[styles.expandDivider, { marginTop: SP[3] }]} />
                    <View style={{ gap: SP[2], marginTop: SP[2] }}>
                      {subMap.items.map((item) => {
                        const rawScore = advGroup[`${item.key}_score`];
                        const score =
                          typeof rawScore === "number" ? rawScore : null;
                        const tag = score !== null ? getSubMetricTag(score) : null;
                        return (
                          <View key={item.key} style={styles.subMetricRow}>
                            <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 13, color: COLORS.lightText, flex: 1 }}>
                              {item.label}
                            </Text>
                            {score !== null && (
                              <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 13, color: COLORS.lightText, marginRight: SP[2] }}>
                                {score.toFixed(1)}
                              </Text>
                            )}
                            {tag && (
                              <View style={styles.tagPill}>
                                <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 11, color: COLORS.lightText, letterSpacing: 0.3 }}>
                                  {tag.label}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </Animated.View>
            )}
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  AdvancedSection — collapsible advanced analysis                            */
/* -------------------------------------------------------------------------- */

type AdvancedGroupKey = keyof AdvancedAnalysis;

type AdvGroupDef = {
  key: AdvancedGroupKey;
  label: string;
  items: { scoreKey: string; label: string }[];
};

const ADV_GROUPS: AdvGroupDef[] = [
  {
    key: "cheekbones",
    label: "Cheekbones",
    items: [
      { scoreKey: "width_score",          label: "Cheekbone Width" },
      { scoreKey: "maxilla_score",        label: "Maxilla Development" },
      { scoreKey: "bone_structure_score", label: "Bone Structure" },
      { scoreKey: "face_fat_score",       label: "Face Fat" },
    ],
  },
  {
    key: "jawline",
    label: "Jawline",
    items: [
      { scoreKey: "development_score",  label: "Development" },
      { scoreKey: "gonial_angle_score", label: "Gonial Angle" },
      { scoreKey: "projection_score",   label: "Chin Projection" },
    ],
  },
  {
    key: "eyes",
    label: "Eyes",
    items: [
      { scoreKey: "canthal_tilt_score", label: "Canthal Tilt" },
      { scoreKey: "eye_type_score",     label: "Eye Type" },
      { scoreKey: "brow_volume_score",  label: "Brow Volume" },
      { scoreKey: "symmetry_score",     label: "Symmetry" },
    ],
  },
  {
    key: "skin",
    label: "Skin",
    items: [
      { scoreKey: "color_score",   label: "Skin Color" },
      { scoreKey: "quality_score", label: "Skin Quality" },
    ],
  },
];

function compareAdvanced(
  latest: LatestAdvanced | null,
  previous: LatestAdvanced | null,
  groupKey: AdvancedGroupKey,
  scoreKey: string,
): "improving" | "same" | "worse" | null {
  if (!latest || !previous) return null;
  const lg = (latest as any)[groupKey];
  const pg = (previous as any)[groupKey];
  if (!lg || !pg) return null;
  const l = lg[scoreKey];
  const p = pg[scoreKey];
  if (typeof l !== "number" || typeof p !== "number") return null;
  const diff = l - p;
  if (diff > 0.5) return "improving";
  if (diff < -0.5) return "worse";
  return "same";
}

function AdvancedSection({
  latestAdvanced,
  previousAdvanced,
}: {
  latestAdvanced: LatestAdvanced | null;
  previousAdvanced: LatestAdvanced | null;
}) {
  const [open, setOpen] = useState(false);

  const hasData = latestAdvanced !== null && Object.values(latestAdvanced).some((v) => v !== null);

  const totalItems = ADV_GROUPS.reduce((acc, g) => {
    const grp = latestAdvanced ? (latestAdvanced as any)[g.key] : null;
    return acc + (grp ? g.items.filter((it) => typeof grp[it.scoreKey] === "number").length : 0);
  }, 0);

  return (
    <GlassCard style={styles.sectionCard}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen((v) => !v);
        }}
        style={styles.collapseHeader}
      >
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh }]}>
            Advanced Analysis
          </Text>
          {hasData && (
            <Text style={[TYPE.small, { color: COLORS.sub, marginTop: 2 }]}>
              {totalItems} sub-metrics
            </Text>
          )}
        </View>
        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 16 }}>
          {open ? "▴" : "▾"}
        </Text>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(250)}>
          <View style={styles.collapseBody}>
            {!hasData ? (
              <Text style={[TYPE.caption, { color: COLORS.muted, textAlign: "center", paddingVertical: SP[3] }]}>
                Run a detailed analysis to unlock sub-metric scores.
              </Text>
            ) : (
              ADV_GROUPS.map((grp) => {
                const grpData = latestAdvanced ? (latestAdvanced as any)[grp.key] : null;
                if (!grpData) return null;
                return (
                  <View key={grp.key} style={styles.advGroup}>
                    <Text style={[TYPE.smallSemiBold, { color: LIME.primary, marginBottom: SP[2], textTransform: "uppercase", letterSpacing: 0.8 }]}>
                      {grp.label}
                    </Text>
                    {grp.items.map((item) => {
                      const score = grpData[item.scoreKey];
                      if (typeof score !== "number") return null;
                      const tag = getSubMetricTag(score);
                      const change = compareAdvanced(latestAdvanced, previousAdvanced, grp.key, item.scoreKey);
                      const changeColor = change ? CHANGE_COLOR[change] : "rgba(255,255,255,0.35)";
                      const changeIcon = change ? CHANGE_ICON[change] : "→";
                      return (
                        <View key={item.scoreKey} style={styles.advItem}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                              <Text style={[TYPE.caption, { color: COLORS.muted, flex: 1 }]}>
                                {item.label}
                              </Text>
                              <Text style={[TYPE.captionSemiBold, { color: COLORS.text, marginRight: SP[2] }]}>
                                {score.toFixed(0)}
                              </Text>
                              {change && (
                                <Text style={[{ color: changeColor, fontSize: 11, fontFamily: "Poppins-SemiBold", marginRight: SP[2] }]}>
                                  {changeIcon}
                                </Text>
                              )}
                              <View style={[styles.tagPill, { borderColor: `${tag.color}40`, backgroundColor: `${tag.color}15` }]}>
                                <Text style={[TYPE.small, { color: tag.color, fontSize: 9, fontFamily: "Poppins-SemiBold" }]}>
                                  {tag.label}
                                </Text>
                              </View>
                            </View>
                            {/* Mini score bar */}
                            <View style={styles.miniBarTrack}>
                              <View style={[styles.miniBarFill, { width: `${score}%` as any, backgroundColor: tag.color }]} />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>
      )}
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  ScanHistorySection — collapsible                                           */
/* -------------------------------------------------------------------------- */

function ScanHistorySection({ history }: { history: DashboardHistoryItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <GlassCard style={styles.sectionCard}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen((v) => !v);
        }}
        style={styles.collapseHeader}
      >
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh }]}>
            Scan History
          </Text>
          <Text style={[TYPE.small, { color: COLORS.sub, marginTop: 2 }]}>
            {history.length} {history.length === 1 ? "scan" : "scans"} recorded
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.40)", fontSize: 16 }}>
          {open ? "▴" : "▾"}
        </Text>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(250)}>
          <View style={styles.collapseBody}>
            {history.length === 0 ? (
              <Text style={[TYPE.caption, { color: COLORS.muted, textAlign: "center", paddingVertical: SP[3] }]}>
                No scan history yet.
              </Text>
            ) : (
              history.map((item, i) => (
                <View key={item.id} style={[styles.historyRow, i < history.length - 1 && styles.historyRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh }]}>
                      {item.label}
                    </Text>
                    <Text style={[TYPE.small, { color: COLORS.sub, marginTop: 2 }]}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.scoreChip, { backgroundColor: LIME.bg, borderColor: LIME.border }]}>
                    <Text style={[TYPE.captionSemiBold, { color: LIME.primary }]}>
                      {item.overall.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>
      )}
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  3D Lime Button                                                             */
/* -------------------------------------------------------------------------- */

function LimeButton3D({ onPress, label }: { onPress: () => void; label: string }) {
  const btnDepth = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: btnDepth.value }],
  }));

  const handlePressIn = () => {
    btnDepth.value = withSpring(4, { damping: 14, stiffness: 300 });
  };

  const handlePressOut = () => {
    btnDepth.value = withSpring(0, { damping: 14, stiffness: 300 });
  };

  return (
    <View style={styles.btn3dOuter}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ borderRadius: RADII.circle, overflow: "hidden" }}
      >
        <Animated.View style={[{ borderRadius: RADII.circle, backgroundColor: COLORS.ctaBlack }, animStyle]}>
          <View style={styles.btn3dFace}>
            <Text style={{
              fontFamily: "ProximaNova-Bold",
              fontSize: 17,
              color: "#FFFFFF",
              letterSpacing: 0.6,
              textAlign: "center",
            }}>
              {label.toUpperCase()}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  State screens: Loading / Error / Empty                                     */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <View style={styles.centeredState}>
      <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 15, color: COLORS.lightSub, textAlign: "center" }}>
        Loading your progress…
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.centeredState}>
      <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 18, color: COLORS.lightText, textAlign: "center", marginBottom: SP[2] }}>
        Couldn't load data
      </Text>
      <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 13, color: COLORS.lightSub, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}

function EmptyState({
  router,
  scanLoading,
  scanFailed,
}: {
  router: ReturnType<typeof useRouter>;
  scanLoading: boolean;
  scanFailed: boolean;
}) {
  const btnDepth = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: btnDepth.value }],
  }));

  // Reached only when scan_count === 0. Copy reflects pre-baseline states.
  const title = scanLoading
    ? "Analyzing Your Scan…"
    : scanFailed
      ? "Scan Didn't Complete"
      : "Take Your First Scan";

  const body = scanLoading
    ? "Your first scan is being processed. This takes about 30 seconds."
    : scanFailed
      ? "Your initial scan didn't save. Take a new scan to get your baseline score."
      : "Scan your face to get your baseline score and start tracking progress.";

  const btnLabel = scanLoading ? null : "Scan Now";

  return (
    <View style={styles.centeredState}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 24, color: COLORS.lightText, textAlign: "center", marginBottom: SP[2], letterSpacing: -0.4 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: "ProximaNova-Bold", fontSize: 14, color: COLORS.lightSub, textAlign: "center", marginBottom: SP[6], lineHeight: 20 }}>
          {body}
        </Text>
        {btnLabel && (
          <View style={styles.btn3dOuter}>
            <Pressable
              onPress={() => router.push("/(tabs)/take-picture")}
              onPressIn={() => { btnDepth.value = withSpring(4, { damping: 14, stiffness: 300 }); }}
              onPressOut={() => { btnDepth.value = withSpring(0, { damping: 14, stiffness: 300 }); }}
              style={{ borderRadius: RADII.circle, overflow: "hidden" }}
            >
              <Animated.View style={[{ borderRadius: RADII.circle, backgroundColor: COLORS.ctaBlack }, animStyle]}>
                <View style={styles.btn3dFace}>
                  <Text style={{
                    fontFamily: "ProximaNova-Bold",
                    fontSize: 17,
                    color: "#FFFFFF",
                    letterSpacing: 0.6,
                    textAlign: "center",
                  }}>
                    {btnLabel.toUpperCase()}
                  </Text>
                </View>
              </Animated.View>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}



/* -------------------------------------------------------------------------- */
/*  Main Screen                                                                */
/* -------------------------------------------------------------------------- */

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, loadInsights, invalidate, startPolling } = useInsights();
  const { active: activeNotification, evaluate: evaluateNotification, dismiss: dismissNotification, hide: hideNotification } = useNotifications();
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const advancedData = useAdvancedAnalysis((s) => s.data);
  const authUser = useAuthStore((s) => s.user);
  const displayName = useProfile((s) => s.displayName);
  const scanLoading = useScores((s) => s.loading);
  const scanError   = useScores((s) => s.error);
  const scanImageUri = useScores((s) => s.imageUri);

  // UUID pattern — Supabase leaks the auth UUID into name/email fields on some flows.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (s: string) => UUID_RE.test(s.trim());

  // Derive display name: prefer user-set profile name, then auth fields, then friendly fallback.
  // Any value that looks like a UUID is skipped — those are auth IDs, not names.
  const userName = (() => {
    if (displayName && !isUuid(displayName)) return displayName;

    const candidates: (string | undefined | null)[] = [
      (authUser as any)?.fullName,
      (authUser as any)?.firstName,
      (authUser as any)?.name,
      (authUser as any)?.email,
    ];

    for (const raw of candidates) {
      if (!raw || typeof raw !== "string") continue;
      const first = raw.split(/[@\s]/)[0];
      if (!first || isUuid(first)) continue;
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    return "Champion"; // shown when no real name is available
  })();

  // Load on focus — loadInsights guards itself (no-op when data is fresh).
  // No isDirty in deps: when isDirty flips false the callback identity would
  // change, triggering an extra useFocusEffect fire on the same focus event.
  useFocusEffect(
    useCallback(() => {
      loadInsights();
      // On blur: slide the notification away without writing a cooldown.
      // It will re-evaluate and reappear on the next visit.
      return () => hideNotification();
    }, [loadInsights, hideNotification])
  );

  // Re-evaluate which notification to show whenever insight data refreshes.
  useEffect(() => {
    evaluateNotification(data ?? null);
  }, [data]);

  // Single unified background poll — covers both pending insight and pending
  // advanced analysis. Only one interval runs at a time (store-level guard).
  useEffect(() => {
    const needsInsight  = data != null && data.scan_count >= 2 && data.insight === null;
    const needsAdvanced = data != null && data.scan_count >= 1 && data.latest_advanced === null;
    if (needsInsight || needsAdvanced) {
      return startPolling();
    }
  }, [data?.scan_count, data?.insight, data?.latest_advanced]);

  const onRefresh = useCallback(() => {
    invalidate();
    loadInsights();
  }, [loadInsights, invalidate]);

  // Derived data
  const insight       = data?.insight ?? null;
  const content       = insight?.content ?? null;
  const overall       = data?.overall ?? null;
  const metrics       = data?.metrics ?? [];
  const graphPoints   = data?.graph_points ?? [];
  const graphDates    = data?.graph_dates ?? [];
  const history       = data?.history ?? [];
  const scanCount     = data?.scan_count ?? 0;
  const joinedDaysAgo = data?.joined_days_ago ?? 0;
  const latestAdvanced   = data?.latest_advanced ?? (advancedData as LatestAdvanced | null) ?? null;
  const previousAdvanced = data?.previous_advanced ?? null;

  // Days since the user's most recent scan. `history` is newest-first
  // (see `/insights` server route). Null when no scans exist yet.
  const daysSinceLastScan: number | null = (() => {
    const latestCreated = history[0]?.created_at;
    if (!latestCreated) return null;
    const t = Date.parse(latestCreated);
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  })();

  // Overall delta — use AI content when available, fall back to raw scan math
  const overallDelta = content?.overall_delta
    ?? (overall ? Math.round((overall.current - overall.baseline) * 10) / 10 : 0);
  const verdict: "improved" | "same" | "declined" = content?.verdict
    ?? (overallDelta > 1.5 ? "improved" : overallDelta < -1.5 ? "declined" : "same");

  // Render body
  const renderBody = () => {
    if (loading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} />;
    // After 1 scan we render the full dashboard with a "Baseline" treatment
    // so the user sees the app's tracking surface immediately, even before
    // the second scan unlocks deltas and the journey chart.
    if (scanCount < 1) return (
      <EmptyState
        router={router}
        scanLoading={scanLoading}
        scanFailed={!scanLoading && !!scanError}
      />
    );

    return (
      <>
        {/* ── Section 1.5: Potential Face — top-anchored "% closer" card ── */}
        {/* Renders nothing when no row exists yet; handles its own state machine. */}
        <PotentialFaceCard
          currentImageUri={scanImageUri ?? null}
          latestAdvanced={latestAdvanced}
          daysSinceLastScan={daysSinceLastScan}
          onScanAgain={() => router.push("/(tabs)/take-picture")}
        />

        {/* ── Section 2: Hero Score Card ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)}>
          <HeroCard
            overall={overall!}
            overallDelta={overallDelta}
            verdict={verdict}
            scanCount={scanCount}
            joinedDaysAgo={joinedDaysAgo}
            userName={userName}
          />
        </Animated.View>

        {/* ── Section 3: Your journey ── */}
        {graphPoints.length >= 2 && (
          <Animated.View entering={FadeInDown.delay(180).duration(450)}>
            <JourneyCard
              scanCount={scanCount}
              joinedDaysAgo={joinedDaysAgo}
              overallDelta={overallDelta}
              graphPoints={graphPoints}
            />
          </Animated.View>
        )}

        {/* ── Section 3b: Top 5 trainable sub-metrics (improving / to target) ── */}
        <TopFiveCard result={pickTopFive(latestAdvanced, previousAdvanced, scanCount)} />

        {/* ── Section 4: "Where to focus" — header lives inside MetricGrid ── */}
        {overall && (
          <MetricGrid metrics={metrics} latestAdvanced={latestAdvanced} previousAdvanced={previousAdvanced} />
        )}

        {/* ── Section 6: AI Coach ── (removed) */}
        {false && content && (
          <Animated.View entering={FadeInDown.delay(560).duration(450)}>
            <GlassCard style={styles.aiCard} accentLeft>
              {/* Subtle lime gradient overlay */}
              <LinearGradient
                colors={["rgba(180,243,77,0.06)", "rgba(180,243,77,0.00)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.aiHeader}>
                <View style={styles.aiTitleRow}>
                  <Text style={{ fontSize: 18, marginRight: SP[2] }}>🤖</Text>
                  <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh }]}>
                    AI Coach
                  </Text>
                </View>
                <View style={[styles.verdictPill, {
                  backgroundColor: VERDICT_BG[verdict] ?? "rgba(255,255,255,0.08)",
                  borderColor: `${VERDICT_COLOR[verdict] ?? "rgba(255,255,255,0.25)"}60`,
                }]}>
                  <Text style={[TYPE.small, {
                    color: VERDICT_COLOR[verdict] ?? COLORS.muted,
                    fontFamily: "Poppins-SemiBold",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }]}>
                    {verdict}
                  </Text>
                </View>
              </View>
              <Text style={[TYPE.caption, { color: "rgba(255,255,255,0.75)", lineHeight: 22, marginTop: SP[2] }]}>
                {content?.narrative}
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Section 9: Daily Workout CTA ── */}
        <Animated.View entering={FadeInDown.delay(740).duration(450)} style={styles.ctaContainer}>
          <LimeButton3D
            label="Start Today's Workout"
            onPress={() => router.push("/(tabs)/program")}
          />
        </Animated.View>
      </>
    );
  };


  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Atmospheric lime glow behind header — gives the top section warmth */}
      <LinearGradient
        colors={["rgba(180,243,77,0.10)", "rgba(180,243,77,0.00)"]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGlow}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SP[10] },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={onRefresh}
            tintColor={LIME.primary}
          />
        }
      >
        {/* ── Identity strip: caption + week ribbon ── */}
        <IdentityStrip
          userName={userName}
          joinedDaysAgo={data?.joined_days_ago ?? 0}
          currentStreak={currentStreak}
        />

        {renderBody()}
      </ScrollView>

      {/* ── Insight Pulse — absolute overlay, slides in from top ── */}
      {activeNotification && (
        <View
          style={[styles.notificationOverlay, { top: insets.top + SP[3] }]}
          pointerEvents="box-none"
        >
          <InsightPulseCard
            key={activeNotification.key}
            type={activeNotification.type}
            message={activeNotification.message}
            detail={activeNotification.detail}
            ctaLabel={activeNotification.ctaLabel}
            autoDismissMs={5000}
            onDismiss={dismissNotification}
          />
        </View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

// Soft drop-shadow recipe — bumped slightly so dim-white cards read as
// elevated against the pure-white screen.
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.lightBg,  // pure white screen — cards float via shadow
  },

  // Atmospheric glow — kept as an empty no-op so existing JSX doesn't need
  // to be torn out. Zero height = invisible.
  headerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },

  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    gap: SP[4],
  },

  notificationOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },

  /* Identity strip */
  identityWrap: {
    marginBottom: SP[2],
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SP[3],
  },
  identityCaption: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightSub,
    letterSpacing: 0.1,
  },
  identityStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SP[2],
    paddingVertical: 4,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightCard,
  },
  identityStreakNum: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  ribbonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ribbonCell: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  ribbonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lightBorder,
  },
  ribbonDotDone: {
    backgroundColor: COLORS.ctaBlack,
  },
  ribbonDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ribbonDotTodayPending: {
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  ribbonDay: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.4,
  },
  ribbonDayToday: {
    color: COLORS.lightText,
  },

  /* Legacy header / streak — kept for safety, no longer rendered */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SP[2],
  },
  headerWelcome: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightSub,
    marginBottom: 2,
  },
  headerName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 28,
    color: COLORS.lightText,
    lineHeight: 32,
    letterSpacing: -0.5,
  },

  streakPillBase: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
  },
  streakPillFace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  streakText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  /* Glass card — repurposed as a white card with soft shadow */
  card: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    overflow: "hidden",
    ...SOFT_SHADOW,
  },

  cardInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
  },

  cardAccentLeft: {
    position: "absolute",
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    backgroundColor: COLORS.ctaBlack,
    borderRadius: 2,
  },

  /* Hero — L3 black card. Three info zones: meta · centerpiece · context */
  heroBase: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[5],
  },

  /* Top meta strip */
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMetaText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
  },
  heroMetaPB: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.8,
  },

  /* Centerpiece — score + tier identity, dramatic whitespace */
  heroCenter: {
    alignItems: "center",
    paddingVertical: SP[8] ?? 32,
  },
  heroScoreHuge: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 128,
    lineHeight: 132,
    color: "#FFFFFF",
    letterSpacing: -4,
    textAlign: "center",
  },
  heroTierIdentity: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 6,
    marginTop: -2,
    textAlign: "center",
  },

  /* Bottom context strip */
  heroBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroBottomCol: {
    alignItems: "flex-start",
  },
  heroBottomNum: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  heroBottomLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  /* Baseline pill — replaces the delta number on the first scan */
  heroBaselinePill: {
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderRadius: RADII.circle,
    backgroundColor: "rgba(180,243,77,0.14)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.42)",
  },
  heroBaselinePillText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.8,
  },

  /* Tier chip (used outside hero — keep neutral) */
  tierPill: {
    marginTop: SP[2],
    paddingHorizontal: SP[3],
    paddingVertical: 4,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  tierText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightText,
    letterSpacing: 0.4,
  },
  /* Metric grid — legacy (no longer rendered, kept for safety) */
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
  },

  /* Where to focus — section header */
  focusHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: SP[3],
    marginBottom: SP[3],
  },
  focusTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  focusSub: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  focusSeeAll: {
    paddingVertical: 4,
  },
  focusSeeAllText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightText,
  },

  /* Spotlight metric card — L2, the largest white card on the screen */
  spotlightCard: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    padding: SP[5],
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  spotlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[4],
  },
  spotlightIcon: {
    width: 52,
    height: 52,
    borderRadius: RADII.md,
    backgroundColor: COLORS.iconTileLavender,
    overflow: "hidden",
  },
  spotlightLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  spotlightName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 18,
    color: COLORS.lightText,
    letterSpacing: 0.2,
  },
  spotlightScoreCol: {
    alignItems: "flex-end",
  },
  spotlightScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 32,
    color: COLORS.lightText,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  spotlightDelta: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  spotlightInsight: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.lightMuted,
    marginBottom: SP[4],
  },
  spotlightCta: {
    backgroundColor: COLORS.ctaBlack,
    borderRadius: RADII.circle,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightCtaText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },

  /* Mid row — Rising | Falling */
  midRow: {
    flexDirection: "row",
    gap: SP[3],
    marginTop: SP[3],
  },
  midCard: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.md,
    padding: SP[4],
    ...SOFT_SHADOW,
  },
  midTag: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightText,
    letterSpacing: 0.6,
    marginBottom: SP[2],
  },
  midTagDown: {
    color: COLORS.declineRed,
  },
  midName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    letterSpacing: 0.1,
    marginBottom: SP[2],
  },
  midRowScore: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  midScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 24,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  midDelta: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
  },

  /* Reference list — no card chrome, just rows on the L0 surface */
  refList: {
    marginTop: SP[3],
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.md,
    paddingHorizontal: SP[4],
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[3],
    gap: SP[3],
  },
  refRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightHairline,
  },
  refIcon: {
    width: 32,
    height: 32,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.iconTileLavender,
    overflow: "hidden",
  },
  refName: {
    flex: 1,
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightText,
    letterSpacing: 0.2,
  },
  refDelta: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
    minWidth: 50,
    textAlign: "right",
  },
  refScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 16,
    color: COLORS.lightText,
    minWidth: 30,
    textAlign: "right",
  },

  /* Metric card — white card, lavender icon tile, soft shadow */
  metricRowBase: {
    width: METRIC_COL_W,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    paddingBottom: 0,
    ...SOFT_SHADOW,
  },
  metricRowFace: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADII.lg,
    overflow: "hidden",
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    gap: SP[3],
  },
  metricRowThumb: {
    width: 44,
    height: 44,
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
  },
  metricRowThumbImg: {
    width: "100%",
    height: "100%",
  },
  metricRowThumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.iconTileLavender,
    borderRadius: RADII.md,
  },
  metricRowInfo: {
    flex: 1,
    gap: 2,
  },
  metricRowName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightText,
    letterSpacing: 0.2,
  },
  metricRowTier: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightSub,
  },
  metricRowArrowBtn: {
    backgroundColor: COLORS.ctaBlack,
    borderRadius: RADII.circle,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  metricRowArrowLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  metricRowScoreCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  metricRowScoreText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightText,
  },

  /* Metric detail bottom sheet — light, matches Edit/Targets sheets */
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.lightCard,
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    paddingHorizontal: SP[5],
    paddingBottom: SP[8] ?? 32,
    paddingTop: SP[3],
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.lightBorder,
    alignSelf: "center",
    marginBottom: SP[4],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[4],
  },
  sheetThumb: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
  },
  sheetMetricName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.lightSurface,
    borderRadius: RADII.lg,
    padding: SP[4],
    marginBottom: SP[4],
    gap: SP[2],
  },
  sheetScoreBox: {
    alignItems: "center",
    flex: 1,
    borderRadius: RADII.md,
    paddingVertical: SP[2],
  },
  sheetScoreLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sheetScoreValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 20,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  sheetScoreArrow: {
    alignItems: "center",
    gap: 2,
  },
  sheetScoreDelta: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
  },
  sheetSubList: {
    gap: SP[3],
  },
  sheetSubRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightHairline,
  },
  sheetSubLabel: {
    flex: 1,
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
  },
  sheetSubScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    marginRight: SP[2],
  },
  sheetNoSub: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightSub,
    textAlign: "center",
    paddingVertical: SP[4],
  },

  /* Sub-metric progress bar */
  sheetSubBarWrap: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lightSurfaceAlt,
    marginHorizontal: SP[3],
    overflow: "hidden",
  },
  sheetSubBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.ctaBlack,
  },

  /* Sub-metric tag pill — light chip */
  subTag3dBase: {
    borderRadius: RADII.circle,
  },
  subTag3dFace: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
    paddingHorizontal: SP[3],
    paddingVertical: 4,
  },
  subTag3dText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightText,
    letterSpacing: 0.3,
  },

  /* Journey card — white with soft shadow, monochrome graph */
  journeyBase: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    marginBottom: SP[2],
    ...SOFT_SHADOW,
  },
  journeyFace: {
    borderRadius: RADII.lg,
    backgroundColor: JOURNEY_CARD_BG,
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    overflow: "hidden",
  },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SP[3],
  },
  journeyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  journeyTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    color: JOURNEY_INK,
    letterSpacing: -0.4,
  },
  journeyTitleIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
  },
  journeySubtitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: JOURNEY_SUB,
    marginTop: 3,
  },
  journeyPillDepth: {
    backgroundColor: "transparent",
    borderRadius: 999,
  },
  journeyPillFace: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyPillText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    letterSpacing: 0.2,
  },
  journeyGraphWrap: {
    marginTop: SP[1],
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDayLabels: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 22,
    paddingRight: 10,
    marginTop: 4,
  },
  journeyDayLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.6,
  },

  /* Trend card — light surface, monochrome */
  trendBase: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    ...SOFT_SHADOW,
  },
  trendFace: {
    borderRadius: RADII.lg,
    overflow: "hidden",
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[3],
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SP[3],
  },
  trendTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 18,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  trendSubtitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  trendFilterPill: {
    backgroundColor: COLORS.lightSurfaceAlt,
    borderRadius: RADII.circle,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  trendFilterText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightText,
  },
  trendDayLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SP[2],
  },
  trendDayLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.6,
  },

  /* Metric cards */
  metricCard: {
    marginBottom: 0,
  },

  metricPressable: {
    padding: SP[4],
  },

  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SP[2],
  },

  tierPillSmall: {
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  tierTextSmall: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightText,
    letterSpacing: 0.4,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lightSurfaceAlt,
    marginBottom: SP[2],
    position: "relative" as const,
    overflow: "visible" as const,
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.ctaBlack,
  },
  baselineTick: {
    position: "absolute" as const,
    top: -3,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: COLORS.lightSub,
    marginLeft: -1,
  },
  beforeAfterRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: SP[2],
  },
  beforeBox: {
    flex: 1,
    alignItems: "center" as const,
    backgroundColor: COLORS.lightSurface,
    borderRadius: RADII.md,
    paddingVertical: SP[2],
  },
  arrowCol: {
    alignItems: "center" as const,
    gap: 1,
  },
  arrowText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 16,
    color: COLORS.lightText,
  },
  arrowDelta: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.lightSub,
  },
  afterBox: {
    flex: 1,
    alignItems: "center" as const,
    borderRadius: RADII.md,
    paddingVertical: SP[2],
    backgroundColor: COLORS.lightSurface,
  },
  bestBox: {
    flex: 1,
    alignItems: "center" as const,
    backgroundColor: COLORS.lightSurface,
    borderRadius: RADII.md,
    paddingVertical: SP[2],
  },
  beforeLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  beforeValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
  },
  afterLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    marginBottom: 2,
    color: COLORS.lightSub,
  },
  afterValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
  },
  miniBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden" as const,
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.ctaBlack,
    opacity: 0.85,
  },

  directionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },

  dirBadge: {
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },

  expandedPanel: {
    marginTop: SP[3],
  },

  expandDivider: {
    height: 1,
    backgroundColor: COLORS.lightHairline,
    marginBottom: SP[3],
  },

  statBoxRow: {
    flexDirection: "row",
    gap: SP[3],
  },

  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.lightSurface,
    borderRadius: RADII.md,
    paddingVertical: SP[3],
  },

  subMetricRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  tagPill: {
    paddingHorizontal: SP[3],
    paddingVertical: 4,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
  },

  /* AI Coach card */
  aiCard: {
    padding: SP[5],
    paddingLeft: SP[5] + 8, // extra left padding for accent bar
  },

  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  aiTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  verdictPill: {
    paddingHorizontal: SP[3],
    paddingVertical: 4,
    borderRadius: RADII.circle,
  },

  /* Collapsible sections */
  sectionCard: {
    overflow: "hidden",
  },

  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SP[4],
  },

  collapseBody: {
    paddingHorizontal: SP[4],
    paddingBottom: SP[4],
  },

  advGroup: {
    marginBottom: SP[4],
  },

  advItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[1],
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[3],
  },

  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightHairline,
  },

  scoreChip: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
  },

  /* CTA — black pill, mirrors START ROUTINE */
  ctaContainer: {
    marginTop: SP[3],
    marginBottom: SP[2],
  },

  btn3dOuter: {
    position: "relative",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
  },

  btn3dFace: {
    minHeight: 58,
    borderRadius: RADII.circle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: SP[4],
  },

  btn3dBase: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
    borderRadius: RADII.circle,
    backgroundColor: "transparent",
    zIndex: -1,
  },

  /* State screens */
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[12],
    paddingHorizontal: SP[6],
  },
});
