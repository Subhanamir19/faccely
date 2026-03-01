// app/history/compare.tsx
// Side-by-side photo comparison with drag slider

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fetchScanDetail, type ScanDetail } from "@/lib/api/history";
import type { Scores } from "@/lib/api/scores";
import Text from "@/components/ui/T";
import BackButton from "@/components/ui/BackButton";
import { COLORS, RADII, SP } from "@/lib/tokens";

/* ─── layout ──────────────────────────────────────────────────── */
const { width: W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD   = 20;
const CARD_W  = W - H_PAD * 2;
const IMG_H   = Math.round(CARD_W * 1.2);
const HANDLE_R = 20;
const BG = "#0B0B0B";

/* ─── helpers ─────────────────────────────────────────────────── */
function computeOverall(scores: Scores): number {
  const vals = [
    scores.jawline,
    scores.facial_symmetry,
    scores.skin_quality,
    scores.cheekbones,
    scores.eyes_symmetry,
    scores.nose_harmony,
    scores.sexual_dimorphism,
  ];
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function formatShortDate(value: string): string {
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

/* ─── score badge ─────────────────────────────────────────────── */
type BadgeProps = {
  date: string;
  score: number;
  side: "left" | "right";
};

function ScoreBadge({ date, score, side }: BadgeProps) {
  const isRight = side === "right";
  return (
    <View style={[styles.badge, isRight ? styles.badgeRight : styles.badgeLeft]}>
      <LinearGradient
        colors={
          isRight
            ? ["rgba(180,243,77,0.20)", "rgba(0,0,0,0.60)"]
            : ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.50)"]
        }
        style={StyleSheet.absoluteFill}
        borderRadius={10}
      />
      <Text style={[styles.badgeDate, isRight && styles.badgeDateAccent]} numberOfLines={1}>
        {date}
      </Text>
      <View style={styles.badgeScoreRow}>
        <Text style={[styles.badgeNum, isRight && styles.badgeNumAccent]}>
          {score}
        </Text>
        <Text style={[styles.badgeDenom, isRight && styles.badgeDenomAccent]}>
          /100
        </Text>
      </View>
    </View>
  );
}

/* ─── screen ──────────────────────────────────────────────────── */
export default function CompareScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId1?: string; scanId2?: string }>();
  const { scanId1, scanId2 } = params;

  const [scan1, setScan1] = useState<ScanDetail | null>(null);
  const [scan2, setScan2] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId1 || !scanId2) {
      setError("Missing scan IDs.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetchScanDetail(scanId1),
          fetchScanDetail(scanId2),
        ]);
        if (!cancelled) {
          // Sort so the older scan is always on the left
          if (new Date(a.createdAt) <= new Date(b.createdAt)) {
            setScan1(a);
            setScan2(b);
          } else {
            setScan1(b);
            setScan2(a);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load scans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [scanId1, scanId2]);

  /* ── slider state ── */
  const initX = CARD_W / 2;
  const sliderXRef    = useRef(initX);
  const gestureStartX = useRef(initX);
  const [sliderX, setSliderX] = useState(initX);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        gestureStartX.current = sliderXRef.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const next = Math.max(0, Math.min(CARD_W, gestureStartX.current + dx));
        sliderXRef.current = next;
        setSliderX(next);
      },
    })
  ).current;

  /* ── loading / error states ── */
  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text variant="caption" color="sub" style={{ marginTop: SP[3] }}>
          Loading scans…
        </Text>
      </View>
    );
  }

  if (error || !scan1 || !scan2) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.centered}>
          <Text variant="body" color="sub">{error || "Could not load scans."}</Text>
        </View>
      </View>
    );
  }

  const score1 = computeOverall(scan1.scores);
  const score2 = computeOverall(scan2.scores);
  const date1  = formatShortDate(scan1.createdAt);
  const date2  = formatShortDate(scan2.createdAt);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.headerCenter}>
            <Text variant="bodySemiBold" color="text">Comparison</Text>
            <Text variant="small" color="sub">Drag to compare</Text>
          </View>
          {/* Spacer to balance layout */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Slider */}
        <View style={styles.sliderWrapper}>
          <View style={styles.sliderContainer} {...pan.panHandlers}>
            {/* Right image (newer) — base layer */}
            <Image
              source={{ uri: scan2.images.front.url }}
              style={styles.fullImg}
              resizeMode="cover"
            />

            {/* Left image (older) — clipped on top */}
            <View style={[styles.leftClip, { width: sliderX }]}>
              <Image
                source={{ uri: scan1.images.front.url }}
                style={[styles.fullImg, { width: CARD_W }]}
                resizeMode="cover"
              />
            </View>

            {/* Score badges */}
            <ScoreBadge side="left"  date={date1} score={score1} />
            <ScoreBadge side="right" date={date2} score={score2} />

            {/* Divider line */}
            <View style={[styles.divider, { left: sliderX - 1 }]} />

            {/* Drag handle */}
            <View
              style={[
                styles.handle,
                { left: sliderX - HANDLE_R, top: IMG_H / 2 - HANDLE_R },
              ]}
            >
              <MaterialCommunityIcons name="chevron-left"  size={13} color={BG} />
              <MaterialCommunityIcons name="chevron-right" size={13} color={BG} />
            </View>
          </View>
        </View>

        {/* Bottom info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <View style={styles.infoDot} />
            <Text variant="caption" color="sub" numberOfLines={1}>{date1}</Text>
            <Text variant="captionSemiBold" color="text"> · {score1}/100</Text>
          </View>
          <View style={styles.infoSep} />
          <View style={styles.infoItem}>
            <View style={[styles.infoDot, styles.infoDotAccent]} />
            <Text variant="caption" color="sub" numberOfLines={1}>{date2}</Text>
            <Text variant="captionSemiBold" style={{ color: COLORS.accent }}> · {score2}/100</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    paddingHorizontal: H_PAD,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SP[2],
    paddingBottom: SP[4],
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerSpacer: {
    width: 60, // mirrors BackButton width to keep title centered
  },

  // Slider
  sliderWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sliderContainer: {
    width: CARD_W,
    height: IMG_H,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#111",
    alignSelf: "center",
  },
  fullImg: {
    width: CARD_W,
    height: IMG_H,
  },
  leftClip: {
    position: "absolute",
    left: 0,
    top: 0,
    height: IMG_H,
    overflow: "hidden",
  },

  // Divider + handle
  divider: {
    position: "absolute",
    top: 0,
    width: 2,
    height: IMG_H,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_R * 2,
    height: HANDLE_R * 2,
    borderRadius: HANDLE_R,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  // Score badges
  badge: {
    position: "absolute",
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    maxWidth: CARD_W * 0.42,
  },
  badgeLeft:  { left: 10 },
  badgeRight: { right: 10, borderColor: "rgba(180,243,77,0.22)" },
  badgeDate: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  badgeDateAccent: {
    color: COLORS.accent,
  },
  badgeScoreRow: { flexDirection: "row", alignItems: "flex-end" },
  badgeNum: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 20,
    lineHeight: 24,
  },
  badgeNumAccent: { color: COLORS.accent },
  badgeDenom: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 11,
    lineHeight: 18,
    marginLeft: 1,
    marginBottom: 1,
  },
  badgeDenomAccent: { color: "rgba(180,243,77,0.7)" },

  // Bottom info row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[4],
    gap: SP[2],
  },
  infoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    flexWrap: "nowrap",
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
    flexShrink: 0,
  },
  infoDotAccent: {
    backgroundColor: COLORS.accent,
  },
  infoSep: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.divider,
  },
});
