// app/(tabs)/dashboard.tsx
// Progress Dashboard — Score ring, trend graph, metric breakdown, AI insights

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Polyline,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Path,
} from "react-native-svg";
import { useRouter } from "expo-router";
import Text from "@/components/ui/T";
import ScreenHeader from "@/components/layout/ScreenHeader";
import { COLORS, SP, RADII, TYPE } from "@/lib/tokens";
import { useInsights } from "@/store/insights";
import type {
  DashboardMetric,
  DashboardHistoryItem,
  AdvancedItem,
  InsightContent,
  DashboardOverall,
} from "@/lib/api/insights";

/* -------------------------------------------------------------------------- */
/*   Gold accent palette (dashboard-local override)                           */
/* -------------------------------------------------------------------------- */

const GOLD = {
  primary: "#C9A84C",
  light: "#F5D78E",
  dim: "rgba(201,168,76,0.60)",
  glow: "rgba(201,168,76,0.18)",
  border: "rgba(201,168,76,0.30)",
  bg: "rgba(201,168,76,0.10)",
  track: "rgba(201,168,76,0.15)",
};

const VERDICT_COLOR: Record<string, string> = {
  improved: "#4ADE80",
  same: "rgba(255,255,255,0.45)",
  declined: "#F87171",
};
const CHANGE_COLOR: Record<string, string> = {
  improving: "#4ADE80",
  same: "rgba(255,255,255,0.40)",
  worse: "#F87171",
};
const CHANGE_ICON: Record<string, string> = {
  improving: "↑",
  same: "→",
  worse: "↓",
};
const DIR_COLOR: Record<string, string> = {
  up: "#4ADE80",
  flat: "rgba(255,255,255,0.40)",
  down: "#F87171",
};

const METRIC_LABELS: Record<string, string> = {
  jawline: "Jawline",
  facial_symmetry: "Symmetry",
  skin_quality: "Skin",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eye Symmetry",
  nose_harmony: "Nose Harmony",
  sexual_dimorphism: "Masculinity",
};

function formatDelta(d: number): string {
  if (d > 0) return `+${d.toFixed(1)}`;
  if (d < 0) return d.toFixed(1);
  return "0";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/*   ScoreRing — animated SVG arc                                             */
/* -------------------------------------------------------------------------- */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ScoreRing({
  score,
  size = 160,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={GOLD.primary} />
            <Stop offset="100%" stopColor={GOLD.light} />
          </SvgGradient>
        </Defs>
        {/* track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={GOLD.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* progress arc */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text
          style={{
            fontSize: 36,
            fontFamily: "Poppins-Bold",
            color: GOLD.light,
            lineHeight: 40,
          }}
        >
          {score.toFixed(1)}
        </Text>
        <Text style={{ ...TYPE.small, color: GOLD.dim }}>overall</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   MiniGraph — polyline chart                                               */
/* -------------------------------------------------------------------------- */

function MiniGraph({
  points,
  width = 200,
  height = 56,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const padX = 4;
  const padY = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (p - min) / range) * (height - padY * 2);
    return `${x},${y}`;
  });

  const polyStr = coords.join(" ");

  // Build fill path
  const first = coords[0];
  const last = coords[coords.length - 1];
  const [lastX] = last.split(",");
  const [firstX] = first.split(",");
  const fillPath = `M ${first} L ${coords.slice(1).join(" L ")} L ${lastX},${height} L ${firstX},${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={GOLD.primary} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={GOLD.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={fillPath} fill="url(#graphFill)" />
      <Polyline
        points={polyStr}
        fill="none"
        stroke={GOLD.primary}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/*   Card shell                                                               */
/* -------------------------------------------------------------------------- */

function Card({
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
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardOverlay} />
      <View style={styles.cardTopLine} />
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Empty / Generating states                                                */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)}>
      <Card style={styles.centeredCard}>
        <View style={styles.centeredInner}>
          <Text style={styles.stateIcon}>📊</Text>
          <Text variant="h3" color="text" style={{ textAlign: "center" }}>
            No Progress Yet
          </Text>
          <Text variant="caption" color="sub" style={styles.stateSubtext}>
            Complete a second scan to unlock personalized progress insights and
            track your improvement over time.
          </Text>
          <TouchableOpacity
            style={styles.stateCTA}
            onPress={() => router.push("/(tabs)/take-picture")}
            activeOpacity={0.8}
          >
            <Text style={styles.stateCTAText}>Scan Now →</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );
}

function GeneratingState() {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(100)}>
      <Card style={styles.centeredCard}>
        <View style={styles.centeredInner}>
          <Text style={styles.stateIcon}>⚡</Text>
          <Text variant="h3" color="text" style={{ textAlign: "center" }}>
            Generating Insights
          </Text>
          <Text variant="caption" color="sub" style={styles.stateSubtext}>
            Your AI progress report is being prepared. Pull down to refresh in a
            few seconds.
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Hero card — ring + graph + overall stats                                */
/* -------------------------------------------------------------------------- */

function HeroCard({
  overall,
  graphPoints,
  graphDates,
  scanCount,
  joinedDaysAgo,
}: {
  overall: DashboardOverall;
  graphPoints: number[];
  graphDates: string[];
  scanCount: number;
  joinedDaysAgo: number;
}) {
  const delta = overall.current - overall.baseline;

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(80)}>
      <Card>
        <View style={styles.heroInner}>
          {/* Top row: ring + stats */}
          <View style={styles.heroTop}>
            <ScoreRing score={overall.current} size={152} strokeWidth={9} />

            <View style={styles.heroStats}>
              <StatPill
                label="Baseline"
                value={overall.baseline.toFixed(1)}
                color={GOLD.dim}
              />
              <StatPill
                label="Best Ever"
                value={overall.best.toFixed(1)}
                color={GOLD.light}
              />
              <StatPill
                label={delta >= 0 ? "Total Gain" : "Net Change"}
                value={formatDelta(Math.round(delta * 10) / 10)}
                color={delta >= 0 ? "#4ADE80" : "#F87171"}
              />
              <StatPill
                label="Scans"
                value={`${scanCount}`}
                color="rgba(255,255,255,0.7)"
              />
            </View>
          </View>

          {/* Graph row */}
          {graphPoints.length >= 2 && (
            <View style={styles.graphContainer}>
              <View style={styles.graphHeader}>
                <Text style={styles.graphLabel}>Score Trend</Text>
                {graphDates.length >= 2 && (
                  <Text style={styles.graphRange}>
                    {formatDate(graphDates[0])} →{" "}
                    {formatDate(graphDates[graphDates.length - 1])}
                  </Text>
                )}
              </View>
              <MiniGraph
                points={graphPoints}
                width={graphPoints.length > 10 ? 280 : 240}
                height={60}
              />
            </View>
          )}

          {/* Footer */}
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>
              {joinedDaysAgo > 0
                ? `${joinedDaysAgo} day${joinedDaysAgo !== 1 ? "s" : ""} of tracking`
                : "Started today"}
            </Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   AI Coach card                                                             */
/* -------------------------------------------------------------------------- */

function CoachCard({ content }: { content: InsightContent }) {
  const color = VERDICT_COLOR[content.verdict];
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(160)}>
      <Card>
        <View style={styles.coachInner}>
          <View style={styles.coachHeader}>
            <View style={styles.coachBadge}>
              <Text style={styles.coachBadgeIcon}>🤖</Text>
              <Text style={styles.coachBadgeText}>AI Coach</Text>
            </View>
            <View
              style={[
                styles.verdictBadge,
                { borderColor: color, backgroundColor: `${color}18` },
              ]}
            >
              <Text style={[styles.verdictText, { color }]}>
                {content.verdict.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.narrative}>{content.narrative}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Metric rows (expandable)                                                 */
/* -------------------------------------------------------------------------- */

function MetricRow({
  metric,
  index,
}: {
  metric: DashboardMetric;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = DIR_COLOR[metric.direction];
  const arrow =
    metric.direction === "up" ? "↑" : metric.direction === "down" ? "↓" : "→";

  const barWidth = Math.min(100, Math.max(0, metric.current));

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(280 + index * 40)}>
      <Pressable onPress={() => setExpanded((p) => !p)} style={styles.metricRow}>
        <BlurView
          intensity={Platform.OS === "android" ? 15 : 28}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.metricOverlay} />
        <View style={styles.metricInner}>
          {/* Main row */}
          <View style={styles.metricMainRow}>
            <Text style={styles.metricLabel}>
              {METRIC_LABELS[metric.key] ?? metric.key}
            </Text>
            <View style={styles.metricRight}>
              <Text style={[styles.metricDelta, { color }]}>
                {formatDelta(metric.delta)}
              </Text>
              <Text style={[styles.metricArrow, { color }]}>{arrow}</Text>
              <Text style={styles.metricExpand}>{expanded ? "−" : "+"}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${barWidth}%` as any, backgroundColor: color },
              ]}
            />
          </View>

          {/* Expanded detail */}
          {expanded && (
            <View style={styles.metricDetail}>
              <View style={styles.metricDetailRow}>
                <DetailStat label="Current" value={metric.current.toFixed(1)} />
                <DetailStat label="Baseline" value={metric.baseline.toFixed(1)} />
                <DetailStat label="Best" value={metric.best.toFixed(1)} />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailValue}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Advanced analysis section (collapsible)                                  */
/* -------------------------------------------------------------------------- */

function AdvancedSection({ items }: { items: AdvancedItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(560)}>
      <Card style={{ overflow: "hidden" }}>
        <Pressable
          onPress={() => setOpen((p) => !p)}
          style={styles.sectionToggle}
        >
          <Text style={styles.sectionToggleTitle}>Advanced Analysis</Text>
          <View style={styles.sectionToggleRight}>
            <Text style={styles.sectionCount}>{items.length} metrics</Text>
            <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
          </View>
        </Pressable>

        {open && (
          <View style={styles.advancedList}>
            {items.map((item, i) => {
              const color = CHANGE_COLOR[item.change];
              return (
                <View
                  key={i}
                  style={[
                    styles.advancedItem,
                    i < items.length - 1 && styles.advancedItemBorder,
                  ]}
                >
                  <View style={styles.advancedLeft}>
                    <Text style={[styles.advancedChange, { color }]}>
                      {CHANGE_ICON[item.change]}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.advancedLabel}>{item.label}</Text>
                      <Text style={styles.advancedComment}>{item.comment}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Scan history (collapsible)                                               */
/* -------------------------------------------------------------------------- */

function HistorySection({ items }: { items: DashboardHistoryItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(620)}>
      <Card style={{ overflow: "hidden" }}>
        <Pressable
          onPress={() => setOpen((p) => !p)}
          style={styles.sectionToggle}
        >
          <Text style={styles.sectionToggleTitle}>Scan History</Text>
          <View style={styles.sectionToggleRight}>
            <Text style={styles.sectionCount}>{items.length} scans</Text>
            <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
          </View>
        </Pressable>

        {open && (
          <View style={styles.historyList}>
            {items.map((item, i) => (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  i < items.length - 1 && styles.historyItemBorder,
                ]}
              >
                <View>
                  <Text style={styles.historyLabel}>{item.label}</Text>
                  <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.historyScore}>{item.overall.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Main screen                                                              */
/* -------------------------------------------------------------------------- */

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const overall = data?.overall ?? null;
  const metrics = data?.metrics ?? [];
  const graphPoints = data?.graph_points ?? [];
  const graphDates = data?.graph_dates ?? [];
  const history = data?.history ?? [];
  const joinedDaysAgo = data?.joined_days_ago ?? 0;
  const advanced = content?.advanced ?? [];

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

    if (!overall && scanCount < 2) return <EmptyState />;
    if (!overall || !content) return <GeneratingState />;

    return (
      <>
        <HeroCard
          overall={overall}
          graphPoints={graphPoints}
          graphDates={graphDates}
          scanCount={scanCount}
          joinedDaysAgo={joinedDaysAgo}
        />

        <CoachCard content={content} />

        <Animated.View entering={FadeInDown.duration(400).delay(240)}>
          <Text style={styles.sectionTitle}>Metric Breakdown</Text>
        </Animated.View>

        {metrics.map((m, i) => (
          <MetricRow key={m.key} metric={m} index={i} />
        ))}

        {advanced.length > 0 && <AdvancedSection items={advanced} />}

        {history.length > 0 && <HistorySection items={history} />}

        {insight && (
          <Animated.View entering={FadeInDown.duration(400).delay(700)}>
            <Text style={styles.footerText}>
              Updated{" "}
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
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Gold glow */}
      <LinearGradient
        colors={[GOLD.glow, "transparent"]}
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
              tintColor={GOLD.primary}
              colors={[GOLD.primary]}
            />
          }
        >
          {renderBody()}
        </ScrollView>
      </View>

      {/* Fixed bottom CTA */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 8 }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.ctaBorder} />
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push("/(tabs)/take-picture")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[GOLD.primary, GOLD.light]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaBtnText}>New Scan</Text>
          </LinearGradient>
        </TouchableOpacity>
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
    height: 260,
  },
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    gap: SP[3],
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.32,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 8 }),
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,14,10,0.92)",
    borderWidth: 1,
    borderColor: GOLD.border,
    borderRadius: RADII.xl,
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: GOLD.primary,
    opacity: 0.4,
    borderRadius: 1,
  },

  // ── Empty / Generating ────────────────────────────────────────────────────
  centeredCard: {
    marginTop: SP[8],
  },
  centeredInner: {
    padding: SP[6],
    alignItems: "center",
    gap: SP[3],
  },
  stateIcon: {
    fontSize: 44,
  },
  stateSubtext: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SP[2],
  },
  stateCTA: {
    marginTop: SP[2],
    paddingHorizontal: SP[5],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: GOLD.border,
    backgroundColor: GOLD.bg,
  },
  stateCTAText: {
    ...TYPE.captionSemiBold,
    color: GOLD.light,
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroInner: {
    padding: SP[4],
    gap: SP[4],
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  heroStats: {
    flex: 1,
    gap: SP[2],
  },
  statPill: {
    gap: 1,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
  statLabel: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.40)",
  },
  graphContainer: {
    gap: SP[1],
  },
  graphHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  graphLabel: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.45)",
  },
  graphRange: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.30)",
  },
  heroFooter: {
    alignItems: "center",
  },
  heroFooterText: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.30)",
  },

  // ── Coach card ────────────────────────────────────────────────────────────
  coachInner: {
    padding: SP[4],
    gap: SP[3],
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coachBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
  },
  coachBadgeIcon: {
    fontSize: 14,
  },
  coachBadgeText: {
    ...TYPE.smallSemiBold,
    color: GOLD.dim,
    letterSpacing: 0.5,
  },
  verdictBadge: {
    paddingHorizontal: SP[3],
    paddingVertical: 3,
    borderRadius: RADII.circle,
    borderWidth: 1,
  },
  verdictText: {
    ...TYPE.smallSemiBold,
    letterSpacing: 0.8,
  },
  narrative: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 24,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    ...TYPE.captionSemiBold,
    color: "rgba(255,255,255,0.40)",
    letterSpacing: 0.8,
    paddingHorizontal: SP[1],
    marginTop: SP[1],
  },

  // ── Metric rows ───────────────────────────────────────────────────────────
  metricRow: {
    borderRadius: RADII.md,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 4 }),
  },
  metricOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,14,10,0.90)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: RADII.md,
  },
  metricInner: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    gap: SP[1],
  },
  metricMainRow: {
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
    ...TYPE.captionSemiBold,
  },
  metricArrow: {
    ...TYPE.captionSemiBold,
    fontSize: 14,
  },
  metricExpand: {
    ...TYPE.captionSemiBold,
    color: "rgba(255,255,255,0.30)",
    marginLeft: SP[1],
    fontSize: 16,
  },
  barTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  barFill: {
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  metricDetail: {
    marginTop: SP[2],
    paddingTop: SP[2],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  metricDetailRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  detailStat: {
    alignItems: "center",
    gap: 2,
  },
  detailValue: {
    ...TYPE.captionSemiBold,
    color: GOLD.light,
  },
  detailLabel: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.35)",
  },

  // ── Collapsible sections ──────────────────────────────────────────────────
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
  },
  sectionToggleTitle: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  sectionToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  sectionCount: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.35)",
  },
  sectionChevron: {
    ...TYPE.small,
    color: GOLD.dim,
  },

  // ── Advanced items ────────────────────────────────────────────────────────
  advancedList: {
    paddingHorizontal: SP[4],
    paddingBottom: SP[3],
  },
  advancedItem: {
    paddingVertical: SP[2],
  },
  advancedItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  advancedLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
  },
  advancedChange: {
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 20,
    width: 16,
    textAlign: "center",
  },
  advancedLabel: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
    lineHeight: 18,
  },
  advancedComment: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 16,
    marginTop: 1,
  },

  // ── History items ─────────────────────────────────────────────────────────
  historyList: {
    paddingHorizontal: SP[4],
    paddingBottom: SP[3],
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SP[2],
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  historyLabel: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  historyDate: {
    ...TYPE.small,
    color: "rgba(255,255,255,0.40)",
    marginTop: 1,
  },
  historyScore: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: GOLD.light,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerText: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    marginTop: SP[2],
  },

  // ── Bottom CTA ────────────────────────────────────────────────────────────
  ctaWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    overflow: "hidden",
  },
  ctaBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GOLD.border,
  },
  ctaBtn: {
    borderRadius: RADII.circle,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: GOLD.primary,
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
        }
      : { elevation: 10 }),
  },
  ctaGradient: {
    paddingVertical: SP[4],
    alignItems: "center",
    borderRadius: RADII.circle,
  },
  ctaBtnText: {
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
    color: "#1A1200",
    letterSpacing: 0.3,
  },
});
