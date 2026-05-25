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
  ActivityIndicator,
  type ImageSourcePropType,
  Modal,
  TextInput,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
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
  type SvgProps,
} from "react-native-svg";
import { LocalSvg } from "react-native-svg/css";
import { useRouter, useFocusEffect } from "expo-router";
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Bell,
  Target,
  TriangleAlert,
  X,
} from "lucide-react-native";
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
import { usePotentialFace, computeProgressPercent } from "@/store/potentialFace";
import type {
  DashboardMetric,
  DashboardHistoryItem,
  InsightContent,
  DashboardOverall,
  LatestAdvanced,
} from "@/lib/api/insights";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import { fetchScanDetail } from "@/lib/api/history";
import { pickTopFive } from "@/lib/submetrics";
import { TopFiveCard } from "@/components/dashboard/TopFiveCard";
import ProblemsIcon from "@/assets/icons/problems.svg";
import ProgressIcon from "@/assets/icons/progress.svg";
import FocusIcon from "@/assets/icons/next-foucs.svg";
import StreakIcon from "@/assets/icons/streak-icon.svg";

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

const TRACKING_HEADER = {
  bg: "#FEF5E4",
  accent: COLORS.accentDepth,
  accentSoft: "rgba(72,145,32,0.12)",
  text: COLORS.lightText,
  muted: COLORS.lightSub,
  faint: COLORS.lightMuted,
  border: COLORS.lightBorder,
  control: COLORS.lightSurfaceAlt,
} as const;

const DETAIL_FONT = "DINNextRounded-Regular";

const DIR_COLOR: Record<string, string> = {
  up:   COLORS.lightText,
  down: COLORS.lightSub,
  flat: COLORS.lightMuted,
};

const PROFILE_WEB_AXES = [
  { key: "skin_quality", label: "SKIN" },
  { key: "eyes_symmetry", label: "EYES" },
  { key: "facial_symmetry", label: "SYMMETRY" },
  { key: "jawline", label: "JAWLINE" },
  { key: "cheekbones", label: "MIDFACE" },
] as const;

const PROFILE_WEB_W = 294;
const PROFILE_WEB_H = 258;
const PROFILE_WEB_CX = PROFILE_WEB_W / 2;
const PROFILE_WEB_CY = 134;
const PROFILE_WEB_RADIUS = 82;
const PROFILE_WEB_LABEL_RADIUS = 112;

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

function profileWebPoint(index: number, value: number, radius?: number) {
  "worklet";
  const axisCount = 5;
  const centerX = 147;
  const centerY = 134;
  const resolvedRadius = typeof radius === "number" ? radius : 82;
  const step = (Math.PI * 2) / axisCount;
  const angle = -Math.PI / 2 + index * step;
  const clamped = Math.max(0, Math.min(100, value));
  const r = (clamped / 100) * resolvedRadius;

  return {
    x: centerX + Math.cos(angle) * r,
    y: centerY + Math.sin(angle) * r,
  };
}

function profileWebPath(values: number[], radius?: number): string {
  "worklet";
  const resolvedRadius = typeof radius === "number" ? radius : 82;
  return values
    .map((value, index) => {
      const p = profileWebPoint(index, value, resolvedRadius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
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

const TRACKING_MASCOT_IMAGES = {
  improved: require("@/assets/images-for-initial-tracking-screen/progress.png"),
  same: require("@/assets/images-for-initial-tracking-screen/no-progress.png"),
  declined: require("@/assets/images-for-initial-tracking-screen/no-progress.png"),
} as const;

const TRACKING_NEXT_SCREEN_SIGN = require("@/assets/images-for-initial-tracking-screen/sign-for-next-screen.png");

const DASHBOARD_MODULE_ICONS = {
  problems: ProblemsIcon,
  progress: ProgressIcon,
  focus: FocusIcon,
} as const;

type DashboardModuleKey = "problems" | "progress" | "focus";
type SvgIconSource = React.ComponentType<SvgProps> | ImageSourcePropType;

function DashboardSvgIcon({
  icon,
  width,
  height,
}: {
  icon: SvgIconSource;
  width: number;
  height: number;
}) {
  if (typeof icon === "function") {
    const Icon = icon;
    return <Icon width={width} height={height} />;
  }

  return <LocalSvg asset={icon} width={width} height={height} />;
}

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
/*  Dashboard module tiles                                                     */
/* -------------------------------------------------------------------------- */

function DashboardModuleButton({
  label,
  subtitle,
  icon,
  variant,
  badgeCount,
  wide,
  onPress,
}: {
  label: string;
  subtitle: string;
  icon: SvgIconSource;
  variant: DashboardModuleKey;
  badgeCount?: number;
  wide?: boolean;
  onPress: () => void;
}) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <View style={[styles.dashModuleOuter, wide && styles.dashModuleOuterWide]}>
      {showBadge && (
        <View pointerEvents="none" style={styles.dashModuleBadge}>
          <Text style={styles.dashModuleBadgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
        </View>
      )}

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.dashModuleCard,
          variant === "problems" && styles.dashModuleCardProblems,
          variant === "progress" && styles.dashModuleCardProgress,
          variant === "focus" && styles.dashModuleCardFocus,
          wide && styles.dashModuleCardWide,
          pressed && styles.dashModuleCardPressed,
        ]}
      >
        <View style={[styles.dashModuleIconSlot, wide && styles.dashModuleIconSlotWide]}>
          <DashboardSvgIcon
            icon={icon}
            width={wide ? 96 : 112}
            height={wide ? 96 : 112}
          />
        </View>

        <View style={[styles.dashModuleCopy, wide && styles.dashModuleCopyWide]}>
          <Text
            style={[
              styles.dashModuleTitle,
              variant === "problems" && styles.dashModuleTitleProblems,
              variant === "progress" && styles.dashModuleTitleProgress,
              variant === "focus" && styles.dashModuleTitleFocus,
            ]}
          >
            {label}
          </Text>
          <Text style={styles.dashModuleSubtitle}>{subtitle}</Text>
        </View>

        <View
          style={[
            styles.dashModuleArrow,
            variant === "problems" && styles.dashModuleArrowProblems,
            variant === "progress" && styles.dashModuleArrowProgress,
            variant === "focus" && styles.dashModuleArrowFocus,
          ]}
        >
          <ArrowRight size={23} color="#050505" strokeWidth={3} />
        </View>
      </Pressable>
    </View>
  );
}

function DashboardModuleButtons({
  problemCount,
  scanCount,
  focusCount,
  onOpen,
}: {
  problemCount: number;
  scanCount: number;
  focusCount: number;
  onOpen: (key: DashboardModuleKey) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(180).duration(420)} style={styles.dashModuleGrid}>
      <DashboardModuleButton
        label="Top 5 Problems"
        subtitle="Areas that need attention"
        icon={DASHBOARD_MODULE_ICONS.problems}
        variant="problems"
        badgeCount={problemCount}
        onPress={() => onOpen("problems")}
      />
      <DashboardModuleButton
        label="Progress Graph"
        subtitle="Track improvement over time"
        icon={DASHBOARD_MODULE_ICONS.progress}
        variant="progress"
        badgeCount={scanCount}
        onPress={() => onOpen("progress")}
      />
      <DashboardModuleButton
        label="Next Focus"
        subtitle="Your recommended focus area"
        icon={DASHBOARD_MODULE_ICONS.focus}
        variant="focus"
        badgeCount={focusCount}
        wide
        onPress={() => onOpen("focus")}
      />
    </Animated.View>
  );
}

function DashboardModuleEmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.dashModuleEmptyCard}>
      <Text style={styles.dashModuleEmptyTitle}>{title}</Text>
      <Text style={styles.dashModuleEmptyBody}>{body}</Text>
    </View>
  );
}

function DashboardModuleOverlay({
  visible,
  title,
  subtitle,
  topInset,
  bottomInset,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.dashModuleOverlayRoot, { paddingTop: topInset }]}>
        <View style={styles.dashModuleOverlayHeader}>
          <View style={styles.dashModuleOverlayTitleBlock}>
            <Text style={styles.dashModuleOverlayTitle}>{title}</Text>
            <Text style={styles.dashModuleOverlaySubtitle}>{subtitle}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close dashboard module"
            style={({ pressed }) => [styles.dashModuleOverlayClose, pressed && styles.dashModuleCardPressed]}
          >
            <X size={21} color="#FFFFFF" strokeWidth={2.8} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.dashModuleOverlayContent,
            { paddingBottom: bottomInset + SP[8] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
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
  const animationKey = `${points.join(",")}|${projection?.join(",") ?? ""}|${stroke}`;

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
  }, [animationKey]);

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
  const graphAnimationKey = `${graphPoints.join("-")}:${projection?.join("-") ?? "none"}:${deltaColor}`;

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
          <JourneyGraph
            key={graphAnimationKey}
            points={graphPoints}
            projection={projection}
            stroke={deltaColor}
          />
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

function ProgressGraphDetail({
  scanCount,
  joinedDaysAgo,
  overallDelta,
  graphPoints,
  daysSinceLastScan,
}: {
  scanCount: number;
  joinedDaysAgo: number;
  overallDelta: number;
  graphPoints: number[];
  daysSinceLastScan: number | null;
}) {
  const currentScore = graphPoints[graphPoints.length - 1] ?? 0;
  const tier = getScoreTier(currentScore);
  const next = nextTier(currentScore);
  const isUp = overallDelta >= 0;
  const dayUnit = joinedDaysAgo === 1 ? "day" : "days";
  const scanUnit = scanCount === 1 ? "scan" : "scans";
  const lastScanCopy =
    daysSinceLastScan === null
      ? "Today"
      : daysSinceLastScan === 0
        ? "Today"
        : `${daysSinceLastScan}d ago`;

  const paceCopy = next
    ? `${Math.max(0, next.threshold - currentScore).toFixed(0)} pts to ${next.label}`
    : "Top tier reached";

  const habitCopy =
    daysSinceLastScan === null || daysSinceLastScan <= 3
      ? "Fresh data"
      : "Scan again soon";

  return (
    <Animated.View entering={FadeInDown.duration(360)} style={styles.progressMockRoot}>
      <View style={styles.progressHeroCard}>
        <View style={styles.progressHeroCopy}>
          <Text style={styles.progressHeroEyebrow}>CURRENT TRAJECTORY</Text>
          <Text style={styles.progressHeroTitle}>
            {isUp ? "You are trending up" : "Your score needs attention"}
          </Text>
          <Text style={styles.progressHeroBody}>
            {`${Math.abs(overallDelta).toFixed(1)} point ${isUp ? "gain" : "drop"} across ${joinedDaysAgo} ${dayUnit}.`}
          </Text>
        </View>
        <View style={[styles.progressHeroBadge, !isUp && styles.progressHeroBadgeDown]}>
          {isUp ? (
            <TrendingUp size={22} color={COLORS.accentDepth} strokeWidth={2.5} />
          ) : (
            <TrendingDown size={22} color={COLORS.declineRed} strokeWidth={2.5} />
          )}
        </View>
      </View>

      <View style={styles.progressStatGrid}>
        <View style={styles.progressStatCard}>
          <Text style={styles.progressStatValue}>{Math.round(currentScore)}</Text>
          <Text style={styles.progressStatLabel}>{tier.label}</Text>
        </View>
        <View style={styles.progressStatCard}>
          <Text style={styles.progressStatValue}>{scanCount}</Text>
          <Text style={styles.progressStatLabel}>{scanUnit}</Text>
        </View>
        <View style={styles.progressStatCard}>
          <Text style={styles.progressStatValue}>{lastScanCopy}</Text>
          <Text style={styles.progressStatLabel}>{habitCopy}</Text>
        </View>
      </View>

      <JourneyCard
        scanCount={scanCount}
        joinedDaysAgo={joinedDaysAgo}
        overallDelta={overallDelta}
        graphPoints={graphPoints}
      />

      <View style={styles.progressInsightCard}>
        <View style={styles.progressInsightRow}>
          <View style={styles.progressInsightIcon}>
            <Target size={18} color={COLORS.lightText} strokeWidth={2.4} />
          </View>
          <View style={styles.progressInsightCopy}>
            <Text style={styles.progressInsightTitle}>Next milestone</Text>
            <Text style={styles.progressInsightBody}>{paceCopy}</Text>
          </View>
        </View>
        <View style={styles.progressInsightDivider} />
        <View style={styles.progressInsightRow}>
          <View style={[styles.progressInsightIcon, styles.progressInsightIconSoft]}>
            <RefreshCw size={18} color={COLORS.accentDepth} strokeWidth={2.4} />
          </View>
          <View style={styles.progressInsightCopy}>
            <Text style={styles.progressInsightTitle}>Best next move</Text>
            <Text style={styles.progressInsightBody}>
              Keep scans consistent so the projected line gets more reliable.
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  IdentityStrip - tracking detail header                                     */
/* -------------------------------------------------------------------------- */

function IdentityStrip({
  currentStreak,
  onBack,
}: {
  userName: string | null;
  joinedDaysAgo: number;
  currentStreak: number;
  avatarUri: string | null;
  onBack: () => void;
}) {
  const streakUnit = currentStreak === 1 ? "day streak" : "days streak";

  return (
    <Animated.View entering={FadeInDown.delay(0).duration(360)} style={styles.identityWrap}>
      <View style={styles.identityHeader}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to overview"
          style={({ pressed }) => [styles.identityRailButton, pressed && styles.identityRailPressed]}
        >
          <ArrowLeft size={18} color={TRACKING_HEADER.text} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.identityStreakPill}>
          <DashboardSvgIcon icon={StreakIcon} width={16} height={16} />
          <Text style={styles.identityStreakNum}>{currentStreak}</Text>
          <Text style={styles.identityStreakText}>{streakUnit}</Text>
        </View>

        <Pressable
          onPress={() => Haptics.selectionAsync()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Progress tracking"
          style={({ pressed }) => [styles.identityRailButton, pressed && styles.identityRailPressed]}
        >
          <TrendingUp size={18} color={TRACKING_HEADER.text} strokeWidth={2.3} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroCard — side-by-side: ring left, score info right                      */
/* -------------------------------------------------------------------------- */

const POTENTIAL_FACE_POLL_MS = 5_000;

function HeroImagePreview({
  uri,
  label,
  visible,
  onClose,
  onImageError,
}: {
  uri: string | null;
  label: string;
  visible: boolean;
  onClose: () => void;
  onImageError?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (visible) setStatus("loading");
  }, [uri, visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.heroPreviewBackdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
          style={styles.heroPreviewShade}
          onPress={onClose}
        />
        <Animated.View entering={FadeInDown.duration(260)} style={styles.heroPreviewCard}>
          <View style={styles.heroPreviewImageWrap}>
            {uri && (
              <ExpoImage
                source={{ uri }}
                style={styles.heroPreviewImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={180}
                onLoadStart={() => setStatus("loading")}
                onLoad={() => setStatus("ready")}
                onDisplay={() => setStatus("ready")}
                onError={() => {
                  setStatus("error");
                  onImageError?.();
                }}
              />
            )}
            {(!uri || status === "loading") && (
              <View style={styles.heroPreviewStateOverlay}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.heroPreviewStateText}>Loading image...</Text>
              </View>
            )}
            {status === "error" && (
              <View style={styles.heroPreviewStateOverlay}>
                <TriangleAlert size={26} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.heroPreviewStateText}>Refreshing preview...</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroPreviewLabel}>{label}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
            style={styles.heroPreviewClose}
          >
            <X size={18} color={COLORS.lightText} strokeWidth={2.4} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function OverviewFaceImage({
  uri,
  accent,
  loading,
  onError,
}: {
  uri: string | null;
  accent?: boolean;
  loading?: boolean;
  onError?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (uri) setStatus("loading");
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.overviewFacePlaceholder}>
        {loading && <ActivityIndicator size="small" color={COLORS.lightMuted} />}
      </View>
    );
  }

  return (
    <View style={styles.overviewFaceImageWrap}>
      <ExpoImage
        source={{ uri }}
        style={styles.overviewFaceImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={180}
        onLoadStart={() => setStatus("loading")}
        onLoad={() => setStatus("ready")}
        onDisplay={() => setStatus("ready")}
        onError={() => {
          setStatus("error");
          onError?.();
        }}
      />
      {status === "loading" && (
        <View style={styles.overviewFaceImageOverlay}>
          <ActivityIndicator size="small" color={accent ? COLORS.accentDepth : COLORS.lightMuted} />
        </View>
      )}
      {status === "error" && (
        <View style={styles.overviewFaceImageOverlay}>
          <TriangleAlert size={20} color={accent ? COLORS.accentDepth : COLORS.lightMuted} strokeWidth={2.2} />
        </View>
      )}
    </View>
  );
}

function UnifiedProgressHero({
  overall,
  scanCount,
  metrics,
}: {
  overall: DashboardOverall;
  scanCount: number;
  metrics: DashboardMetric[];
}) {
  const scoreVal = useSharedValue(0);
  const reveal = useSharedValue(0);
  const webPlot = useSharedValue(0);
  const pulse = useSharedValue(0);
  const deltaVal = useSharedValue(0);
  const overallDelta = 0;
  const [preview, setPreview] = useState<null | { uri: string; label: string }>(null);
  const potentialFace = usePotentialFace((s) => s.data);
  const latestAdvanced: LatestAdvanced | null = null;
  const metricByKey = useMemo(() => {
    const out = new Map<string, DashboardMetric>();
    for (const metric of metrics) out.set(metric.key, metric);
    return out;
  }, [metrics]);
  const webValues = PROFILE_WEB_AXES.map((axis) => metricByKey.get(axis.key)?.current ?? overall.current);
  const webAverage = webValues.length
    ? Math.round(webValues.reduce((sum, value) => sum + value, 0) / webValues.length)
    : Math.round(overall.current);
  const valueSignature = webValues.map((value) => value.toFixed(1)).join("|");

  useEffect(() => {
    scoreVal.value = 0;
    reveal.value = 0;
    webPlot.value = 0;
    pulse.value = 0;
    const cfg = { duration: 1400, easing: Easing.out(Easing.cubic) };
    scoreVal.value = withTiming(webAverage, cfg);
    reveal.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    webPlot.value = withDelay(140, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(reveal);
      cancelAnimation(webPlot);
      cancelAnimation(pulse);
    };
  }, [scoreVal, reveal, webPlot, pulse, webAverage, valueSignature]);

  const scoreProps = useAnimatedProps(() => ({
    text: String(Math.round(scoreVal.value)),
    defaultValue: "",
  } as any));
  const deltaProps = useAnimatedProps(() => ({
    text: `${overallDelta >= 0 ? "+" : "−"}${deltaVal.value.toFixed(1)}`,
    defaultValue: "",
  } as any));

  const isPB = scanCount >= 2 && overall.current >= overall.best;
  const potentialReady = potentialFace?.status === "ready";
  const potentialPending = potentialFace?.status === "pending";
  const potentialFailed = potentialFace?.status === "failed";
  const progress = computeProgressPercent(potentialFace, latestAdvanced);
  const progressPct = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));
  const potentialLabel =
    potentialReady ? "Potential" :
    potentialPending ? "Generating" :
    potentialFailed ? "Retry soon" :
    "Potential";
  const potentialUri: any = potentialReady ? potentialFace?.primaryImageUrl ?? null : null;
  const currentImageUri: any = null;
  const potentialScoreProps = scoreProps;

  const openPreview = (uri: string | null, label: string) => {
    if (!uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreview({ uri, label });
  };

  const webRevealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: 0.88 + reveal.value * 0.12 }],
  } as any));
  const webPathProps = useAnimatedProps(() => ({
    d: profileWebPath(webValues.map((value) => value * webPlot.value)),
  } as any));
  const haloProps = useAnimatedProps(() => ({
    r: 4 + pulse.value * 4,
    opacity: 0.18 + (1 - pulse.value) * 0.18,
  } as any));

  return (
    <Animated.View entering={FadeInDown.delay(0).duration(450)} style={styles.unifiedOuter}>
      <View style={styles.profileWebCard}>
        <View style={styles.profileWebHeader}>
          <View>
            <Text style={styles.profileWebEyebrow}>ATTRIBUTE MAP</Text>
            <Text style={styles.profileWebTitle}>Face profile</Text>
          </View>
          {isPB && <Text style={styles.heroMetaPB}>★ PERSONAL BEST</Text>}
          <View style={styles.profileWebScorePill}>
            <AnimatedTextInput
              animatedProps={scoreProps}
              editable={false}
              pointerEvents="none"
              style={[styles.profileWebScoreValue, { padding: 0 }]}
            />
            <Text style={styles.profileWebScoreLabel}>AVG</Text>
          </View>
        </View>

        <Animated.View style={[styles.profileWebChartWrap, webRevealStyle]}>
          <Svg width={PROFILE_WEB_W} height={PROFILE_WEB_H}>
            <Defs>
              <SvgGradient id="profileWebFill" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={COLORS.accent} stopOpacity="0.34" />
                <Stop offset="1" stopColor={COLORS.accentDepth} stopOpacity="0.12" />
              </SvgGradient>
            </Defs>

            {[20, 40, 60, 80, 100].map((level) => (
              <Path
                key={`web-ring-${level}`}
                d={profileWebPath(PROFILE_WEB_AXES.map(() => level))}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
                fill="none"
              />
            ))}

            {PROFILE_WEB_AXES.map((_, index) => {
              const p = profileWebPoint(index, 100);
              return (
                <Line
                  key={`web-axis-${index}`}
                  x1={PROFILE_WEB_CX}
                  y1={PROFILE_WEB_CY}
                  x2={p.x}
                  y2={p.y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
              );
            })}

            <AnimatedSvgPath
              animatedProps={webPathProps}
              stroke={COLORS.accent}
              strokeWidth={2.8}
              strokeLinejoin="round"
              fill="url(#profileWebFill)"
            />

            {webValues.map((value, index) => {
              const p = profileWebPoint(index, value);
              const axis = PROFILE_WEB_AXES[index];
              return (
                <React.Fragment key={`web-dot-${axis.key}`}>
                  <AnimatedCircle cx={p.x} cy={p.y} fill={COLORS.accent} animatedProps={haloProps} />
                  <Circle cx={p.x} cy={p.y} r={4.2} fill={COLORS.accent} stroke="#090909" strokeWidth={1.6} />
                </React.Fragment>
              );
            })}

            {PROFILE_WEB_AXES.map((axis, index) => {
              const p = profileWebPoint(index, 100, PROFILE_WEB_LABEL_RADIUS);
              const isLeft = p.x < PROFILE_WEB_CX - 8;
              const isRight = p.x > PROFILE_WEB_CX + 8;
              const labelX = isLeft ? Math.max(p.x, 58) : isRight ? Math.min(p.x, PROFILE_WEB_W - 58) : p.x;
              const yNudge = index === 0 ? -8 : index === 2 || index === 3 ? 9 : 2;
              const score = Math.round(webValues[index] ?? overall.current);
              const anchor = isLeft ? "end" : isRight ? "start" : "middle";

              return (
                <React.Fragment key={`web-label-${axis.key}`}>
                  <SvgText
                    x={labelX}
                    y={p.y + yNudge}
                    fill="rgba(255,255,255,0.76)"
                    fontFamily="ProximaNova-Bold"
                    fontSize={12}
                    letterSpacing={1.1}
                    textAnchor={anchor}
                  >
                    {axis.label}
                  </SvgText>
                  <SvgText
                    x={labelX}
                    y={p.y + yNudge + 15}
                    fill="#FFFFFF"
                    fontFamily="ProximaNova-Bold"
                    fontSize={12}
                    textAnchor={anchor}
                  >
                    {score}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>

        <View style={styles.profileWebFooter}>
          <View style={styles.profileWebLegendDot} />
          <Text style={styles.profileWebFooterText}>Live profile from your latest scan</Text>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <>
    <Animated.View entering={FadeInDown.delay(0).duration(450)} style={styles.unifiedOuter}>
      <View style={styles.heroSplitCard}>
        <View style={styles.heroSplitMeta}>
          <Text style={styles.heroMetaText}>OVERALL RATING</Text>
          {isPB && <Text style={styles.heroMetaPB}>★ PERSONAL BEST</Text>}
        </View>

        <View style={styles.heroSplitBody}>
          <View style={styles.heroFaceScoreCol}>
            <Text style={styles.heroFaceTopLabel}>Current</Text>
            <Pressable
              disabled={!currentImageUri}
              onPress={() => openPreview(currentImageUri, "Current face")}
              style={({ pressed }) => [
                styles.heroCurrentImage,
                pressed && currentImageUri && { opacity: 0.9, transform: [{ scale: 0.96 }] },
              ]}
            >
              {currentImageUri ? (
                <Image
                  source={{ uri: currentImageUri }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroPotentialPlaceholder} />
              )}
            </Pressable>
            <AnimatedTextInput
              animatedProps={scoreProps}
              editable={false}
              style={[styles.heroFaceScore, { padding: 0 }]}
            />
          </View>

          <View style={styles.heroPotentialCol}>
            <Text style={styles.heroPotentialLabel}>{potentialLabel}</Text>
            <Pressable
              disabled={!potentialUri}
              onPress={() => openPreview(potentialUri, "Potential face")}
              style={({ pressed }) => [
                styles.heroPotentialImage,
                potentialReady && styles.heroPotentialImageReady,
                pressed && potentialUri && { opacity: 0.9, transform: [{ scale: 0.96 }] },
              ]}
            >
              {potentialUri ? (
                <Image
                  source={{ uri: potentialUri }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroPotentialPlaceholder}>
                  <Text style={styles.heroPotentialPlaceholderText}>
                    {potentialPending ? "..." : potentialFailed ? "!" : ""}
                  </Text>
                </View>
              )}
            </Pressable>
            <AnimatedTextInput
              animatedProps={potentialScoreProps}
              editable={false}
              style={[styles.heroPotentialScore, { padding: 0 }]}
            />
          </View>
        </View>

        <View style={styles.heroPotentialProgress}>
          <View style={styles.heroPotentialProgressHeader}>
            <Text style={styles.heroPotentialProgressLabel}>
              {progressPct === null ? "POTENTIAL PROGRESS" : `${progressPct}% CLOSER TO POTENTIAL`}
            </Text>
            {progressPct !== null && (
              <Text style={styles.heroPotentialProgressPct}>{progressPct}%</Text>
            )}
          </View>
          <View style={styles.heroPotentialTrack}>
            <View style={[styles.heroPotentialFill, { width: `${progressPct ?? 0}%` as any }]} />
          </View>
          <Text style={styles.heroPotentialProgressHint}>
            {progressPct === null
              ? potentialPending
                ? "Generating your potential face"
                : potentialFailed
                  ? "Potential face will retry shortly"
                  : "Run advanced analysis to measure movement toward it"
              : "Based on the target metrics behind your potential face"}
          </Text>
        </View>
      </View>
    </Animated.View>
    <HeroImagePreview
      uri={preview?.uri ?? null}
      label={preview?.label ?? ""}
      visible={preview !== null}
      onClose={() => setPreview(null)}
    />
    </>
  );
}

function ProgressOverview({
  overall,
  currentImageUri,
  latestAdvanced,
  verdict,
  latestScanId,
  onSeeProgress,
}: {
  overall: DashboardOverall;
  currentImageUri: string | null;
  latestAdvanced: LatestAdvanced | null;
  verdict: "improved" | "same" | "declined";
  latestScanId: string | null;
  onSeeProgress: () => void;
}) {
  const [preview, setPreview] = useState<null | { target: "current" | "potential"; label: string }>(null);
  const [remoteCurrentImageUri, setRemoteCurrentImageUri] = useState<string | null>(null);
  const [remoteCurrentLoading, setRemoteCurrentLoading] = useState(false);
  const [currentImageRetryTick, setCurrentImageRetryTick] = useState(0);
  const currentImageRetryRef = useRef(0);
  const potentialImageRetryRef = useRef(0);
  const scoreVal = useSharedValue(0);
  const potentialScoreVal = useSharedValue(0);
  const potentialFace = usePotentialFace((s) => s.data);
  const potentialLoading = usePotentialFace((s) => s.loading);
  const loadPotentialFace = usePotentialFace((s) => s.load);
  const retryPotentialFace = usePotentialFace((s) => s.retryGeneration);

  const next = nextTier(overall.current);
  const potentialScore = next?.threshold ?? Math.ceil(overall.current);
  const potentialReady = potentialFace?.status === "ready";
  const potentialPending = potentialFace?.status === "pending" || potentialLoading;
  const potentialFailed = potentialFace?.status === "failed";
  const potentialUri = potentialReady ? potentialFace?.primaryImageUrl ?? null : null;
  const displayCurrentImageUri = currentImageUri ?? remoteCurrentImageUri;

  useEffect(() => {
    void loadPotentialFace();
  }, [loadPotentialFace]);

  useEffect(() => {
    currentImageRetryRef.current = 0;
  }, [currentImageUri, latestScanId]);

  useEffect(() => {
    potentialImageRetryRef.current = 0;
  }, [potentialUri]);

  useEffect(() => {
    if (currentImageUri || !latestScanId) {
      setRemoteCurrentImageUri(null);
      setRemoteCurrentLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteCurrentLoading(true);
    fetchScanDetail(latestScanId)
      .then((detail) => {
        if (!cancelled) setRemoteCurrentImageUri(detail.images?.front?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setRemoteCurrentImageUri(null);
      })
      .finally(() => {
        if (!cancelled) setRemoteCurrentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentImageUri, latestScanId, currentImageRetryTick]);

  useEffect(() => {
    const urls = [displayCurrentImageUri, potentialUri].filter((u): u is string => !!u);
    if (!urls.length) return;
    ExpoImage.prefetch(urls, "memory-disk").catch(() => {});
  }, [displayCurrentImageUri, potentialUri]);

  useEffect(() => {
    if (potentialFace?.status !== "pending") return;
    const id = setInterval(() => void loadPotentialFace(), POTENTIAL_FACE_POLL_MS);
    return () => clearInterval(id);
  }, [potentialFace?.status, loadPotentialFace]);

  useEffect(() => {
    const cfg = { duration: 1250, easing: Easing.out(Easing.cubic) };
    scoreVal.value = 0;
    potentialScoreVal.value = 0;
    scoreVal.value = withTiming(overall.current, cfg);
    potentialScoreVal.value = withDelay(120, withTiming(potentialScore, cfg));
  }, [overall.current, potentialScore]);

  const scoreProps = useAnimatedProps(() => ({
    text: String(Math.round(scoreVal.value)),
    defaultValue: "",
  } as any));
  const potentialScoreProps = useAnimatedProps(() => ({
    text: String(Math.round(potentialScoreVal.value)),
    defaultValue: "",
  } as any));

  const message =
    verdict === "improved"
      ? "Keep going. You're getting closer to your potential."
      : verdict === "declined"
        ? "A dip is useful signal. Re-center your routine and compare again."
        : "You're holding steady. Consistency is what moves this forward.";

  const missingPotentialCopy = potentialPending
    ? "Generating your potential face..."
    : potentialFailed
      ? "Potential face needs a retry"
      : "Generate potential";
  const mascotImage = TRACKING_MASCOT_IMAGES[verdict];

  const handleGeneratePotential = async () => {
    if (!latestScanId || potentialPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await retryPotentialFace(latestScanId);
    } catch {
      // Store owns the surfaced error; keep this interaction non-blocking.
    }
  };

  const handleCurrentImageError = useCallback(() => {
    if (currentImageUri || !latestScanId || currentImageRetryRef.current >= 1) return;
    currentImageRetryRef.current += 1;
    setRemoteCurrentImageUri(null);
    setCurrentImageRetryTick((tick) => tick + 1);
  }, [currentImageUri, latestScanId]);

  const handlePotentialImageError = useCallback(() => {
    if (!potentialReady || potentialImageRetryRef.current >= 1) return;
    potentialImageRetryRef.current += 1;
    void loadPotentialFace();
  }, [loadPotentialFace, potentialReady]);

  const openPreview = (target: "current" | "potential", label: string) => {
    const uri = target === "potential" ? potentialUri : displayCurrentImageUri;
    if (!uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreview({ target, label });
    if (target === "potential") {
      void loadPotentialFace();
    }
  };

  const handlePreviewImageError = useCallback(() => {
    if (preview?.target === "potential") {
      void loadPotentialFace();
      return;
    }
    if (preview?.target === "current") {
      handleCurrentImageError();
    }
  }, [handleCurrentImageError, loadPotentialFace, preview?.target]);

  const previewUri =
    preview?.target === "potential"
      ? potentialUri
      : preview?.target === "current"
        ? displayCurrentImageUri ?? null
        : null;

  const closePreview = () => {
    setPreview(null);
  };

  return (
    <>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.overviewWrap}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Overall rating</Text>
          <Text style={styles.overviewSubtitle}>
            See how your current face compares to your potential.
          </Text>
        </View>

        <View style={styles.overviewCard}>
          <View style={styles.overviewCompareRow}>
            <View style={styles.overviewFaceCol}>
              <Text style={styles.overviewFaceLabel}>Current</Text>
              <Pressable
                disabled={!displayCurrentImageUri}
                onPress={() => openPreview("current", "Current face")}
                style={({ pressed }) => [
                  styles.overviewFaceRing,
                  styles.overviewCurrentRing,
                  pressed && displayCurrentImageUri && styles.overviewPressed,
                ]}
              >
                <OverviewFaceImage
                  uri={displayCurrentImageUri}
                  loading={remoteCurrentLoading}
                  onError={handleCurrentImageError}
                />
              </Pressable>
              <AnimatedTextInput
                animatedProps={scoreProps}
                editable={false}
                style={[styles.overviewScore, styles.overviewCurrentScore, { padding: 0 }]}
              />
            </View>

            <View style={styles.overviewDivider} />

            <View style={styles.overviewFaceCol}>
              <Text style={[styles.overviewFaceLabel, styles.overviewPotentialLabel]}>Potential</Text>
              <Pressable
                disabled={!potentialUri}
                onPress={() => openPreview("potential", "Potential face")}
                style={({ pressed }) => [
                  styles.overviewFaceRing,
                  styles.overviewPotentialRing,
                  pressed && potentialUri && styles.overviewPressed,
                ]}
              >
                {potentialUri ? (
                  <OverviewFaceImage uri={potentialUri} accent onError={handlePotentialImageError} />
                ) : (
                  <View style={styles.overviewPotentialFallback}>
                    {potentialPending ? (
                      <RefreshCw size={22} color={COLORS.accentDepth} strokeWidth={2.4} />
                    ) : (
                      <Sparkles size={24} color={COLORS.accentDepth} strokeWidth={2.4} />
                    )}
                    <Text style={styles.overviewFallbackText}>{missingPotentialCopy}</Text>
                  </View>
                )}
              </Pressable>
              <AnimatedTextInput
                animatedProps={potentialScoreProps}
                editable={false}
                style={[styles.overviewScore, styles.overviewPotentialScore, { padding: 0 }]}
              />
              {!potentialUri && !potentialPending && (
                <Pressable onPress={handleGeneratePotential} style={styles.overviewRetryBtn}>
                  <Text style={styles.overviewRetryText}>Generate</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.overviewMascotCallout}>
            <View style={styles.overviewMascotSlot}>
              <Image source={mascotImage} style={styles.overviewMascotImage} resizeMode="contain" />
            </View>
            <Text style={styles.overviewMascotText}>{message}</Text>
          </View>

        </View>

        <Pressable onPress={onSeeProgress} style={({ pressed }) => [styles.overviewTrackCard, pressed && styles.overviewPressed]}>
          <View style={styles.overviewTrackIcon}>
            <Image source={TRACKING_NEXT_SCREEN_SIGN} style={styles.overviewTrackImage} resizeMode="contain" />
          </View>
          <View style={styles.overviewTrackCopy}>
            <Text style={styles.overviewTrackTitle}>Track your progress</Text>
            <Text style={styles.overviewTrackSub}>Keep improving and unlock your best version.</Text>
          </View>
          <ChevronRight size={26} color={COLORS.lightSub} strokeWidth={2.4} />
        </Pressable>

        <LimeButton3D label="See Your Progress" onPress={onSeeProgress} />
      </Animated.View>
      <HeroImagePreview
        uri={previewUri}
        label={preview?.label ?? ""}
        visible={preview !== null}
        onClose={closePreview}
        onImageError={handlePreviewImageError}
      />
    </>
  );
}

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
  const avatarUri = useProfile((s) => s.avatarUri);
  const scanLoading = useScores((s) => s.loading);
  const scanError   = useScores((s) => s.error);
  const scanImageUri = useScores((s) => s.imageUri);
  const [progressView, setProgressView] = useState<"overview" | "details">("overview");
  const [openDashboardModule, setOpenDashboardModule] = useState<DashboardModuleKey | null>(null);

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
  const latestScanId = history[0]?.id ?? null;
  const topFiveResult = useMemo(
    () => pickTopFive(latestAdvanced, previousAdvanced, scanCount),
    [latestAdvanced, previousAdvanced, scanCount]
  );
  const dashboardProblemCount = Math.min(5, topFiveResult.rows.length);
  const dashboardFocusCount = metrics.some((metric) => metric.key !== "sexual_dimorphism") ? 1 : 0;

  const closeDashboardModule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenDashboardModule(null);
  }, []);

  const moduleOverlayCopy = openDashboardModule === "problems"
    ? {
        title: "Top 5 Problems",
        subtitle: "Your highest-leverage targets right now.",
      }
    : openDashboardModule === "progress"
      ? {
          title: "Progress Graph",
          subtitle: "Your score movement across scans.",
        }
      : {
          title: "Next Focus",
          subtitle: "The metric that should drive your next session.",
        };

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
  const renderDetailBody = () => {
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
        <IdentityStrip
          userName={userName}
          joinedDaysAgo={data?.joined_days_ago ?? 0}
          currentStreak={currentStreak}
          avatarUri={avatarUri}
          onBack={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setProgressView("overview");
          }}
        />

        <UnifiedProgressHero
          overall={overall!}
          scanCount={scanCount}
          metrics={metrics}
        />

        {/* ── Section 3: Your journey ── */}
        <DashboardModuleButtons
          problemCount={dashboardProblemCount}
          scanCount={scanCount}
          focusCount={dashboardFocusCount}
          onOpen={setOpenDashboardModule}
        />

        {/* ── Section 3b: Top 5 trainable sub-metrics (improving / to target) ── */}
        <DashboardModuleOverlay
          visible={openDashboardModule !== null}
          title={moduleOverlayCopy.title}
          subtitle={moduleOverlayCopy.subtitle}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onClose={closeDashboardModule}
        >
          {openDashboardModule === "problems" && (
            <TopFiveCard result={topFiveResult} />
          )}

          {openDashboardModule === "progress" && (
            graphPoints.length >= 2 ? (
              <ProgressGraphDetail
                key={`progress-detail-${graphPoints.join("-")}-${scanCount}-${overallDelta}`}
                scanCount={scanCount}
                joinedDaysAgo={joinedDaysAgo}
                overallDelta={overallDelta}
                graphPoints={graphPoints}
                daysSinceLastScan={daysSinceLastScan}
              />
            ) : (
              <DashboardModuleEmptyCard
                title="Progress graph is almost ready"
                body="Add another scan to unlock your trend line."
              />
            )
          )}

          {openDashboardModule === "focus" && (
            overall ? (
              <MetricGrid metrics={metrics} latestAdvanced={latestAdvanced} previousAdvanced={previousAdvanced} />
            ) : (
              <DashboardModuleEmptyCard
                title="Next focus is almost ready"
                body="Run a scan so we can rank your next training target."
              />
            )
          )}
        </DashboardModuleOverlay>

        {/* ── Section 4: "Where to focus" — header lives inside MetricGrid ── */}

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

  const renderBody = () => {
    if (loading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} />;
    if (scanCount < 1) return (
      <EmptyState
        router={router}
        scanLoading={scanLoading}
        scanFailed={!scanLoading && !!scanError}
      />
    );

    if (progressView === "overview") {
      return (
        <ProgressOverview
          overall={overall!}
          currentImageUri={scanImageUri ?? null}
          latestAdvanced={latestAdvanced}
          verdict={verdict}
          latestScanId={latestScanId}
          onSeeProgress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setProgressView("details");
          }}
        />
      );
    }

    return renderDetailBody();
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
    backgroundColor: "#FEF5E4",
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

  /* Unified top card — score + potential */
  overviewWrap: {
    gap: SP[5],
  },
  overviewHeader: {
    alignItems: "center",
    paddingTop: SP[5],
    paddingHorizontal: SP[5],
    marginBottom: SP[1],
  },
  overviewTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 30,
    lineHeight: 34,
    color: COLORS.lightText,
    letterSpacing: -0.7,
    textAlign: "center",
  },
  overviewSubtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: 19,
    lineHeight: 27,
    color: COLORS.lightSub,
    textAlign: "center",
    marginTop: SP[4],
    maxWidth: 310,
  },
  overviewCard: {
    borderRadius: RADII.card,
    backgroundColor: COLORS.lightCard,
    paddingHorizontal: SP[5],
    paddingTop: SP[7],
    paddingBottom: SP[5],
    gap: SP[5],
    ...SOFT_SHADOW,
  },
  overviewCompareRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    minHeight: 236,
  },
  overviewFaceCol: {
    flex: 1,
    alignItems: "center",
  },
  overviewFaceLabel: {
    fontFamily: DETAIL_FONT,
    fontSize: 19,
    color: COLORS.lightSub,
    marginBottom: SP[4],
  },
  overviewPotentialLabel: {
    color: COLORS.accentDepth,
  },
  overviewFaceRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.iconTileLavender,
  },
  overviewCurrentRing: {
    borderWidth: 7,
    borderColor: COLORS.lightBorder,
  },
  overviewPotentialRing: {
    borderWidth: 7,
    borderColor: COLORS.accent,
  },
  overviewFaceImage: {
    width: "100%",
    height: "100%",
  },
  overviewFaceImageWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.iconTileLavender,
  },
  overviewFaceImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,251,252,0.58)",
  },
  overviewFacePlaceholder: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.iconTileLavender,
  },
  overviewPotentialFallback: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    paddingHorizontal: SP[3],
    backgroundColor: "#F4FAEA",
  },
  overviewFallbackText: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: COLORS.accentDepth,
    textAlign: "center",
  },
  overviewScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 52,
    lineHeight: 58,
    minWidth: 90,
    textAlign: "center",
    letterSpacing: -2,
    marginTop: SP[5],
  },
  overviewCurrentScore: {
    color: COLORS.lightText,
  },
  overviewPotentialScore: {
    color: COLORS.accentDepth,
  },
  overviewDivider: {
    width: 1,
    height: 138,
    backgroundColor: COLORS.lightHairline,
    marginTop: 54,
    marginHorizontal: SP[2],
  },
  overviewRetryBtn: {
    minHeight: 34,
    borderRadius: RADII.circle,
    paddingHorizontal: SP[4],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF8DF",
    marginTop: -SP[1],
  },
  overviewRetryText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.accentDepth,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  overviewMascotCallout: {
    minHeight: 104,
    borderRadius: RADII.xl,
    backgroundColor: "#F0F8E8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    gap: SP[4],
  },
  overviewMascotSlot: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewMascotImage: {
    width: 82,
    height: 82,
  },
  overviewMascotText: {
    flex: 1,
    fontFamily: "ProximaNova-Bold",
    fontSize: 18,
    lineHeight: 24,
    color: "#27581D",
  },
  overviewTrackCard: {
    minHeight: 118,
    borderRadius: RADII.card,
    backgroundColor: COLORS.lightCard,
    flexDirection: "row",
    alignItems: "center",
    padding: SP[5],
    gap: SP[4],
    ...SOFT_SHADOW,
  },
  overviewTrackIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.accentDepth,
    backgroundColor: "#F4FAEA",
  },
  overviewTrackImage: {
    width: 58,
    height: 58,
  },
  overviewTrackCopy: {
    flex: 1,
    gap: 3,
  },
  overviewTrackTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 21,
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  overviewTrackSub: {
    fontFamily: DETAIL_FONT,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.lightSub,
  },
  overviewPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  detailBackRow: {
    display: "none",
    alignItems: "flex-start",
    marginBottom: -SP[1],
  },
  detailBackButton: {
    minHeight: 44,
    borderRadius: RADII.circle,
    paddingHorizontal: SP[4],
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  detailBackText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    letterSpacing: 0.1,
  },
  unifiedOuter: {
    marginBottom: SP[1],
  },
  profileWebCard: {
    borderRadius: RADII.card,
    backgroundColor: "#050505",
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[4],
    minHeight: 366,
    ...SOFT_SHADOW,
  },
  profileWebHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SP[1],
  },
  profileWebEyebrow: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: 1.7,
  },
  profileWebTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    lineHeight: 26,
    color: COLORS.accent,
    letterSpacing: -0.2,
    marginTop: 5,
  },
  profileWebScorePill: {
    minWidth: 56,
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: "rgba(180,243,77,0.13)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.24)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[2],
  },
  profileWebScoreValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    lineHeight: 25,
    color: COLORS.accent,
    textAlign: "center",
    minWidth: 34,
  },
  profileWebScoreLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 9,
    color: "rgba(255,255,255,0.48)",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  profileWebChartWrap: {
    minHeight: PROFILE_WEB_H,
    alignItems: "center",
    justifyContent: "center",
  },
  profileWebFooter: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: SP[3],
  },
  profileWebLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  profileWebFooterText: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: "rgba(255,255,255,0.48)",
    letterSpacing: 0.2,
  },
  heroSplitCard: {
    borderRadius: RADII.card,
    backgroundColor: "#000000",
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[5],
    minHeight: 398,
    ...SOFT_SHADOW,
  },
  heroSplitMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[5],
  },
  heroSplitBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SP[4],
    minHeight: 226,
  },
  heroFaceScoreCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: SP[2],
  },
  heroFaceTopLabel: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: "rgba(255,255,255,0.56)",
    letterSpacing: 0.4,
    minHeight: 14,
  },
  heroCurrentImage: {
    width: 126,
    height: 126,
    borderRadius: 63,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  heroFaceScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 50,
    lineHeight: 54,
    color: "#FFFFFF",
    letterSpacing: -1.5,
    minWidth: 86,
    textAlign: "center",
  },
  heroPotentialCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: SP[2],
  },
  heroPotentialImage: {
    width: 126,
    height: 126,
    borderRadius: 63,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  heroPotentialImageReady: {
    borderColor: COLORS.accent,
  },
  heroPotentialPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroPotentialPlaceholderText: {
    fontFamily: DETAIL_FONT,
    fontSize: 18,
    color: "rgba(255,255,255,0.45)",
  },
  heroPotentialLabel: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.4,
    minHeight: 14,
  },
  heroPotentialScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 50,
    lineHeight: 54,
    color: COLORS.accent,
    letterSpacing: -1.5,
    minWidth: 86,
    textAlign: "center",
  },
  heroPotentialProgress: {
    marginTop: SP[5],
    gap: SP[2],
  },
  heroPotentialProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroPotentialProgressLabel: {
    fontFamily: DETAIL_FONT,
    fontSize: 10,
    color: "rgba(255,255,255,0.48)",
    letterSpacing: 0.8,
  },
  heroPotentialProgressPct: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.4,
  },
  heroPotentialTrack: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroPotentialFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  heroPotentialProgressHint: {
    fontFamily: DETAIL_FONT,
    fontSize: 10,
    color: "rgba(255,255,255,0.38)",
    letterSpacing: 0.2,
  },
  heroPreviewBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  },
  heroPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  heroPreviewCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: RADII.card,
    backgroundColor: "#0B0B0B",
    padding: SP[3],
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    ...SOFT_SHADOW,
  },
  heroPreviewImageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  heroPreviewImage: {
    width: "100%",
    height: "100%",
  },
  heroPreviewStateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  heroPreviewStateText: {
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  heroPreviewLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: COLORS.lightBg,
    letterSpacing: 0.3,
    marginTop: SP[3],
    marginBottom: SP[1],
  },
  heroPreviewClose: {
    position: "absolute",
    top: SP[4],
    right: SP[4],
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  unifiedIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[3],
  },
  unifiedIdentityText: {
    flex: 1,
    fontFamily: DETAIL_FONT,
    fontSize: 13,
    color: COLORS.lightSub,
    letterSpacing: 0.1,
  },
  unifiedStreakPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightBg,
  },
  unifiedStreakText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightText,
  },
  unifiedRibbonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[5],
  },
  unifiedRibbonCell: {
    alignItems: "center",
    flex: 1,
    gap: 7,
  },
  unifiedRibbonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lightBorder,
  },
  unifiedRibbonDotDone: {
    backgroundColor: COLORS.ctaBlack,
  },
  unifiedRibbonDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  unifiedRibbonDotPending: {
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  unifiedRibbonDay: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.4,
  },
  unifiedRibbonDayToday: {
    color: COLORS.lightText,
  },
  unifiedCard: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    gap: SP[6],
  },
  unifiedSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[4],
  },
  unifiedScoreBlock: {
    flex: 1,
    minWidth: 0,
  },
  unifiedEyebrow: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: COLORS.lightSub,
    letterSpacing: 0.3,
    marginBottom: SP[2],
  },
  unifiedScoreLine: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unifiedScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 76,
    lineHeight: 78,
    color: COLORS.lightText,
    letterSpacing: -3,
  },
  unifiedScoreDenom: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 22,
    color: COLORS.lightMuted,
    letterSpacing: -0.4,
    marginLeft: 4,
  },
  unifiedRankPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    borderRadius: RADII.circle,
    backgroundColor: "#EFF8DF",
    paddingVertical: SP[2],
    paddingLeft: SP[2],
    paddingRight: SP[4],
    marginTop: SP[2],
  },
  unifiedRankIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E4F6C8",
  },
  unifiedRankLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.accentDepth,
  },
  unifiedRankSub: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: COLORS.lightMuted,
    marginTop: 1,
  },
  unifiedMilestonePanel: {
    flex: 1,
    minHeight: 126,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    backgroundColor: COLORS.lightCard,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    ...SOFT_SHADOW,
  },
  unifiedMilestoneCol: {
    flex: 1,
    justifyContent: "center",
  },
  unifiedMilestoneDivider: {
    width: 1,
    backgroundColor: COLORS.lightHairline,
    marginHorizontal: SP[4],
  },
  unifiedMilestoneLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.5,
    marginBottom: SP[2],
  },
  unifiedMilestoneValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 30,
    lineHeight: 34,
    color: "#079A3A",
    letterSpacing: -0.8,
  },
  unifiedMilestoneScoreLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  unifiedMilestoneScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 34,
    lineHeight: 36,
    color: COLORS.lightText,
    letterSpacing: -0.8,
  },
  unifiedMilestoneTier: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: "#079A3A",
  },
  unifiedMilestoneSub: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: COLORS.lightMuted,
    marginTop: SP[2],
  },
  unifiedTransformHeader: {
    gap: 2,
  },
  unifiedTransformTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 18,
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  unifiedTransformSub: {
    fontFamily: DETAIL_FONT,
    fontSize: 13,
    color: COLORS.lightMuted,
  },
  unifiedCompareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  unifiedFaceCell: {
    flex: 1,
    alignItems: "center",
  },
  unifiedFaceBox: {
    width: "100%",
    height: 188,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  unifiedFaceBoxActive: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  unifiedFacePlaceholder: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.iconTileLavender,
  },
  unifiedPlaceholderHead: {
    width: 54,
    height: 66,
    borderRadius: 28,
    backgroundColor: "#D8CDD9",
  },
  unifiedPlaceholderNeck: {
    width: 36,
    height: 28,
    borderRadius: 14,
    marginTop: -4,
    backgroundColor: "#D8CDD9",
  },
  unifiedPendingDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.lightBorder,
  },
  unifiedFaceLabel: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    marginTop: SP[3],
  },
  unifiedFaceLabelActive: {
    color: COLORS.lightText,
  },
  unifiedFaceSubtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    marginTop: 2,
    textAlign: "center",
  },
  unifiedImageBadge: {
    position: "absolute",
    top: SP[3],
    left: SP[3],
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    borderRadius: RADII.circle,
    backgroundColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: SP[3],
    paddingVertical: 5,
  },
  unifiedImageBadgeText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 9,
    color: COLORS.lightText,
    letterSpacing: 0.3,
  },
  unifiedImageBadgeScore: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 14,
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  unifiedArrow: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 30,
    color: COLORS.lightSub,
    marginBottom: SP[10],
  },
  unifiedProgressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  unifiedProgressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.ctaBlack,
  },
  unifiedProgressCaption: {
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    color: COLORS.lightSub,
    textAlign: "right",
    marginTop: -SP[2],
  },
  unifiedScanAgain: {
    minHeight: 46,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
  },
  unifiedScanAgainText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  /* Identity strip */
  identityWrap: {
    backgroundColor: TRACKING_HEADER.bg,
    paddingTop: SP[2],
    paddingBottom: SP[2],
    marginBottom: SP[1],
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[4],
  },
  identityRailButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#F8F9F8",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  identityRailPressed: {
    opacity: 0.72,
    transform: [{ translateY: 1 }],
  },
  identityStreakPill: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 15,
    borderRadius: RADII.circle,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  identityStreakIcon: {
    width: 16,
    height: 16,
  },
  identityStreakText: {
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    color: TRACKING_HEADER.muted,
  },
  identityLegacyHeader: {
    display: "none",
  },
  identityProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    minWidth: 0,
  },
  identityAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
    borderWidth: 1,
    borderColor: TRACKING_HEADER.border,
  },
  identityAvatarImage: {
    width: "100%",
    height: "100%",
  },
  identityAvatarText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    color: COLORS.lightText,
  },
  identityNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 18,
    color: TRACKING_HEADER.text,
    letterSpacing: -0.1,
  },
  identityCaption: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    color: TRACKING_HEADER.muted,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  identityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  identityOverviewPill: {
    minHeight: 38,
    borderRadius: RADII.circle,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SP[4],
    backgroundColor: TRACKING_HEADER.accent,
  },
  identityOverviewText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  identityBell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: TRACKING_HEADER.border,
  },
  identityBellDot: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKING_HEADER.accent,
    borderWidth: 1,
    borderColor: COLORS.lightBg,
  },
  identityBellDotText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 8,
    color: TRACKING_HEADER.text,
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
    fontSize: 13,
    color: "#E85F00",
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
    fontFamily: DETAIL_FONT,
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
  dashModuleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
    marginTop: SP[3],
    marginBottom: SP[2],
  },
  dashModuleOuter: {
    width: Math.floor((Dimensions.get("window").width - SP[5] * 2 - SP[3]) / 2),
    minHeight: 196,
  },
  dashModuleOuterWide: {
    width: "100%",
    minHeight: 126,
  },
  dashModuleCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    padding: SP[4],
    backgroundColor: COLORS.lightCard,
    shadowColor: "#000000",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dashModuleCardProblems: {
    backgroundColor: "#FFF6F7",
    borderColor: "rgba(229,72,77,0.25)",
  },
  dashModuleCardProgress: {
    backgroundColor: "#FAFFF2",
    borderColor: "rgba(107,154,30,0.20)",
  },
  dashModuleCardFocus: {
    backgroundColor: "#FFFCF5",
    borderColor: "rgba(194,107,0,0.18)",
  },
  dashModuleCardWide: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: SP[5],
  },
  dashModuleCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  dashModuleIconSlot: {
    width: "100%",
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  dashModuleIconSlotWide: {
    width: 96,
    height: 96,
    marginBottom: 0,
    marginRight: SP[5],
  },
  dashModuleImage: {
    width: 112,
    height: 112,
  },
  dashModuleImageWide: {
    width: 96,
    height: 96,
  },
  dashModuleCopy: {
    paddingRight: 52,
  },
  dashModuleCopyWide: {
    flex: 1,
    paddingRight: SP[3],
  },
  dashModuleTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    lineHeight: 20,
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  dashModuleTitleProblems: {
    color: COLORS.declineRed,
  },
  dashModuleTitleProgress: {
    color: COLORS.accentDepth,
  },
  dashModuleTitleFocus: {
    color: "#58CC02",
  },
  dashModuleSubtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.lightSub,
    marginTop: 4,
  },
  dashModuleArrow: {
    position: "absolute",
    right: SP[4],
    bottom: SP[4],
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF6DF",
  },
  dashModuleArrowProblems: {
    backgroundColor: "#FBDCDD",
  },
  dashModuleArrowProgress: {
    backgroundColor: "#EAF4D8",
  },
  dashModuleArrowFocus: {
    backgroundColor: "#FFF0D7",
  },
  dashModuleBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.declineRed,
    borderWidth: 2,
    borderColor: "#FEF5E4",
    zIndex: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dashModuleBadgeText: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 11,
    lineHeight: 14,
    color: "#FFFFFF",
  },
  dashModuleOverlayRoot: {
    flex: 1,
    backgroundColor: "#FEF5E4",
  },
  dashModuleOverlayHeader: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
  },
  dashModuleOverlayTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: SP[3],
  },
  dashModuleOverlayTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  dashModuleOverlaySubtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.lightSub,
    marginTop: 3,
  },
  dashModuleOverlayClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ctaBlack,
  },
  dashModuleOverlayContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
  },
  dashModuleEmptyCard: {
    borderRadius: 18,
    backgroundColor: COLORS.lightCard,
    padding: SP[5],
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dashModuleEmptyTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 19,
    lineHeight: 24,
    color: COLORS.lightText,
  },
  dashModuleEmptyBody: {
    fontFamily: DETAIL_FONT,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.lightSub,
    marginTop: SP[2],
  },

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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  spotlightInsight: {
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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
    fontFamily: DETAIL_FONT,
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

  /* Progress graph detail mockup */
  progressMockRoot: {
    gap: SP[4],
  },
  progressHeroCard: {
    minHeight: 112,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    padding: SP[5],
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
    ...SOFT_SHADOW,
  },
  progressHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  progressHeroEyebrow: {
    fontFamily: DETAIL_FONT,
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 1,
    marginBottom: SP[1],
  },
  progressHeroTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  progressHeroBody: {
    fontFamily: DETAIL_FONT,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.lightSub,
    marginTop: SP[2],
  },
  progressHeroBadge: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF8DE",
  },
  progressHeroBadgeDown: {
    backgroundColor: COLORS.declineRedSoft,
  },
  progressStatGrid: {
    flexDirection: "row",
    gap: SP[3],
  },
  progressStatCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: RADII.md,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.07)",
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  progressStatValue: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 20,
    lineHeight: 24,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  progressStatLabel: {
    fontFamily: DETAIL_FONT,
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  progressInsightCard: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    ...SOFT_SHADOW,
  },
  progressInsightRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  progressInsightIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  progressInsightIconSoft: {
    backgroundColor: "#EEF8DE",
  },
  progressInsightCopy: {
    flex: 1,
    minWidth: 0,
  },
  progressInsightTitle: {
    fontFamily: "ProximaNova-Bold",
    fontSize: 15,
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  progressInsightBody: {
    fontFamily: DETAIL_FONT,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  progressInsightDivider: {
    height: 1,
    backgroundColor: COLORS.lightHairline,
    marginLeft: 52,
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
