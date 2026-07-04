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
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { ArrowLeft, BarChart3, ChevronDown, Target, TriangleAlert, X } from "lucide-react-native";

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

const BG = "#FEF4E4";
const INK = "#343638";
const MUTED = "#777A7D";
const GREEN = "#4CD400";
const GREEN_DARK = "#3CAD00";
const BLUE = "#16A7E4";
const ORANGE = "#F27B00";
const CARD_BORDER = "#E1E1DE";

const FALLBACK_ICON = require("../../assets/icons/next-foucs.png");
const AnimatedPath = Animated.createAnimatedComponent(Path);

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

type GraphCoord = {
  x: number;
  y: number;
};

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

function buildGraphLayout(points: number[], width: number, height: number): { path: string; coords: GraphCoord[]; length: number } {
  if (!points.length) return { path: "", coords: [], length: 1 };

  const min = Math.min(...points, 40);
  const max = Math.max(...points, 90);
  const range = Math.max(12, max - min);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? index * step : width / 2;
    const normalized = (point - min) / range;
    const y = clamp(height - normalized * height, 8, height - 8);
    return { x, y };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const length = coords.slice(1).reduce((sum, point, index) => {
    const previous = coords[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);

  return { path, coords, length: Math.max(1, length) };
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

function ProgressGraphCard({
  points,
  dates,
  width,
}: {
  points: number[];
  dates: string[];
  width: number;
}) {
  const chartWidth = Math.max(240, width - 48);
  const chartHeight = 160;
  const safePoints = points.length ? points.slice(-8) : [56];
  const safeDates = dates.slice(-safePoints.length);
  const graph = useMemo(() => buildGraphLayout(safePoints, chartWidth, chartHeight), [chartHeight, chartWidth, safePoints]);
  const lineProgress = useSharedValue(0);
  const latest = Math.round(safePoints[safePoints.length - 1] ?? 56);
  const first = safePoints[0] ?? latest;
  const delta = latest - first;
  const labelLeft = formatShortDate(safeDates[0], "Scan 1");
  const labelRight = formatShortDate(safeDates[safeDates.length - 1], "Latest");

  useEffect(() => {
    lineProgress.value = 0;
    lineProgress.value = withTiming(1, {
      duration: 950,
      easing: Easing.out(Easing.cubic),
    });
  }, [graph.path, lineProgress]);

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: graph.length * (1 - lineProgress.value),
  }));

  return (
    <View style={[styles.graphCard, { width }]}>
      <View style={styles.graphHeader}>
        <View>
          <Text style={styles.eyebrow}>PROGRESS OVER SCANS</Text>
          <Text style={styles.graphTitle}>Your check-in trend</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeValue}>{latest}</Text>
          <Text style={[styles.scoreBadgeDelta, delta < 0 && styles.scoreBadgeDeltaDown]}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(0)}
          </Text>
        </View>
      </View>

      <View style={styles.chartWrap}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <SvgGradient id="focusLine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={BLUE} />
              <Stop offset="1" stopColor={GREEN} />
            </SvgGradient>
          </Defs>
          {[0, 1, 2].map((row) => {
            const y = 20 + row * 52;
            return (
              <Line
                key={row}
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="rgba(52,54,56,0.10)"
                strokeWidth={1}
              />
            );
          })}
          <AnimatedPath
            d={graph.path}
            fill="none"
            stroke="url(#focusLine)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${graph.length} ${graph.length}`}
            animatedProps={animatedLineProps}
          />
          {graph.coords.map((point, index) => (
            <Circle
              key={`${safePoints[index]}-${index}`}
              cx={point.x}
              cy={point.y}
              r={5}
              fill="#FFFFFF"
              stroke={index === safePoints.length - 1 ? GREEN : BLUE}
              strokeWidth={3}
            />
          ))}
        </Svg>
      </View>

      <View style={styles.graphFooter}>
        <Text style={styles.graphDate}>{labelLeft}</Text>
        <Text style={styles.graphHint}>{safePoints.length} scans</Text>
        <Text style={styles.graphDate}>{labelRight}</Text>
      </View>
    </View>
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
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

  const openFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFocusVisible(true);
  }, []);

  const openProblems = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProblemsVisible(true);
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
            <View style={styles.statusPill}>
              {loading ? <ActivityIndicator color={GREEN_DARK} size="small" /> : <BarChart3 size={17} color={GREEN_DARK} strokeWidth={3} />}
              <Text style={styles.statusText}>{data?.scan_count ?? 0} scans</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Check-in focus</Text>
          <Text style={styles.heroSubtitle}>Review your scan trend, then choose what to inspect first.</Text>

          <ProgressGraphCard
            points={data?.graph_points ?? []}
            dates={data?.graph_dates ?? []}
            width={contentWidth}
          />

          <View style={[styles.summaryCard, { width: contentWidth }]}>
            <View style={styles.summaryIcon}>
              <Target size={23} color={GREEN_DARK} strokeWidth={3} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>Your check-in guide</Text>
              <Text style={styles.summaryBody}>
                Your scan trend and blueprint traits are organized into the areas to inspect first.
              </Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <Pressable
              onPress={openFocus}
              accessibilityRole="button"
              accessibilityLabel="Open next focus metrics"
              style={({ pressed }) => [styles.actionButton, styles.actionButtonFocus, pressed && styles.actionPressed]}
            >
              <Target size={24} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.actionTextWhite}>NEXT FOCUS</Text>
              <Text style={styles.actionSubWhite}>{recommendations.length || 6} metrics</Text>
            </Pressable>

            <Pressable
              onPress={openProblems}
              accessibilityRole="button"
              accessibilityLabel="Open main problems"
              style={({ pressed }) => [styles.actionButton, styles.actionButtonProblems, pressed && styles.actionPressed]}
            >
              <TriangleAlert size={24} color={INK} strokeWidth={3} />
              <Text style={styles.actionTextDark}>MAIN PROBLEMS</Text>
              <Text style={styles.actionSubDark}>Blueprint traits</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <MetricCardsSheet
        visible={focusVisible}
        title="Next Focus"
        subtitle="The 5-6 highest-leverage metrics from your latest analysis."
        items={recommendations}
        tone="focus"
        emptyTitle="No focus metrics yet"
        emptyBody="Run an advanced analysis to unlock your next focus metrics."
        onClose={() => setFocusVisible(false)}
      />

      <MetricCardsSheet
        visible={problemsVisible}
        title="Main Problems"
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.52)",
  },
  pressed: {
    opacity: 0.76,
  },
  statusPill: {
    minWidth: 88,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.54)",
  },
  statusText: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: INK,
  },
  heroTitle: {
    marginTop: -2,
    fontFamily: FONT_BOLD,
    fontSize: 31,
    lineHeight: 35,
    color: INK,
  },
  heroSubtitle: {
    marginTop: -8,
    fontFamily: FONT_BOLD,
    fontSize: 14,
    lineHeight: 19,
    color: INK,
  },
  graphCard: {
    minHeight: 274,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.11,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  graphHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    lineHeight: 15,
    color: "#9D9EA2",
    letterSpacing: 1.6,
  },
  graphTitle: {
    marginTop: 2,
    fontFamily: FONT_BOLD,
    fontSize: 22,
    lineHeight: 27,
    color: INK,
  },
  scoreBadge: {
    minWidth: 58,
    minHeight: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FFE8",
  },
  scoreBadgeValue: {
    fontFamily: FONT_BOLD,
    fontSize: 22,
    lineHeight: 24,
    color: GREEN_DARK,
  },
  scoreBadgeDelta: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: GREEN_DARK,
  },
  scoreBadgeDeltaDown: {
    color: ORANGE,
  },
  chartWrap: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  graphFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  graphDate: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: MUTED,
  },
  graphHint: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: BLUE,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#D8EBCB",
    backgroundColor: "#FCFFF7",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9FFD9",
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    lineHeight: 19,
    color: INK,
  },
  summaryBody: {
    marginTop: 2,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    minHeight: 112,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderBottomWidth: 6,
  },
  actionButtonFocus: {
    backgroundColor: GREEN,
    borderBottomColor: GREEN_DARK,
  },
  actionButtonProblems: {
    backgroundColor: "#FFF3C9",
    borderBottomColor: "#E0AF00",
  },
  actionPressed: {
    transform: [{ translateY: 4 }],
    borderBottomWidth: 3,
  },
  actionTextWhite: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    lineHeight: 18,
    color: "#FFFFFF",
    textAlign: "center",
  },
  actionSubWhite: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: "rgba(255,255,255,0.86)",
  },
  actionTextDark: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    lineHeight: 18,
    color: INK,
    textAlign: "center",
  },
  actionSubDark: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    color: "#966D00",
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
