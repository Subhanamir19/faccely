// app/history/analysis-card.tsx
// Analysis detail — vertical scroll, priority-ordered metrics, expandable insights.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  Image,
  Pressable,
  Platform,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { COLORS, SP, RADII, TYPE, SIZES } from "@/lib/tokens";
import {
  getArchetype,
  getMetricPriorities,
  getOverallScore,
  METRIC_LABELS,
  getMetricRecommendations,
} from "@/lib/analysisInsights";
import type { MetricKey } from "@/lib/types";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Score helpers ──────────────────────────────────────────────────────────

const SCORE_TIERS = [
  { max: 39, color: "#EF4444", glow: "rgba(239,68,68,0.25)" },
  { max: 59, color: "#F97316", glow: "rgba(249,115,22,0.25)" },
  { max: 79, color: "#F59E0B", glow: "rgba(245,158,11,0.25)" },
  { max: 100, color: "#B4F34D", glow: "rgba(180,243,77,0.25)" },
] as const;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getScoreTier(score: number) {
  const s = clamp(score, 0, 100);
  return SCORE_TIERS.find(({ max }) => s <= max) ?? SCORE_TIERS[3];
}

function getScoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 50) return "Average";
  return "Needs Work";
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + Math.round((255 - (n >> 16)) * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round((255 - ((n >> 8) & 0xff)) * amount));
  const b = Math.min(255, (n & 0xff) + Math.round((255 - (n & 0xff)) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function formatDate(value?: string): string {
  if (!value) return "--";
  try {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

// ── Animated score ring ────────────────────────────────────────────────────

const RING_SIZE = 80;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ScoreRing({ value, delay = 0 }: { value: number; delay?: number }) {
  const tier = getScoreTier(value);
  const colorLight = lighten(tier.color, 0.35);
  const stroke = 8;
  const r = (RING_SIZE - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = RING_SIZE / 2;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - clamp(value, 0, 100) / 100)],
  });

  const band = getScoreBand(value);

  return (
    <View style={[ringStyles.wrap, { shadowColor: tier.color }]}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <SvgGradient id={`g${value}${delay}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colorLight} />
            <Stop offset="100%" stopColor={tier.color} />
          </SvgGradient>
        </Defs>
        <Circle cx={center} cy={center} r={r} stroke={COLORS.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={center} cy={center} r={r}
          stroke={`url(#g${value}${delay})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          originX={center}
          originY={center}
        />
      </Svg>
      <View style={ringStyles.center}>
        <Text style={[ringStyles.value, { color: tier.color }]}>
          {Math.round(clamp(value, 0, 100))}
        </Text>
        <Text style={[ringStyles.band, { color: tier.color }]}>{band}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  value: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: "Poppins-SemiBold",
  },
  band: {
    fontSize: 8,
    lineHeight: 10,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginTop: 1,
  },
});

// ── Metric card ────────────────────────────────────────────────────────────

type MetricCardProps = {
  metric: MetricKey;
  label: string;
  score: number;
  lines: string[];
  index: number;
};

function MetricCard({ metric, label, score, lines, index }: MetricCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tier = getScoreTier(score);
  const recs = getMetricRecommendations(metric, score);
  const PREVIEW = 3;
  const hasMore = lines.length > PREVIEW;
  const visibleLines = expanded ? lines : lines.slice(0, PREVIEW);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <View style={[cardStyles.card, { borderColor: `${tier.color}22` }]}>
      {/* Subtle glow top line */}
      <View style={[cardStyles.topLine, { backgroundColor: tier.color }]} />

      {/* Header row: ring + metric name + score bar */}
      <View style={cardStyles.headerRow}>
        <ScoreRing value={score} delay={index * 80} />

        <View style={cardStyles.headerRight}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.metricLabel}>{label}</Text>
            <View style={[cardStyles.bandPill, { borderColor: tier.color }]}>
              <Text style={[cardStyles.bandPillText, { color: tier.color }]}>
                {getScoreBand(score)}
              </Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={cardStyles.barTrack}>
            <View
              style={[
                cardStyles.barFill,
                { width: `${score}%` as any, backgroundColor: tier.color },
              ]}
            />
          </View>

          <Text style={cardStyles.scoreLabel}>
            {Math.round(score)}{" "}
            <Text style={cardStyles.scoreSub}>/ 100</Text>
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={cardStyles.divider} />

      {/* Insight lines */}
      <View style={cardStyles.insightsBlock}>
        <Text style={[cardStyles.sectionLabel, { color: tier.color }]}>
          Analysis
        </Text>
        <View style={cardStyles.linesList}>
          {visibleLines.map((line, i) => (
            <View key={i} style={cardStyles.lineRow}>
              <View style={[cardStyles.dot, { backgroundColor: tier.color }]} />
              <Text style={cardStyles.lineText}>{line || "--"}</Text>
            </View>
          ))}
        </View>

        {hasMore && (
          <Pressable
            onPress={toggleExpand}
            style={({ pressed }) => [cardStyles.expandBtn, pressed && { opacity: 0.7 }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={cardStyles.expandText}>
              {expanded
                ? "Show less"
                : `Show ${lines.length - PREVIEW} more`}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={12}
              color={COLORS.sub}
            />
          </Pressable>
        )}
      </View>

      {/* Recommendations */}
      {recs.length > 0 && (
        <View style={cardStyles.recsBlock}>
          <View style={cardStyles.recsTitleRow}>
            <Ionicons name="flash-outline" size={12} color={COLORS.accent} />
            <Text style={cardStyles.recsLabel}>Recommendations</Text>
          </View>
          <View style={cardStyles.recsList}>
            {recs.map((rec, i) => (
              <View key={i} style={[cardStyles.recRow, rec.priority === "high" && cardStyles.recRowHigh]}>
                <View style={[cardStyles.recPriorityBar, { backgroundColor: rec.priority === "high" ? tier.color : COLORS.cardBorder }]} />
                <Text style={cardStyles.recText}>{rec.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }
      : { elevation: 6 }),
  },
  topLine: {
    height: 2,
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
    padding: SP[4],
    paddingBottom: SP[3],
  },
  headerRight: {
    flex: 1,
    gap: SP[2],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flexWrap: "wrap",
  },
  metricLabel: {
    ...TYPE.bodySemiBold,
    color: COLORS.text,
  },
  bandPill: {
    borderWidth: 1,
    borderRadius: RADII.circle,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
  },
  bandPillText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  barTrack: {
    height: 4,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: RADII.circle,
  },
  scoreLabel: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  scoreSub: {
    ...TYPE.caption,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SP[4],
  },

  insightsBlock: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[2],
  },
  sectionLabel: {
    ...TYPE.smallSemiBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  linesList: {
    gap: SP[2],
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  lineText: {
    ...TYPE.caption,
    color: COLORS.textHigh,
    flex: 1,
    lineHeight: 20,
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    alignSelf: "flex-start",
    marginTop: SP[1],
  },
  expandText: {
    ...TYPE.small,
    color: COLORS.sub,
  },

  recsBlock: {
    paddingHorizontal: SP[4],
    paddingBottom: SP[4],
    gap: SP[2],
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SP[3],
  },
  recsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1] + 1,
    marginBottom: SP[1],
  },
  recsLabel: {
    ...TYPE.smallSemiBold,
    color: COLORS.accent,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontSize: 11,
  },
  recsList: {
    gap: SP[2],
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
    backgroundColor: COLORS.whiteGlass,
    borderRadius: RADII.md,
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  recRowHigh: {
    borderColor: "rgba(180,243,77,0.15)",
    backgroundColor: "rgba(180,243,77,0.04)",
  },
  recPriorityBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    minHeight: 16,
    flexShrink: 0,
    marginTop: 1,
  },
  recText: {
    ...TYPE.caption,
    color: COLORS.textHigh,
    flex: 1,
    lineHeight: 20,
  },
});

// ── Hero image section ─────────────────────────────────────────────────────

function HeroImage({
  imageUrl,
  overallScore,
  archetype,
  date,
}: {
  imageUrl?: string;
  overallScore: number | null;
  archetype: string;
  date: string;
}) {
  const tier = overallScore != null ? getScoreTier(overallScore) : null;

  return (
    <View style={heroStyles.wrap}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={heroStyles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={heroStyles.placeholder}>
          <Ionicons name="person-outline" size={56} color={COLORS.muted} />
        </View>
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      {/* Score overlay at bottom */}
      <View style={heroStyles.overlay}>
        <View style={heroStyles.overallRow}>
          {overallScore != null && (
            <>
              <Text style={[heroStyles.overallScore, { color: tier!.color }]}>
                {overallScore}
              </Text>
              <View style={heroStyles.overallRight}>
                <Text style={[heroStyles.overallBand, { color: tier!.color }]}>
                  {getScoreBand(overallScore)}
                </Text>
                <Text style={heroStyles.archetype}>{archetype}</Text>
              </View>
            </>
          )}
        </View>
        <Text style={heroStyles.date}>{date}</Text>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  wrap: {
    height: 220,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: COLORS.track,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingBottom: SP[4],
    paddingTop: SP[3],
    gap: SP[1],
  },
  overallRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  overallScore: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: "Poppins-SemiBold",
  },
  overallRight: {
    gap: 2,
  },
  overallBand: {
    ...TYPE.captionSemiBold,
    letterSpacing: 0.5,
  },
  archetype: {
    ...TYPE.small,
    color: COLORS.muted,
  },
  date: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.5)",
  },
});

// ── Main screen ────────────────────────────────────────────────────────────

type AnalysisItem = {
  key: MetricKey;
  label: string;
  score: number;
  lines: string[];
};

export default function HistoryAnalysisCard() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = params?.scanId;

  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError("Missing scanId");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchScanDetail(scanId);
        if (!cancelled) setDetail(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load scan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanId]);

  // Build metric items sorted worst-first (highest improvement potential)
  const items = useMemo<AnalysisItem[]>(() => {
    if (!detail?.explanations || !detail?.scores) return [];
    const raw: AnalysisItem[] = [];

    for (const key of Object.keys(METRIC_LABELS) as MetricKey[]) {
      const explanations = (detail.explanations as any)?.[key];
      const score = Number((detail.scores as any)?.[key]);
      const hasCopy =
        Array.isArray(explanations) &&
        explanations.some(
          (l: unknown) => typeof l === "string" && (l as string).trim().length > 0
        );
      if (hasCopy && Number.isFinite(score)) {
        raw.push({
          key,
          label: METRIC_LABELS[key],
          score: clamp(score, 0, 100),
          lines: (explanations as string[]).filter((l) => typeof l === "string" && l.trim()),
        });
      }
    }

    // Sort worst first (ascending score)
    const priorities = getMetricPriorities(detail.scores as any);
    raw.sort((a, b) => priorities.indexOf(a.key) - priorities.indexOf(b.key));
    return raw;
  }, [detail]);

  const overallScore = useMemo(
    () => (detail?.scores ? getOverallScore(detail.scores as any) : null),
    [detail]
  );
  const archetype = useMemo(
    () => (detail?.scores ? getArchetype(detail.scores as any) : ""),
    [detail]
  );

  const handleBack = () => router.back();
  const handleViewScores = () =>
    router.push(`/history/score-card?scanId=${encodeURIComponent(scanId ?? "")}`);

  // ── Loading / error / missing ────────────────────────────────────────────
  if (loading || error || !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[COLORS.bgTop, COLORS.bgBottom]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.stateHeader}>
          <BackButton onPress={handleBack} />
          <Text variant="h2" color="text">
            Analysis
          </Text>
        </View>

        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text variant="captionMedium" color="sub" style={{ marginTop: SP[3] }}>
              Loading analysis...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centeredState}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
            <Text
              variant="captionMedium"
              style={{ color: COLORS.error, textAlign: "center", marginTop: SP[2] }}
            >
              {error}
            </Text>
          </View>
        ) : (
          <View style={styles.centeredState}>
            <Ionicons name="scan-outline" size={40} color={COLORS.muted} />
            <Text variant="body" color="sub" style={{ textAlign: "center" }}>
              Could not load this scan.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
      />

      {/* ── Fixed header ────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + SP[2] }]}>
        <BackButton onPress={handleBack} />
        <View style={styles.headerCenter}>
          <Text variant="h2" color="text">
            Analysis
          </Text>
        </View>
        <Pressable
          onPress={handleViewScores}
          style={({ pressed }) => [styles.scoresPill, pressed && { opacity: 0.7 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.scoresPillText}>Scores</Text>
          <Ionicons name="chevron-forward" size={12} color={COLORS.accent} />
        </Pressable>
      </View>

      {/* ── Scrollable content ──────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image with score overlay */}
        <HeroImage
          imageUrl={detail.images?.front?.url}
          overallScore={overallScore}
          archetype={archetype}
          date={formatDate(detail.createdAt)}
        />

        {/* Section label */}
        {items.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Metric Breakdown</Text>
            <Text style={styles.sectionSub}>Sorted by improvement potential</Text>
          </View>
        )}

        {/* Metric cards */}
        {items.map((item, i) => (
          <MetricCard
            key={item.key}
            metric={item.key}
            label={item.label}
            score={item.score}
            lines={item.lines}
            index={i}
          />
        ))}

        {items.length === 0 && (
          <View style={styles.emptyAnalysis}>
            <Ionicons name="analytics-outline" size={36} color={COLORS.muted} />
            <Text variant="body" color="sub" style={{ textAlign: "center", marginTop: SP[3] }}>
              No analysis generated for this scan.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Fixed footer CTA ────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
        <View style={styles.ctaDepth}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaFace,
              { transform: [{ translateY: pressed ? 3 : 0 }] },
            ]}
            onPress={handleViewScores}
          >
            <Ionicons name="stats-chart-outline" size={16} color="#0B0B0B" />
            <Text style={styles.ctaText}>View Score Breakdown</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[8],
    gap: SP[2],
  },
  stateHeader: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    paddingBottom: SP[3],
    gap: SP[1],
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingBottom: SP[3],
    gap: SP[3],
  },
  headerCenter: {
    flex: 1,
  },
  scoresPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
  },
  scoresPillText: {
    ...TYPE.smallSemiBold,
    color: COLORS.accent,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    gap: SP[4],
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SP[1],
  },
  sectionTitle: {
    ...TYPE.captionSemiBold,
    color: COLORS.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 11,
  },
  sectionSub: {
    ...TYPE.small,
    color: COLORS.muted,
    fontSize: 10,
  },

  emptyAnalysis: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[12],
  },

  // Footer CTA
  footer: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    backgroundColor: COLORS.bgTop,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  ctaDepth: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: 4,
    ...(Platform.OS === "ios"
      ? { shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 10 }),
  },
  ctaFace: {
    borderRadius: RADII.pill,
    paddingVertical: SP[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.accent,
  },
  ctaText: {
    ...TYPE.bodySemiBold,
    color: "#0B0B0B",
  },
});
