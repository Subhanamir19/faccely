import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Screen from "@/components/layout/Screen";
import Text from "@/components/ui/T";
import MetricCardShell from "@/components/layout/MetricCardShell";
import MetricPagerFooter from "@/components/layout/MetricPagerFooter";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { COLORS, SP } from "@/lib/tokens";
import useMetricSizing from "@/components/layout/useMetricSizing";

const CARD_BORDER = COLORS.cardBorder;
const CARD = COLORS.card;
const TEXT = COLORS.text;
const SUBTLE = COLORS.sub;
const ACCENT = COLORS.accent;

const METRIC_DEFS: Array<{ key: keyof ScanDetail["scores"]; label: string }> = [
  { key: "eyes_symmetry", label: "Eyes" },
  { key: "jawline", label: "Jawline" },
  { key: "cheekbones", label: "Cheekbones" },
  { key: "nose_harmony", label: "Nose" },
  { key: "facial_symmetry", label: "Face Symmetry" },
  { key: "skin_quality", label: "Skin" },
  { key: "sexual_dimorphism", label: "Masculinity" },
];

const RING_COLORS = {
  track: "rgba(255,255,255,0.16)",
  text: "rgba(255,255,255,0.92)",
};

const SCORE_COLOR_BANDS = [
  { max: 39, color: "#EF4444" },
  { max: 59, color: "#BE00E8" },
  { max: 79, color: "#F59E0B" },
  { max: 100, color: "#B4F34D" },
] as const;

type ScorePalette = {
  accent: string;
  accentLight: string;
  glow: string;
};

const POP = Platform.select({
  ios: "Poppins-SemiBold",
  android: "Poppins-SemiBold",
  default: "Poppins-SemiBold",
});

const AnimatedCircle: any = Animated.createAnimatedComponent(Circle);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const roundPct = (n: number) => Math.round(n);

const RING_SIZE = 112;
const LINE_GAP = SP[1] + 2; // 6px derived from tokens for uniform line spacing

function hexToRgb(hex: string) {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const parsed = parseInt(normalized, 16);
  const int = Number.isNaN(parsed) ? 0 : parsed;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
}

function toHex(channel: number) {
  return Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, "0");
}

function lightenColor(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) => channel + (255 - channel) * amount;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getScorePalette(score: number): ScorePalette {
  const s = clamp(score, 0, 100);
  const band = SCORE_COLOR_BANDS.find(({ max }) => s <= max) ?? SCORE_COLOR_BANDS[SCORE_COLOR_BANDS.length - 1];
  const accent = band.color;
  return {
    accent,
    accentLight: lightenColor(accent, 0.25),
    glow: withAlpha(accent, 0.28),
  };
}

function formatDate(value?: string) {
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

function ScoreRing({ value, active }: { value: number; active: boolean }) {
  const palette = useMemo(() => getScorePalette(value), [value]);

  const size = RING_SIZE;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 850 : 250,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [active, value, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - clamp(value, 0, 100) / 100)],
  });

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="historyRingGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={palette.accentLight} />
            <Stop offset="100%" stopColor={palette.accent} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={center}
          cy={center}
          r={center - 2}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1}
        />

        <Circle cx={center} cy={center} r={r} stroke={RING_COLORS.track} strokeWidth={stroke} fill="none" />

        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#historyRingGrad)"
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

      <Animated.Text style={styles.ringText as any}>
        {`${roundPct(clamp(value, 0, 100))}%`}
      </Animated.Text>
    </View>
  );
}

export default function HistoryAnalysisCard() {
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = params?.scanId;
  const sizing = useMetricSizing();
  const { cardWidth, gutter, snap, pad } = sizing;

  const [detail, setDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);

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

  const items = useMemo(() => {
    if (!detail?.explanations || !detail?.scores) return [];
    return METRIC_DEFS.map((def) => {
      const explanations = (detail.explanations as any)?.[def.key];
      const score = Number((detail.scores as any)?.[def.key]);
      const hasCopy = Array.isArray(explanations) && explanations.some((line) => typeof line === "string" && line.trim().length > 0);
      if (!hasCopy) return null;
      return {
        key: def.key,
        label: def.label,
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
        lines: explanations as string[],
      };
    }).filter(Boolean) as Array<{ key: string; label: string; score: number | null; lines: string[] }>;
  }, [detail]);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(page, items.length - 1));
    if (clamped !== page) {
      setPage(clamped);
    }
    listRef.current?.scrollToOffset({ offset: clamped * snap, animated: false });
  }, [items.length, page, snap]);

  const scrollToPage = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(items.length - 1, i));
      listRef.current?.scrollToOffset({ offset: next * snap, animated: true });
      setPage(next);
    },
    [items.length, snap]
  );

  const goPrev = useCallback(() => scrollToPage(page - 1), [page, scrollToPage]);
  const goNext = useCallback(() => scrollToPage(page + 1), [page, scrollToPage]);

  const renderPage = useCallback(
    ({
      item,
      index,
    }: {
      item: { key: string; label: string; score: number | null; lines: string[] };
      index: number;
    }) => {
      const hasScore = typeof item.score === "number" && Number.isFinite(item.score);
      const safeScore = hasScore ? clamp(item.score ?? 0, 0, 100) : null;
      const isActive = page === index;

      return (
        <MetricCardShell withOuterPadding={false} renderSurface={false} sizing={sizing}>
          {(usableWidth) => (
            <View style={[styles.slideCard, { width: usableWidth }]}>
              <View style={[styles.slide, { gap: gutter }]}>
                <View style={styles.scorePill}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  {safeScore != null ? (
                    <View style={styles.ringWrapper}>
                      <ScoreRing value={safeScore} active={isActive} />
                    </View>
                  ) : (
                    <View style={styles.ringWrapper}>
                      <View style={[styles.ringWrap, styles.ringPlaceholder]}>
                        <Text style={styles.placeholderText}>--</Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.metricCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                  </View>
                  <Text style={styles.remarksLabel}>Remarks</Text>
                  <View style={styles.linesWrap}>
                    {item.lines.map((line, idx) => (
                      <Text key={`${item.key}-${idx}`} style={styles.cardLine} numberOfLines={2}>
                        {`• ${line || "--"}`}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
        </MetricCardShell>
      );
    },
    [gutter, page]
  );

  const hasExpl = items.length > 0;
  const showSideImage = !!detail?.hasSideImage;

  return (
    <Screen
      scroll={false}
      contentContainerStyle={styles.screenContent}
      footer={
        hasExpl ? (
          <MetricPagerFooter
            index={page}
            total={items.length}
            onPrev={goPrev}
            onNext={page === items.length - 1 ? () => router.back() : goNext}
            isFirst={page === 0}
            isLast={page === items.length - 1}
            nextLabel={page === items.length - 1 ? "Back" : "Next"}
            helperText={items.length > 1 ? "Swipe to view more metrics" : undefined}
            padX={0}
          />
        ) : null
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={18} color={TEXT} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Analysis history</Text>
          <View style={styles.meta}>
            <Text style={styles.sub}>{formatDate(detail?.createdAt)}</Text>
          </View>
        </View>
      </View>

      {!scanId ? (
        <View style={styles.center}>
          <Text style={styles.text}>Error: Missing scanId</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TEXT} />
          <Text style={styles.text}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.text}>Error: {error}</Text>
        </View>
      ) : !detail ? (
        <View style={styles.center}>
          <Text style={styles.text}>No data.</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <MetricCardShell sizing={sizing}>
            {(usableWidth) => {
              const computedImageWidth = showSideImage ? (usableWidth - gutter) / 2 : usableWidth;
              return (
                <View style={[styles.imagesRow, { gap: gutter }]}>
                  <View style={[styles.imageCard, { width: computedImageWidth }]}>
                    <Text style={styles.imageLabel}>Front</Text>
                    {detail.images?.front?.url ? (
                      <Image source={{ uri: detail.images.front.url }} style={styles.image} resizeMode="cover" />
                    ) : (
                      <Text style={styles.imagePlaceholder}>No image</Text>
                    )}
                  </View>
                  {showSideImage ? (
                    <View style={[styles.imageCard, { width: computedImageWidth }]}>
                      <Text style={styles.imageLabel}>Side</Text>
                      {detail.images?.side?.url ? (
                        <Image source={{ uri: detail.images.side.url }} style={styles.image} resizeMode="cover" />
                      ) : (
                        <Text style={styles.imagePlaceholder}>No image</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            }}
          </MetricCardShell>

          {!hasExpl ? (
            <View style={[styles.center, styles.grow]}>
              <Text style={styles.text}>No analysis was generated for this scan.</Text>
            </View>
          ) : (
            <View style={styles.carouselArea}>
              <FlatList
                data={items}
                ref={listRef}
                renderItem={renderPage}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled={false}
                snapToInterval={snap}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
                  setPage(idx);
                }}
                contentContainerStyle={[styles.carouselContent, { paddingHorizontal: pad }]}
                ItemSeparatorComponent={() => <View style={{ width: gutter }} />}
                getItemLayout={(_, i) => ({ length: snap, offset: snap * i, index: i })}
              />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingTop: SP[4],
    paddingBottom: SP[4],
    gap: SP[4],
  },
  header: { gap: SP[2] },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    paddingVertical: SP[1],
  },
  backText: { color: TEXT, fontSize: 14 },
  titleBlock: { gap: SP[1] },
  title: { color: TEXT, fontSize: 22, lineHeight: 28 },
  meta: { gap: 2 },
  sub: { color: SUBTLE, fontSize: 13 },
  subDim: { color: "rgba(255,255,255,0.64)", fontSize: 12 },
  text: { color: TEXT, textAlign: "center" },
  content: { flex: 1, gap: SP[4], justifyContent: "flex-start" },
  center: { alignItems: "center", justifyContent: "center", gap: SP[2] },
  grow: { flex: 1 },

  imagesRow: { flexDirection: "row", alignSelf: "center" },
  imageCard: {
    backgroundColor: CARD,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: SP[3],
    gap: SP[1],
  },
  imageLabel: { color: TEXT, fontSize: 13, marginTop: 2 },
  image: { width: "100%", aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)" },
  imagePlaceholder: { color: SUBTLE, fontSize: 13 },

  carouselArea: { flex: 1, justifyContent: "center" },
  carouselContent: { alignItems: "center", paddingVertical: SP[2] },
  slide: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 240,
  },
  slideCard: {
    backgroundColor: CARD,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    alignSelf: "center",
  },
  cardShell: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  scorePill: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[2],
    paddingHorizontal: SP[2],
    minWidth: RING_SIZE + SP[2] * 2,
  },
  scoreLabel: { color: SUBTLE, fontSize: 12 },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  ringWrap: {
    alignSelf: "center",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 8,
  },
  ringText: { position: "absolute", fontSize: 26, color: RING_COLORS.text, fontFamily: POP },
  ringPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  placeholderText: { color: SUBTLE, fontSize: 18, fontFamily: POP },

  metricCard: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    gap: SP[2],
  },
  cardHeader: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center" },
  cardTitle: { color: TEXT, fontSize: 18, lineHeight: 24, fontFamily: "Poppins-SemiBold" },
  remarksLabel: { color: ACCENT, fontSize: 13, letterSpacing: 0.2, marginTop: 2, fontFamily: "Poppins-SemiBold" },
  linesWrap: { gap: LINE_GAP },
  cardLine: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Poppins-Medium",
  },

  swipeHint: { color: SUBTLE, textAlign: "center", fontSize: 12, opacity: 0.8 },
});
