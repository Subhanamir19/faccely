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
import { TrendingUp } from "lucide-react-native";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII, TYPE, SHADOWS } from "@/lib/tokens";
import { useInsights } from "@/store/insights";
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

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/* -------------------------------------------------------------------------- */
/*  Design tokens — lime palette                                               */
/* -------------------------------------------------------------------------- */

const LIME = {
  primary: COLORS.accent,
  light:   COLORS.accentLight,
  dark:    COLORS.accentDepth,
  dim:     "rgba(180,243,77,0.60)",   // 60% accent — no exact token
  glow:    COLORS.accentGlow,
  border:  COLORS.accentBorder,
  bg:      "rgba(180,243,77,0.10)",   // 10% accent — no exact token
  track:   "rgba(180,243,77,0.15)",   // 15% accent — no exact token
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
  facial_symmetry:   require("@/assets/TASK-ICONS/symmetry.png"),
  nose_harmony:      require("@/assets/TASK-ICONS/nosse.png"),
  sexual_dimorphism: null,
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

  // --- DIAGNOSTIC LOGS (remove after debugging) ---
  console.log("[MetricDetailSheet] opened for metric:", metric.key);
  console.log("[MetricDetailSheet] latestAdvanced:", latestAdvanced ? JSON.stringify(latestAdvanced) : "NULL");
  console.log("[MetricDetailSheet] subMap:", subMap ? `groupKey=${subMap.groupKey}` : "NO_SUBMAP (metric has no sub-metrics)");
  console.log("[MetricDetailSheet] advGroup:", advGroup ? "FOUND" : "NULL", "→", advGroup ? JSON.stringify(advGroup) : "will show empty state");
  // -------------------------------------------------

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
            <View style={[styles.tierPill, { backgroundColor: `${tier.color}18`, borderColor: `${tier.color}40`, alignSelf: "flex-start" }]}>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={styles.sheetCloseBtn} hitSlop={12}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, lineHeight: 20 }}>✕</Text>
          </Pressable>
        </View>

        {/* Score comparison row */}
        <View style={styles.sheetScoreRow}>
          <View style={styles.sheetScoreBox}>
            <Text style={styles.sheetScoreLabel}>BASELINE</Text>
            <Text style={styles.sheetScoreValue}>{metric.baseline.toFixed(1)}</Text>
          </View>
          <View style={styles.sheetScoreArrow}>
            <Text style={[styles.sheetScoreDelta, { color: barColor }]}>{formatDelta(metric.delta)}</Text>
            <Text style={{ color: barColor, fontSize: 16, lineHeight: 18 }}>→</Text>
          </View>
          <View style={[styles.sheetScoreBox, { borderColor: `${barColor}50`, backgroundColor: `${barColor}12` }]}>
            <Text style={[styles.sheetScoreLabel, { color: barColor }]}>NOW</Text>
            <Text style={[styles.sheetScoreValue, { color: barColor }]}>{metric.current.toFixed(1)}</Text>
          </View>
          <View style={styles.sheetScoreBox}>
            <Text style={styles.sheetScoreLabel}>BEST</Text>
            <Text style={[styles.sheetScoreValue, metric.current >= metric.best ? { color: LIME.primary } : {}]}>
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
                dir === "up"   ? LIME.primary :
                dir === "down" ? "#EF4444"    : "rgba(255,255,255,0.70)";

              return (
                <View key={item.key} style={styles.sheetSubRow}>
                  <ZigzagArrow direction={dir} color={arrowColor} />
                  <Text style={styles.sheetSubLabel}>{item.label}</Text>
                  {score !== null && tag && (
                    <View style={styles.sheetSubBarWrap}>
                      <View style={[styles.sheetSubBarFill, { width: `${Math.min(100, score)}%` as any, backgroundColor: tag.color }]} />
                    </View>
                  )}
                  {tag && (
                    <View style={[styles.subTag3dBase, { backgroundColor: `${tag.color}55` }]}>
                      <View style={[styles.subTag3dFace, { backgroundColor: tag.color }]}>
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
            colors={["#FFFFFF", "#E8E8E8"]}
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
  const filtered = metrics.filter((m) => m.key !== "sexual_dimorphism");
  const [selected, setSelected] = useState<DashboardMetric | null>(null);

  return (
    <>
      <View style={styles.metricGrid}>
        {filtered.map((m, i) => (
          <MetricCard3D
            key={m.key}
            metric={m}
            delay={260 + i * 50}
            onPress={() => setSelected(m)}
          />
        ))}
      </View>

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
  const glowColor  = light ? "rgba(0,0,0,0.18)" : LIME.primary;
  const trackColor = light ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.08)";
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

/* Regular dot — springs in with stagger */
function GraphDot({
  cx,
  cy,
  delay,
}: {
  cx: number;
  cy: number;
  delay: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 200 }));
  }, []);
  const dotProps = useAnimatedProps(() => ({ r: 3.5 * anim.value, opacity: anim.value }));
  return (
    <AnimatedCircle cx={cx} cy={cy} fill="#000" stroke={LIME.primary} strokeWidth={1.5} animatedProps={dotProps} />
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
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="3,5"
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
          fontWeight="600"
          fill="rgba(255,255,255,0.35)"
          textAnchor="start"
        >
          {score}
        </SvgText>
      ))}

      {/* Regular dots — stagger in alongside the line draw */}
      {coords.slice(0, -1).map((c, i) => (
        <GraphDot
          key={i}
          cx={c.x}
          cy={c.y}
          delay={Math.round((i / (coords.length - 1)) * 1300 + 120)}
        />
      ))}

      {/* Last dot — always visible, pulsing */}
      <LastDot cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  HeroCard — side-by-side: ring left, score info right                      */
/* -------------------------------------------------------------------------- */

function HeroCard({
  overall,
  overallDelta,
  verdict,
  scanCount,
  joinedDaysAgo,
  userName,
}: {
  overall: DashboardOverall;
  overallDelta: number;
  verdict: string;
  scanCount: number;
  joinedDaysAgo: number;
  userName: string;
}) {
  const isImproved = verdict === "improved";
  const deltaColor = overallDelta >= 0 ? LIME.primary : "#EF4444";

  // Count-up animations — UI-thread driven via Reanimated shared values
  const scoreVal    = useSharedValue(0);
  const deltaVal    = useSharedValue(0);
  const baselineVal = useSharedValue(0);
  const bestVal     = useSharedValue(0);

  useEffect(() => {
    scoreVal.value    = 0;
    deltaVal.value    = 0;
    baselineVal.value = 0;
    bestVal.value     = 0;
    const cfg = { duration: 1400, easing: Easing.out(Easing.cubic) };
    scoreVal.value    = withTiming(overall.current,         cfg);
    deltaVal.value    = withDelay(100, withTiming(Math.abs(overallDelta), cfg));
    baselineVal.value = withDelay(200, withTiming(overall.baseline,       cfg));
    bestVal.value     = withDelay(300, withTiming(overall.best,           cfg));
  }, [overall.current, overallDelta, overall.baseline, overall.best]);

  const scoreProps    = useAnimatedProps(() => ({ text: String(Math.round(scoreVal.value)),    defaultValue: "" } as any));
  const deltaProps    = useAnimatedProps(() => ({ text: `${overallDelta >= 0 ? "+" : "-"}${deltaVal.value.toFixed(1)}`, defaultValue: "" } as any));
  const baselineProps = useAnimatedProps(() => ({ text: baselineVal.value.toFixed(1), defaultValue: "" } as any));
  const bestProps     = useAnimatedProps(() => ({ text: bestVal.value.toFixed(1),     defaultValue: "" } as any));

  // Pulsing lime glow when improved
  const glowOpacity = useSharedValue(isImproved ? 0.4 : 0);
  useEffect(() => {
    if (!isImproved) return;
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, [isImproved]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  // On lime background, positive delta uses dark ink; negative keeps a dark red
  const darkDeltaColor = overallDelta >= 0 ? "#0F2800" : "#7F0000";

  return (
    <Animated.View style={[styles.heroBase, glowStyle]}>
      <View style={styles.heroFace}>
        <LinearGradient
          colors={[LIME.light, LIME.primary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Side-by-side row */}
        <View style={styles.heroRow}>

          {/* Left column — ring (light variant: dark arc on lime bg) */}
          <View style={styles.heroRingCol}>
            <ScoreRing score={overall.current} size={148} strokeWidth={11} light />
            <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
              <AnimatedTextInput
                animatedProps={scoreProps}
                editable={false}
                style={[styles.heroScoreBig, { color: "#0F0F0F", padding: 0 }]}
              />
              <Text style={[styles.heroScoreLabel, { color: "rgba(0,0,0,0.50)" }]}>OVERALL</Text>
            </View>
          </View>

          {/* Right column — info */}
          <View style={styles.heroInfoCol}>
            <Text style={[styles.heroInfoTitle, { color: "rgba(0,0,0,0.55)" }]}>{userName}'s Progress</Text>

            {/* Delta line */}
            <View style={styles.heroDeltaRow}>
              <AnimatedTextInput
                animatedProps={deltaProps}
                editable={false}
                style={[styles.heroDeltaNum, { color: darkDeltaColor, padding: 0 }]}
              />
              <Text style={[styles.heroDeltaSince, { color: "rgba(0,0,0,0.55)" }]}> since Day 1</Text>
            </View>

            {/* Stat boxes — 2 col grid */}
            <View style={styles.heroStatGrid}>
              <View style={[styles.heroStatBox, { backgroundColor: "rgba(0,0,0,0.12)", borderColor: "rgba(0,0,0,0.10)" }]}>
                <Text style={[styles.heroStatLabel, { color: "rgba(0,0,0,0.50)" }]}>DAY 1 SCORE</Text>
                <AnimatedTextInput
                  animatedProps={baselineProps}
                  editable={false}
                  style={[styles.heroStatValue, { color: "#0F0F0F", padding: 0 }]}
                />
              </View>
              <View style={[styles.heroStatBox, { backgroundColor: "rgba(0,0,0,0.12)", borderColor: "rgba(0,0,0,0.10)" }]}>
                <Text style={[styles.heroStatLabel, { color: "rgba(0,0,0,0.50)" }]}>BEST EVER</Text>
                <AnimatedTextInput
                  animatedProps={bestProps}
                  editable={false}
                  style={[styles.heroStatValue, { color: "#0F0F0F", padding: 0 }]}
                />
              </View>
            </View>
          </View>

        </View>
      </View>
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

function EmptyState({
  router,
  scanCount,
  scanLoading,
  scanFailed,
}: {
  router: ReturnType<typeof useRouter>;
  scanCount: number;
  scanLoading: boolean;
  scanFailed: boolean;
}) {
  const btnDepth = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: btnDepth.value }],
  }));

  // Determine copy based on state
  const title = (() => {
    if (scanLoading) return "Analyzing Your Scan…";
    if (scanFailed)  return "Scan Didn't Complete";
    if (scanCount === 1) return "One More Scan Needed";
    return "Take Your First Scan";
  })();

  const body = (() => {
    if (scanLoading) return "Your first scan is being processed. This takes about 30 seconds.";
    if (scanFailed)  return "Your initial scan didn't save. Take a new scan to get your baseline score.";
    if (scanCount === 1) return "You're one scan away from unlocking your progress dashboard.";
    return "Scan your face to get your baseline score and start tracking progress.";
  })();

  const btnLabel = (() => {
    if (scanLoading) return null; // no button while processing
    if (scanCount === 1) return "Scan Again";
    return "Scan Now";
  })();

  return (
    <View style={styles.centeredState}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={[TYPE.h3, { color: COLORS.text, textAlign: "center", marginBottom: SP[2] }]}>
          {title}
        </Text>
        <Text style={[TYPE.body, { color: COLORS.muted, textAlign: "center", marginBottom: SP[6] }]}>
          {body}
        </Text>
        {btnLabel && (
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
                  <Text style={[TYPE.button, { color: "#0B0B0B" }]}>{btnLabel}</Text>
                </LinearGradient>
              </Animated.View>
            </Pressable>
            <View style={styles.btn3dBase} />
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
  const { data, loading, error, isDirty, loadInsights, invalidate, pollUntilInsight, pollUntilAdvanced } = useInsights();
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const advancedData = useAdvancedAnalysis((s) => s.data);
  const authUser = useAuthStore((s) => s.user);
  const displayName = useProfile((s) => s.displayName);
  const scanLoading = useScores((s) => s.loading);
  const scanError   = useScores((s) => s.error);

  // Derive first name: prefer user-set display name, then auth fields, then email prefix
  const userName = (() => {
    if (displayName) return displayName;
    const raw =
      (authUser as any)?.fullName ||
      (authUser as any)?.firstName ||
      (authUser as any)?.name ||
      (authUser as any)?.email ||
      "";
    if (!raw) return "there";
    const first = raw.split(/[@\s]/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  })();

  useFocusEffect(
    useCallback(() => {
      if (isDirty) {
        console.log("[dashboard] focused — isDirty=true, calling loadInsights()");
        loadInsights();
      } else {
        console.log("[dashboard] focused — data is fresh, skipping fetch");
      }
    }, [loadInsights, isDirty])
  );

  // When scan_count >= 2 but insight hasn't generated yet, poll until it arrives
  useEffect(() => {
    if (data && data.scan_count >= 2 && data.insight === null) {
      return pollUntilInsight();
    }
  }, [data?.scan_count, data?.insight]);

  // Fix C: When latest_advanced is null but we have scans, poll until it appears.
  // Covers the case where the user is already on the dashboard when advanced analysis finishes.
  useEffect(() => {
    if (data && data.scan_count >= 1 && data.latest_advanced === null) {
      const cancel = pollUntilAdvanced();
      return cancel;
    }
  }, [data?.scan_count, data?.latest_advanced]);

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
  const latestAdvanced   = data?.latest_advanced ?? null;
  const previousAdvanced = data?.previous_advanced ?? null;

  // Overall delta — use AI content when available, fall back to raw scan math
  const overallDelta = content?.overall_delta
    ?? (overall ? Math.round((overall.current - overall.baseline) * 10) / 10 : 0);
  const verdict: "improved" | "same" | "declined" = content?.verdict
    ?? (overallDelta > 1.5 ? "improved" : overallDelta < -1.5 ? "declined" : "same");

  // Render body
  const renderBody = () => {
    if (loading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} />;
    if (scanCount < 2) return (
      <EmptyState
        router={router}
        scanCount={scanCount}
        scanLoading={scanLoading}
        scanFailed={!scanLoading && !!scanError && scanCount === 0}
      />
    );

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
            userName={userName}
          />
        </Animated.View>

        {/* ── Section 3: Progress Over Time ── */}
        {graphPoints.length >= 2 && (
          <Animated.View entering={FadeInDown.delay(180).duration(450)}>
            <View style={styles.trendBase}>
              <View style={styles.trendFace}>
                <LinearGradient colors={["#1C1C1C", "#0F0F0F"]} style={StyleSheet.absoluteFill} />

                {/* Header row: title+subtitle left, filter pill right */}
                <View style={styles.trendHeader}>
                  <View>
                    <Text style={styles.trendTitle}>Progress Over Time</Text>
                    <Text style={styles.trendSubtitle}>
                      {scanCount} {scanCount === 1 ? "scan" : "scans"} · {joinedDaysAgo} days
                    </Text>
                  </View>
                  <View style={styles.trendFilterPill}>
                    <Text style={styles.trendFilterText}>Overall</Text>
                  </View>
                </View>

                <MiniGraph points={graphPoints} height={120} />

                {/* Day labels pinned bottom */}
                <View style={styles.trendDayLabels}>
                  <Text style={styles.trendDayLabel}>DAY 1</Text>
                  <Text style={styles.trendDayLabel}>TODAY</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Section 4: Metric Breakdown title ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={[TYPE.h4, { color: COLORS.text, marginBottom: SP[1], marginTop: SP[2] }]}>
            Metric Breakdown
          </Text>
          <Text style={[TYPE.small, { color: COLORS.sub, marginBottom: SP[3] }]}>
            7 facial metrics · tap a card for a detailed breakdown
          </Text>
        </Animated.View>

        {/* ── Section 5: Metric grid 2×4 ── */}
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
                {content.narrative}
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
            <Text style={styles.headerWelcome}>WELCOME BACK!</Text>
            <Text style={styles.headerName}>{userName}</Text>
          </View>
          {/* 3D streak pill — depth base peeks below the face */}
          <View style={styles.streakPillBase}>
            <View style={styles.streakPillFace}>
              <Text style={styles.streakText}>🔥 {currentStreak} day streak</Text>
            </View>
          </View>
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
  headerWelcome: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerName: {
    fontSize: 30,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    lineHeight: 34,
  },

  streakPillBase: {
    borderRadius: RADII.pill,
    backgroundColor: "#7A2E00",   // burnt-orange depth — the "shadow" base
    paddingBottom: 3,
  },
  streakPillFace: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.40)",
  },
  streakText: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "#FB923C",
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

  /* Hero card — lime gradient, matches metric cards */
  heroBase: {
    borderRadius: RADII.card,
    backgroundColor: LIME.dark,
    paddingBottom: 6,
    shadowColor: LIME.primary,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  heroFace: {
    borderRadius: RADII.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[5],
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  heroRingCol: {
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfoCol: {
    flex: 1,
    gap: SP[2],
  },
  heroInfoTitle: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.45)",
  },
  heroDeltaRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  heroDeltaNum: {
    fontSize: 28,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 32,
  },
  heroDeltaSince: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.50)",
  },
  heroStatGrid: {
    flexDirection: "row",
    gap: SP[2],
    marginTop: SP[1],
  },
  heroStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: SP[3],
    paddingHorizontal: SP[2],
    alignItems: "center",
  },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.8,
    marginBottom: SP[1],
  },
  heroStatValue: {
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    lineHeight: 26,
  },
  heroScoreBig: {
    fontSize: 40,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    lineHeight: 44,
  },
  heroScoreLabel: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 1.2,
    marginTop: -2,
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
  /* Metric grid — 2 columns */
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
  },

  /* Metric card — compact 3D half-width card */
  metricRowBase: {
    width: METRIC_COL_W,
    borderRadius: RADII.xl,
    backgroundColor: "#B0B0B0",
    paddingBottom: METRIC_DEPTH,
    shadowColor: "#ffffff",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  metricRowFace: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADII.xl,
    overflow: "hidden",
    paddingHorizontal: SP[2],
    paddingVertical: SP[2],
    gap: SP[2],
  },
  metricRowThumb: {
    width: 42,
    height: 42,
    borderRadius: RADII.md,
    overflow: "hidden",
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
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: RADII.md,
  },
  metricRowInfo: {
    flex: 1,
    gap: 1,
  },
  metricRowName: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: "#0F0F0F",
  },
  metricRowTier: {
    fontSize: 9,
    fontFamily: "Poppins-Medium",
    color: "rgba(0,0,0,0.55)",
  },
  metricRowArrowBtn: {
    backgroundColor: "#0F0F0F",
    borderRadius: RADII.md,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  metricRowArrowLabel: {
    fontSize: 9,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.4,
  },
  metricRowScoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  metricRowScoreText: {
    fontSize: 11,
    fontFamily: "Poppins-Bold",
    color: "#0F0F0F",
  },

  /* Metric detail bottom sheet */
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#141414",
    borderTopLeftRadius: RADII.card,
    borderTopRightRadius: RADII.card,
    paddingHorizontal: SP[5],
    paddingBottom: SP[8] ?? 32,
    paddingTop: SP[3],
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
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
    width: 60,
    height: 60,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sheetMetricName: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sheetScoreLabel: {
    fontSize: 8,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sheetScoreValue: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
  },
  sheetScoreArrow: {
    alignItems: "center",
    gap: 2,
  },
  sheetScoreDelta: {
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
  },
  sheetSubList: {
    gap: SP[3],
  },
  sheetSubRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[2],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetSubLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins-Medium",
    color: "rgba(255,255,255,0.70)",
  },
  sheetSubScore: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
    marginRight: SP[2],
  },
  sheetNoSub: {
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    color: "rgba(255,255,255,0.40)",
    textAlign: "center",
    paddingVertical: SP[4],
  },

  /* Sub-metric progress bar */
  sheetSubBarWrap: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: SP[3],
    overflow: "hidden",
  },
  sheetSubBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* 3D sub-metric tag pill */
  subTag3dBase: {
    borderRadius: RADII.pill,
    paddingBottom: 3,
  },
  subTag3dFace: {
    borderRadius: RADII.pill,
    paddingHorizontal: SP[3],
    paddingVertical: 4,
  },
  subTag3dText: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    color: "#0F0F0F",
    letterSpacing: 0.3,
  },

  /* Trend card — 3D treatment */
  trendBase: {
    borderRadius: RADII.card,
    backgroundColor: "#0A0A0A",
    paddingBottom: 5,
    shadowColor: LIME.primary,
    shadowOpacity: 0.20,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  trendFace: {
    borderRadius: RADII.card,
    overflow: "hidden",
    borderTopWidth: 2,
    borderTopColor: LIME.primary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
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
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
    color: "#FFFFFF",
  },
  trendSubtitle: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.40)",
    marginTop: 2,
  },
  trendFilterPill: {
    backgroundColor: "#1E1E1E",
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  trendFilterText: {
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    color: LIME.primary,
  },
  trendDayLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SP[2],
  },
  trendDayLabel: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    color: "rgba(255,255,255,0.30)",
    letterSpacing: 0.8,
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
