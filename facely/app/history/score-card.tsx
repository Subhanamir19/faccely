// app/history/score-card.tsx
// Historical scan scores — mirrors (tabs)/score.tsx UI, fed by fetchScanDetail.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import ScoringCarousel, { type ScoringMetric } from "@/components/scores/ScoringCarousel";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";

const FONT = "ProximaNova-Bold";

// ─── Metric definitions — kept in sync with (tabs)/score.tsx ───────────────

type MetricDef = { apiKey: string; label: string; defaultScore: number };

const METRIC_DEFS: MetricDef[] = [
  { apiKey: "jawline",           label: "Jawline",                defaultScore: 64 },
  { apiKey: "facial_symmetry",   label: "Facial Symmetry",        defaultScore: 72 },
  { apiKey: "cheekbones",        label: "Cheekbones",             defaultScore: 58 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity", defaultScore: 81 },
  { apiKey: "skin_quality",      label: "Skin Quality",           defaultScore: 69 },
  { apiKey: "eyes_symmetry",     label: "Eye Symmetry",           defaultScore: 62 },
  { apiKey: "nose_harmony",      label: "Nose Balance",           defaultScore: 74 },
];

function buildMetrics(apiScores: Record<string, number> | null | undefined): ScoringMetric[] {
  return METRIC_DEFS.map(({ apiKey, label, defaultScore }) => {
    const raw = Number(apiScores?.[apiKey]);
    const score = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : defaultScore;
    return { label, score };
  });
}

function computeOverall(metrics: ScoringMetric[]): number {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
}

// ─── Light pill button — mirrors the live score screen ─────────────────────

function LightPillButton({
  label,
  onPress,
  variant = "secondary",
  fill = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  fill?: boolean;
}) {
  const isPrimary = variant === "primary";
  const bg = isPrimary ? COLORS.ctaBlack : COLORS.lightSurfaceAlt;
  const fg = isPrimary ? "#FFFFFF" : COLORS.lightText;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        ...(fill ? { flex: 1 } : {}),
        minHeight: sh(54),
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: sh(14),
        paddingHorizontal: SP[5],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: fg, fontFamily: FONT, fontSize: ms(13), letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function HistoryScoreCard() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
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

  const metrics = useMemo<ScoringMetric[]>(
    () => buildMetrics(detail?.scores as any),
    [detail]
  );
  const totalScore = useMemo(() => computeOverall(metrics), [metrics]);

  const HORIZONTAL_PAD = SP[5];
  const viewportWidth = SW - HORIZONTAL_PAD * 2;

  // Avatar must shrink on shorter screens so it can't crash into the header
  // when the centerStack contents exceed the available vertical space.
  const avatarSize = Math.round(
    Math.min(ms(128), Math.max(72, SH * 0.14))
  );
  const avatarPad = Math.max(2, Math.round(avatarSize * 0.03));

  const handleBack = () => router.back();
  const handleAdvanced = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(scanId ?? "")}`);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.lightText} size="large" />
        <Text variant="captionMedium" style={{ color: COLORS.lightSub, marginTop: SP[3] }}>
          Loading scores...
        </Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.declineRed} />
        <Text
          variant="captionMedium"
          style={{ color: COLORS.declineRed, textAlign: "center", marginTop: SP[2], paddingHorizontal: SP[6] }}
        >
          {error ?? "Could not load this scan."}
        </Text>
        <View style={{ marginTop: SP[4] }}>
          <LightPillButton label="Back" onPress={handleBack} />
        </View>
      </View>
    );
  }

  const imageUri = detail.images?.front?.url ?? null;

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.content,
          {
            paddingTop:    insets.top    + SP[5],
            paddingBottom: insets.bottom + SP[5],
          },
        ]}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <Text style={styles.title}>Your Scores</Text>
          <Text style={styles.subtitle}>Facial analysis breakdown — all 8 metrics</Text>
        </Animated.View>

        {/* Centered stack: avatar + carousel */}
        <View style={styles.centerStack}>
          <Animated.View entering={FadeInDown.duration(420).delay(160)}>
            <View
              style={[
                styles.avatarRing,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  padding: avatarPad,
                },
              ]}
            >
              {imageUri ? (
                <ExpoImage
                  source={{ uri: imageUri }}
                  style={[styles.avatarImg, { borderRadius: avatarSize / 2 }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={250}
                />
              ) : (
                <View
                  style={[
                    styles.avatarImg,
                    styles.avatarPlaceholder,
                    { borderRadius: avatarSize / 2 },
                  ]}
                />
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(220)} style={{ width: "100%" }}>
            <ScoringCarousel
              metrics={metrics}
              totalScore={totalScore}
              dashboardMetrics={[]}
              overallDelta={null}
              viewportWidth={viewportWidth}
            />
          </Animated.View>
        </View>

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.buttonRow}>
          <LightPillButton label="Back" onPress={handleBack} />
          <LightPillButton
            label="Advanced Analysis"
            variant="primary"
            onPress={handleAdvanced}
            fill
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: SP[5],
  },
  header: {
    gap: sh(4),
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(28),
    color: COLORS.lightText,
    lineHeight: ms(32),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },
  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
    marginTop: sh(8),
  },
  avatarRing: {
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatarImg: {
    width:  "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.iconTileLavender,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SP[3],
    marginTop: SP[2],
  },
});
