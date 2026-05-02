// app/(tabs)/analysis.tsx
// Advanced Analysis — flat 3-section accordion list (What's Working / Just Okay / Needs Work).
// Design ref: new-advanced analysis-refernce.md

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Image as RNImage,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { Sparkles, Target, AlertCircle, ChevronDown, ChevronRight, Microscope, ScanFace, LineChart, ShieldCheck } from "lucide-react-native";
import { MetricDetailCard } from "@/components/analysis/MetricDetailCard";
import AnalysisCarousel from "@/components/analysis/AnalysisCarousel";

import Text from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sw, sh } from "@/lib/responsive";
import { useScores } from "@/store/scores";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useTasksStore } from "@/store/tasks";
import { usePotentialFace } from "@/store/potentialFace";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";
import { BlueprintModal } from "@/components/analysis/BlueprintModal";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

// ---------------------------------------------------------------------------
// Design constants — matched to reference
// ---------------------------------------------------------------------------

// Light theme palette — every "depth" / "card" / "border" key now resolves
// to the same light vocabulary used across dashboard / routine list / scan /
// score screens. Semantic keys preserved so STATUS_CONFIG / ZONE_CONFIG still
// work without restructuring.
const C = {
  bg:          COLORS.lightBg,
  card:        COLORS.lightCard,
  cardDepth:   "transparent",
  iconBox:     COLORS.iconTileLavender,
  iconDepth:   "transparent",
  expandedBg:  COLORS.lightSurface,
  expandDepth: "transparent",
  textPrimary: COLORS.lightText,
  textMuted:   COLORS.lightSub,
  textBody:    COLORS.lightMuted,

  // working (fine) — sage tint
  fineText:    "#1F3D1F",
  fineBg:      "#E2F1D8",
  fineBorder:  "#C7E2B4",
  fineIcon:    "#3F7A2A",

  // okay (neutral) — light gray
  neutralText: COLORS.lightText,
  neutralBg:   COLORS.lightSurfaceAlt,
  neutralBorder: COLORS.lightBorder,
  neutralIcon: COLORS.lightSub,

  // needs work (alarming) — soft red
  alarmText:   "#7A1F1F",
  alarmBg:     COLORS.declineRedSoft,
  alarmBorder: "#F4C0C2",
  alarmIcon:   COLORS.declineRed,

  // ── Zone slabs — flat light surfaces, no tint ──
  workingZoneBg:  COLORS.lightCard,
  workingZoneBrd: "transparent",
  workingCardBg:  COLORS.lightCard,

  okayZoneBg:     COLORS.lightCard,
  okayZoneBrd:    "transparent",

  needsZoneBg:    COLORS.lightCard,
  needsZoneBrd:   "transparent",
  needsCardBg:    COLORS.lightCard,
  needsCardBrd:   "transparent",
  needsCardDep:   "transparent",
};

// Soft drop-shadow recipe — same as elsewhere
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

const FONT = "ProximaNova-Bold";

// ---------------------------------------------------------------------------
// Section thresholds
// ---------------------------------------------------------------------------

const T_WORKING  = 72; // score >= 72  → What's Working
const T_OKAY_LOW = 55; // score 55–71  → Just Okay
                       // score  < 55  → Needs Work

// ---------------------------------------------------------------------------
// Sub-metric definitions — source of truth, maps to AdvancedAnalysis shape
// ---------------------------------------------------------------------------

type CategoryChip = "CHEEKS" | "JAW" | "EYES" | "SKIN";
type StatusKind   = "fine" | "neutral" | "alarming";
type SectionKey   = "working" | "okay" | "needs_work";

type SubDef = {
  id:         string;
  group:      keyof AdvancedAnalysis;
  key:        string;
  label:      string;
  category:   CategoryChip;
  emoji:      string;
  icon?:      number | null;
  idealRange: string;  // one-liner shown in expanded ideal-range row
};

const SUBMETRIC_DEFS: SubDef[] = [
  {
    id: "cheekbones.width", group: "cheekbones", key: "width", label: "Cheekbones Width", category: "CHEEKS", emoji: "😊",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/cheekbones--width.jpeg"),
    idealRange: "Cheekbones should be wider than the forehead is tall, giving the face a strong, broad midface. Wide but still proportional — not exaggerated.",
  },
  {
    id: "cheekbones.maxilla", group: "cheekbones", key: "maxilla", label: "Maxilla", category: "CHEEKS", emoji: "🦷",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/maxilla--.jpeg"),
    idealRange: "The upper jaw bone should sit forward, giving the cheek area a lifted, full appearance from both the front and side view.",
  },
  {
    id: "cheekbones.bone_structure", group: "cheekbones", key: "bone_structure", label: "Bone Structure", category: "CHEEKS", emoji: "🦴",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/BONE-STRUCTURE.jpeg"),
    idealRange: "High, defined cheekbones that cast a subtle shadow below them. The high point should sit level with or above the ears.",
  },
  {
    id: "cheekbones.face_fat", group: "cheekbones", key: "face_fat", label: "Face Fat", category: "CHEEKS", emoji: "🫦",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/face--fat.jpeg"),
    idealRange: "Low enough body fat (~10–14%) for the cheeks to appear hollow under the cheekbones, creating a chiseled shadow beneath them.",
  },
  {
    id: "cheekbones.fwhr", group: "cheekbones", key: "fwhr", label: "Face Width Ratio", category: "CHEEKS", emoji: "📏",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/FWHR--.jpeg"),
    idealRange: "How wide your face is compared to its height between the brows and upper lip. Wider reads as more masculine (~1.9–2.0), narrower as more feminine (~1.6–1.8).",
  },
  {
    id: "jawline.development", group: "jawline", key: "development", label: "Jaw Development", category: "JAW", emoji: "💪",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/jawline--development.jpeg"),
    idealRange: "The jaw edge should be clearly visible from the front as a sharp, defined line running from ear to chin — visible even at a distance.",
  },
  {
    id: "jawline.gonial_angle", group: "jawline", key: "gonial_angle", label: "Gonial Angle", category: "JAW", emoji: "📐",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/gonial--angle.jpeg"),
    idealRange: "The sharpness of your jaw corner. Ideal is 95–115°. Tighter corners look stronger and more chiseled. Above 125°, the corner blends away and the jaw looks round.",
  },
  {
    id: "jawline.projection", group: "jawline", key: "projection", label: "Chin Projection", category: "JAW", emoji: "👤",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/chin--projection.jpeg"),
    idealRange: "The chin should stick out to roughly the same level as the nose tip from a side view. More projection means a stronger, more defined profile.",
  },
  {
    id: "jawline.ramus", group: "jawline", key: "ramus", label: "Ramus Height", category: "JAW", emoji: "📐",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/ramus--height.jpeg"),
    idealRange: "The vertical part of the jaw (from the ear down to the jaw corner) should be tall and nearly straight up-and-down. Taller and more vertical = stronger-looking jaw corners.",
  },
  {
    id: "eyes.canthal_tilt", group: "eyes", key: "canthal_tilt", label: "Canthal Tilt", category: "EYES", emoji: "👁️",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/canthal--tilt.jpeg"),
    idealRange: "The outer corner of the eye should sit slightly higher (+3° to +5°) than the inner corner. This upward tilt gives a focused, intense look. Downward-tilted eyes appear softer and more passive.",
  },
  {
    id: "eyes.eye_type", group: "eyes", key: "eye_type", label: "Eye Type", category: "EYES", emoji: "👀",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/eye--type.jpeg"),
    idealRange: "Almond or 'hunter' shaped eyes with tight lids and no white visible below the iris. This shape gives a sharp, focused appearance rather than a wide or sleepy look.",
  },
  {
    id: "eyes.brow_volume", group: "eyes", key: "brow_volume", label: "Brow Volume", category: "EYES", emoji: "🤨",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/eyebrows--densiy.jpeg"),
    idealRange: "Thick, well-groomed brows with a clear arch. The tail should extend past the outer corner of the eye. Full brows frame the face and make the eye area look stronger.",
  },
  {
    id: "eyes.symmetry", group: "eyes", key: "symmetry", label: "Eye Symmetry", category: "EYES", emoji: "👁️",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/eyes--symmetry.jpeg"),
    idealRange: "Both eyes should look the same size and height. A difference under 2mm is barely noticeable. Over 3mm becomes clearly visible in normal face-to-face conversation.",
  },
  {
    id: "skin.color", group: "skin", key: "color", label: "Skin Color", category: "SKIN", emoji: "🎨",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/SKIN--COLOR.jpeg"),
    idealRange: "Skin tone should be even and consistent with no dark spots, redness, or patchy areas. A clear, uniform complexion across the entire face.",
  },
  {
    id: "skin.quality", group: "skin", key: "quality", label: "Skin Quality", category: "SKIN", emoji: "✨",
    icon: require("../../advanced-analysis-icons/advanced-analysis-icons-new/skin--quality.jpeg"),
    idealRange: "Skin should be smooth with small, tight pores and no active breakouts. When light hits it, it should reflect evenly rather than scatter across a rough surface.",
  },
];

// ---------------------------------------------------------------------------
// Flat metric type (derived from AdvancedAnalysis + thresholds)
// ---------------------------------------------------------------------------

type FlatMetric = {
  id:         string;
  label:      string;
  category:   CategoryChip;
  score:      number;
  verdict:    string;   // from backend; falls back to score tier if empty
  commentary: string;
  section:    SectionKey;
  status:     StatusKind;
  globalIdx:  number;
  emoji:      string;
  icon:       number | null | undefined;
  idealRange: string;  // static reference text shown in expanded ideal range row
};

function classifyScore(score: number): { section: SectionKey; status: StatusKind } {
  if (score >= T_WORKING)  return { section: "working",    status: "fine"     };
  if (score >= T_OKAY_LOW) return { section: "okay",       status: "neutral"  };
  return                          { section: "needs_work", status: "alarming" };
}

// Score-tier fallback when backend returns empty verdict
function tierLabel(score: number): string {
  if (score >= 85) return "Exceptional";
  if (score >= 75) return "Strong";
  if (score >= 65) return "Above Avg";
  if (score >= 55) return "Moderate";
  if (score >= 40) return "Below Avg";
  return "Developing";
}

// Metrics whose verdict is always derived client-side as a percentage of their score.
// These map 1-to-1 with the 0-100 score — no text label adds meaning.
const PERCENT_VERDICT_IDS = new Set(["skin.color", "skin.quality"]);

function resolveVerdict(def: SubDef, score: number, rawVerdict: string): string {
  // Skin metrics: always show score as a percentage
  if (PERCENT_VERDICT_IDS.has(def.id)) return `${score}%`;
  // Degree metrics (canthal_tilt, gonial_angle): backend returns e.g. "+4°" or "108°".
  // Accept if it looks like a degree value; fall back to tier label if backend failed.
  const cleaned = rawVerdict.trim();
  if (cleaned) return cleaned;
  return tierLabel(score);
}

function flattenData(data: AdvancedAnalysis): FlatMetric[] {
  return SUBMETRIC_DEFS
    .map((def, i) => {
      const group      = data[def.group] as Record<string, any>;
      const score      = (group[`${def.key}_score`]   as number | undefined) ?? 50;
      const commentary = (group[def.key]               as string | undefined) ?? "";
      const rawVerdict = (group[`${def.key}_verdict`]  as string | undefined) ?? "";
      const verdict    = resolveVerdict(def, score, rawVerdict);
      const { section, status } = classifyScore(score);
      return {
        id: def.id, label: def.label, category: def.category,
        score, verdict, commentary, rawVerdict,
        section, status, globalIdx: i,
        emoji: def.emoji, icon: def.icon,
        idealRange: def.idealRange,
      };
    })
    // Suppress metrics that were not assessed: ramus when no side image was provided.
    // Signal: score is exactly the Zod default (50) AND both verdict and commentary are empty.
    .filter((m) => !(m.score === 50 && (m as any).rawVerdict === "" && m.commentary === ""))
    // Re-index globalIdx after filter so animation delays stay tight.
    .map((m, i) => ({ ...m, globalIdx: i }));
}

// ---------------------------------------------------------------------------
// Status visual config
// ---------------------------------------------------------------------------

type StatusConfig = {
  icon:        React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  iconColor:   string;
  pillBg:      string;
  pillBorder:  string;
  pillText:    string;
  dotColor:    string;
};

const STATUS_CONFIG: Record<StatusKind, StatusConfig> = {
  fine:     { icon: Sparkles,     iconColor: C.fineIcon,    pillBg: C.fineBg,    pillBorder: C.fineBorder,    pillText: C.fineText,    dotColor: C.fineIcon    },
  neutral:  { icon: Target,       iconColor: C.neutralIcon, pillBg: C.neutralBg, pillBorder: C.neutralBorder, pillText: C.neutralText, dotColor: C.neutralIcon },
  alarming: { icon: AlertCircle,  iconColor: C.alarmIcon,   pillBg: C.alarmBg,   pillBorder: C.alarmBorder,   pillText: C.alarmText,   dotColor: C.alarmIcon   },
};

// ---------------------------------------------------------------------------
// Section display config
// ---------------------------------------------------------------------------

const SECTION_CONFIG: Record<SectionKey, { title: string; emptyLabel: string }> = {
  working:    { title: "What's Working",  emptyLabel: "No standout strengths yet" },
  okay:       { title: "Just Okay",       emptyLabel: "Nothing in this range"    },
  needs_work: { title: "Needs Work",      emptyLabel: "Nothing needs attention"  },
};

// ---------------------------------------------------------------------------
// Zone config — Option C: Surface Stratification
// Each section renders inside a tinted slab with its own bg + border tone
// ---------------------------------------------------------------------------

type ZoneCfg = { zoneBg: string; zoneBrd: string; dividerClr: string };

const ZONE_CONFIG: Record<SectionKey, ZoneCfg> = {
  working:    { zoneBg: C.workingZoneBg,  zoneBrd: C.workingZoneBrd, dividerClr: C.fineIcon    },
  okay:       { zoneBg: C.okayZoneBg,     zoneBrd: C.okayZoneBrd,    dividerClr: C.neutralIcon },
  needs_work: { zoneBg: C.needsZoneBg,    zoneBrd: C.needsZoneBrd,   dividerClr: C.alarmIcon   },
};

// ---------------------------------------------------------------------------
// Shimmer line — loading placeholder
// ---------------------------------------------------------------------------

function ShimmerLine({ width = "100%" }: { width?: string | number; delay?: number }) {
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2,  { duration: 700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[sx.shimmerLine, { width: width as any }, style]} />;
}

// ---------------------------------------------------------------------------
// Shimmer card — shown while loading
// ---------------------------------------------------------------------------

function ShimmerCard({ index }: { index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(index * 60)}
      style={sx.shimmerCard}
    >
      <View style={sx.shimmerRow}>
        <View style={sx.shimmerIconBox} />
        <View style={{ flex: 1, gap: sh(6) }}>
          <ShimmerLine width="55%" delay={index * 80} />
          <ShimmerLine width="35%" delay={index * 80 + 120} />
        </View>
        <View style={sx.shimmerPill}>
          <ShimmerLine width="100%" delay={index * 80 + 60} />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Metric card — original accordion behavior preserved; tap also opens detail modal
// ---------------------------------------------------------------------------

function IdealRangeRow({ text, accentColor }: { text: string; accentColor: string }) {
  return (
    <View style={sx.idealRangeRow}>
      <View style={[sx.idealRangeDot, { backgroundColor: accentColor }]} />
      <View style={sx.idealRangeTextWrap}>
        <Text style={sx.idealRangeLabel}>IDEAL</Text>
        <Text style={sx.idealRangeText}>{text}</Text>
      </View>
    </View>
  );
}

function MetricCard({ item, onPress }: { item: FlatMetric; onPress: (m: FlatMetric) => void }) {
  const cfg         = STATUS_CONFIG[item.status];
  const isNeedsWork = item.section === "needs_work";
  const isWorking   = item.section === "working";

  const [expanded]                     = useState(isNeedsWork);
  const [typedText, setTypedText]     = useState("");
  const [idealOpen, setIdealOpen]     = useState(false);
  const hasAnimated                   = useRef(false);
  const hasCommentary                 = item.commentary.length > 0;
  const hasIdealRange                 = item.idealRange.length > 0;

  const chevronRot     = useSharedValue(isNeedsWork ? 1 : 0);
  const revealProgress = useSharedValue(isNeedsWork ? 1 : 0);
  const idealProgress  = useSharedValue(0);

  const toggle = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  const toggleIdeal = useCallback(() => {
    if (!hasIdealRange) return;
    const next = !idealOpen;
    setIdealOpen(next);
    idealProgress.value = withSpring(next ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [idealOpen, hasIdealRange]);

  useEffect(() => {
    if (!expanded || !item.commentary) return;
    if (hasAnimated.current) { setTypedText(item.commentary); return; }
    setTypedText("");
    let i = 0;
    const msPerChar = Math.min(18, Math.max(7, Math.round(3500 / item.commentary.length)));
    const timer = setInterval(() => {
      i += 1;
      setTypedText(item.commentary.slice(0, i));
      if (i >= item.commentary.length) { clearInterval(timer); hasAnimated.current = true; }
    }, msPerChar);
    return () => clearInterval(timer);
  }, [expanded, item.commentary]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronRot.value, [0, 1], [0, 180])}deg` }],
  }));

  const expandStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(revealProgress.value, [0, 1], [0, 300]),
    opacity:   interpolate(revealProgress.value, [0, 0.35], [0, 1]),
    overflow:  "hidden" as const,
  }));

  const idealStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(idealProgress.value, [0, 1], [0, 120]),
    opacity:   interpolate(idealProgress.value, [0, 0.4], [0, 1]),
    overflow:  "hidden" as const,
  }));

  const cardSx     = isNeedsWork ? sx.cardNeedsWork : isWorking ? sx.cardWorking : sx.card;
  const idealAccent = isNeedsWork ? C.alarmIcon : isWorking ? C.fineIcon : C.neutralIcon;

  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(Math.min(item.globalIdx * 60, 480))}
      style={cardSx}
    >
      {/* ── Header row ── */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          sx.cardHeader,
          pressed && { opacity: 0.82, transform: [{ scale: 0.984 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}${isNeedsWork && item.commentary ? ". " + item.commentary : ""}`}
      >
        {/* Icon box */}
        <View style={[sx.iconBox, { borderBottomColor: C.iconDepth }]}>
          {item.icon ? (
            <RNImage source={item.icon} style={sx.metricIcon} />
          ) : (
            <Text style={sx.metricEmoji}>{item.emoji}</Text>
          )}
        </View>

        {/* Label */}
        <View style={sx.labelBlock}>
          <Text style={sx.metricLabel} numberOfLines={2}>{item.label}</Text>
        </View>

        {/* Verdict pill + chevron */}
        <View style={sx.rightGroup}>
          <View style={[sx.pillDepth, { backgroundColor: cfg.pillBorder }]}>
            <View style={[sx.pillFace, { backgroundColor: cfg.pillBg }]}>
              <Text style={[sx.pillText, { color: cfg.pillText }]}>
                {item.verdict}
              </Text>
            </View>
          </View>
          {hasCommentary && !isNeedsWork && (
            <Animated.View style={chevronStyle}>
              <ChevronDown size={ms(16)} color={C.textMuted} strokeWidth={2.2} />
            </Animated.View>
          )}
        </View>
      </Pressable>

      {/* ── needs_work: commentary always visible ── */}
      {isNeedsWork && hasCommentary && (
        <View style={sx.expandedWrapDirect}>
          <View style={sx.expandedCardDark}>
            <Text style={sx.expandedTextDark}>
              {typedText}
              {typedText.length < item.commentary.length && (
                <Text style={[sx.cursor, { color: C.alarmIcon }]}>|</Text>
              )}
            </Text>
          </View>
          {hasIdealRange && (
            <>
              <Pressable
                onPress={toggleIdeal}
                style={({ pressed }) => [sx.idealToggleRow, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Toggle ideal range"
              >
                <Text style={[sx.idealToggleLabel, { color: idealAccent }]}>IDEAL RANGE</Text>
                <ChevronDown
                  size={ms(13)}
                  color={idealAccent}
                  strokeWidth={2.2}
                  style={{ transform: [{ rotate: idealOpen ? "180deg" : "0deg" }] }}
                />
              </Pressable>
              <Animated.View style={idealStyle}>
                <IdealRangeRow text={item.idealRange} accentColor={idealAccent} />
              </Animated.View>
            </>
          )}
        </View>
      )}

      {/* ── working/okay: accordion expand ── */}
      {!isNeedsWork && hasCommentary && (
        <Animated.View style={expandStyle}>
          <View style={sx.expandedWrap}>
            <View style={sx.expandedCard}>
              <Text style={sx.expandedText}>
                {typedText}
                {expanded && typedText.length < item.commentary.length && (
                  <Text style={sx.cursor}>|</Text>
                )}
              </Text>
            </View>
            {hasIdealRange && (
              <>
                <Pressable
                  onPress={toggleIdeal}
                  style={({ pressed }) => [sx.idealToggleRow, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle ideal range"
                >
                  <Text style={[sx.idealToggleLabel, { color: idealAccent }]}>IDEAL RANGE</Text>
                  <ChevronDown
                    size={ms(13)}
                    color={idealAccent}
                    strokeWidth={2.2}
                    style={{ transform: [{ rotate: idealOpen ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
                <Animated.View style={idealStyle}>
                  <IdealRangeRow text={item.idealRange} accentColor={idealAccent} />
                </Animated.View>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* Shimmer — commentary not yet loaded */}
      {!hasCommentary && (
        <View style={sx.commentaryShimmer}>
          <ShimmerLine width="90%" delay={item.globalIdx * 90} />
          <ShimmerLine width="65%" delay={item.globalIdx * 90 + 130} />
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Section block
// ---------------------------------------------------------------------------

function SectionBlock({
  sectionKey,
  metrics,
  onCardPress,
}: {
  sectionKey:  SectionKey;
  metrics:     FlatMetric[];
  onCardPress: (m: FlatMetric) => void;
}) {
  if (metrics.length === 0) return null;

  const cfg    = STATUS_CONFIG[metrics[0].status];
  const config = SECTION_CONFIG[sectionKey];
  const zone   = ZONE_CONFIG[sectionKey];

  return (
    <Animated.View
      entering={FadeInDown.duration(380).delay(sectionKey === "working" ? 60 : sectionKey === "okay" ? 160 : 260)}
      style={[sx.sectionZone, { backgroundColor: zone.zoneBg, borderColor: zone.zoneBrd }]}
    >
      {/* Zone header */}
      <View style={sx.zoneHeader}>
        <View style={sx.sectionTitleRow}>
          <View style={[sx.sectionDot, { backgroundColor: cfg.dotColor }]} />
          <Text style={sx.sectionTitle}>{config.title}</Text>
        </View>
        <Text style={[sx.sectionCountLarge, { color: cfg.dotColor }]}>
          {metrics.length}
        </Text>
      </View>

      {/* Accent divider */}
      <View style={[sx.zoneDivider, { backgroundColor: zone.dividerClr + "30" }]} />

      {/* Cards */}
      <View style={sx.cardList}>
        {metrics.map((item) => (
          <MetricCard key={item.id} item={item} onPress={onCardPress} />
        ))}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Analysis content — rendered once we have data
// ---------------------------------------------------------------------------

export function AnalysisContent({
  data,
  viewportWidth,
  imageUri,
}: {
  data: AdvancedAnalysis;
  viewportWidth: number;
  imageUri?: string | null;
}) {
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const metrics   = useMemo(() => flattenData(data), [data]);

  // Single carousel ordered by section: working → okay → needs_work.
  // Section identity is conveyed via a chip on each card; chip color shifts
  // as the user swipes between sections.
  const ordered = useMemo(() => {
    const working   = metrics.filter((m) => m.section === "working");
    const okay      = metrics.filter((m) => m.section === "okay");
    const needsWork = metrics.filter((m) => m.section === "needs_work");
    return [...working, ...okay, ...needsWork];
  }, [metrics]);

  // ── Detail modal state ────────────────────────────────────────────────────
  const [selectedMetric, setSelectedMetric] = useState<FlatMetric | null>(null);
  const handleCardPress  = useCallback((m: FlatMetric) => setSelectedMetric(m), []);
  const handleModalClose = useCallback(() => setSelectedMetric(null),            []);

  return (
    <>
      {/* ── Page header ── */}
      <Animated.View entering={FadeInDown.duration(340)} style={sx.refHeader}>
        <View style={sx.refTopRow}>
          <View style={sx.refPillDepth}>
            <View style={sx.refPill}>
              <Text style={sx.refPillFire}>🔥</Text>
              <Text style={sx.refPillScore}>{currentStreak}</Text>
            </View>
          </View>
          <View style={sx.refLabelRow}>
            <View style={sx.refLabelDot} />
            <Text style={sx.refLabelText}>ANALYSIS RESULTS</Text>
          </View>
        </View>

      </Animated.View>

      {/* ── Framed user avatar — same vocabulary as the score screen ── */}
      <Animated.View entering={FadeInDown.duration(380).delay(120)} style={sx.avatarSection}>
        <View style={sx.avatarRing}>
          {imageUri ? (
            <ExpoImage
              source={{ uri: imageUri }}
              style={sx.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
            />
          ) : (
            <View style={[sx.avatarImg, sx.avatarPlaceholder]} />
          )}
        </View>
      </Animated.View>

      {/* ── Swipeable carousel of all metrics ── */}
      <Animated.View entering={FadeInDown.duration(420).delay(160)}>
        <AnalysisCarousel
          metrics={ordered}
          viewportWidth={viewportWidth}
          onCardPress={(c) => {
            // Carousel emits a slim CarouselMetric — find the full FlatMetric
            // by id so the popup gets commentary + ideal range too.
            const full = ordered.find((m) => m.id === c.id) ?? null;
            if (full) handleCardPress(full);
          }}
        />
      </Animated.View>

      {/* ── Footer CTA — black pill, matches START ROUTINE elsewhere ── */}
      <Animated.View
        entering={FadeInDown.duration(340).delay(600)}
        style={sx.footerCta}
      >
        <Pressable
          onPress={() => {
            // First-time onboarding flow: route through the Potential Face
            // reveal once, then the user lands in the program.  After the
            // reveal has been *successfully* dismissed once, this CTA goes
            // straight to the program tab on every subsequent visit.
            //
            // We require BOTH revealSeen=true AND a `ready` row to bypass.
            // This auto-recovers from edge cases where revealSeen got set by
            // an earlier code path that didn't actually show a successful
            // reveal — without this guard, those users would never see the
            // reveal even after a fresh generation finally succeeds.
            const state = usePotentialFace.getState();
            const ackedRealReveal =
              state.revealSeen && state.data?.status === "ready";
            if (ackedRealReveal) router.push("/(tabs)/program");
            else router.push("/(onboarding)/potential-face-reveal");
          }}
          style={({ pressed }) => [sx.ctaBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={sx.ctaBtnText}>START YOUR ROUTINE</Text>
          <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>

      {/* ── Detail card modal ── */}
      <MetricDetailCard
        metric={selectedMetric}
        onDismiss={handleModalClose}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state — no scan yet
// ---------------------------------------------------------------------------

function EmptyState() {
  const benefits = [
    { Icon: ScanFace,    label: "15 facial sub-metrics" },
    { Icon: LineChart,   label: "Personalized ideal ranges"   },
    { Icon: ShieldCheck, label: "Private — scans stay on device" },
  ];

  return (
    <View style={sx.emptyWrap}>
      <Animated.View entering={FadeInDown.duration(380)} style={sx.emptyIconFrame}>
        <View style={sx.emptyIconGlow} />
        <View style={sx.emptyIconCore}>
          <Microscope size={ms(30)} color={COLORS.accent} strokeWidth={1.8} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(380).delay(80)} style={sx.emptyLabelRow}>
        <View style={sx.emptyLabelDot} />
        <Text style={sx.emptyLabelText}>ADVANCED ANALYSIS</Text>
      </Animated.View>

      <Animated.Text entering={FadeInDown.duration(380).delay(140)} style={sx.emptyTitle}>
        Unlock your full breakdown
      </Animated.Text>

      <Animated.Text entering={FadeInDown.duration(380).delay(200)} style={sx.emptySub}>
        Capture a face scan and we'll generate a detailed report across your cheeks, jaw, eyes, and skin.
      </Animated.Text>

      <Animated.View entering={FadeInDown.duration(380).delay(260)} style={sx.emptyBenefits}>
        {benefits.map(({ Icon, label }, i) => (
          <View key={i} style={sx.benefitRow}>
            <View style={sx.benefitIconBox}>
              <Icon size={ms(14)} color={COLORS.accent} strokeWidth={2.2} />
            </View>
            <Text style={sx.benefitText}>{label}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(380).delay(340)}
        style={[sx.emptyCta]}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/take-picture")}
          style={({ pressed }) => [sx.ctaBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Start face scan"
        >
          <Text style={sx.ctaBtnText}>START FACE SCAN</Text>
          <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={sx.errorWrap}>
      <AlertCircle size={ms(32)} color={COLORS.error} strokeWidth={1.8} />
      <Text style={sx.errorTitle}>Analysis unavailable</Text>
      <Text style={sx.errorSub}>{message}</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [sx.retryBtn, pressed && { opacity: 0.75 }]}>
        <Text style={sx.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();

  const { scores, imageUri }               = useScores();
  const { data, loading, error, fetch, cachedScanId } = useAdvancedAnalysis();
  const { checkAndPromptConsent, ConsentModal }        = useAdvancedAnalysisConsent();

  const hasScores = !!scores && !!imageUri;
  // Carousel viewport — screen width minus the scroll's horizontal padding
  // (sw(16) on each side, see sx.scrollContent).
  const viewportWidth = SW - sw(16) * 2;

  // Bump on every focus so AnalysisContent remounts and re-animates.
  // Data is cached in Zustand so there's no loading flash — just fresh entrance.
  const [focusKey, setFocusKey] = useState(0);

  // Blueprint modal — shown once per scan (keyed to cachedScanId).
  // Marks the scan id only AFTER the user dismisses, so the modal becomes
  // the first thing they see in the advanced flow and the carousel stays
  // hidden underneath until then.
  const [blueprintVisible, setBlueprintVisible] = useState(false);
  const dismissedForScanIdRef = useRef<string | null>(null);

  // Fetch on every focus — consent gate runs once per install (Apple 5.1.1/5.1.2)
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
      if (hasScores && !data && !loading) {
        checkAndPromptConsent().then((agreed) => {
          if (agreed) fetch();
        });
      }
    }, [hasScores, data, loading, checkAndPromptConsent, fetch])
  );

  // Pending = data is ready for a scan the user hasn't dismissed the
  // blueprint for yet. Drives both the modal trigger and the content gate
  // so the carousel never flashes behind the modal on first entry.
  const needsFirstSurface =
    !!data && !!cachedScanId && dismissedForScanIdRef.current !== cachedScanId;

  useEffect(() => {
    if (needsFirstSurface && !blueprintVisible) setBlueprintVisible(true);
  }, [needsFirstSurface, blueprintVisible]);

  const handleBlueprintDismiss = useCallback(() => {
    if (cachedScanId) dismissedForScanIdRef.current = cachedScanId;
    setBlueprintVisible(false);
  }, [cachedScanId]);

  const showLoading  = loading && !data;
  const showError    = !!error && !data;
  const showEmpty    = !hasScores;
  // Hide the carousel until the blueprint is dismissed for this scan.
  const showContent  = !!data && !needsFirstSurface;

  return (
    <View style={[sx.screen, { backgroundColor: C.bg }]}>
      {/* Safe-area container */}
      <View style={[sx.safeArea, { paddingTop: insets.top }]}>

        {/* ── Header — only shown for non-content states ── */}
        {!showContent && (
          <Animated.View
            entering={FadeInDown.duration(360)}
            style={sx.header}
          >
            <Text style={sx.headerTitle}>Advanced Analysis</Text>
            <Text style={sx.headerSub}>Your detailed facial breakdown</Text>
          </Animated.View>
        )}

        {/* ── Body ── */}
        <ScrollView
          style={sx.scroll}
          contentContainerStyle={[
            sx.scrollContent,
            { paddingBottom: insets.bottom + SP[8] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {showEmpty && <EmptyState />}

          {showError && (
            <ErrorState message={error!} onRetry={fetch} />
          )}

          {showLoading && !showEmpty && (
            <View style={sx.shimmerList}>
              {Array.from({ length: 8 }).map((_, i) => (
                <ShimmerCard key={i} index={i} />
              ))}
            </View>
          )}

          {showContent && <AnalysisContent key={focusKey} data={data!} viewportWidth={viewportWidth} imageUri={imageUri} />}
        </ScrollView>
      </View>

      {/* Consent modal — shown once before first fetch */}
      <ConsentModal />

      {/* Blueprint modal — auto-surfaces once per scan as the first screen
          of the advanced-analysis flow, before the carousel is revealed. */}
      {!!data && (
        <BlueprintModal
          data={data}
          imageUri={imageUri ?? null}
          visible={blueprintVisible}
          onDismiss={handleBlueprintDismiss}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const CARD_RADIUS   = ms(18);
const ICON_BOX_SIZE = ms(36);
const ICON_RADIUS   = ms(10);
const PILL_RADIUS   = ms(999);

const sx = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },

  // ── Header ──
  header: {
    alignItems: "center",
    paddingHorizontal: sw(20),
    paddingTop: sh(14),
    paddingBottom: sh(10),
  },
  headerTitle: {
    fontSize: ms(22, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  headerSub: {
    fontSize: ms(12.5, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    marginTop: sh(3),
    textAlign: "center",
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
    marginTop: sh(4),
  },
  liveDot: {
    width: sw(7),
    height: sw(7),
    borderRadius: 999,
    backgroundColor: C.fineIcon,
  },
  liveLabel: {
    fontSize: ms(10, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    letterSpacing: 1.4,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingTop: sh(2),
    gap: sh(12),
  },

  // ── Framed user avatar — mirrors score-screen vocabulary ──
  avatarSection: {
    alignItems: "center",
    marginTop: sh(8),
    marginBottom: sh(4),
  },
  avatarRing: {
    width: ms(128),
    height: ms(128),
    borderRadius: ms(64),
    padding: ms(4),
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: ms(60),
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.iconTileLavender,
  },

  // ── Reference-style header (inside AnalysisContent) ──
  refHeader: {
    paddingHorizontal: sw(4),
    paddingTop: sh(10),
    paddingBottom: sh(22),
    gap: sh(14),
  },
  refTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },
  // Streak pill — black on white, matches the same chip used app-wide
  refPillDepth: {
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    backgroundColor: COLORS.ctaBlack,
    borderRadius: 999,
    paddingHorizontal: sw(14),
    paddingVertical: sh(7),
  },
  refPillFire: {
    fontSize: ms(13),
    lineHeight: ms(16),
  },
  refPillScore: {
    fontSize: ms(14, 0.3),
    fontFamily: FONT,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  // "• ANALYSIS RESULTS" label
  refLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(7),
  },
  refLabelDot: {
    width: sw(7),
    height: sw(7),
    borderRadius: 999,
    backgroundColor: C.fineIcon,
  },
  refLabelText: {
    fontSize: ms(10.5, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    letterSpacing: 1.8,
  },
  // Description paragraph
  refDesc: {
    fontSize: ms(14, 0.3),
    fontFamily: FONT,
    color: C.textBody,
    lineHeight: ms(21),
  },
  // Progress bar row
  refBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },

  // ── Overview bar (kept for style references) ──
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    marginBottom: sh(20),
    paddingHorizontal: sw(4),
  },
  barTrack: {
    flex: 1,
    height: sh(8),
    backgroundColor: COLORS.lightSurfaceAlt,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: COLORS.ctaBlack,
    borderRadius: 999,
  },
  overviewCount: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
  },

  // ── Section zone — light card with soft shadow ──
  sectionZone: {
    borderRadius: ms(20),
    paddingTop: sh(14),
    paddingBottom: sh(16),
    paddingHorizontal: sw(12),
    overflow: "hidden",
    ...SOFT_SHADOW,
  },
  // Zone header: title left, large accent count right
  zoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: sh(10),
  },
  // Thin horizontal accent line below zone header
  zoneDivider: {
    height: 1,
    marginBottom: sh(12),
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: sw(7) },
  sectionDot: {
    width: sw(7),
    height: sw(7),
    borderRadius: 999,
  },
  sectionTitle: {
    fontSize: ms(17, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
  // Large accent number replacing the small "5 items" label
  sectionCountLarge: {
    fontSize: ms(26, 0.3),
    fontFamily: FONT,
    letterSpacing: -0.3,
  },
  cardList: { gap: sh(8) },

  // ── Metric card — flat row inside the zone, no extra shadow ──
  card: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: sw(12),
    paddingTop: sh(10),
    paddingBottom: sh(10),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
  },
  cardWorking: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: sw(12),
    paddingTop: sh(10),
    paddingBottom: sh(10),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
  },
  cardNeedsWork: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: sw(12),
    paddingTop: sh(12),
    paddingBottom: sh(12),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.alarmBorder,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },

  // Icon box — lavender tile
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: C.iconBox,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },

  // Label + chip
  labelBlock: {
    flex: 1,
    gap: sh(3),
  },
  metricIcon: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
  },
  metricEmoji: {
    fontSize: ms(18),
    lineHeight: ms(20),
    textAlign: "center" as const,
  },
  metricLabel: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    lineHeight: ms(16),
  },
  categoryChip: {
    alignSelf: "flex-start",
    borderRadius: ms(6),
    borderWidth: 1,
    paddingHorizontal: sw(6),
    paddingVertical: sh(1),
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  categoryChipText: {
    fontSize: ms(9.5, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    letterSpacing: 0.8,
  },

  // Right group: pill + chevron
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
    flexShrink: 0,
  },
  pillDepth: {
    borderRadius: PILL_RADIUS,
    backgroundColor: "transparent",
  },
  pillFace: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: sw(8),
    paddingVertical: sh(3),
    minWidth: sw(56),
    maxWidth: sw(130),
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: ms(10.5, 0.3),
    fontFamily: FONT,
    lineHeight: ms(13),
    textAlign: "center" as const,
  },

  // Expanded commentary
  expandedWrap: {
    paddingTop: sh(8),
    paddingBottom: sh(2),
  },
  expandedCard: {
    backgroundColor: C.expandedBg,
    borderRadius: ms(12),
    paddingHorizontal: sw(12),
    paddingVertical: sh(9),
  },
  expandedText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT,
    color: C.textBody,
    lineHeight: ms(20),
  },
  // needs_work commentary — always visible, red-accented inset
  expandedWrapDirect: {
    paddingTop: sh(10),
    paddingBottom: sh(2),
  },
  expandedCardDark: {
    backgroundColor: COLORS.declineRedSoft,
    borderRadius: ms(10),
    borderLeftWidth: 2,
    borderLeftColor: C.alarmIcon,
    paddingHorizontal: sw(12),
    paddingVertical: sh(9),
  },
  expandedTextDark: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT,
    color: C.alarmText,
    lineHeight: ms(20),
  },
  cursor: {
    color: C.fineIcon,
    fontFamily: FONT,
  },

  // Commentary shimmer (while card present but text not loaded)
  commentaryShimmer: {
    gap: sh(5),
    paddingTop: sh(10),
    paddingBottom: sh(4),
  },

  // ── Shimmer loading ──
  shimmerList: { gap: sh(10) },
  shimmerCard: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: sw(12),
    paddingVertical: sh(10),
    ...SOFT_SHADOW,
  },
  shimmerRow: { flexDirection: "row", alignItems: "center", gap: sw(12) },
  shimmerIconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: C.iconBox,
    flexShrink: 0,
  },
  shimmerPill: {
    width: sw(72),
    height: sh(30),
    borderRadius: PILL_RADIUS,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: sw(10),
  },
  shimmerLine: {
    height: sh(10),
    borderRadius: ms(6),
    backgroundColor: COLORS.lightSurfaceAlt,
  },

  // ── Footer CTA — black pill ──
  footerCta: {
    marginTop: sh(10),
    marginBottom: sh(4),
  },
  ctaBtn: {
    minHeight: sh(56),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingVertical: sh(16),
    paddingHorizontal: sw(20),
  },
  ctaBtnText: {
    fontSize: ms(15, 0.3),
    fontFamily: FONT,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  // ── Empty state ──
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: sh(48),
    paddingBottom: sh(40),
    paddingHorizontal: sw(20),
  },
  emptyIconFrame: {
    width: ms(84),
    height: ms(84),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sh(22),
  },
  emptyIconGlow: {
    position: "absolute",
    width: ms(84),
    height: ms(84),
    borderRadius: ms(42),
    backgroundColor: COLORS.iconTileLavender,
    opacity: 1,
  },
  emptyIconCore: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  emptyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(7),
    marginBottom: sh(10),
  },
  emptyLabelDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: 999,
    backgroundColor: C.fineIcon,
  },
  emptyLabelText: {
    fontSize: ms(10.5, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    letterSpacing: 1.8,
  },
  emptyTitle: {
    fontSize: ms(24, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: sh(10),
  },
  emptySub: {
    fontSize: ms(13.5, 0.3),
    fontFamily: FONT,
    color: C.textBody,
    textAlign: "center",
    lineHeight: ms(21),
    maxWidth: sw(300),
  },
  emptyBenefits: {
    alignSelf: "stretch",
    gap: sh(10),
    marginTop: sh(24),
    marginBottom: sh(28),
    paddingHorizontal: sw(8),
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },
  benefitIconBox: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT,
    color: C.textBody,
    flex: 1,
  },
  emptyCta: {
    alignSelf: "stretch",
  },

  // ── Error state ──
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: sh(80),
    gap: sh(12),
    paddingHorizontal: sw(8),
  },
  errorTitle: {
    fontSize: ms(20, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    textAlign: "center",
  },
  errorSub: {
    fontSize: ms(13.5, 0.3),
    fontFamily: FONT,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: ms(20),
  },
  retryBtn: {
    marginTop: sh(4),
    paddingHorizontal: sw(28),
    paddingVertical: sh(11),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  retryText: {
    fontSize: ms(14, 0.3),
    fontFamily: FONT,
    color: C.textPrimary,
    letterSpacing: 0.4,
  },

  // ── Ideal range ──
  idealToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: sh(10),
    paddingTop: sh(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.lightHairline,
    paddingHorizontal: sw(2),
  },
  idealToggleLabel: {
    fontSize: ms(10, 0.3),
    fontFamily: FONT,
    letterSpacing: 1.1,
  },
  idealRangeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: sw(8),
    paddingTop: sh(8),
    paddingBottom: sh(4),
    paddingHorizontal: sw(2),
  },
  idealRangeDot: {
    width: sw(4),
    height: sw(4),
    borderRadius: sw(2),
    marginTop: sh(5),
    flexShrink: 0,
    opacity: 0.7,
  },
  idealRangeTextWrap: {
    flex: 1,
    gap: sh(2),
  },
  idealRangeLabel: {
    fontSize: ms(9.5, 0.3),
    fontFamily: FONT,
    color: COLORS.lightSub,
    letterSpacing: 0.8,
  },
  idealRangeText: {
    fontSize: ms(12, 0.3),
    fontFamily: FONT,
    color: COLORS.lightMuted,
    lineHeight: ms(18),
  },
});
