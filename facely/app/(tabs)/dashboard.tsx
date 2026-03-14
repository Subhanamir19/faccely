// app/(tabs)/dashboard.tsx
// Progress Dashboard — full redesign with lime design system

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
  Dimensions,
  Image,
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
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Polyline,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Path,
  Line,
} from "react-native-svg";
import { useRouter } from "expo-router";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII, TYPE, SHADOWS } from "@/lib/tokens";
import { useInsights } from "@/store/insights";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useTasksStore } from "@/store/tasks";
import type {
  DashboardMetric,
  DashboardHistoryItem,
  InsightContent,
  DashboardOverall,
  LatestAdvanced,
} from "@/lib/api/insights";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

/* -------------------------------------------------------------------------- */
/*  Design tokens — lime palette                                               */
/* -------------------------------------------------------------------------- */

const LIME = {
  primary: "#B4F34D",
  light:   "#CCFF6B",
  dark:    "#6B9A1E",
  dim:     "rgba(180,243,77,0.60)",
  glow:    "rgba(180,243,77,0.18)",
  border:  "rgba(180,243,77,0.30)",
  bg:      "rgba(180,243,77,0.10)",
  track:   "rgba(180,243,77,0.15)",
};

const DIR_COLOR: Record<string, string> = {
  up:   "#B4F34D",
  down: "#EF4444",
  flat: "rgba(255,255,255,0.35)",
};

const VERDICT_COLOR: Record<string, string> = {
  improved: "#B4F34D",
  same:     "rgba(255,255,255,0.45)",
  declined: "#EF4444",
};

const VERDICT_BG: Record<string, string> = {
  improved: "rgba(180,243,77,0.12)",
  same:     "rgba(255,255,255,0.08)",
  declined: "rgba(239,68,68,0.12)",
};

const CHANGE_COLOR: Record<string, string> = {
  improving: "#B4F34D",
  same:      "rgba(255,255,255,0.40)",
  worse:     "#EF4444",
};

const CHANGE_ICON: Record<string, string> = {
  improving: "↑",
  same:      "→",
  worse:     "↓",
};

const METRIC_LABELS: Record<string, string> = {
  jawline:           "Jawline",
  facial_symmetry:   "Facial Symmetry",
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

/* -------------------------------------------------------------------------- */
/*  Metric images                                                              */
/* -------------------------------------------------------------------------- */

const METRIC_IMAGES: Record<string, any> = {
  jawline:           require("@/assets/analysis-image-new/jawline analysis.jpeg"),
  cheekbones:        require("@/assets/analysis-image-new/cheekbones analysis.jpeg"),
  eyes_symmetry:     require("@/assets/analysis-image-new/eye area naalysis.jpeg"),
  skin_quality:      require("@/assets/analysis-image-new/skin analysis.jpeg"),
  // Placeholders until images are provided
  facial_symmetry:   null,
  nose_harmony:      null,
  sexual_dimorphism: null,
};

const METRIC_PLACEHOLDER_EMOJI: Record<string, string> = {
  facial_symmetry:   "⚖️",
  nose_harmony:      "👃",
  sexual_dimorphism: "💪",
};

/* -------------------------------------------------------------------------- */
/*  CurvedArrow — animated SVG arrow for direction                             */
/* -------------------------------------------------------------------------- */

const AnimatedPath = Animated.createAnimatedComponent(Path);

function CurvedArrow({ direction }: { direction: "up" | "down" | "flat" }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, []);

  // Path lengths (pre-calculated for each shape)
  const upPath    = "M 3 17 C 3 9 9 3 17 3";
  const downPath  = "M 3 3 C 3 11 9 17 17 17";
  const flatPath  = "M 2 10 L 18 10";
  const pathLen   = direction === "flat" ? 16 : 20;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLen * (1 - progress.value),
  }));

  const color =
    direction === "up"   ? LIME.primary :
    direction === "down" ? "#EF4444"    :
    "rgba(255,255,255,0.40)";

  const d = direction === "up" ? upPath : direction === "down" ? downPath : flatPath;

  // Arrow tip points
  const tip =
    direction === "up"   ? { d: "M 14 3 L 17 3 L 17 6" } :
    direction === "down" ? { d: "M 14 17 L 17 17 L 17 14" } :
    { d: "M 15 7 L 18 10 L 15 13" };

  return (
    <Svg width={20} height={20}>
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={pathLen}
        animatedProps={animatedProps}
      />
      <Path
        d={tip.d}
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
/*  MetricCard3D — individual 3D metric tile                                   */
/* -------------------------------------------------------------------------- */

const CARD_W = (Dimensions.get("window").width - SP[4] * 2 - SP[3]) / 2;
const CARD_H = CARD_W * 1.2;

function MetricCard3D({
  metric,
  delay,
}: {
  metric: DashboardMetric;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const color      = DIR_COLOR[metric.direction] ?? DIR_COLOR.flat;
  const tier       = getScoreTier(metric.current);
  const label      = METRIC_LABELS[metric.key] ?? metric.key;
  const img        = METRIC_IMAGES[metric.key];
  const placeholder = METRIC_PLACEHOLDER_EMOJI[metric.key] ?? "📊";

  const dirLabel =
    metric.direction === "up"   ? "IMPROVED" :
    metric.direction === "down" ? "DECLINED" : "STABLE";

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.96, { damping: 14, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={animStyle}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.metricTileOuter}>
        {/* 3D base layer */}
        <View style={[styles.metricTileBase, { shadowColor: color }]} />
        {/* Face */}
        <View style={[styles.metricTileFace, { borderTopColor: color }]}>
          <LinearGradient
            colors={["#1E1E1E", "#0F0F0F"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Image area */}
          <View style={styles.metricTileImage}>
            {img ? (
              <Image source={img} style={styles.metricTileImg} resizeMode="cover" />
            ) : (
              <View style={styles.metricTilePlaceholder}>
                <Text style={{ fontSize: 36 }}>{placeholder}</Text>
              </View>
            )}
            {/* Gradient fade over image for text legibility */}
            <LinearGradient
              colors={["rgba(15,15,15,0.70)", "transparent", "rgba(15,15,15,0.80)"]}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Score in top-right */}
            <View style={styles.metricTileScoreBadge}>
              <Text style={[styles.metricTileScore, { color: tier.color }]}>
                {metric.current.toFixed(0)}
              </Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.metricTileName} numberOfLines={1}>{label}</Text>

          {/* Bottom: arrow + tag */}
          <View style={styles.metricTileBottom}>
            <CurvedArrow direction={metric.direction} />
            <View style={[styles.metricDirPill, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
              <Text style={[styles.metricDirText, { color }]}>{dirLabel}</Text>
            </View>
            <Text style={[styles.metricDeltaText, { color }]}>
              {formatDelta(Math.round(metric.delta * 10) / 10)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  OverallCard3D — 8th grid tile showing overall score                        */
/* -------------------------------------------------------------------------- */

function OverallCard3D({
  overall,
  overallDelta,
  verdict,
  delay,
}: {
  overall: DashboardOverall;
  overallDelta: number;
  verdict: string;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = verdict === "improved" ? LIME.primary : verdict === "declined" ? "#EF4444" : "rgba(255,255,255,0.40)";
  const tier  = getScoreTier(overall.current);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        style={styles.metricTileOuter}
      >
        <View style={[styles.metricTileBase, { shadowColor: LIME.primary }]} />
        <View style={[styles.metricTileFace, { borderTopColor: LIME.primary }]}>
          <LinearGradient colors={["#1C2410", "#0F0F0F"]} style={StyleSheet.absoluteFill} />

          {/* Overall score center */}
          <View style={styles.overallCenter}>
            <Text style={styles.overallScoreNum}>{overall.current.toFixed(1)}</Text>
            <View style={[styles.tierPill, { backgroundColor: `${tier.color}18`, borderColor: `${tier.color}50`, marginTop: SP[1] }]}>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>

          <Text style={styles.metricTileName}>Overall</Text>

          <View style={styles.metricTileBottom}>
            <CurvedArrow direction={overallDelta > 0.5 ? "up" : overallDelta < -0.5 ? "down" : "flat"} />
            <Text style={[styles.metricDeltaText, { color: overallDelta >= 0 ? LIME.primary : "#EF4444", fontSize: 13, fontFamily: "Poppins-SemiBold" }]}>
              {formatDelta(Math.round(overallDelta * 10) / 10)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MetricGrid — 2-column 4-row grid of metric tiles                           */
/* -------------------------------------------------------------------------- */

function MetricGrid({
  metrics,
  overall,
  overallDelta,
  verdict,
}: {
  metrics: DashboardMetric[];
  overall: DashboardOverall;
  overallDelta: number;
  verdict: string;
}) {
  return (
    <View style={styles.metricGrid}>
      {metrics.map((m, i) => (
        <MetricCard3D key={m.key} metric={m} delay={280 + i * 45} />
      ))}
      <OverallCard3D
        overall={overall}
        overallDelta={overallDelta}
        verdict={verdict}
        delay={280 + metrics.length * 45}
      />
    </View>
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ScoreRing({
  score,
  size = 148,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0%" stopColor={LIME.primary} />
            <Stop offset="100%" stopColor={LIME.light} />
          </SvgGradient>
        </Defs>
        {/* Glow layer */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={LIME.primary}
          strokeWidth={strokeWidth + 6}
          fill="none"
          opacity={0.08}
        />
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="url(#ringGrad)"
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
/*  MiniGraph — SVG area chart                                                 */
/* -------------------------------------------------------------------------- */

const { width: SCREEN_W } = Dimensions.get("window");
const GRAPH_H = 100;
const GRAPH_W = SCREEN_W - SP[4] * 2 - SP[6] * 2; // full card width minus padding

function MiniGraph({
  points,
  dates,
  width = GRAPH_W,
  height = GRAPH_H,
}: {
  points: number[];
  dates?: string[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const toX = (i: number) => padX + (i / (points.length - 1)) * innerW;
  const toY = (p: number) => padY + (1 - (p - min) / range) * innerH;

  const coords = points.map((p, i) => ({ x: toX(i), y: toY(p) }));
  const polyStr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const firstC = coords[0];
  const lastC = coords[coords.length - 1];
  const fillPath = `M ${firstC.x},${firstC.y} ${coords
    .slice(1)
    .map((c) => `L ${c.x},${c.y}`)
    .join(" ")} L ${lastC.x},${height} L ${firstC.x},${height} Z`;

  // Y-axis guide values
  const mid = (min + max) / 2;

  return (
    <View>
      {/* Y-axis labels */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: "space-between", paddingVertical: padY }]} pointerEvents="none">
        {[max, mid, min].map((v, i) => (
          <Text key={i} style={{ ...TYPE.small, color: "rgba(255,255,255,0.30)", fontSize: 10 }}>
            {v.toFixed(0)}
          </Text>
        ))}
      </View>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={LIME.primary} stopOpacity="0.30" />
            <Stop offset="100%" stopColor={LIME.primary} stopOpacity="0.00" />
          </SvgGradient>
        </Defs>
        {/* Grid lines at 25%, 50%, 75% height */}
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <Line
            key={i}
            x1={padX}
            y1={padY + frac * innerH}
            x2={width - padX}
            y2={padY + frac * innerH}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}
        {/* Fill */}
        <Path d={fillPath} fill="url(#graphFill)" />
        {/* Line */}
        <Polyline
          points={polyStr}
          fill="none"
          stroke={LIME.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* First dot */}
        <Circle cx={firstC.x} cy={firstC.y} r={4} fill={LIME.primary} opacity={0.8} />
        {/* Last dot */}
        <Circle cx={lastC.x} cy={lastC.y} r={5} fill={LIME.primary} />
        <Circle cx={lastC.x} cy={lastC.y} r={9} fill={LIME.primary} opacity={0.15} />
      </Svg>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroCard — delta headline + ring + 2×2 stats + celebration glow          */
/* -------------------------------------------------------------------------- */

function HeroCard({
  overall,
  overallDelta,
  verdict,
  scanCount,
  joinedDaysAgo,
}: {
  overall: DashboardOverall;
  overallDelta: number;
  verdict: string;
  scanCount: number;
  joinedDaysAgo: number;
}) {
  const tier = getScoreTier(overall.current);
  const isImproved = verdict === "improved";
  const deltaColor = overallDelta >= 0 ? LIME.primary : "#EF4444";
  const deltaBg    = overallDelta >= 0 ? "rgba(180,243,77,0.12)" : "rgba(239,68,68,0.12)";
  const deltaBorder = overallDelta >= 0 ? LIME.border : "rgba(239,68,68,0.35)";

  // Celebration pulse on the card border when improved
  const glowOpacity = useSharedValue(isImproved ? 0.35 : 0);
  useEffect(() => {
    if (!isImproved) return;
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [isImproved]);
  const glowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(180,243,77,${glowOpacity.value})`,
  }));

  const stats = [
    { label: "Baseline", value: overall.baseline.toFixed(1), color: COLORS.sub },
    { label: "Best Ever", value: overall.best.toFixed(1),    color: LIME.dim, highlight: overall.current >= overall.best },
    { label: "Days",      value: `${joinedDaysAgo}`,         color: COLORS.sub },
    { label: "Scans",     value: `${scanCount}`,             color: COLORS.sub },
  ];

  return (
    <Animated.View style={[styles.heroGlowBorder, glowStyle]}>
      <GlassCard style={styles.heroCard}>
        {/* ── Delta headline ── */}
        <View style={styles.heroDeltaRow}>
          <View style={[styles.heroDeltaBadge, { backgroundColor: deltaBg, borderColor: deltaBorder }]}>
            <Text style={[styles.heroDeltaText, { color: deltaColor }]}>
              {formatDelta(Math.round(overallDelta * 10) / 10)}
            </Text>
          </View>
          <Text style={styles.heroDeltaLabel}>
            {isImproved ? "improvement since baseline 🎉" : overallDelta < 0 ? "change since baseline" : "no change yet"}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        {/* ── Ring + stats ── */}
        <View style={styles.heroRow}>
          {/* Ring */}
          <View style={styles.heroLeft}>
            <ScoreRing score={overall.current} size={144} strokeWidth={10} />
            <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
              <Text style={styles.heroScore}>{overall.current.toFixed(1)}</Text>
              <Text style={[TYPE.small, { color: LIME.dim, marginTop: -2 }]}>overall</Text>
              <View style={[styles.tierPill, { backgroundColor: `${tier.color}18`, borderColor: `${tier.color}50` }]}>
                <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
              </View>
            </View>
          </View>

          {/* 2×2 stat grid */}
          <View style={styles.heroStatsGrid}>
            {stats.map((s, i) => (
              <View key={i} style={styles.heroStatCell}>
                <Text style={[styles.heroStatValue, s.highlight ? { color: LIME.primary } : {}]}>
                  {s.value}
                  {s.highlight && <Text style={{ fontSize: 10 }}> 🏆</Text>}
                </Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
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
              <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh, flex: 1 }]}>
                {label}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SP[2] }}>
                {/* Score tier pill */}
                <View style={[styles.tierPillSmall, { backgroundColor: `${tier.color}18`, borderColor: `${tier.color}40` }]}>
                  <Text style={[styles.tierTextSmall, { color: tier.color }]}>{tier.label}</Text>
                </View>
                <Text style={[TYPE.captionSemiBold, { color: COLORS.text, minWidth: 32, textAlign: "right" }]}>
                  {metric.current.toFixed(1)}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.30)", fontSize: 13 }}>
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

            {/* Direction badge */}
            <View style={styles.directionRow}>
              <View style={[styles.dirBadge, { borderColor: `${barColor}40`, backgroundColor: `${barColor}12` }]}>
                <Text style={[TYPE.small, { color: barColor, fontSize: 10, fontFamily: "Poppins-SemiBold" }]}>
                  {dirLabel}
                </Text>
              </View>
              <Text style={[TYPE.small, { color: barColor, fontSize: 10 }]}>
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
                  {/* Arrow + delta */}
                  <View style={styles.arrowCol}>
                    <Text style={[styles.arrowText, { color: barColor }]}>
                      {metric.direction === "up" ? "→" : metric.direction === "down" ? "→" : "→"}
                    </Text>
                    <Text style={[styles.arrowDelta, { color: barColor }]}>
                      {formatDelta(metric.delta)}
                    </Text>
                  </View>
                  {/* Current box */}
                  <View style={[styles.afterBox, { borderColor: `${barColor}40`, backgroundColor: `${barColor}08` }]}>
                    <Text style={[styles.afterLabel, { color: barColor }]}>NOW</Text>
                    <Text style={[styles.afterValue, { color: barColor }]}>{metric.current.toFixed(1)}</Text>
                  </View>
                  {/* Best Ever */}
                  <View style={styles.bestBox}>
                    <Text style={styles.beforeLabel}>BEST</Text>
                    <Text style={[styles.beforeValue, metric.current >= metric.best ? { color: LIME.primary } : {}]}>
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
                            <Text style={[TYPE.caption, { color: COLORS.muted, flex: 1 }]}>
                              {item.label}
                            </Text>
                            {score !== null && (
                              <Text style={[TYPE.captionSemiBold, { color: COLORS.text, marginRight: SP[2] }]}>
                                {score.toFixed(1)}
                              </Text>
                            )}
                            {tag && (
                              <View style={[styles.tagPill, { borderColor: `${tag.color}40`, backgroundColor: `${tag.color}15` }]}>
                                <Text style={[TYPE.small, { color: tag.color, fontSize: 9, fontFamily: "Poppins-SemiBold" }]}>
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
        style={{ borderRadius: 28, overflow: "hidden" }}
      >
        <Animated.View style={[{ borderRadius: 28 }, animStyle]}>
          <LinearGradient
            colors={["#CCFF6B", "#B4F34D"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.btn3dFace}
          >
            <Text style={[TYPE.button, { color: "#0B0B0B" }]}>{label}</Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
      <View style={styles.btn3dBase} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  State screens: Loading / Error / Empty                                     */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <View style={styles.centeredState}>
      <Text style={[TYPE.body, { color: COLORS.muted, textAlign: "center" }]}>
        Loading your progress…
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.centeredState}>
      <Text style={[TYPE.body, { color: COLORS.error, textAlign: "center", marginBottom: SP[2] }]}>
        Couldn't load data
      </Text>
      <Text style={[TYPE.caption, { color: COLORS.muted, textAlign: "center" }]}>
        {message}
      </Text>
    </View>
  );
}

function EmptyState({ router }: { router: ReturnType<typeof useRouter> }) {
  const btnDepth = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: btnDepth.value }],
  }));

  return (
    <View style={styles.centeredState}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={[TYPE.h3, { color: COLORS.text, textAlign: "center", marginBottom: SP[2] }]}>
          Track Your Progress
        </Text>
        <Text style={[TYPE.body, { color: COLORS.muted, textAlign: "center", marginBottom: SP[6] }]}>
          You need at least 2 scans to see your progress dashboard.
        </Text>
        <View style={styles.btn3dOuter}>
          <Pressable
            onPress={() => router.push("/(tabs)/take-picture")}
            onPressIn={() => { btnDepth.value = withSpring(4, { damping: 14, stiffness: 300 }); }}
            onPressOut={() => { btnDepth.value = withSpring(0, { damping: 14, stiffness: 300 }); }}
            style={{ borderRadius: 28, overflow: "hidden" }}
          >
            <Animated.View style={[{ borderRadius: 28 }, animStyle]}>
              <LinearGradient
                colors={["#CCFF6B", "#B4F34D"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.btn3dFace}
              >
                <Text style={[TYPE.button, { color: "#0B0B0B" }]}>Take First Scan</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
          <View style={styles.btn3dBase} />
        </View>
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
  const { data, loading, error, loadInsights } = useInsights();
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const advancedData = useAdvancedAnalysis((s) => s.data);

  useEffect(() => {
    loadInsights();
  }, []);

  const onRefresh = useCallback(() => {
    loadInsights(true);
  }, [loadInsights]);

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
  const latestAdvanced   = data?.latest_advanced ?? null;
  const previousAdvanced = data?.previous_advanced ?? null;

  // Overall delta
  const overallDelta = content?.overall_delta ?? 0;
  const verdict = content?.verdict ?? "same";

  // Render body
  const renderBody = () => {
    if (loading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} />;
    if (scanCount < 2) return <EmptyState router={router} />;

    return (
      <>
        {/* ── Section 2: Hero Score Card ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)}>
          <HeroCard
            overall={overall!}
            overallDelta={overallDelta}
            verdict={verdict}
            scanCount={scanCount}
            joinedDaysAgo={joinedDaysAgo}
          />
        </Animated.View>

        {/* ── Section 3: Score Trend ── */}
        {graphPoints.length >= 2 && (
          <Animated.View entering={FadeInDown.delay(180).duration(450)}>
            <GlassCard style={styles.trendCard}>
              {/* Header */}
              <View style={styles.trendHeader}>
                <Text style={[TYPE.captionSemiBold, { color: COLORS.textHigh }]}>
                  Score Trend
                </Text>
                {graphDates.length >= 2 && (
                  <Text style={[TYPE.small, { color: COLORS.sub }]}>
                    {formatDate(graphDates[0])} → {formatDate(graphDates[graphDates.length - 1])}
                  </Text>
                )}
              </View>
              {/* Chart */}
              <View style={styles.trendChart}>
                <MiniGraph points={graphPoints} dates={graphDates} />
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Section 4: Metric Breakdown title ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={[TYPE.h4, { color: COLORS.text, marginBottom: SP[1], marginTop: SP[2] }]}>
            Metric Breakdown
          </Text>
          <Text style={[TYPE.small, { color: COLORS.sub, marginBottom: SP[3] }]}>
            7 facial metrics · tap a card to see sub-metrics below
          </Text>
        </Animated.View>

        {/* ── Section 5: Metric grid 2×4 ── */}
        {overall && (
          <MetricGrid
            metrics={metrics}
            overall={overall}
            overallDelta={overallDelta}
            verdict={verdict}
          />
        )}

        {/* ── Section 6: AI Coach ── */}
        {content && (
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
                {content.narrative}
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Section 7: Advanced Analysis collapsible ── */}
        <Animated.View entering={FadeInDown.delay(620).duration(450)}>
          <AdvancedSection
            latestAdvanced={latestAdvanced}
            previousAdvanced={previousAdvanced}
          />
        </Animated.View>

        {/* ── Section 8: Scan History collapsible ── */}
        <Animated.View entering={FadeInDown.delay(680).duration(450)}>
          <ScanHistorySection history={history} />
        </Animated.View>

        {/* ── Section 9: New Scan CTA ── */}
        <Animated.View entering={FadeInDown.delay(740).duration(450)} style={styles.ctaContainer}>
          <LimeButton3D
            label="New Scan"
            onPress={() => router.push("/(tabs)/take-picture")}
          />
        </Animated.View>
      </>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#000000", "#0B0B0B"]}
        style={StyleSheet.absoluteFill}
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
        {/* ── Section 1: Header ── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.h2, { color: COLORS.text }]}>Progress</Text>
            <Text style={[TYPE.small, { color: COLORS.sub, marginTop: 2 }]}>
              {scanCount} {scanCount === 1 ? "scan" : "scans"} · {joinedDaysAgo}d tracked
            </Text>
          </View>
          {currentStreak > 0 && (
            <View style={styles.streakPill}>
              <Text style={[TYPE.smallSemiBold, { color: "#FB923C" }]}>
                🔥 {currentStreak}
              </Text>
            </View>
          )}
        </Animated.View>

        {renderBody()}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },

  scrollContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    gap: SP[3],
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SP[1],
  },

  streakPill: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(251,146,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.30)",
  },

  /* Glass card */
  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    ...SHADOWS.card,
  },

  cardInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADII.card,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  cardAccentLeft: {
    position: "absolute",
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    backgroundColor: LIME.primary,
    borderRadius: 2,
  },

  /* Hero card */
  heroGlowBorder: {
    borderRadius: RADII.card + 2,
    borderWidth: 1.5,
    borderColor: "rgba(180,243,77,0.35)",
  },
  heroCard: {
    padding: SP[5],
    borderWidth: 0, // border handled by heroGlowBorder
  },
  heroDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[3],
  },
  heroDeltaBadge: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  heroDeltaText: {
    fontSize: 22,
    fontFamily: "Poppins-Bold",
    lineHeight: 28,
  },
  heroDeltaLabel: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.50)",
    flex: 1,
    flexWrap: "wrap" as const,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: SP[4],
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  heroLeft: {
    alignItems: "center",
    justifyContent: "center",
    width: 144,
    height: 144,
  },
  heroScore: {
    fontSize: 34,
    fontFamily: "Poppins-Bold",
    color: COLORS.text,
    lineHeight: 38,
  },
  tierPill: {
    marginTop: SP[1],
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 9,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.6,
  },
  heroStatsGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap" as const,
    gap: SP[2],
  },
  heroStatCell: {
    width: "46%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    gap: 2,
  },
  heroStatValue: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  heroStatLabel: {
    ...TYPE.small,
    color: COLORS.sub,
    fontSize: 11,
  },

  /* Metric grid */
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
  },

  /* Metric 3D tile */
  metricTileOuter: {
    width: CARD_W,
    height: CARD_H,
    position: "relative",
  },
  metricTileBase: {
    position: "absolute",
    bottom: -4,
    left: 4,
    right: 4,
    height: CARD_H,
    borderRadius: RADII.xl,
    backgroundColor: "#0A0A0A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  metricTileFace: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADII.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderTopWidth: 2,
    borderTopColor: LIME.primary, // overridden per card
    justifyContent: "flex-end",
  },
  metricTileImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  metricTileImg: {
    width: "100%",
    height: "100%",
  },
  metricTilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  metricTileScoreBadge: {
    position: "absolute",
    top: SP[2],
    right: SP[2],
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADII.md,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
  },
  metricTileScore: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
  },
  metricTileName: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    paddingHorizontal: SP[3],
    paddingTop: SP[2],
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metricTileBottom: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[3],
    paddingBottom: SP[3],
    paddingTop: SP[1],
    gap: SP[1],
  },
  metricDirPill: {
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  metricDirText: {
    fontSize: 8,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
  },
  metricDeltaText: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },

  /* Overall card center */
  overallCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overallScoreNum: {
    fontSize: 32,
    fontFamily: "Poppins-Bold",
    color: LIME.primary,
    lineHeight: 36,
  },

  /* Trend card */
  trendCard: {
    padding: SP[5],
  },

  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SP[3],
  },

  trendChart: {
    overflow: "hidden",
    borderRadius: RADII.md,
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
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  tierTextSmall: {
    fontSize: 8,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: SP[2],
    position: "relative" as const,
    overflow: "visible" as const,
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  baselineTick: {
    position: "absolute" as const,
    top: -3,
    width: 2,
    height: 11,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.50)",
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    paddingVertical: SP[2],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  arrowCol: {
    alignItems: "center" as const,
    gap: 1,
  },
  arrowText: {
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  arrowDelta: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
  },
  afterBox: {
    flex: 1,
    alignItems: "center" as const,
    borderRadius: RADII.md,
    paddingVertical: SP[2],
    borderWidth: 1,
  },
  bestBox: {
    flex: 1,
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    paddingVertical: SP[2],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  beforeLabel: {
    fontSize: 8,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  beforeValue: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  afterLabel: {
    fontSize: 8,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  afterValue: {
    ...TYPE.captionSemiBold,
  },
  miniBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden" as const,
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 2,
    opacity: 0.75,
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
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: SP[3],
  },

  statBoxRow: {
    flexDirection: "row",
    gap: SP[3],
  },

  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    paddingVertical: SP[3],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  subMetricRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  tagPill: {
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
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
    borderRadius: RADII.pill,
    borderWidth: 1,
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
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  scoreChip: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.md,
    borderWidth: 1,
  },

  /* 3D button */
  ctaContainer: {
    marginTop: SP[3],
    marginBottom: SP[2],
  },

  btn3dOuter: {
    position: "relative",
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
    ...SHADOWS.primaryBtn,
  },

  btn3dFace: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  },

  btn3dBase: {
    position: "absolute",
    bottom: -4,
    left: 0,
    right: 0,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6B9A1E",
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
