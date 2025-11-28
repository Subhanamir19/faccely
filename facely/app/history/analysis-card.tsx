import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

const BG = "#02040A";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#F5F7FA";
const SUBTLE = "rgba(255,255,255,0.72)";
const ACCENT = "#B4F34D";
const DOT = "rgba(255,255,255,0.22)";

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

  const size = 90;
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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

  const renderPage = ({
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
      <View style={[styles.slide, { width: width - 48 }]}>
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
              <Text key={`${item.key}-${idx}`} style={styles.cardLine}>
                {line || "--"}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const hasExpl = items.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Analysis history</Text>
          <Text style={styles.sub}>{formatDate(detail?.createdAt)}</Text>
          {detail?.modelVersion ? <Text style={styles.subDim}>Model {detail.modelVersion}</Text> : null}
        </View>

        {!scanId ? (
          <View style={styles.center}>
            <Text style={styles.text}>Error: Missing scanId</Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
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
          <>
            <View style={styles.imagesRow}>
              <View style={styles.imageCard}>
                <Text style={styles.imageLabel}>Front</Text>
                {detail.images?.front?.url ? (
                  <Image source={{ uri: detail.images.front.url }} style={styles.image} resizeMode="cover" />
                ) : (
                  <Text style={styles.imagePlaceholder}>No image</Text>
                )}
              </View>
              {detail.hasSideImage ? (
                <View style={styles.imageCard}>
                  <Text style={styles.imageLabel}>Side</Text>
                  {detail.images?.side?.url ? (
                    <Image source={{ uri: detail.images.side.url }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <Text style={styles.imagePlaceholder}>No image</Text>
                  )}
                </View>
              ) : null}
            </View>

            {!hasExpl ? (
              <View style={[styles.center, { flex: 1 }]}>
                <Text style={styles.text}>No analysis was generated for this scan.</Text>
              </View>
            ) : (
              <>
                <View style={styles.carouselArea}>
                  <FlatList
                    data={items}
                    ref={listRef}
                    renderItem={renderPage}
                    keyExtractor={(item) => item.key}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 48));
                      setPage(idx);
                    }}
                    contentContainerStyle={styles.carouselContent}
                    ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                  />
                </View>
                <View style={styles.pagerArea}>
                  <View style={styles.dots}>
                    {items.map((_, i) => (
                      <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                    ))}
                  </View>
                  {items.length > 1 ? <Text style={styles.swipeHint}>Swipe to view more metrics</Text> : null}
                </View>
              </>
            )}
          </>
        )}

        <View style={[styles.backArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20, paddingTop: 12 },
  header: { marginBottom: 18, paddingTop: 6, gap: 2 },
  title: { color: TEXT, fontSize: 22, fontWeight: "700", marginTop: 6 },
  sub: { color: "#9CA3AF", marginTop: 4, fontSize: 13 },
  subDim: { color: "#6B7280", marginTop: 2, fontSize: 12 },
  center: { alignItems: "center", justifyContent: "center", flex: 1, gap: 12 },
  text: { color: TEXT },
  backBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10 },
  backText: { color: TEXT, fontWeight: "600" },
  imagesRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  imageCard: {
    flex: 1,
    backgroundColor: "#050816",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    gap: 6,
  },
  imageLabel: { color: TEXT, fontWeight: "600", fontSize: 12 },
  image: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: "#0D1018" },
  imagePlaceholder: { color: SUBTLE },
  carouselArea: { flex: 1, justifyContent: "center" },
  carouselContent: { paddingHorizontal: 14, gap: 14 },
  slide: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 260,
    maxHeight: 320,
    gap: 12,
  },
  scorePill: {
    width: 120,
    backgroundColor: "#050816",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 14,
    paddingTop: 4,
    gap: 8,
    marginRight: 16,
  },
  scoreLabel: { color: "#D1D5DB", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  ringWrapper: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  ringWrap: {
    alignSelf: "center",
    width: 90,
    height: 90,
    borderRadius: 45,
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
  placeholderText: { color: SUBTLE, fontSize: 20, fontWeight: "700", fontFamily: POP },
  metricCard: {
    flex: 1,
    marginLeft: 0,
    backgroundColor: "#050816",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "flex-start", alignItems: "center" },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: CARD_BORDER, marginTop: 6 },
  remarksLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "600", marginTop: 8 },
  linesWrap: { gap: 4, marginTop: 12 },
  cardLine: { color: "#E5E7EB", fontSize: 14, lineHeight: 20, marginTop: 4 },
  pagerArea: { alignItems: "center", marginTop: 8, marginBottom: 8 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DOT },
  dotActive: { backgroundColor: ACCENT, width: 10, height: 10 },
  swipeHint: { color: "#6B7280", textAlign: "center", marginTop: 4, fontSize: 11 },
  backArea: { marginTop: 4 },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    height: 52,
    justifyContent: "center",
  },
  ctaText: { color: "#081109", fontWeight: "600", fontSize: 16 },
});
