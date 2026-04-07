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
};

const SUBMETRIC_DEFS: SubDef[] = [
  { id: "cheekbones.width",          group: "cheekbones", key: "width",          label: "Cheekbones Width",  category: "CHEEKS" },
  { id: "cheekbones.maxilla",        group: "cheekbones", key: "maxilla",        label: "Maxilla",           category: "CHEEKS" },
  { id: "cheekbones.bone_structure", group: "cheekbones", key: "bone_structure", label: "Bone Structure",    category: "CHEEKS" },
  { id: "cheekbones.face_fat",       group: "cheekbones", key: "face_fat",       label: "Face Fat",          category: "CHEEKS" },
  { id: "jawline.development",       group: "jawline",    key: "development",    label: "Jaw Development",   category: "JAW"    },
  { id: "jawline.gonial_angle",      group: "jawline",    key: "gonial_angle",   label: "Gonial Angle",      category: "JAW"    },
  { id: "jawline.projection",        group: "jawline",    key: "projection",     label: "Chin Projection",   category: "JAW"    },
  { id: "eyes.canthal_tilt",         group: "eyes",       key: "canthal_tilt",   label: "Canthal Tilt",      category: "EYES"   },
  { id: "eyes.eye_type",             group: "eyes",       key: "eye_type",       label: "Eye Type",          category: "EYES"   },
  { id: "eyes.brow_volume",          group: "eyes",       key: "brow_volume",    label: "Brow Volume",       category: "EYES"   },
  { id: "eyes.symmetry",             group: "eyes",       key: "symmetry",       label: "Eye Symmetry",      category: "EYES"   },
  { id: "skin.color",                group: "skin",       key: "color",          label: "Skin Color",        category: "SKIN"   },
  { id: "skin.quality",              group: "skin",       key: "quality",        label: "Skin Quality",      category: "SKIN"   },
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

function flattenData(data: AdvancedAnalysis): FlatMetric[] {
  return SUBMETRIC_DEFS.map((def, i) => {
    const group = data[def.group] as Record<string, any>;
    const score      = (group[`${def.key}_score`]   as number | undefined) ?? 50;
    const commentary = (group[def.key]               as string | undefined) ?? "";
    const rawVerdict = (group[`${def.key}_verdict`]  as string | undefined) ?? "";
    const verdict    = rawVerdict.trim() || tierLabel(score);
    const { section, status } = classifyScore(score);
    return { id: def.id, label: def.label, category: def.category, score, verdict, commentary, section, status, globalIdx: i };
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
// Shimmer line — loading placeholder
// ---------------------------------------------------------------------------

function ShimmerLine({ width = "100%", delay = 0 }: { width?: string | number; delay?: number }) {
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
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;

  const [expanded, setExpanded]   = useState(false);
  const [typedText, setTypedText] = useState("");
  const hasAnimated               = useRef(false);
  const hasCommentary             = item.commentary.length > 0;

  const chevronRot     = useSharedValue(0);
  const revealProgress = useSharedValue(0);

  const toggle = useCallback(() => {
    if (!hasCommentary) return;
    const next = !expanded;
    setExpanded(next);
    chevronRot.value     = withSpring(next ? 1 : 0, { damping: 14, stiffness: 180 });
    revealProgress.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 160 });
  }, [expanded, hasCommentary]);

  // Typewriter — runs once per open; thereafter shows full text instantly
  useEffect(() => {
    if (!expanded || !item.commentary) return;
    if (hasAnimated.current) { setTypedText(item.commentary); return; }
    setTypedText("");
    let i = 0;
    // Speed scales with length: cap total duration at ~3.5s
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

  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(Math.min(item.globalIdx * 65, 520)).springify()}
      style={sx.card}
    >
      {/* ── Header row ── */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [sx.cardHeader, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}. ${expanded ? "Collapse" : "Expand"} details`}
      >
        {/* Icon box */}
        <View style={[sx.iconBox, { borderBottomColor: C.iconDepth }]}>
          <Icon size={ms(21)} color={cfg.iconColor} strokeWidth={1.9} />
        </View>

        {/* Label + category chip */}
        <View style={sx.labelBlock}>
          <Text style={sx.metricLabel} numberOfLines={1}>{item.label}</Text>
          <View style={[sx.categoryChip, { borderColor: C.cardDepth }]}>
            <Text style={sx.categoryChipText}>{item.category}</Text>
          </View>
        </View>

        {/* Verdict pill + chevron */}
        <View style={sx.rightGroup}>
          <View style={[sx.pillDepth, { backgroundColor: cfg.pillBorder }]}>
            <View style={[sx.pillFace, { backgroundColor: cfg.pillBg }]}>
              <Text style={[sx.pillText, { color: cfg.pillText }]} numberOfLines={1}>
                {item.verdict}
              </Text>
            </View>
          </View>
          {hasCommentary && (
            <Animated.View style={chevronStyle}>
              <ChevronDown size={ms(16)} color={C.textMuted} strokeWidth={2.2} />
            </Animated.View>
          )}
        </View>
      </Pressable>

      {/* ── Expanded commentary ── */}
      {hasCommentary && (
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

  return (
    <View style={sx.section}>
      {/* Section header */}
      <Animated.View
        entering={FadeInDown.duration(340).delay(sectionKey === "working" ? 80 : sectionKey === "okay" ? 180 : 280)}
        style={sx.sectionHeader}
      >
        <View style={sx.sectionTitleRow}>
          <View style={[sx.sectionDot, { backgroundColor: cfg.dotColor }]} />
          <Text style={sx.sectionTitle}>{config.title}</Text>
        </View>
        <Text style={sx.sectionCount}>{metrics.length} {metrics.length === 1 ? "item" : "items"}</Text>
      </Animated.View>

      {/* Cards */}
      <View style={sx.cardList}>
        {metrics.map((item) => (
          <MetricCard key={item.id} item={item} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Analysis content — rendered once we have data
// ---------------------------------------------------------------------------

function AnalysisContent({ data }: { data: AdvancedAnalysis }) {
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
      {/* ── Overview bar ── */}
      <Animated.View
        entering={FadeInDown.duration(380).delay(40)}
        style={sx.overviewRow}
      >
        <View style={sx.barTrack}>
          <Animated.View style={[sx.barFill, barStyle]} />
        </View>
        <Text style={sx.overviewCount}>
          {working.length} / {metrics.length}
        </Text>
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

  // Fetch on every focus — consent gate runs once per install (Apple 5.1.1/5.1.2)
  useFocusEffect(
    useCallback(() => {
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

        {/* ── Header ── */}
        <Animated.View
          entering={FadeInDown.duration(360)}
          style={sx.header}
        >
          <View>
            <Text style={sx.headerTitle}>Advanced Analysis</Text>
            <Text style={sx.headerSub}>
              {showContent
                ? "Tap any metric to read the full breakdown."
                : "Your detailed facial breakdown"}
            </Text>
          </View>
          {/* Live dot when data is loaded */}
          {showContent && (
            <View style={sx.liveRow}>
              <View style={sx.liveDot} />
              <Text style={sx.liveLabel}>RESULTS</Text>
            </View>
          )}
        </Animated.View>

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

          {showContent && <AnalysisContent data={data!} />}
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

const CARD_RADIUS   = ms(20);
const ICON_BOX_SIZE = ms(52);
const ICON_RADIUS   = ms(14);
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
    paddingTop: sh(4),
    gap: sh(2),
  },

  // ── Overview bar ──
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    marginBottom: sh(20),
    paddingHorizontal: sw(4),
  },
  barTrack: {
    flex: 1,
    height: sh(5),
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

  // ── Section ──
  section: { gap: sh(10), marginBottom: sh(28) },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sw(4),
    marginBottom: sh(4),
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
  sectionCount: {
    fontSize: ms(12.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textMuted,
  },
  cardList: { gap: sh(10) },

  // ── Metric card ──
  card: {
    backgroundColor: C.card,
    borderRadius: CARD_RADIUS,
    borderBottomWidth: 5,
    borderBottomColor: C.cardDepth,
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
    borderBottomWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Label + chip
  labelBlock: {
    flex: 1,
    gap: sh(4),
  },
  metricLabel: {
    fontSize: ms(14.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    lineHeight: ms(18),
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
    paddingBottom: sh(3),
  },
  pillFace: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: sw(11),
    paddingVertical: sh(5),
    minWidth: sw(68),
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: ms(12, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    lineHeight: ms(15),
  },

  // Expanded commentary
  expandedWrap: {
    paddingTop: sh(10),
    paddingBottom: sh(2),
  },
  expandedCard: {
    backgroundColor: C.expandedBg,
    borderRadius: ms(14),
    borderBottomWidth: 2,
    borderBottomColor: C.expandDepth,
    paddingHorizontal: sw(14),
    paddingVertical: sh(12),
  },
  expandedText: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textBody,
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
    borderBottomWidth: 5,
    borderBottomColor: C.cardDepth,
    paddingHorizontal: sw(12),
    paddingVertical: sh(14),
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
