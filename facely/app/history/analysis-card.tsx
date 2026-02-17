// app/history/analysis-card.tsx
// Analysis detail view - premium design matching app aesthetic

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  View,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import StateView from "@/components/layout/StateView";
import MetricPagerFooter from "@/components/layout/MetricPagerFooter";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { COLORS, SP, RADII, SIZES } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const METRIC_DEFS: Array<{ key: keyof ScanDetail["scores"]; label: string }> = [
  { key: "eyes_symmetry", label: "Eyes" },
  { key: "jawline", label: "Jawline" },
  { key: "cheekbones", label: "Cheekbones" },
  { key: "nose_harmony", label: "Nose" },
  { key: "facial_symmetry", label: "Symmetry" },
  { key: "skin_quality", label: "Skin" },
  { key: "sexual_dimorphism", label: "Masculinity" },
];

const SCORE_COLORS = [
  { max: 39, color: "#EF4444", glow: "rgba(239,68,68,0.3)" },
  { max: 59, color: "#BE00E8", glow: "rgba(190,0,232,0.3)" },
  { max: 79, color: "#F59E0B", glow: "rgba(245,158,11,0.3)" },
  { max: 100, color: "#B4F34D", glow: "rgba(180,243,77,0.3)" },
] as const;

const RING_SIZE = 140;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function getScoreData(score: number) {
  const s = clamp(score, 0, 100);
  const data = SCORE_COLORS.find(({ max }) => s <= max) ?? SCORE_COLORS[3];
  return data;
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round((255 - (num >> 16)) * amount));
  const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round((255 - ((num >> 8) & 0x00ff)) * amount));
  const b = Math.min(255, (num & 0x0000ff) + Math.round((255 - (num & 0x0000ff)) * amount));
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function formatDate(value?: string): string {
  if (!value) return "--";
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

type ScoreRingProps = { value: number; active: boolean };

function ScoreRing({ value, active }: ScoreRingProps) {
  const scoreData = getScoreData(value);
  const color = scoreData.color;
  const colorLight = lightenColor(color, 0.35);
  const stroke = 12;
  const r = (RING_SIZE - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = RING_SIZE / 2;

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 1000 : 200,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [active, value]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - clamp(value, 0, 100) / 100)],
  });

  return (
    <View style={[styles.ringContainer, { shadowColor: color }]}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colorLight} />
            <Stop offset="100%" stopColor={color} />
          </SvgGradient>
        </Defs>
        {/* Background ring */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={COLORS.track}
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress ring */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#ringGrad)"
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
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color }]}>
          {Math.round(clamp(value, 0, 100))}
        </Text>
        <Text variant="small" color="sub">/ 100</Text>
      </View>
    </View>
  );
}

type AnalysisItem = {
  key: string;
  label: string;
  score: number | null;
  lines: string[];
};

export default function HistoryAnalysisCard() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = params?.scanId;

  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  const cardWidth = SCREEN_WIDTH - SP[4] * 2;
  const gutter = SP[3];
  const snap = cardWidth + gutter;

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

  const items = useMemo(() => {
    if (!detail?.explanations || !detail?.scores) return [] as AnalysisItem[];
    const result: AnalysisItem[] = [];
    for (const def of METRIC_DEFS) {
      const explanations = (detail.explanations as any)?.[def.key];
      const score = Number((detail.scores as any)?.[def.key]);
      const hasCopy = Array.isArray(explanations) &&
        explanations.some((line: unknown) => typeof line === "string" && (line as string).trim().length > 0);
      if (hasCopy) {
        result.push({
          key: def.key as string,
          label: def.label,
          score: Number.isFinite(score) ? clamp(score, 0, 100) : null,
          lines: explanations as string[],
        });
      }
    }
    return result;
  }, [detail]);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(page, items.length - 1));
    if (clamped !== page) setPage(clamped);
  }, [items.length, page]);

  const scrollToPage = useCallback((i: number) => {
    const next = Math.max(0, Math.min(items.length - 1, i));
    listRef.current?.scrollToOffset({ offset: next * snap, animated: true });
    setPage(next);
  }, [items.length, snap]);

  const handleBack = () => router.back();

  const renderCard = useCallback(({ item, index }: { item: AnalysisItem; index: number }) => {
    const isActive = page === index;
    const safeScore = item.score ?? 0;
    const scoreData = getScoreData(safeScore);

    return (
      <View style={[styles.analysisCard, { width: cardWidth }]}>
        {/* Glow effect */}
        <View style={[styles.cardGlow, { backgroundColor: scoreData.glow }]} />

        {/* Card content */}
        <View style={styles.cardContent}>
          {/* Top section: Image + Ring */}
          <View style={styles.topSection}>
            {/* Mini profile image */}
            <View style={styles.miniImageWrapper}>
              {detail?.images?.front?.url ? (
                <Image
                  source={{ uri: detail.images.front.url }}
                  style={styles.miniImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.miniImage, styles.imagePlaceholder]}>
                  <Text variant="caption" color="sub">?</Text>
                </View>
              )}
            </View>

            {/* Score Ring */}
            <ScoreRing value={safeScore} active={isActive} />

            {/* Metric label badge */}
            <View style={[styles.metricBadge, { borderColor: scoreData.color }]}>
              <Text variant="captionSemiBold" style={{ color: scoreData.color }}>
                {item.label}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Remarks section */}
          <View style={styles.remarksSection}>
            <Text variant="captionSemiBold" style={styles.remarksTitle}>
              Analysis
            </Text>
            <View style={styles.remarksList}>
              {item.lines.slice(0, 4).map((line, idx) => (
                <View key={idx} style={styles.remarkRow}>
                  <View style={[styles.remarkDot, { backgroundColor: scoreData.color }]} />
                  <Text variant="caption" color="textHigh" style={styles.remarkText}>
                    {line || "--"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }, [page, cardWidth, detail]);

  if (!scanId || loading || error || !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <Text variant="h2" color="text">Analysis</Text>
        </View>
        <StateView
          loading={loading}
          loadingText="Loading analysis..."
          error={error}
          empty={!scanId}
          emptyTitle="Missing scan"
          emptySubtitle="Could not load this scan"
        />
      </View>
    );
  }

  const hasItems = items.length > 0;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />

      {/* Accent glow at top */}
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.headerTitle}>
            <Text variant="h2" color="text">Analysis</Text>
            <View style={styles.dateBadge}>
              <Text variant="small" color="sub">{formatDate(detail.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Cards Carousel */}
        {hasItems ? (
          <View style={styles.carouselSection}>
            <FlatList
              ref={listRef}
              data={items}
              renderItem={renderCard}
              keyExtractor={(item) => item.key}
              horizontal
              pagingEnabled={false}
              snapToInterval={snap}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
                setPage(idx);
              }}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => <View style={{ width: gutter }} />}
            />
          </View>
        ) : (
          <View style={styles.emptyAnalysis}>
            <Text variant="body" color="sub">No analysis generated for this scan.</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      {hasItems && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SP[4] }]}>
          <MetricPagerFooter
            index={page}
            total={items.length}
            onPrev={() => scrollToPage(page - 1)}
            onNext={page === items.length - 1 ? handleBack : () => scrollToPage(page + 1)}
            isFirst={page === 0}
            isLast={page === items.length - 1}
            nextLabel={page === items.length - 1 ? "Done" : "Next"}
            helperText={items.length > 1 ? "Swipe to view more metrics" : undefined}
            padX={0}
          />
        </View>
      )}
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    paddingBottom: SP[3],
    gap: SP[1],
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  dateBadge: {
    backgroundColor: COLORS.whiteGlass,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Carousel
  carouselSection: {
    flex: 1,
    justifyContent: "center",
  },
  carouselContent: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
  },
  emptyAnalysis: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Analysis card
  analysisCard: {
    backgroundColor: COLORS.bgBottom,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.5,
  },
  cardContent: {
    padding: SP[4],
    gap: SP[4],
  },

  // Top section
  topSection: {
    alignItems: "center",
    gap: SP[3],
  },
  miniImageWrapper: {
    padding: 2,
    borderRadius: (SIZES.avatarSm + 4) / 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  miniImage: {
    width: SIZES.avatarSm,
    height: SIZES.avatarSm,
    borderRadius: SIZES.avatarSm / 2,
    backgroundColor: COLORS.track,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Score ring
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringValue: {
    fontSize: 40,
    lineHeight: 48,
    fontFamily: "Poppins-SemiBold",
  },

  // Metric badge
  metricBadge: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.circle,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },

  // Remarks section
  remarksSection: {
    gap: SP[3],
  },
  remarksTitle: {
    color: COLORS.accent,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  remarksList: {
    gap: SP[2],
  },
  remarkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
  },
  remarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  remarkText: {
    flex: 1,
    lineHeight: 20,
  },

  // Footer
  footer: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
  },
});
