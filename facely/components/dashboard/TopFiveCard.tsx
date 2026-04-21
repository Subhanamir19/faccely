// components/dashboard/TopFiveCard.tsx
// Top 5 trainable sub-metrics card — warm cream "Quests" treatment.
// Mode: "improving" (lime zone) once the app has enough trend data,
//       "toTarget"  (red  zone) for new users.
// Rows tap-open the existing MetricDetailCard modal.

import React, { useState, useCallback } from "react";
import { View, Pressable, Image, StyleSheet, Platform } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { TrendingUp, Target, Sparkles, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";

import Text from "@/components/ui/T";
import { ms, sw, sh } from "@/lib/responsive";
import { MetricDetailCard, type DetailMetric } from "@/components/analysis/MetricDetailCard";
import type { TopFiveResult, SubMetricRow } from "@/lib/submetrics";

// ---------------------------------------------------------------------------
// Visual tokens — warm cream sheet with colorful numbered rows
// ---------------------------------------------------------------------------

const C = {
  // Sheet
  sheetBg:        "#FFF8E7",
  sheetDepth:     "#C9B98A",
  sheetBorder:    "rgba(28,36,24,0.06)",

  // Text
  ink:            "#1C2418",
  inkMuted:       "#8A8576",
  avatarBg:       "#D9D9D9",
  avatarDepth:    "#BEBEBE",

  // Count badge (top-right, red)
  countBg:        "#F04A4A",
  countDepth:     "#C12D2D",

  // Title chip (target/dart)
  titleChipRed:   "#F04A4A",
  titleChipBlue:  "#3BA7F5",
  titleChipWhite: "#FFFFFF",

  // Locked-state colors (dark fallback)
  lockedBg:       "#141414",
  lockedBrd:      "#222222",
  lockedIcon:     "#808080",
  lockedText:     "#FFFFFF",
} as const;

// Per-row palette (1..5)
const ROW_PALETTE = [
  { border: "#F45B5B", depth: "#C83B3B", badge: "#F45B5B" }, // 1 red
  { border: "#F5B93B", depth: "#C98C1C", badge: "#F5B93B" }, // 2 amber
  { border: "#B569D6", depth: "#8943AB", badge: "#B569D6" }, // 3 purple
  { border: "#4BA8E8", depth: "#2A7FB8", badge: "#4BA8E8" }, // 4 blue
  { border: "#6CC24A", depth: "#4A9A2C", badge: "#6CC24A" }, // 5 green
] as const;

const CARD_RADIUS   = ms(22);
const ICON_BOX_SIZE = ms(40);
const ICON_RADIUS   = ms(999);

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function Row({
  item,
  index,
  onPress,
}: {
  item:    SubMetricRow;
  index:   number;
  onPress: (m: SubMetricRow) => void;
}) {
  const palette = ROW_PALETTE[index % ROW_PALETTE.length];

  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(Math.min(index * 60, 280))}
      style={[rowStyles.cardDepth, { backgroundColor: palette.depth }]}
    >
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          rowStyles.cardFace,
          { borderColor: palette.border },
          pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}`}
      >
        {/* Numbered circle badge — left */}
        <View style={[rowStyles.numBadge, { backgroundColor: palette.badge }]}>
          <Text style={rowStyles.numText}>{index + 1}</Text>
        </View>

        {/* Icon / avatar */}
        <View style={rowStyles.iconBox}>
          {item.icon ? (
            <Image source={item.icon} style={rowStyles.metricIcon} />
          ) : (
            <Text style={rowStyles.metricEmoji}>{item.emoji}</Text>
          )}
        </View>

        {/* Label + meta */}
        <View style={rowStyles.labelBlock}>
          <Text style={rowStyles.metricLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={rowStyles.metaText} numberOfLines={1}>
            {item.category} · {item.verdict}
          </Text>
        </View>

        {/* Chevron — matches row accent */}
        <ChevronRight size={ms(18)} color={palette.border} strokeWidth={2.6} />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function TopFiveCard({ result }: { result: TopFiveResult }) {
  const [selected, setSelected] = useState<SubMetricRow | null>(null);

  const handlePress   = useCallback((m: SubMetricRow) => setSelected(m), []);
  const handleDismiss = useCallback(() => setSelected(null), []);

  // ── Locked / empty state ──
  if (result.mode === "none" || result.rows.length === 0) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        style={[styles.lockedZone]}
      >
        <View style={styles.lockedRow}>
          <View style={styles.lockedIconBadge}>
            <Sparkles size={ms(14)} color={C.lockedIcon} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.lockedTitle}>Top 5 Insights</Text>
            <Text style={styles.lockedSubtitle}>
              Unlock personalized sub-metric breakdowns
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(tabs)/analysis")}
          style={({ pressed }) => [
            styles.lockedCta,
            pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Run advanced analysis"
        >
          <Text style={styles.lockedCtaText}>Run Advanced Analysis</Text>
          <ChevronRight size={ms(14)} color={C.lockedText} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
    );
  }

  const isImproving = result.mode === "improving";
  const title       = isImproving ? "Top 5 Improving" : "Top 5 to Target";
  const subtitle    = isImproving
    ? "Biggest gains since your first scan"
    : "Where your next scans should move the needle";
  const Icon        = isImproving ? TrendingUp : Target;

  const detailMetric: DetailMetric | null = selected
    ? {
        id:         selected.id,
        label:      selected.label,
        category:   selected.category,
        score:      selected.score,
        verdict:    selected.verdict,
        commentary: selected.commentary,
        idealRange: selected.idealRange,
        status:     selected.status,
        section:    selected.section,
        icon:       selected.icon,
        emoji:      selected.emoji,
      }
    : null;

  const rows = result.rows.slice(0, 5);

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        style={styles.sheetDepth}
      >
        <View style={styles.sheetFace}>

          {/* ── Header row ── */}
          <View style={styles.zoneHeader}>
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.titleChip}>
                  <View style={styles.titleChipOuter} />
                  <View style={styles.titleChipMid} />
                  <View style={styles.titleChipInner}>
                    <Icon size={ms(10)} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              </View>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            {/* Red count badge */}
            <View style={styles.countDepth}>
              <View style={styles.countFace}>
                <Text style={styles.countText}>{rows.length}</Text>
              </View>
            </View>
          </View>

          {/* ── Rows ── */}
          <View style={styles.rowList}>
            {rows.map((row, i) => (
              <Row
                key={row.id}
                item={row}
                index={i}
                onPress={handlePress}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <MetricDetailCard metric={detailMetric} onDismiss={handleDismiss} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FONT_SEMI = Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" });
const FONT_MED  = Platform.select({ ios: "Poppins-Medium",   android: "Poppins-Medium",   default: "Poppins-Medium" });
const FONT_REG  = Platform.select({ ios: "Poppins-Regular",  android: "Poppins-Regular",  default: "Poppins-Regular" });

const styles = StyleSheet.create({
  sheetDepth: {
    borderRadius: ms(24),
    backgroundColor: C.sheetDepth,
    paddingBottom: 5,
    marginTop: sh(8),
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheetFace: {
    borderRadius: ms(24),
    backgroundColor: C.sheetBg,
    borderWidth: 1,
    borderColor: C.sheetBorder,
    paddingTop: sh(16),
    paddingBottom: sh(16),
    paddingHorizontal: sw(14),
    overflow: "hidden",
  },

  zoneHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: sh(14),
  },
  titleCol: {
    flex: 1,
    paddingRight: sw(10),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(8),
  },
  title: {
    fontSize: ms(18, 0.3),
    fontFamily: FONT_SEMI,
    color: C.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: ms(12, 0.3),
    fontFamily: FONT_MED,
    color: C.inkMuted,
    marginTop: sh(2),
  },

  // Layered target chip next to title
  titleChip: {
    width: ms(20),
    height: ms(20),
    alignItems: "center",
    justifyContent: "center",
  },
  titleChipOuter: {
    position: "absolute",
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: C.titleChipWhite,
    borderWidth: 2,
    borderColor: C.titleChipRed,
  },
  titleChipMid: {
    position: "absolute",
    width: ms(13),
    height: ms(13),
    borderRadius: ms(7),
    backgroundColor: C.titleChipRed,
  },
  titleChipInner: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    alignItems: "center",
    justifyContent: "center",
  },

  // Red count badge
  countDepth: {
    backgroundColor: C.countDepth,
    borderRadius: ms(999),
    paddingBottom: 3,
  },
  countFace: {
    backgroundColor: C.countBg,
    borderRadius: ms(999),
    width: ms(30),
    height: ms(30),
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: ms(15, 0.3),
    fontFamily: FONT_SEMI,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  rowList: { gap: sh(10) },

  // ── Locked / empty state (kept dark as before) ──
  lockedZone: {
    borderRadius: ms(20),
    borderWidth: 1,
    backgroundColor: C.lockedBg,
    borderColor: C.lockedBrd,
    paddingTop: sh(14),
    paddingBottom: sh(16),
    paddingHorizontal: sw(12),
    marginTop: sh(8),
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
    marginBottom: sh(12),
  },
  lockedIconBadge: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E1E1E",
    borderColor: "#2C2C2C",
  },
  lockedTitle: {
    fontSize: ms(15, 0.3),
    fontFamily: FONT_SEMI,
    color: C.lockedText,
    letterSpacing: -0.1,
  },
  lockedSubtitle: {
    fontSize: ms(11.5, 0.3),
    fontFamily: FONT_REG,
    color: C.lockedIcon,
    marginTop: sh(1),
  },
  lockedCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    backgroundColor: "#1E1E1E",
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: "#2C2C2C",
    paddingVertical: sh(10),
    paddingHorizontal: sw(14),
  },
  lockedCtaText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT_SEMI,
    color: C.lockedText,
    letterSpacing: -0.1,
  },
});

const rowStyles = StyleSheet.create({
  cardDepth: {
    borderRadius: CARD_RADIUS,
    paddingBottom: 4,
  },
  cardFace: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
    backgroundColor: C.sheetBg,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    paddingLeft: sw(8),
    paddingRight: sw(12),
    paddingVertical: sh(9),
    overflow: "hidden",
  },
  numBadge: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(999),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  numText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT_SEMI,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    lineHeight: ms(15),
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: C.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  metricIcon: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
  },
  metricEmoji: {
    fontSize: ms(18),
    lineHeight: ms(20),
    textAlign: "center" as const,
  },
  labelBlock: {
    flex: 1,
    gap: sh(2),
  },
  metricLabel: {
    fontSize: ms(14, 0.3),
    fontFamily: FONT_SEMI,
    color: C.ink,
    lineHeight: ms(17),
    letterSpacing: -0.1,
  },
  metaText: {
    fontSize: ms(11, 0.3),
    fontFamily: FONT_MED,
    color: C.inkMuted,
  },
});
