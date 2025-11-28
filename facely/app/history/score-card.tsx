import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";

const BG = "#02040A";
const CARD = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const SUBTLE = "rgba(255,255,255,0.72)";
const ACCENT = "#B4F34D";
const TRACK = "rgba(255,255,255,0.14)";

const METRIC_DEFS: Array<{ key: keyof ScanDetail["scores"]; label: string }> = [
  { key: "jawline", label: "Jawline" },
  { key: "facial_symmetry", label: "Face Symmetry" },
  { key: "cheekbones", label: "Cheekbones" },
  { key: "sexual_dimorphism", label: "Masculinity/Femininity" },
  { key: "skin_quality", label: "Skin Quality" },
  { key: "eyes_symmetry", label: "Eye Symmetry" },
  { key: "nose_harmony", label: "Nose Balance" },
];

function formatDate(value: string | undefined) {
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

export default function HistoryScoreCard() {
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

  const renderMetric = (m: { key: string; label: string; value: number }) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(m.value) ? m.value : 0));
    return (
      <View key={m.key} style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{m.label}</Text>
          <Text style={styles.metricValue}>{clamped}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${clamped}%` }]} />
        </View>
      </View>
    );
  };

  const renderImageCard = (label: string, path?: string, url?: string) => {
    if (!url) {
      return (
        <View style={styles.imageCard}>
          <Text style={styles.imageLabel}>{label}</Text>
          <Text style={styles.imagePlaceholder}>No image</Text>
        </View>
      );
    }
    return (
      <View style={styles.imageCard}>
        <Text style={styles.imageLabel}>{label}</Text>
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
        <Text style={styles.imagePath} numberOfLines={1}>
          {path || ""}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Score history</Text>
          <Text style={styles.sub}>{formatDate(detail?.createdAt)}</Text>
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
              {renderImageCard("Front", detail.images?.front?.path, detail.images?.front?.url)}
              {detail.hasSideImage
                ? renderImageCard("Side", detail.images?.side?.path, detail.images?.side?.url)
                : null}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: 120, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {metrics.length ? (
                metrics.map(renderMetric)
              ) : (
                <View style={styles.metricCard}>
                  <Text style={styles.text}>No scores available for this scan.</Text>
                </View>
              )}
            </ScrollView>
          </>
        )}

        <View style={styles.bottomBar}>
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
  header: { marginBottom: 16 },
  title: { color: TEXT, fontSize: 22, fontWeight: "700", marginTop: 4 },
  sub: { color: SUBTLE, marginTop: 4 },
  center: { alignItems: "center", justifyContent: "center", flex: 1, gap: 12 },
  text: { color: TEXT },
  backBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10 },
  backText: { color: TEXT, fontWeight: "600" },
  imagesRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  imageCard: {
    flex: 1,
    backgroundColor: CARD,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 6,
  },
  imageLabel: { color: TEXT, fontWeight: "600" },
  image: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: "#0D1018" },
  imagePlaceholder: { color: SUBTLE },
  imagePath: { color: SUBTLE, fontSize: 12 },
  scroll: { flex: 1 },
  metricCard: {
    backgroundColor: CARD,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  metricHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { color: TEXT, fontSize: 16, fontWeight: "600" },
  metricValue: { color: TEXT, fontSize: 20, fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  bottomBar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#081109", fontWeight: "700", fontSize: 16 },
});
