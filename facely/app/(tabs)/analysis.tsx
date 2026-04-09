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
  Image,
} from "react-native";
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
import { Sparkles, Target, AlertCircle, ChevronDown, ChevronRight } from "lucide-react-native";

import Text from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sw, sh } from "@/lib/responsive";
import { useScores } from "@/store/scores";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useTasksStore } from "@/store/tasks";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";

// ---------------------------------------------------------------------------
// Design constants — matched to reference
// ---------------------------------------------------------------------------

const C = {
  bg:          "#000000",
  card:        "#1A1A1A",
  cardDepth:   "#0A0A0A",
  iconBox:     "#222222",
  iconDepth:   "#111111",
  expandedBg:  "#222222",
  expandDepth: "#111111",
  textPrimary: "#FFFFFF",
  textMuted:   "#808080",
  textBody:    "#A0A0A0",
  // working (fine) — lime
  fineText:    "#2D3B1F",
  fineBg:      "#B4F34D",
  fineBorder:  "#8ECA45",
  fineIcon:    "#B4F34D",
  // okay (neutral) — off-white
  neutralText: "#1A1A1A",
  neutralBg:   "#E8E8E8",
  neutralBorder:"#C8C8C8",
  neutralIcon: "#A0A0A0",
  // needs work (alarming) — red
  alarmText:   "#4A0D0D",
  alarmBg:     "#FF6B6B",
  alarmBorder: "#D94A4A",
  alarmIcon:   "#FF6B6B",

  // ── Zone slab backgrounds (Option C: Surface Stratification) ──
  workingZoneBg:  "#0C1900",   // very subtle lime tint
  workingZoneBrd: "#192E00",
  workingCardBg:  "#142100",   // slightly lighter than zone

  okayZoneBg:     "#111111",   // neutral dark
  okayZoneBrd:    "#1C1C1C",

  needsZoneBg:    "#160202",   // very subtle red tint
  needsZoneBrd:   "#280808",
  needsCardBg:    "#1F0606",   // slightly lighter than zone
  needsCardBrd:   "#380E0E",
  needsCardDep:   "#0D0101",
};

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
  id:       string;
  group:    keyof AdvancedAnalysis;
  key:      string;
  label:    string;
  category: CategoryChip;
  emoji:    string;
  icon?:    number | null;
};

const SUBMETRIC_DEFS: SubDef[] = [
  { id: "cheekbones.width",          group: "cheekbones", key: "width",          label: "Cheekbones Width",  category: "CHEEKS", emoji: "😊",  icon: require("../../advanced-analysis-icons/cheekbones-width.jpeg")    },
  { id: "cheekbones.maxilla",        group: "cheekbones", key: "maxilla",        label: "Maxilla",           category: "CHEEKS", emoji: "🦷",  icon: require("../../advanced-analysis-icons/maxilla.jpeg")             },
  { id: "cheekbones.bone_structure", group: "cheekbones", key: "bone_structure", label: "Bone Structure",    category: "CHEEKS", emoji: "🦴",  icon: require("../../advanced-analysis-icons/bone structure.jpeg")      },
  { id: "cheekbones.face_fat",       group: "cheekbones", key: "face_fat",       label: "Face Fat",          category: "CHEEKS", emoji: "🫦",  icon: require("../../advanced-analysis-icons/face fat.jpeg")            },
  { id: "jawline.development",       group: "jawline",    key: "development",    label: "Jaw Development",   category: "JAW",    emoji: "💪",  icon: require("../../advanced-analysis-icons/jawline development.jpeg") },
  { id: "jawline.gonial_angle",      group: "jawline",    key: "gonial_angle",   label: "Gonial Angle",      category: "JAW",    emoji: "📐",  icon: require("../../advanced-analysis-icons/gonial-angle.jpeg")        },
  { id: "jawline.projection",        group: "jawline",    key: "projection",     label: "Chin Projection",   category: "JAW",    emoji: "👤",  icon: require("../../advanced-analysis-icons/chin-projection.jpeg")     },
  { id: "eyes.canthal_tilt",         group: "eyes",       key: "canthal_tilt",   label: "Canthal Tilt",      category: "EYES",   emoji: "👁️",  icon: require("../../advanced-analysis-icons/canthal tilt.jpeg")        },
  { id: "eyes.eye_type",             group: "eyes",       key: "eye_type",       label: "Eye Type",          category: "EYES",   emoji: "👀",  icon: require("../../advanced-analysis-icons/eye-type.jpeg")             },
  { id: "eyes.brow_volume",          group: "eyes",       key: "brow_volume",    label: "Brow Volume",       category: "EYES",   emoji: "🤨",  icon: require("../../advanced-analysis-icons/eyebrows-density.jpeg")    },
  { id: "eyes.symmetry",             group: "eyes",       key: "symmetry",       label: "Eye Symmetry",      category: "EYES",   emoji: "👁️",  icon: require("../../advanced-analysis-icons/eye-symmetry.jpeg")        },
  { id: "skin.color",                group: "skin",       key: "color",          label: "Skin Color",        category: "SKIN",   emoji: "🎨",  icon: require("../../advanced-analysis-icons/ski color.jpeg")           },
  { id: "skin.quality",              group: "skin",       key: "quality",        label: "Skin Quality",      category: "SKIN",   emoji: "✨",  icon: require("../../advanced-analysis-icons/skin quality.jpeg")        },
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
  return SUBMETRIC_DEFS.map((def, i) => {
    const group      = data[def.group] as Record<string, any>;
    const score      = (group[`${def.key}_score`]   as number | undefined) ?? 50;
    const commentary = (group[def.key]               as string | undefined) ?? "";
    const rawVerdict = (group[`${def.key}_verdict`]  as string | undefined) ?? "";
    const verdict    = resolveVerdict(def, score, rawVerdict);
    const { section, status } = classifyScore(score);
    return { id: def.id, label: def.label, category: def.category, score, verdict, commentary, section, status, globalIdx: i, emoji: def.emoji, icon: def.icon };
  });
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
// Metric card — the main accordion item
// ---------------------------------------------------------------------------

function MetricCard({ item }: { item: FlatMetric }) {
  const cfg         = STATUS_CONFIG[item.status];
  const isNeedsWork = item.section === "needs_work";
  const isWorking   = item.section === "working";

  // needs_work cards start expanded — commentary is always visible
  const [expanded, setExpanded]   = useState(isNeedsWork);
  const [typedText, setTypedText] = useState("");
  const hasAnimated               = useRef(false);
  const hasCommentary             = item.commentary.length > 0;

  const chevronRot     = useSharedValue(isNeedsWork ? 1 : 0);
  const revealProgress = useSharedValue(isNeedsWork ? 1 : 0);

  const toggle = useCallback(() => {
    if (!hasCommentary || isNeedsWork) return;
    const next = !expanded;
    setExpanded(next);
    chevronRot.value     = withSpring(next ? 1 : 0, { damping: 12, stiffness: 220 });
    revealProgress.value = withSpring(next ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [expanded, hasCommentary, isNeedsWork]);

  // Typewriter — auto-runs on mount for needs_work; once per open otherwise
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

  // Card visual style varies per section zone
  const cardSx = isNeedsWork ? sx.cardNeedsWork : isWorking ? sx.cardWorking : sx.card;

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
          pressed && !isNeedsWork && { opacity: 0.82, transform: [{ scale: 0.984 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}${isNeedsWork && item.commentary ? ". " + item.commentary : ""}`}
      >
        {/* Icon box */}
        <View style={[sx.iconBox, { borderBottomColor: C.iconDepth }]}>
          {item.icon ? (
            <Image source={item.icon} style={sx.metricIcon} />
          ) : (
            <Text style={sx.metricEmoji}>{item.emoji}</Text>
          )}
        </View>

        {/* Label */}
        <View style={sx.labelBlock}>
          <Text style={sx.metricLabel} numberOfLines={2}>{item.label}</Text>
        </View>

        {/* Verdict pill + chevron (chevron hidden for needs_work — always open) */}
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

      {/* ── needs_work: commentary always visible, red-tinted inset card ── */}
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
}: {
  sectionKey: SectionKey;
  metrics: FlatMetric[];
}) {
  if (metrics.length === 0) return null;

  const cfg    = STATUS_CONFIG[metrics[0].status];
  const config = SECTION_CONFIG[sectionKey];
  const zone   = ZONE_CONFIG[sectionKey];

  return (
    // Zone slab — tinted background unique to each section
    <Animated.View
      entering={FadeInDown.duration(380).delay(sectionKey === "working" ? 60 : sectionKey === "okay" ? 160 : 260)}
      style={[sx.sectionZone, { backgroundColor: zone.zoneBg, borderColor: zone.zoneBrd }]}
    >
      {/* Zone header: title left, count right (large accent number) */}
      <View style={sx.zoneHeader}>
        <View style={sx.sectionTitleRow}>
          <View style={[sx.sectionDot, { backgroundColor: cfg.dotColor }]} />
          <Text style={sx.sectionTitle}>{config.title}</Text>
        </View>
        <Text style={[sx.sectionCountLarge, { color: cfg.dotColor }]}>
          {metrics.length}
        </Text>
      </View>

      {/* Thin accent divider — colored by section status */}
      <View style={[sx.zoneDivider, { backgroundColor: zone.dividerClr + "30" }]} />

      {/* Cards */}
      <View style={sx.cardList}>
        {metrics.map((item) => (
          <MetricCard key={item.id} item={item} />
        ))}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Analysis content — rendered once we have data
// ---------------------------------------------------------------------------

function AnalysisContent({ data }: { data: AdvancedAnalysis }) {
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const metrics   = useMemo(() => flattenData(data), [data]);
  const working   = useMemo(() => metrics.filter((m) => m.section === "working"),    [metrics]);
  const okay      = useMemo(() => metrics.filter((m) => m.section === "okay"),       [metrics]);
  const needsWork = useMemo(() => metrics.filter((m) => m.section === "needs_work"), [metrics]);

  const workingFraction = metrics.length > 0 ? working.length / metrics.length : 0;

  // Animate the progress bar fill
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(workingFraction * 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [workingFraction]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` as any }));

  return (
    <>
      {/* ── Reference-style page header ── */}
      <Animated.View entering={FadeInDown.duration(340)} style={sx.refHeader}>

        {/* Row 1: score pill + ANALYSIS RESULTS label */}
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

        {/* Row 2: description */}
        <Animated.Text
          entering={FadeInDown.duration(340).delay(80)}
          style={sx.refDesc}
        >
          A balanced aesthetic breakdown to highlight your striking features, and identify areas for structural improvement and refinement.
        </Animated.Text>

        {/* Row 3: progress bar + count */}
        <Animated.View
          entering={FadeInDown.duration(340).delay(140)}
          style={sx.refBarRow}
        >
          <View style={sx.barTrack}>
            <Animated.View style={[sx.barFill, barStyle]} />
          </View>
          <Text style={sx.overviewCount}>
            {working.length} / {metrics.length}
          </Text>
        </Animated.View>

      </Animated.View>

      {/* ── Three sections ── */}
      <SectionBlock sectionKey="working"    metrics={working}   />
      <SectionBlock sectionKey="okay"       metrics={okay}      />
      <SectionBlock sectionKey="needs_work" metrics={needsWork} />

      {/* ── Footer CTA ── */}
      <Animated.View
        entering={FadeInDown.duration(340).delay(600)}
        style={sx.footerCta}
      >
        <View style={sx.ctaDepth}>
          <Pressable
            onPress={() => router.push("/(tabs)/program")}
            style={({ pressed }) => [
              sx.ctaBtn,
              { transform: [{ translateY: pressed ? 5 : 0 }] },
            ]}
          >
            <LinearGradient
              colors={[COLORS.accentLight, COLORS.accent]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={sx.ctaBtnText}>View Program</Text>
            <ChevronRight size={ms(16)} color="#0B1A00" strokeWidth={2.5} />
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state — no scan yet
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={sx.emptyWrap}>
      <Text style={sx.emptyIcon}>🔬</Text>
      <Text style={sx.emptyTitle}>No scan data</Text>
      <Text style={sx.emptySub}>
        Run a face scan to unlock your full advanced analysis.
      </Text>
      <View style={sx.ctaDepth}>
        <Pressable
          onPress={() => router.push("/(tabs)/take-picture")}
          style={({ pressed }) => [
            sx.ctaBtn,
            { transform: [{ translateY: pressed ? 5 : 0 }] },
          ]}
        >
          <LinearGradient
            colors={[COLORS.accentLight, COLORS.accent]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={sx.ctaBtnText}>Scan Now</Text>
        </Pressable>
      </View>
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

  const { scores, imageUri }               = useScores();
  const { data, loading, error, fetch }    = useAdvancedAnalysis();
  const { checkAndPromptConsent, ConsentModal } = useAdvancedAnalysisConsent();

  const hasScores = !!scores && !!imageUri;

  // Bump on every focus so AnalysisContent remounts and re-animates.
  // Data is cached in Zustand so there's no loading flash — just fresh entrance.
  const [focusKey, setFocusKey] = useState(0);

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

  const showLoading  = loading && !data;
  const showError    = !!error && !data;
  const showEmpty    = !hasScores;
  const showContent  = !!data;

  return (
    <View style={[sx.screen, { backgroundColor: C.bg }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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

          {showContent && <AnalysisContent key={focusKey} data={data!} />}
        </ScrollView>
      </View>

      {/* Consent modal — shown once before first fetch */}
      <ConsentModal />
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: sw(20),
    paddingTop: sh(14),
    paddingBottom: sh(10),
  },
  headerTitle: {
    fontSize: ms(24, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: ms(12.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textMuted,
    marginTop: sh(2),
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
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
  // Score pill — 3D press feel matching the card language
  refPillDepth: {
    borderRadius: 999,
    backgroundColor: "#0A0A0A",
    paddingBottom: 3,
  },
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    backgroundColor: "#1A1A1A",
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textMuted,
    letterSpacing: 1.8,
  },
  // Description paragraph
  refDesc: {
    fontSize: ms(14, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
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
    backgroundColor: "#1A1A1A",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: C.fineIcon,
    borderRadius: 999,
  },
  overviewCount: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textMuted,
  },

  // ── Section zone slab (Option C: Surface Stratification) ──
  sectionZone: {
    borderRadius: ms(20),
    borderWidth: 1,
    paddingTop: sh(14),
    paddingBottom: sh(16),
    paddingHorizontal: sw(12),
    overflow: "hidden",
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
  // Large accent number replacing the small "5 items" label
  sectionCountLarge: {
    fontSize: ms(26, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: -1,
  },
  cardList: { gap: sh(8) },

  // ── Metric card ──
  card: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    borderBottomWidth: 6,
    borderBottomColor: C.cardDepth,
    paddingHorizontal: sw(12),
    paddingTop: sh(9),
    paddingBottom: sh(7),
    overflow: "hidden",
  },
  // What's Working card — lime-tinted, floats above zone bg
  cardWorking: {
    backgroundColor: C.workingCardBg,
    borderRadius: CARD_RADIUS,
    borderBottomWidth: 6,
    borderBottomColor: C.workingZoneBg,
    paddingHorizontal: sw(12),
    paddingTop: sh(9),
    paddingBottom: sh(7),
    overflow: "hidden",
  },
  // Needs Work card — heavier border, more vertical padding, red-tinted
  cardNeedsWork: {
    backgroundColor: C.needsCardBg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: C.needsCardBrd,
    borderBottomWidth: 4,
    borderBottomColor: C.needsCardDep,
    paddingHorizontal: sw(12),
    paddingTop: sh(12),
    paddingBottom: sh(10),
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },

  // Icon box
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: C.iconBox,
    borderBottomWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
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
    paddingBottom: 4,
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
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
    borderBottomWidth: 2,
    borderBottomColor: C.expandDepth,
    paddingHorizontal: sw(12),
    paddingVertical: sh(9),
  },
  expandedText: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textBody,
    lineHeight: ms(20),
  },
  // needs_work commentary — always visible, red-accented inset
  expandedWrapDirect: {
    paddingTop: sh(10),
    paddingBottom: sh(2),
  },
  expandedCardDark: {
    backgroundColor: "#150303",
    borderRadius: ms(10),
    borderLeftWidth: 2,
    borderLeftColor: C.alarmIcon,
    paddingHorizontal: sw(12),
    paddingVertical: sh(9),
  },
  expandedTextDark: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: "#C49090",
    lineHeight: ms(20),
  },
  cursor: {
    color: C.fineIcon,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
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
    borderBottomWidth: 6,
    borderBottomColor: C.cardDepth,
    paddingHorizontal: sw(12),
    paddingVertical: sh(10),
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
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: sw(10),
  },
  shimmerLine: {
    height: sh(10),
    borderRadius: 6,
    backgroundColor: "#2A2A2A",
  },

  // ── Footer CTA ──
  footerCta: {
    marginTop: sh(10),
    marginBottom: sh(4),
  },
  ctaDepth: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: sh(5),
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaBtn: {
    height: sh(54),
    borderRadius: RADII.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
  },
  ctaBtnText: {
    fontSize: ms(16, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: "#0B1A00",
  },

  // ── Empty state ──
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: sh(80),
    gap: sh(14),
    paddingHorizontal: sw(8),
  },
  emptyIcon: { fontSize: ms(44), lineHeight: ms(52) },
  emptyTitle: {
    fontSize: ms(22, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: ms(14, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textMuted,
    textAlign: "center",
    lineHeight: ms(21),
    marginBottom: sh(8),
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    textAlign: "center",
  },
  errorSub: {
    fontSize: ms(13.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textMuted,
    textAlign: "center",
    lineHeight: ms(20),
  },
  retryBtn: {
    marginTop: sh(4),
    paddingHorizontal: sw(28),
    paddingVertical: sh(11),
    borderRadius: RADII.pill,
    borderWidth: 1.5,
    borderColor: COLORS.outline,
  },
  retryText: {
    fontSize: ms(14, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
  },
});
