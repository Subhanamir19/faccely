// app/history/score-card.tsx
// Scan results — compact horizontal metric rows, band label, scroll-contained footer.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Easing,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { COLORS, SP, RADII, SIZES, TYPE } from "@/lib/tokens";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";

// ── Score helpers ──────────────────────────────────────────────────────────

const METRIC_DEFS: Array<{ key: keyof ScanDetail["scores"]; label: string }> = [
  { key: "jawline", label: "Jawline" },
  { key: "facial_symmetry", label: "Symmetry" },
  { key: "cheekbones", label: "Cheekbones" },
  { key: "sexual_dimorphism", label: "Masculinity" },
  { key: "skin_quality", label: "Skin" },
  { key: "eyes_symmetry", label: "Eyes" },
  { key: "nose_harmony", label: "Nose" },
];

function getScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s <= 39) return COLORS.error;
  if (s <= 59) return COLORS.errorLight;
  if (s <= 79) return COLORS.warning;
  return COLORS.success;
}

function getScoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 50) return "Average";
  return "Needs Work";
}

function formatDate(value: string | undefined): string {
  if (!value) return "--";
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// ── Animated bar ───────────────────────────────────────────────────────────

function AnimatedBar({ score, delay, color }: { score: number; delay: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(100, score));

  useEffect(() => {
    width.setValue(0);
    Animated.timing(width, {
      toValue: clamped,
      duration: 700,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, delay]);

  const animatedWidth = width.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={barStyles.track}>
      <Animated.View
        style={[
          barStyles.fill,
          { width: animatedWidth, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: RADII.circle,
  },
});

// ── Compact metric row ─────────────────────────────────────────────────────

function MetricRow({
  label,
  score,
  index,
  onPress,
}: {
  label: string;
  score: number;
  index: number;
  onPress: () => void;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = getScoreColor(clamped);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.pressed]}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      {/* Label */}
      <Text style={rowStyles.label}>{label}</Text>

      {/* Bar — fills remaining space */}
      <AnimatedBar score={score} delay={index * 70} color={color} />

      {/* Score number */}
      <Text style={[rowStyles.score, { color }]}>{clamped}</Text>

      {/* Tap affordance */}
      <Ionicons name="chevron-forward" size={12} color={COLORS.muted} />
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[3],
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...TYPE.caption,
    color: COLORS.sub,
    width: 88,
    flexShrink: 0,
  },
  score: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 18,
    lineHeight: 22,
    minWidth: 30,
    textAlign: "right",
    flexShrink: 0,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function HistoryScoreCard() {
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

  const metrics = useMemo(() => {
    if (!detail?.scores) return [];
    return METRIC_DEFS.map((m) => ({
      ...m,
      value: Number((detail.scores as any)?.[m.key]) ?? 0,
    }));
  }, [detail]);

  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return Math.round(sum / metrics.length);
  }, [metrics]);

  const handleBack = () => router.back();

  const handleViewAnalysis = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(scanId ?? "")}`);
  };

  const handleMetricPress = (metricKey: string) => {
    // Navigate to analysis card — the vertical scroll will naturally show all metrics,
    // and the user can scroll to find the tapped metric.
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(scanId ?? "")}`);
  };

  // ── Loading / error ────────────────────────────────────────────────────
  if (loading || error || !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
        <View style={styles.stateHeader}>
          <BackButton onPress={handleBack} />
          <Text variant="h2" color="text">Scan Results</Text>
        </View>
        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text variant="captionMedium" color="sub" style={{ marginTop: SP[3] }}>
              Loading scores...
            </Text>
          </View>
        ) : (
          <View style={styles.centeredState}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
            <Text
              variant="captionMedium"
              style={{ color: COLORS.error, textAlign: "center", marginTop: SP[2] }}
            >
              {error ?? "Could not load this scan."}
            </Text>
          </View>
        )}
      </View>
    );
  }

  const overallColor = getScoreColor(overallScore);
  const overallBand = getScoreBand(overallScore);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
      />

      <ScrollView
        style={[styles.scrollView, { paddingTop: insets.top }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SP[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────── */}
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.headerTitleRow}>
            <Text variant="h2" color="text">Scan Results</Text>
            <View style={styles.dateBadge}>
              <Text variant="small" color="sub">{formatDate(detail.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* ── Images ────────────────────────────────────── */}
        <View style={styles.imageSection}>
          <View style={styles.imageWrapper}>
            {detail.images?.front?.url ? (
              <Image
                source={{ uri: detail.images.front.url }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.profileImage, styles.imagePlaceholder]}>
                <Ionicons name="person-outline" size={40} color={COLORS.muted} />
              </View>
            )}
          </View>

          {detail.hasSideImage && detail.images?.side?.url && (
            <View style={styles.sideImageWrapper}>
              <Image
                source={{ uri: detail.images.side.url }}
                style={styles.sideImage}
                resizeMode="cover"
              />
            </View>
          )}
        </View>

        {/* ── Overall score card ────────────────────────── */}
        <View style={styles.overallCard}>
          <View style={styles.overallTop}>
            <View style={styles.overallLeft}>
              <Text style={styles.overallLabel}>Overall Score</Text>
              <Text style={[styles.overallScore, { color: overallColor }]}>
                {overallScore}
              </Text>
              <View style={styles.bandRow}>
                <View style={[styles.bandDot, { backgroundColor: overallColor }]} />
                <Text style={[styles.bandLabel, { color: overallColor }]}>
                  {overallBand}
                </Text>
              </View>
            </View>

            {/* Mini ring visual */}
            <View style={[styles.scoreBadge, { borderColor: overallColor }]}>
              <Text style={[styles.scoreBadgeNum, { color: overallColor }]}>
                {overallScore}
              </Text>
            </View>
          </View>

          {/* Overall animated bar */}
          <AnimatedBar score={overallScore} delay={0} color={overallColor} />
        </View>

        {/* ── Metrics breakdown ─────────────────────────── */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsTitleRow}>
            <Text style={styles.metricsTitle}>By Metric</Text>
            <Text style={styles.metricsTap}>Tap any row for analysis</Text>
          </View>

          {/* Column headers */}
          <View style={styles.colHeaders}>
            <Text style={[styles.colLabel, { width: 88 }]}>Area</Text>
            <Text style={[styles.colLabel, { flex: 1 }]}>Performance</Text>
            <Text style={[styles.colLabel, { minWidth: 30, textAlign: "right" }]}>Score</Text>
            <View style={{ width: 16 }} />
          </View>

          <View style={styles.divider} />

          {metrics.map((m, i) => (
            <React.Fragment key={m.key}>
              <MetricRow
                label={m.label}
                score={m.value}
                index={i + 1}
                onPress={() => handleMetricPress(m.key)}
              />
              {i < metrics.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── View analysis CTA ─────────────────────────── */}
        <Pressable
          onPress={handleViewAnalysis}
          style={({ pressed }) => [styles.analysisBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="analytics-outline" size={18} color={COLORS.accent} />
          <Text style={styles.analysisBtnText}>View Full Analysis</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.accent} />
        </Pressable>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SP[4],
    gap: SP[4],
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
    gap: SP[1],
    paddingTop: SP[2],
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    flexWrap: "wrap",
  },
  dateBadge: {
    backgroundColor: COLORS.whiteGlass,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Images
  imageSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: SP[3],
  },
  imageWrapper: {
    padding: 3,
    borderRadius: (SIZES.avatarLg + 6) / 2,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
    ...(Platform.OS === "ios"
      ? { shadowColor: COLORS.accent, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 6 }),
  },
  profileImage: {
    width: SIZES.avatarLg,
    height: SIZES.avatarLg,
    borderRadius: SIZES.avatarLg / 2,
    backgroundColor: COLORS.track,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  sideImageWrapper: {
    padding: 2,
    borderRadius: (SIZES.avatarMd + 4) / 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sideImage: {
    width: SIZES.avatarMd,
    height: SIZES.avatarMd,
    borderRadius: SIZES.avatarMd / 2,
    backgroundColor: COLORS.track,
  },

  // Overall card
  overallCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[4],
    gap: SP[3],
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 5 }),
  },
  overallTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overallLeft: {
    gap: SP[1],
  },
  overallLabel: {
    ...TYPE.small,
    color: COLORS.sub,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  overallScore: {
    fontSize: 52,
    lineHeight: 58,
    fontFamily: "Poppins-SemiBold",
  },
  bandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  bandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bandLabel: {
    ...TYPE.captionSemiBold,
    letterSpacing: 0.3,
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.whiteGlass,
  },
  scoreBadgeNum: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 22,
    lineHeight: 26,
  },

  // Metrics card
  metricsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[2],
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 5 }),
  },
  metricsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SP[2],
  },
  metricsTitle: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 11,
  },
  metricsTap: {
    ...TYPE.small,
    color: COLORS.muted,
    fontSize: 10,
  },
  colHeaders: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    marginBottom: SP[2],
  },
  colLabel: {
    ...TYPE.small,
    color: COLORS.muted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginBottom: SP[1],
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    opacity: 0.5,
  },

  // View analysis button
  analysisBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    paddingVertical: SP[4],
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
    marginBottom: SP[4],
  },
  analysisBtnText: {
    ...TYPE.captionSemiBold,
    color: COLORS.accent,
  },
});
