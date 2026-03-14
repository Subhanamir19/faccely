// app/(tabs)/dashboard.tsx
// Progress Dashboard — AI-generated insights and per-metric deltas

import React, { useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Text from "@/components/ui/T";
import ScreenHeader from "@/components/layout/ScreenHeader";
import { COLORS, SP, RADII, TYPE } from "@/lib/tokens";
import { useInsights } from "@/store/insights";
import type { InsightContent, MetricInsight } from "@/lib/api/insights";

/* -------------------------------------------------------------------------- */
/*   Config                                                                   */
/* -------------------------------------------------------------------------- */

const METRIC_KEYS = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
] as const;

const METRIC_LABELS: Record<string, string> = {
  jawline: "Jawline",
  facial_symmetry: "Facial Symmetry",
  skin_quality: "Skin Quality",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eye Symmetry",
  nose_harmony: "Nose Balance",
  sexual_dimorphism: "Masculinity",
};

const VERDICT_COLOR: Record<string, string> = {
  improved: "#B4F34D",
  same: "rgba(255,255,255,0.45)",
  declined: "#FF5252",
};

const VERDICT_LABEL: Record<string, string> = {
  improved: "IMPROVED",
  same: "NO CHANGE",
  declined: "DECLINED",
};

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  if (delta < 0) return delta.toFixed(1);
  return "0";
}

/* -------------------------------------------------------------------------- */
/*   Shared card shell                                                        */
/* -------------------------------------------------------------------------- */

function CardShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      <BlurView
        intensity={Platform.OS === "android" ? 20 : 40}
        tint="dark"
        style={styles.cardBlur}
      >
        <View style={styles.cardOverlay} />
        <View style={styles.cardTopLine} />
        {children}
      </BlurView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Empty state — only 1 scan                                               */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)}>
      <CardShell style={styles.centeredCard}>
        <View style={styles.centeredInner}>
          <Text style={styles.stateIcon}>📊</Text>
          <Text variant="h3" color="text" style={styles.stateTitle}>
            No Progress Yet
          </Text>
          <Text variant="caption" color="sub" style={styles.stateSubtitle}>
            Run a second analysis to unlock your personalized progress insights
          </Text>
        </View>
      </CardShell>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Generating state — 2+ scans but insight not ready yet                   */
/* -------------------------------------------------------------------------- */

function GeneratingState() {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)}>
      <CardShell style={styles.centeredCard}>
        <View style={styles.centeredInner}>
          <Text style={styles.stateIcon}>⚡</Text>
          <Text variant="h3" color="text" style={styles.stateTitle}>
            Preparing Your Insights
          </Text>
          <Text variant="caption" color="sub" style={styles.stateSubtitle}>
            Your first progress insight is being generated. Pull down to
            refresh.
          </Text>
        </View>
      </CardShell>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Insight card — main summary                                              */
/* -------------------------------------------------------------------------- */

function InsightCard({ content }: { content: InsightContent }) {
  const color = VERDICT_COLOR[content.verdict];
  const deltaText = formatDelta(content.overall_delta);

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)}>
      <CardShell>
        <View style={styles.cardInner}>
          {/* delta + verdict row */}
          <View style={styles.insightHeader}>
            <View>
              <Text style={[styles.deltaNumber, { color }]}>{deltaText}</Text>
              <Text style={styles.deltaLabel}>overall since baseline</Text>
            </View>
            <View
              style={[
                styles.verdictBadge,
                {
                  borderColor: color,
                  backgroundColor: `${color}18`,
                },
              ]}
            >
              <Text style={[styles.verdictText, { color }]}>
                {VERDICT_LABEL[content.verdict]}
              </Text>
            </View>
          </View>

          {/* narrative */}
          <Text style={styles.narrative}>{content.narrative}</Text>
        </View>
      </CardShell>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Metric row                                                               */
/* -------------------------------------------------------------------------- */

function MetricRow({
  metricKey,
  insight,
  index,
}: {
  metricKey: string;
  insight: MetricInsight;
  index: number;
}) {
  const color = VERDICT_COLOR[insight.verdict];
  const arrow =
    insight.verdict === "improved"
      ? "↑"
      : insight.verdict === "declined"
      ? "↓"
      : "→";

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(300 + index * 50)}
      style={styles.metricRow}
    >
      <BlurView
        intensity={Platform.OS === "android" ? 15 : 30}
        tint="dark"
        style={styles.metricBlur}
      >
        <View style={styles.metricOverlay} />
        <View style={styles.metricInner}>
          <Text style={styles.metricLabel}>
            {METRIC_LABELS[metricKey] ?? metricKey}
          </Text>
          <View style={styles.metricRight}>
            <Text style={[styles.metricDelta, { color }]}>
              {formatDelta(insight.delta)}
            </Text>
            <Text style={[styles.metricArrow, { color }]}>{arrow}</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Main screen                                                              */
/* -------------------------------------------------------------------------- */

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, loadInsights } = useInsights();

  useEffect(() => {
    loadInsights();
  }, []);

  const onRefresh = useCallback(() => {
    loadInsights();
  }, [loadInsights]);

  const insight = data?.insight ?? null;
  const scanCount = data?.scan_count ?? 0;
  const content = insight?.content ?? null;

  const renderBody = () => {
    if (error) {
      return (
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text
            variant="caption"
            color="sub"
            style={{ textAlign: "center", marginTop: SP[8] }}
          >
            {error}
          </Text>
        </Animated.View>
      );
    }

    if (!content && scanCount < 2) return <EmptyState />;
    if (!content && scanCount >= 2) return <GeneratingState />;
    if (!content) return null;

    return (
      <>
        <InsightCard content={content} />

        <Animated.View entering={FadeInDown.duration(400).delay(250)}>
          <Text style={styles.sectionTitle}>Metric Breakdown</Text>
        </Animated.View>

        {METRIC_KEYS.map((key, i) => (
          <MetricRow
            key={key}
            metricKey={key}
            insight={content.metrics[key]}
            index={i}
          />
        ))}

        {insight && (
          <Animated.View entering={FadeInDown.duration(400).delay(700)}>
            <Text style={styles.footerText}>
              Last updated{" "}
              {new Date(insight.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </Animated.View>
        )}
      </>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Background */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Progress"
          subtitle={
            scanCount > 0
              ? `${scanCount} scan${scanCount !== 1 ? "s" : ""}`
              : "Track your improvement"
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 120 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
        >
          {renderBody()}
        </ScrollView>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Styles                                                                   */
/* -------------------------------------------------------------------------- */

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
    height: 220,
  },
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    gap: SP[3],
  },

  // ── Card shell ────────────────────────────────────────────────────────────
  card: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 8 }),
  },
  cardBlur: {
    borderRadius: RADII.xl,
    overflow: "hidden",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.xl,
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: COLORS.accentBorder,
    borderRadius: 1,
  },
  cardInner: {
    padding: SP[4],
    gap: SP[3],
  },

  // ── Centered cards (empty/generating states) ──────────────────────────────
  centeredCard: {
    marginTop: SP[8],
  },
  centeredInner: {
    padding: SP[6],
    alignItems: "center",
    gap: SP[3],
  },
  stateIcon: {
    fontSize: 40,
  },
  stateTitle: {
    textAlign: "center",
  },
  stateSubtitle: {
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Insight card ──────────────────────────────────────────────────────────
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deltaNumber: {
    fontSize: 38,
    fontFamily: Platform.select({
      ios: "Poppins-Bold",
      android: "Poppins-Bold",
      default: "Poppins-Bold",
    }),
    lineHeight: 44,
  },
  deltaLabel: {
    ...TYPE.small,
    color: COLORS.sub,
    marginTop: 2,
  },
  verdictBadge: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    borderWidth: 1,
  },
  verdictText: {
    ...TYPE.smallSemiBold,
    letterSpacing: 0.8,
  },
  narrative: {
    ...TYPE.body,
    color: COLORS.text,
    lineHeight: 22,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    ...TYPE.captionSemiBold,
    color: COLORS.sub,
    marginTop: SP[2],
    marginBottom: SP[1],
    paddingHorizontal: SP[1],
  },

  // ── Metric rows ───────────────────────────────────────────────────────────
  metricRow: {
    borderRadius: RADII.md,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 4 }),
  },
  metricBlur: {
    borderRadius: RADII.md,
    overflow: "hidden",
  },
  metricOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.md,
  },
  metricInner: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  metricRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
  },
  metricDelta: {
    ...TYPE.bodySemiBold,
  },
  metricArrow: {
    ...TYPE.bodySemiBold,
    fontSize: 16,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerText: {
    ...TYPE.caption,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SP[2],
  },
});
