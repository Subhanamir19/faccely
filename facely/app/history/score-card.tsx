// app/history/score-card.tsx
// Score detail view - redesigned to match app aesthetic

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { COLORS, SP, RADII, SIZES } from "@/lib/tokens";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import StateView from "@/components/layout/StateView";
import PillNavButton from "@/components/ui/PillNavButton";

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
  if (s <= 35) return COLORS.error;
  if (s <= 50) return COLORS.errorLight;
  if (s <= 65) return COLORS.warning;
  if (s <= 80) return COLORS.accentLight;
  return COLORS.success;
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

type AnimatedBarProps = {
  score: number;
  delay: number;
};

function AnimatedBar({ score, delay }: AnimatedBarProps) {
  const width = useRef(new Animated.Value(0)).current;
  const color = getScoreColor(score);
  const clamped = Math.max(0, Math.min(100, score));

  useEffect(() => {
    width.setValue(0);
    Animated.timing(width, {
      toValue: clamped,
      duration: 800,
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
    <View style={styles.progressTrack}>
      <Animated.View
        style={[styles.progressFill, { width: animatedWidth, backgroundColor: color }]}
      />
    </View>
  );
}

type MetricRowProps = {
  label: string;
  score: number;
  index: number;
};

function MetricRow({ label, score, index }: MetricRowProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View style={styles.metricRow}>
      <Text variant="caption" color="sub">{label}</Text>
      <Text style={styles.metricScore}>{clamped}</Text>
      <AnimatedBar score={score} delay={index * 80} />
    </View>
  );
}

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

    return () => { cancelled = true; };
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

  if (!scanId || loading || error || !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[COLORS.bgTop, COLORS.bgBottom]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <Text variant="h2" color="text">Score history</Text>
        </View>
        <StateView
          loading={loading}
          loadingText="Loading scores..."
          error={error}
          empty={!scanId}
          emptyTitle="Missing scan"
          emptySubtitle="Could not load this scan"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={[styles.scrollView, { paddingTop: insets.top }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <Text variant="h2" color="text">Score history</Text>
          <Text variant="caption" color="sub">{formatDate(detail.createdAt)}</Text>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Profile Image */}
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
                  <Text variant="h3" color="sub">?</Text>
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

          {/* Overall Score */}
          <View style={styles.overallSection}>
            <Text variant="caption" color="sub">Overall Score</Text>
            <Text style={[styles.overallScore, { color: getScoreColor(overallScore) }]}>
              {overallScore}
            </Text>
            <AnimatedBar score={overallScore} delay={0} />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {metrics.map((m, i) => (
              <MetricRow key={m.key} label={m.label} score={m.value} index={i + 1} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[4] }]}>
        <PillNavButton
          kind="solid"
          label="Back to History"
          icon="chevron-back"
          onPress={handleBack}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SP[4],
    gap: SP[4],
  },
  header: {
    gap: SP[1],
    paddingTop: SP[2],
  },

  // Main card
  card: {
    backgroundColor: COLORS.bgBottom,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[4],
    gap: SP[4],
  },

  // Image section
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
    borderColor: COLORS.cardBorder,
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

  // Overall score
  overallSection: {
    alignItems: "center",
    gap: SP[1],
  },
  overallScore: {
    fontSize: 56,
    lineHeight: 64,
    fontFamily: "Poppins-SemiBold",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SP[1],
  },

  // Metrics grid
  metricsGrid: {
    gap: SP[3],
  },
  metricRow: {
    gap: SP[1],
  },
  metricScore: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
  },

  // Progress bar
  progressTrack: {
    height: 5,
    backgroundColor: COLORS.track,
    borderRadius: RADII.circle,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.circle,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    backgroundColor: COLORS.bgTop,
  },
});
