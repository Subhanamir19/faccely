import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from "react-native-svg";
import { ArrowLeft, CalendarClock, Camera, ChevronDown, ChevronRight, Lock, X } from "lucide-react-native";

import Text from "@/components/ui/T";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import type { LatestAdvanced } from "@/lib/api/insights";
import {
  getAdvancedAnalysisIcon,
  getAdvancedAnalysisIconStyle,
} from "@/lib/advancedAnalysisIcons";
import {
  selectNextFocusRecommendations,
  type NextFocusRecommendation,
} from "@/lib/nextFocusRecommendations";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useInsights } from "@/store/insights";

const FONT = "DINNextRounded-Regular";
const FONT_BOLD = "DINNextRounded-Bold";

const BG = "#FFFFFF";
const INK = "#171512";
const MUTED = "#736E67";
const GREEN = "#4CD400";
const GREEN_DARK = "#3CAD00";
const BLUE = "#16A7E4";
const ORANGE = "#F27B00";
const GROUPED_SURFACE = "#F7F6F3";
const CARD_BORDER = "rgba(23,21,18,0.09)";
const GRAPH_EASE = Easing.bezier(0.77, 0, 0.175, 1);

const AXIS = "rgba(23,21,18,0.12)";
const NEXT_MARKER = "#B9B4AC";

const FALLBACK_ICON = require("../../assets/icons/next-foucs.png");
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Trajectory model: the projection runs 8 weeks past the latest scan and lands
// on current score + the gains from the top focus metrics, capped at +10.
const DAY_MS = 86_400_000;
const CHECK_IN_DAYS = 7;
const PROJECTION_DAYS = 56;
const MAX_TARGET_GAIN = 10;
const QUICK_WIN_COUNT = 3;

// Chart box padding: the top leaves room for the target bubble.
const CHART_H = 196;
const PAD_T = 54;
const PAD_B = 14;
const PAD_L = 12;
const PAD_R = 16;

const FOCUS_IMAGE_BG = "#E9FFD9";
const PROBLEM_IMAGE_BG = "#FFE3E0";
const PROBLEM_RED = "#EF4444";

type ProblemMetric = {
  id: string;
  rank: number;
  title: string;
  evidence: string;
  score: number;
  reason: string;
  action: string;
  iconId: string;
};

type SheetMetric = NextFocusRecommendation | ProblemMetric;

type ChartPoint = {
  x: number;
  y: number;
};

type FocusTab = "wins" | "weak";

type FocusIconMeta = {
  iconId: string;
  tint: string;
};

const FOCUS_ICON_MAP: Record<string, FocusIconMeta> = {
  "testosterone-support": { iconId: "jawline.development", tint: "#EBF7FF" },
  "control-estrogen-signals": { iconId: "cheekbones.face_fat", tint: "#FFF2D7" },
  "igf1-support": { iconId: "cheekbones.bone_structure", tint: "#EAF7E2" },
  "release-fascia": { iconId: "eyes.symmetry", tint: "#EFF5FF" },
  "neck-thickness": { iconId: "jawline.ramus", tint: "#EAF7E2" },
  "zygomatic-prominence": { iconId: "cheekbones.width", tint: "#EBF7FF" },
  "orbicularis-oculi": { iconId: "eyes.eye_type", tint: "#EFF5FF" },
  "eye-asymmetry": { iconId: "eyes.symmetry", tint: "#EFF5FF" },
  coloring: { iconId: "skin.color", tint: "#FFF2D7" },
  "release-body-fat": { iconId: "cheekbones.face_fat", tint: "#FFF2D7" },
  "gut-clearance": { iconId: "skin.quality", tint: "#EAF7E2" },
  "masseter-strength": { iconId: "jawline.development", tint: "#EAF7E2" },
  "forward-growth": { iconId: "cheekbones.maxilla", tint: "#EBF7FF" },
  eyebrows: { iconId: "eyes.brow_volume", tint: "#EFF5FF" },
  "hairstyle-adjustment": { iconId: "haircut.styling", tint: "#FFF2D7" },
  fwhr: { iconId: "cheekbones.fwhr", tint: "#EBF7FF" },
  harmony: { iconId: "cheekbones.bone_structure", tint: "#EAF7E2" },
  puffiness: { iconId: "cheekbones.face_fat", tint: "#FFF2D7" },
  "skin-texture": { iconId: "skin.quality", tint: "#EAF7E2" },
  deblot: { iconId: "cheekbones.face_fat", tint: "#FFF2D7" },
  "train-structure": { iconId: "cheekbones.bone_structure", tint: "#EAF7E2" },
  "dry-lips": { iconId: "skin.quality", tint: "#EAF7E2" },
  "nose-fat": { iconId: "cheekbones.face_fat", tint: "#FFF2D7" },
  "cortisol-control": { iconId: "skin.quality", tint: "#EAF7E2" },
  "bone-mass": { iconId: "cheekbones.bone_structure", tint: "#EAF7E2" },
  angularity: { iconId: "jawline.gonial_angle", tint: "#EAF7E2" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatShortDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatDay(time: number) {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Days since the first scan for each point. Falls back to a weekly cadence
// when the dates are missing so the line still spreads out.
function toDayOffsets(dates: string[], count: number) {
  const first = parseTime(dates[0]);
  return Array.from({ length: count }, (_, index) => {
    const time = parseTime(dates[index]);
    if (first === null || time === null) return index * CHECK_IN_DAYS;
    return Math.max(0, (time - first) / DAY_MS);
  });
}

function estimateGain(item: NextFocusRecommendation) {
  return clamp(Math.round(item.score / 8), 1, 4);
}

// Solid scan line: chained cubics with flat tangents at each scan, matching
// the onboarding projection curve.
function smoothPath(points: ChartPoint[]) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const k = (b.x - a.x) * 0.35;
    path += ` C ${a.x + k} ${a.y} ${b.x - k} ${b.y} ${b.x} ${b.y}`;
  }
  return path;
}

// Projection: one symmetric cubic, flat at both ends.
function projectionControls(start: ChartPoint, end: ChartPoint) {
  const dx = (end.x - start.x) * 0.42;
  return [start, { x: start.x + dx, y: start.y }, { x: end.x - dx, y: end.y }, end];
}

function projectionPath(start: ChartPoint, end: ChartPoint) {
  const [, c1, c2] = projectionControls(start, end);
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
}

function pointOnProjection(start: ChartPoint, end: ChartPoint, x: number): ChartPoint {
  const [p0, p1, p2, p3] = projectionControls(start, end);
  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  };
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < 24; step += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid).x < x) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}

function toAdvancedAnalysis(source: LatestAdvanced | AdvancedAnalysis | null): AdvancedAnalysis | null {
  if (!source) return null;
  const raw = source as any;

  return {
    cheekbones: {
      width: raw.cheekbones?.width ?? "",
      width_score: raw.cheekbones?.width_score ?? 50,
      width_verdict: raw.cheekbones?.width_verdict ?? "",
      maxilla: raw.cheekbones?.maxilla ?? "",
      maxilla_score: raw.cheekbones?.maxilla_score ?? 50,
      maxilla_verdict: raw.cheekbones?.maxilla_verdict ?? "",
      bone_structure: raw.cheekbones?.bone_structure ?? "",
      bone_structure_score: raw.cheekbones?.bone_structure_score ?? 50,
      bone_structure_verdict: raw.cheekbones?.bone_structure_verdict ?? "",
      face_fat: raw.cheekbones?.face_fat ?? "",
      face_fat_score: raw.cheekbones?.face_fat_score ?? 50,
      face_fat_verdict: raw.cheekbones?.face_fat_verdict ?? "",
      fwhr: raw.cheekbones?.fwhr ?? "",
      fwhr_score: raw.cheekbones?.fwhr_score ?? 50,
      fwhr_verdict: raw.cheekbones?.fwhr_verdict ?? "",
    },
    jawline: {
      development: raw.jawline?.development ?? "",
      development_score: raw.jawline?.development_score ?? 50,
      development_verdict: raw.jawline?.development_verdict ?? "",
      gonial_angle: raw.jawline?.gonial_angle ?? "",
      gonial_angle_score: raw.jawline?.gonial_angle_score ?? 50,
      gonial_angle_verdict: raw.jawline?.gonial_angle_verdict ?? "",
      projection: raw.jawline?.projection ?? "",
      projection_score: raw.jawline?.projection_score ?? 50,
      projection_verdict: raw.jawline?.projection_verdict ?? "",
      ramus: raw.jawline?.ramus ?? "",
      ramus_score: raw.jawline?.ramus_score ?? 50,
      ramus_verdict: raw.jawline?.ramus_verdict ?? "",
    },
    eyes: {
      canthal_tilt: raw.eyes?.canthal_tilt ?? "",
      canthal_tilt_score: raw.eyes?.canthal_tilt_score ?? 50,
      canthal_tilt_verdict: raw.eyes?.canthal_tilt_verdict ?? "",
      eye_type: raw.eyes?.eye_type ?? "",
      eye_type_score: raw.eyes?.eye_type_score ?? 50,
      eye_type_verdict: raw.eyes?.eye_type_verdict ?? "",
      brow_volume: raw.eyes?.brow_volume ?? "",
      brow_volume_score: raw.eyes?.brow_volume_score ?? 50,
      brow_volume_verdict: raw.eyes?.brow_volume_verdict ?? "",
      symmetry: raw.eyes?.symmetry ?? "",
      symmetry_score: raw.eyes?.symmetry_score ?? 50,
      symmetry_verdict: raw.eyes?.symmetry_verdict ?? "",
    },
    skin: {
      color: raw.skin?.color ?? "",
      color_score: raw.skin?.color_score ?? 50,
      color_verdict: raw.skin?.color_verdict ?? "",
      quality: raw.skin?.quality ?? "",
      quality_score: raw.skin?.quality_score ?? 50,
      quality_verdict: raw.skin?.quality_verdict ?? "",
    },
    haircut: {
      density: raw.haircut?.density ?? "",
      density_score: raw.haircut?.density_score ?? 50,
      density_verdict: raw.haircut?.density_verdict ?? "",
      styling: raw.haircut?.styling ?? "",
      styling_score: raw.haircut?.styling_score ?? 50,
      styling_verdict: raw.haircut?.styling_verdict ?? "",
      facial_hair: raw.haircut?.facial_hair ?? "",
      facial_hair_score: raw.haircut?.facial_hair_score ?? 50,
      facial_hair_verdict: raw.haircut?.facial_hair_verdict ?? "",
    },
  };
}

function TrajectoryCard({
  scores,
  days,
  target,
  targetLabel,
  firstLabel,
  width,
  loading,
  onScan,
}: {
  scores: number[];
  days: number[];
  target: number;
  targetLabel: string;
  firstLabel: string;
  width: number;
  loading: boolean;
  onScan: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const chartW = Math.max(240, width - 36);
  const hasScans = scores.length > 0;
  const current = hasScans ? Math.round(scores[scores.length - 1]) : null;
  const delta = hasScans ? Math.round(scores[scores.length - 1] - scores[0]) : 0;
  const stroke = Math.max(5, chartW * 0.02);

  const geo = useMemo(() => {
    // With no scans, draw a faint sample trajectory behind the first-scan prompt.
    const plotScores = hasScans ? scores : [58];
    const plotDays = hasScans ? days : [0];
    const plotTarget = hasScans ? target : 66;
    const lastDay = plotDays[plotDays.length - 1];
    const horizon = lastDay + PROJECTION_DAYS;

    const all = [...plotScores, plotTarget];
    const hi = Math.max(...all) + 2;
    const lo = Math.min(Math.min(...all) - 5, hi - 14);
    const left = PAD_L;
    const right = chartW - PAD_R;
    const bottom = CHART_H - PAD_B;
    const toX = (day: number) => left + (day / horizon) * (right - left);
    const toY = (score: number) => bottom - ((score - lo) / (hi - lo)) * (bottom - PAD_T);

    const real = plotScores.map((score, index) => ({ x: toX(plotDays[index]), y: toY(score) }));
    const last = real[real.length - 1];
    const end = { x: toX(horizon), y: toY(plotTarget) };
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      x: toX(horizon * fraction),
      label: fraction === 0 ? firstLabel : `Wk ${Math.round((horizon * fraction) / 7)}`,
    }));

    return {
      real,
      realPath: smoothPath(real),
      projPath: projectionPath(last, end),
      end,
      next: pointOnProjection(last, end, toX(lastDay + CHECK_IN_DAYS)),
      bottom,
      left,
      right,
      ticks,
    };
  }, [chartW, days, firstLabel, hasScans, scores, target]);

  const reveal = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      reveal.set(1);
      return;
    }
    reveal.set(0);
    reveal.set(withTiming(1, { duration: 1100, easing: GRAPH_EASE }));
  }, [geo, reduceMotion, reveal]);

  const revealProps = useAnimatedProps(() => ({
    width: chartW * reveal.get(),
  }));

  const bubbleW = 96;
  const bubbleLeft = clamp(geo.end.x - bubbleW + 18, 0, chartW - bubbleW);
  const chipLabel = scores.length < 2 ? "Baseline set" : `${delta >= 0 ? "+" : ""}${delta} since ${firstLabel}`;
  const chipDown = scores.length >= 2 && delta < 0;

  return (
    <View style={[styles.graphCard, { width }]}>
      <View style={styles.graphHeader}>
        <View style={styles.graphHeaderCopy}>
          <Text style={styles.eyebrow}>{hasScans ? "TODAY'S SCORE" : "YOUR TRAJECTORY"}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{current ?? "--"}</Text>
            {hasScans ? (
              <Text style={styles.scoreTarget} numberOfLines={1}>
                {`→ ${target} by ${targetLabel}`}
              </Text>
            ) : null}
          </View>
        </View>
        {hasScans ? (
          <View style={[styles.deltaChip, chipDown && styles.deltaChipDown]}>
            <Text style={[styles.deltaChipText, chipDown && styles.deltaChipTextDown]}>{chipLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.chartWrap, { width: chartW }]}>
        <Svg width={chartW} height={CHART_H}>
          <Defs>
            <ClipPath id="trajectoryReveal">
              <AnimatedRect x={0} y={0} height={CHART_H} animatedProps={revealProps} />
            </ClipPath>
          </Defs>
          <Line x1={geo.left} y1={geo.end.y} x2={geo.right} y2={geo.end.y} stroke={AXIS} strokeWidth={1.5} strokeDasharray="2 7" />
          <Line x1={geo.left} y1={geo.bottom} x2={geo.right} y2={geo.bottom} stroke={AXIS} strokeWidth={1} />
          <G clipPath="url(#trajectoryReveal)" opacity={hasScans ? 1 : 0.32}>
            <Path
              d={geo.projPath}
              fill="none"
              stroke={GREEN}
              strokeOpacity={0.55}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={[stroke * 2.4, stroke * 1.7]}
            />
            {geo.real.length > 1 ? (
              <Path d={geo.realPath} fill="none" stroke={GREEN} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {hasScans ? (
              <Circle cx={geo.next.x} cy={geo.next.y} r={stroke * 0.9} fill="#FFFFFF" stroke={NEXT_MARKER} strokeWidth={stroke * 0.42} />
            ) : null}
            {geo.real.map((point, index) => {
              const isLast = index === geo.real.length - 1;
              return (
                <Circle
                  key={`${point.x}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isLast ? stroke * 1.26 : stroke * 0.8}
                  fill="#FFFFFF"
                  stroke={GREEN}
                  strokeWidth={isLast ? stroke * 0.46 : stroke * 0.38}
                />
              );
            })}
            <Circle cx={geo.end.x} cy={geo.end.y} r={stroke * 1.26} fill={GREEN} stroke="#FFFFFF" strokeWidth={stroke * 0.4} />
          </G>
        </Svg>

        {hasScans ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(260).delay(950)}
            pointerEvents="none"
            style={[styles.bubble, { width: bubbleW, left: bubbleLeft, top: geo.end.y - 50 }]}
          >
            <Text style={styles.bubbleText}>{`Target ${target}`}</Text>
            <View style={[styles.bubbleTail, { left: clamp(geo.end.x - bubbleLeft - 6, 10, bubbleW - 22) }]} />
          </Animated.View>
        ) : null}

        {!hasScans ? (
          <View style={styles.graphEmptyState}>
            {loading ? (
              <ActivityIndicator color={GREEN_DARK} />
            ) : (
              <>
                <Text style={styles.graphEmptyTitle}>See where your routine takes you</Text>
                <Text style={styles.graphEmptyBody}>Your first scan sets the baseline for your projection.</Text>
                <Pressable
                  onPress={onScan}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.actionPressed]}
                >
                  <Camera size={17} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.primaryButtonText}>Take first scan</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.tickRow}>
          {geo.ticks.map((tick, index) => (
            <Text
              key={tick.label + index}
              style={[
                styles.tickText,
                {
                  left: clamp(tick.x - 28, 0, chartW - 56),
                  textAlign: index === 0 ? "left" : index === geo.ticks.length - 1 ? "right" : "center",
                },
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      </View>

      {hasScans ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.legendSolid} />
            <Text style={styles.legendText}>Your scans</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDashed}>
              <View style={styles.legendDash} />
              <View style={styles.legendDash} />
            </View>
            <Text style={styles.legendText}>Projected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendRing} />
            <Text style={styles.legendText}>Next check-in</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CheckInCard({ daysLeft, dateLabel, onScan }: { daysLeft: number; dateLabel: string; onScan: () => void }) {
  const due = daysLeft <= 0;
  const elapsed = clamp(CHECK_IN_DAYS - daysLeft, 0, CHECK_IN_DAYS);

  return (
    <View style={[styles.checkInCard, due && styles.checkInCardDue]}>
      <View style={styles.checkInTop}>
        <View style={[styles.checkInIcon, due && styles.checkInIconDue]}>
          <CalendarClock size={21} color={due ? "#FFFFFF" : GREEN_DARK} strokeWidth={2.6} />
        </View>
        <View style={styles.checkInCopy}>
          <Text style={styles.checkInTitle}>
            {due ? "Check-in due" : `Next check-in in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
          </Text>
          <Text style={styles.checkInBody}>
            {due ? "Same light, same angle as your last scan." : `${dateLabel} · same light, same angle`}
          </Text>
        </View>
      </View>
      {due ? (
        <Pressable
          onPress={onScan}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, styles.checkInButton, pressed && styles.actionPressed]}
        >
          <Camera size={17} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.primaryButtonText}>Scan now</Text>
        </Pressable>
      ) : (
        <View style={styles.dayTrack}>
          {Array.from({ length: CHECK_IN_DAYS }, (_, index) => (
            <View key={index} style={[styles.daySegment, index < elapsed && styles.daySegmentDone]} />
          ))}
        </View>
      )}
    </View>
  );
}

function scoreColor(score: number) {
  if (score < 45) return PROBLEM_RED;
  if (score < 65) return ORANGE;
  return GREEN_DARK;
}

function FocusRow({
  iconId,
  tone,
  title,
  children,
  trailing,
  onPress,
}: {
  iconId: string;
  tone: "focus" | "problem";
  title: string;
  children: React.ReactNode;
  trailing: React.ReactNode;
  onPress: () => void;
}) {
  const icon = getAdvancedAnalysisIcon(iconId);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.focusRow, pressed && styles.pressed]}
    >
      <View style={[styles.focusRowIcon, { backgroundColor: tone === "problem" ? PROBLEM_IMAGE_BG : FOCUS_IMAGE_BG }]}>
        <Image
          source={icon ?? FALLBACK_ICON}
          style={[styles.focusIcon, icon ? getAdvancedAnalysisIconStyle(iconId) : null]}
          resizeMode="contain"
        />
      </View>
      <View style={styles.focusRowCopy}>
        <Text style={styles.focusRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {children}
      </View>
      {trailing}
    </Pressable>
  );
}

function getSheetMetricIconId(item: SheetMetric) {
  if ("iconId" in item) return item.iconId;
  return FOCUS_ICON_MAP[item.id]?.iconId ?? "cheekbones.bone_structure";
}

function FocusCard({ item, tone }: { item: SheetMetric; tone: "focus" | "problem" }) {
  const [expanded, setExpanded] = useState(false);
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const iconId = getSheetMetricIconId(item);
  const icon = getAdvancedAnalysisIcon(iconId);
  const imageBg = tone === "problem" ? PROBLEM_IMAGE_BG : FOCUS_IMAGE_BG;
  const accent = tone === "problem" ? PROBLEM_RED : BLUE;

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const detailStyle = useAnimatedStyle(() => ({
    maxHeight: 116 * progress.value,
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -6 }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPress = () => {
    Haptics.selectionAsync();
    setExpanded((value) => !value);
  };

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(1.02, { damping: 16, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 240 });
        }}
        style={({ pressed }) => [styles.focusCard, pressed && styles.pressed]}
      >
        <View style={styles.focusCardTop}>
          <View style={[styles.focusIconWrap, { backgroundColor: imageBg }]}> 
            {icon ? (
              <Image source={icon} style={[styles.focusIcon, getAdvancedAnalysisIconStyle(iconId)]} resizeMode="contain" />
            ) : (
              <Image source={FALLBACK_ICON} style={styles.focusIcon} resizeMode="contain" />
            )}
          </View>
          <View style={styles.focusCopy}>
            <View style={styles.focusTitleRow}>
              <Text style={[styles.focusRank, { color: accent }]}>#{item.rank}</Text>
              <Text style={styles.focusTitle} numberOfLines={1} adjustsFontSizeToFit>
                {item.title}
              </Text>
            </View>
            <Text style={styles.focusReason} numberOfLines={2}>
              {item.evidence}
            </Text>
          </View>
          <View style={styles.focusScorePill}>
            <Text style={styles.focusScoreText}>{Math.round(item.score)}</Text>
            <ChevronDown
              size={14}
              color={INK}
              strokeWidth={3}
              style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
            />
          </View>
        </View>

        <Animated.View style={[styles.focusDetails, detailStyle]}>
          <View style={styles.focusDivider} />
          <Text style={[styles.focusDetailLabel, { color: accent }]}>USER REMARK</Text>
          <Text style={styles.focusDetailText}>{item.reason}</Text>
          <Text style={[styles.focusDetailLabel, { color: accent }]}>WHAT TO DO</Text>
          <Text style={styles.focusDetailText}>{item.action}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function MetricCardsSheet({
  visible,
  title,
  subtitle,
  items,
  tone,
  emptyTitle,
  emptyBody,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  items: SheetMetric[];
  tone: "focus" | "problem";
  emptyTitle: string;
  emptyBody: string;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View entering={FadeInDown.duration(280)} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <X size={20} color={INK} strokeWidth={3} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.focusList}
          >
            {items.length ? (
              items.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInDown.duration(260).delay(index * 45)}>
                  <FocusCard item={item} tone={tone} />
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyBody}>{emptyBody}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function buildProblemMetrics(data: AdvancedAnalysis | null): ProblemMetric[] {
  if (!data) return [];

  const raw = [
    { id: "jawline.projection", title: "Chin Projection", score: data.jawline.projection_score, iconId: "jawline.projection", action: "Prioritize lower-face structure and chin projection work." },
    { id: "cheekbones.face_fat", title: "Face Fat", score: data.cheekbones.face_fat_score, iconId: "cheekbones.face_fat", action: "Reduce puffiness and lower-face softness before judging structure." },
    { id: "jawline.development", title: "Jaw Development", score: data.jawline.development_score, iconId: "jawline.development", action: "Build jawline strength and lower-face definition consistently." },
    { id: "cheekbones.bone_structure", title: "Bone Structure", score: data.cheekbones.bone_structure_score, iconId: "cheekbones.bone_structure", action: "Support structure-focused training and recovery habits." },
    { id: "cheekbones.maxilla", title: "Maxilla", score: data.cheekbones.maxilla_score, iconId: "cheekbones.maxilla", action: "Focus on midface support, posture, and forward-growth habits." },
    { id: "cheekbones.width", title: "Cheekbone Width", score: data.cheekbones.width_score, iconId: "cheekbones.width", action: "Work on cheekbone definition and midface width cues." },
    { id: "eyes.canthal_tilt", title: "Canthal Tilt", score: data.eyes.canthal_tilt_score, iconId: "eyes.canthal_tilt", action: "Train eye-area control and reduce habits that drag the eye frame." },
    { id: "eyes.symmetry", title: "Eye Symmetry", score: data.eyes.symmetry_score, iconId: "eyes.symmetry", action: "Use balanced eye-area work and front-facing posture habits." },
    { id: "eyes.eye_type", title: "Eye Shape", score: data.eyes.eye_type_score, iconId: "eyes.eye_type", action: "Target orbital control and upper-face tension release." },
    { id: "eyes.brow_volume", title: "Brow Volume", score: data.eyes.brow_volume_score, iconId: "eyes.brow_volume", action: "Refine brow framing, density, and grooming consistency." },
    { id: "jawline.gonial_angle", title: "Gonial Angle", score: data.jawline.gonial_angle_score, iconId: "jawline.gonial_angle", action: "Sharpen the jaw angle through structure and leanness work." },
    { id: "skin.quality", title: "Skin Quality", score: data.skin.quality_score, iconId: "skin.quality", action: "Prioritize barrier basics, cleansing consistency, and texture control." },
    { id: "skin.color", title: "Skin Tone", score: data.skin.color_score, iconId: "skin.color", action: "Improve tone consistency with hydration, light, and skin-support habits." },
    { id: "haircut.density", title: "Hair Density", score: data.haircut.density_score, iconId: "haircut.density", action: "Improve the face frame with stronger hair density presentation." },
    { id: "haircut.styling", title: "Hair Styling", score: data.haircut.styling_score, iconId: "haircut.styling", action: "Choose styling that better balances face length and width." },
    { id: "haircut.facial_hair", title: "Facial Hair", score: data.haircut.facial_hair_score, iconId: "haircut.facial_hair", action: "Refine facial hair lines so the lower face reads cleaner." },
  ];

  return raw
    .sort((a, b) => a.score - b.score)
    .filter((item, index) => item.score < 70 || index < 5)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      evidence: `${item.title} ${Math.round(item.score)}/100`,
      reason: getProblemRemark(item.title, item.score),
      score: Math.round(item.score),
    }));
}

function getProblemRemark(title: string, score: number) {
  if (score < 40) return `${title} is one of the clearest weak points in your latest blueprint.`;
  if (score < 55) return `${title} is below target and should be handled before smaller refinements.`;
  return `${title} is moderate, but still one of the highest-leverage traits to clean up.`;
}
export function NextFocusCheckInRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [focusVisible, setFocusVisible] = useState(false);
  const [problemsVisible, setProblemsVisible] = useState(false);
  const [tab, setTab] = useState<FocusTab>("wins");
  const [now] = useState(() => Date.now());

  const data = useInsights((s) => s.data);
  const loading = useInsights((s) => s.loading);
  const loadInsights = useInsights((s) => s.loadInsights);
  const advancedData = useAdvancedAnalysis((s) => s.data);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const contentWidth = Math.min(width - 40, 400);
  const bottomPad = Math.max(insets.bottom, 8) + FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom + 12;
  const metrics = data?.metrics ?? [];
  const latestAdvanced = data?.latest_advanced ?? (advancedData as LatestAdvanced | null) ?? null;
  const previousAdvanced = data?.previous_advanced ?? null;
  const advancedForBlueprint = useMemo(
    () => toAdvancedAnalysis(data?.latest_advanced ?? advancedData ?? null),
    [advancedData, data?.latest_advanced],
  );

  const recommendations = useMemo(
    () =>
      selectNextFocusRecommendations({
        scanId: data?.history?.[0]?.id ?? null,
        metrics,
        latestAdvanced,
        previousAdvanced,
        limit: 6,
      }),
    [data?.history, latestAdvanced, metrics, previousAdvanced],
  );
  const problemMetrics = useMemo(() => buildProblemMetrics(advancedForBlueprint), [advancedForBlueprint]);

  const scores = useMemo(() => (data?.graph_points ?? []).filter(Number.isFinite).slice(-12), [data?.graph_points]);
  const scoreDates = useMemo(() => (data?.graph_dates ?? []).slice(-scores.length), [data?.graph_dates, scores.length]);
  const days = useMemo(() => toDayOffsets(scoreDates, scores.length), [scoreDates, scores.length]);
  const hasScans = scores.length > 0;

  const quickWins = useMemo(
    () => recommendations.slice(0, QUICK_WIN_COUNT).map((item) => ({ item, gain: estimateGain(item) })),
    [recommendations],
  );
  const totalGain = Math.min(MAX_TARGET_GAIN, quickWins.reduce((sum, win) => sum + win.gain, 0));
  const current = hasScans ? Math.round(scores[scores.length - 1]) : 0;
  const target = Math.min(100, current + totalGain);

  const lastScanTime = parseTime(scoreDates[scoreDates.length - 1]) ?? parseTime(data?.history?.[0]?.created_at) ?? now;
  const firstLabel = formatShortDate(scoreDates[0], "Start");
  const targetLabel = formatDay(lastScanTime + PROJECTION_DAYS * DAY_MS);
  const nextCheckIn = lastScanTime + CHECK_IN_DAYS * DAY_MS;
  const daysLeft = Math.ceil((nextCheckIn - now) / DAY_MS);

  const subtitle = !hasScans
    ? "Take your first scan to set a baseline."
    : scores.length === 1
      ? "Baseline set. Work your focus areas and check in weekly."
      : `${scores.length} scans in. Here's where your routine is heading.`;

  const goToScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/take-picture");
  }, [router]);

  const openFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFocusVisible(true);
  }, []);

  const openProblems = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProblemsVisible(true);
  }, []);

  const selectTab = useCallback((next: FocusTab) => {
    Haptics.selectionAsync();
    setTab(next);
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 2,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <View style={[styles.inner, { width: contentWidth }]}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to progress preview"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft size={23} color={INK} strokeWidth={3} />
            </Pressable>
          </View>

          <Text style={styles.heroTitle}>Your progress</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>

          <TrajectoryCard
            scores={scores}
            days={days}
            target={target}
            targetLabel={targetLabel}
            firstLabel={firstLabel}
            width={contentWidth}
            loading={loading}
            onScan={goToScan}
          />

          {hasScans ? <CheckInCard daysLeft={daysLeft} dateLabel={formatDay(nextCheckIn)} onScan={goToScan} /> : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Focus this week</Text>
            {hasScans ? (
              <View style={styles.segment}>
                {(["wins", "weak"] as const).map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => selectTab(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === key }}
                    style={[styles.segmentItem, tab === key && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>
                      {key === "wins" ? "Quick wins" : "Weak points"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {!hasScans ? (
            <View style={styles.lockedCard}>
              <Lock size={20} color={MUTED} strokeWidth={2.6} />
              <Text style={styles.lockedText}>Your focus areas unlock after your first scan.</Text>
            </View>
          ) : tab === "wins" ? (
            <View style={styles.focusGroup}>
              {quickWins.map(({ item, gain }) => (
                <FocusRow
                  key={item.id}
                  iconId={getSheetMetricIconId(item)}
                  tone="focus"
                  title={item.title}
                  onPress={openFocus}
                  trailing={
                    <View style={styles.gainPill}>
                      <Text style={styles.gainText}>+{gain}</Text>
                    </View>
                  }
                >
                  <Text style={styles.focusRowSub} numberOfLines={1}>
                    {item.evidence}
                  </Text>
                </FocusRow>
              ))}
              <Text style={styles.focusCaption}>
                {`These add up to about +${totalGain}. That's the target line on your graph.`}
              </Text>
              <Pressable onPress={openFocus} accessibilityRole="button" style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
                <Text style={styles.seeAllText}>See all {recommendations.length}</Text>
                <ChevronRight size={16} color={GREEN_DARK} strokeWidth={3} />
              </Pressable>
            </View>
          ) : problemMetrics.length ? (
            <View style={styles.focusGroup}>
              {problemMetrics.slice(0, QUICK_WIN_COUNT).map((item) => (
                <FocusRow
                  key={item.id}
                  iconId={item.iconId}
                  tone="problem"
                  title={item.title}
                  onPress={openProblems}
                  trailing={<Text style={[styles.weakScore, { color: scoreColor(item.score) }]}>{item.score}</Text>}
                >
                  <View style={styles.weakTrack}>
                    <View style={[styles.weakFill, { width: `${clamp(item.score, 4, 100)}%`, backgroundColor: scoreColor(item.score) }]} />
                  </View>
                </FocusRow>
              ))}
              <Pressable onPress={openProblems} accessibilityRole="button" style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
                <Text style={styles.seeAllText}>See all {problemMetrics.length}</Text>
                <ChevronRight size={16} color={GREEN_DARK} strokeWidth={3} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.lockedCard}>
              <Lock size={20} color={MUTED} strokeWidth={2.6} />
              <Text style={styles.lockedText}>Run an advanced analysis to see your weak traits.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <MetricCardsSheet
        visible={focusVisible}
        title="Quick wins"
        subtitle="The highest-leverage metrics from your latest analysis."
        items={recommendations}
        tone="focus"
        emptyTitle="No focus metrics yet"
        emptyBody="Run an advanced analysis to unlock your next focus metrics."
        onClose={() => setFocusVisible(false)}
      />

      <MetricCardsSheet
        visible={problemsVisible}
        title="Weak points"
        subtitle="The blueprint traits currently pulling your scan down most."
        items={problemMetrics}
        tone="problem"
        emptyTitle="No blueprint traits yet"
        emptyBody="Run an advanced analysis to unlock your main problem traits."
        onClose={() => setProblemsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  inner: {
    gap: 12,
  },
  topBar: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GROUPED_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  pressed: {
    opacity: 0.76,
  },
  heroTitle: {
    marginTop: 4,
    fontFamily: FONT_BOLD,
    fontSize: 31,
    lineHeight: 35,
    color: INK,
  },
  heroSubtitle: {
    marginTop: -8,
    marginBottom: 2,
    fontFamily: FONT,
    fontSize: 15,
    lineHeight: 20,
    color: MUTED,
  },
  graphCard: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  graphHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  graphHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    lineHeight: 15,
    color: "#9D9EA2",
    letterSpacing: 1.6,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  scoreValue: {
    fontFamily: FONT_BOLD,
    fontSize: 40,
    lineHeight: 46,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  scoreTarget: {
    flexShrink: 1,
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: GREEN_DARK,
  },
  deltaChip: {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EDF6E4",
  },
  deltaChipDown: {
    backgroundColor: "#FFF0E0",
  },
  deltaChipText: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: GREEN_DARK,
  },
  deltaChipTextDown: {
    color: ORANGE,
  },
  chartWrap: {
    marginTop: 6,
    position: "relative",
  },
  bubble: {
    position: "absolute",
    height: 34,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN_DARK,
  },
  bubbleText: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: "#FFFFFF",
  },
  bubbleTail: {
    position: "absolute",
    bottom: -5,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: GREEN_DARK,
    transform: [{ rotate: "45deg" }],
  },
  graphEmptyState: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: CHART_H,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  graphEmptyTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 18,
    lineHeight: 22,
    color: INK,
    textAlign: "center",
  },
  graphEmptyBody: {
    marginTop: 4,
    marginBottom: 14,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: "center",
  },
  tickRow: {
    height: 18,
    marginTop: 4,
  },
  tickText: {
    position: "absolute",
    width: 56,
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: MUTED,
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSolid: {
    width: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN,
  },
  legendDashed: {
    width: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendDash: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN,
    opacity: 0.55,
  },
  legendRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: NEXT_MARKER,
  },
  legendText: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: MUTED,
  },
  primaryButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN_DARK,
  },
  primaryButtonText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: "#FFFFFF",
  },
  actionPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.82,
  },
  checkInCard: {
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    backgroundColor: GROUPED_SURFACE,
    padding: 14,
    gap: 12,
  },
  checkInCardDue: {
    backgroundColor: "#EDF6E4",
  },
  checkInTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkInIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF4DF",
  },
  checkInIconDue: {
    backgroundColor: GREEN_DARK,
  },
  checkInCopy: {
    flex: 1,
    minWidth: 0,
  },
  checkInTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 16,
    lineHeight: 20,
    color: INK,
  },
  checkInBody: {
    marginTop: 2,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 17,
    color: MUTED,
  },
  checkInButton: {
    alignSelf: "stretch",
  },
  dayTrack: {
    flexDirection: "row",
    gap: 5,
  },
  daySegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(23,21,18,0.08)",
  },
  daySegmentDone: {
    backgroundColor: GREEN,
  },
  sectionHeader: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 20,
    lineHeight: 24,
    color: INK,
  },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 999,
    backgroundColor: GROUPED_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  segmentItem: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: MUTED,
  },
  segmentTextActive: {
    color: INK,
  },
  focusGroup: {
    gap: 8,
  },
  focusRow: {
    minHeight: 68,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    backgroundColor: GROUPED_SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  focusRowIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  focusRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  focusRowTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 16,
    lineHeight: 20,
    color: INK,
  },
  focusRowSub: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  gainPill: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF6E4",
  },
  gainText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: GREEN_DARK,
  },
  weakTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(23,21,18,0.08)",
    overflow: "hidden",
  },
  weakFill: {
    height: 6,
    borderRadius: 3,
  },
  weakScore: {
    minWidth: 32,
    fontFamily: FONT_BOLD,
    fontSize: 18,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  focusCaption: {
    marginTop: 2,
    paddingHorizontal: 4,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  seeAll: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  seeAllText: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: GREEN_DARK,
  },
  lockedCard: {
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    backgroundColor: GROUPED_SURFACE,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 19,
    color: MUTED,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    overflow: "hidden",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D8D8D8",
    marginBottom: 12,
  },
  sheetHeader: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 28,
    lineHeight: 32,
    color: INK,
  },
  sheetSubtitle: {
    marginTop: 2,
    maxWidth: 284,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F1",
  },
  focusList: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    gap: 10,
  },
  focusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
    borderBottomWidth: 4,
    borderBottomColor: "#D8D8D8",
    backgroundColor: "#F8F8F6",
    padding: 12,
    overflow: "hidden",
  },
  focusCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  focusIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  focusIcon: {
    width: "88%",
    height: "88%",
  },
  focusCopy: {
    flex: 1,
    minWidth: 0,
  },
  focusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  focusRank: {
    fontFamily: FONT_BOLD,
    fontSize: 13,
    color: BLUE,
  },
  focusTitle: {
    flex: 1,
    fontFamily: FONT_BOLD,
    fontSize: 17,
    lineHeight: 21,
    color: INK,
  },
  focusReason: {
    marginTop: 3,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  focusScorePill: {
    minWidth: 44,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  focusScoreText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    lineHeight: 18,
    color: INK,
  },
  focusDetails: {
    overflow: "hidden",
  },
  focusDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginTop: 12,
    marginBottom: 10,
  },
  focusDetailLabel: {
    marginTop: 4,
    fontFamily: FONT_BOLD,
    fontSize: 10,
    lineHeight: 13,
    color: BLUE,
    letterSpacing: 1.2,
  },
  focusDetailText: {
    marginTop: 2,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: INK,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: "#F8F8F6",
    padding: 18,
  },
  emptyTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 18,
    color: INK,
  },
  emptyBody: {
    marginTop: 4,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
});
