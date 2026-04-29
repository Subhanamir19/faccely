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
import { COLORS } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Visual tokens — light surface to match the redesigned dashboard
// ---------------------------------------------------------------------------

const C = {
  sheetBg:        COLORS.lightCard,
  sheetDepth:     "transparent",
  sheetBorder:    "transparent",
  ink:            COLORS.lightText,
  inkMuted:       COLORS.lightSub,
  avatarBg:       COLORS.iconTileLavender,
  avatarDepth:    COLORS.lightBorder,

  // Rank badge — neutral light chip
  countBg:        COLORS.lightSurfaceAlt,
  countDepth:     "transparent",

  // Title icon chip — black on white
  titleChipRed:   COLORS.ctaBlack,
  titleChipBlue:  COLORS.ctaBlack,
  titleChipWhite: COLORS.lightBg,

  // Locked / empty
  lockedBg:       COLORS.lightCard,
  lockedBrd:      COLORS.lightBorder,
  lockedIcon:     COLORS.lightSub,
  lockedText:     COLORS.lightText,
} as const;

// Numbered row palette — all collapse to a single neutral so the row reads
// as "rank N" not as a colour-coded category.
const ROW_PALETTE = [
  { border: COLORS.lightBorder, depth: "transparent", badge: COLORS.ctaBlack },
  { border: COLORS.lightBorder, depth: "transparent", badge: COLORS.ctaBlack },
  { border: COLORS.lightBorder, depth: "transparent", badge: COLORS.ctaBlack },
  { border: COLORS.lightBorder, depth: "transparent", badge: COLORS.ctaBlack },
  { border: COLORS.lightBorder, depth: "transparent", badge: COLORS.ctaBlack },
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
          <Text style={rowStyles.metricLabel} numberOfLines={1}>{item.label.toUpperCase()}</Text>
          <Text style={rowStyles.metaText} numberOfLines={1}>
            {item.category} · {item.verdict}
          </Text>
        </View>

        {/* Chevron — quiet affordance */}
        <ChevronRight size={ms(18)} color={C.inkMuted} strokeWidth={2.4} />
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
            <Sparkles size={ms(16)} color={C.ink} strokeWidth={2.4} />
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
          <Text style={styles.lockedCtaText}>RUN ADVANCED ANALYSIS</Text>
          <ChevronRight size={ms(14)} color="#FFFFFF" strokeWidth={2.4} />
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

const FONT_SEMI = "ProximaNova-Bold";
const FONT_MED  = "ProximaNova-Bold";
const FONT_REG  = "ProximaNova-Bold";

const styles = StyleSheet.create({
  sheetDepth: {
    borderRadius: ms(18),
    backgroundColor: C.sheetBg,
    marginTop: sh(8),
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sheetFace: {
    borderRadius: ms(18),
    backgroundColor: C.sheetBg,
    paddingTop: sh(18),
    paddingBottom: sh(14),
    paddingHorizontal: sw(16),
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
    fontSize: ms(20, 0.3),
    fontFamily: FONT_SEMI,
    color: C.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT_MED,
    color: C.inkMuted,
    marginTop: sh(2),
  },

  // Title icon chip — solid black circle with white glyph
  titleChip: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: C.titleChipRed,
    alignItems: "center",
    justifyContent: "center",
  },
  titleChipOuter: { display: "none" },
  titleChipMid:   { display: "none" },
  titleChipInner: {
    width: ms(22),
    height: ms(22),
    alignItems: "center",
    justifyContent: "center",
  },

  // Count badge — neutral chip
  countDepth: {
    backgroundColor: "transparent",
    borderRadius: ms(999),
  },
  countFace: {
    backgroundColor: C.countBg,
    borderRadius: ms(999),
    width: ms(32),
    height: ms(32),
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: ms(15, 0.3),
    fontFamily: FONT_SEMI,
    color: C.ink,
    letterSpacing: -0.3,
  },

  rowList: { gap: sh(10) },

  // ── Locked / empty state — light theme ──
  lockedZone: {
    borderRadius: ms(18),
    backgroundColor: C.lockedBg,
    paddingTop: sh(16),
    paddingBottom: sh(16),
    paddingHorizontal: sw(16),
    marginTop: sh(8),
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
    marginBottom: sh(14),
  },
  lockedIconBadge: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(8),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.iconTileLavender,
  },
  lockedTitle: {
    fontSize: ms(16, 0.3),
    fontFamily: FONT_SEMI,
    color: C.lockedText,
    letterSpacing: -0.2,
  },
  lockedSubtitle: {
    fontSize: ms(12, 0.3),
    fontFamily: FONT_REG,
    color: C.lockedIcon,
    marginTop: sh(2),
  },
  lockedCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    backgroundColor: COLORS.ctaBlack,
    borderRadius: ms(999),
    paddingVertical: sh(12),
    paddingHorizontal: sw(16),
  },
  lockedCtaText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT_SEMI,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});

const rowStyles = StyleSheet.create({
  cardDepth: {
    borderRadius: CARD_RADIUS,
  },
  cardFace: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    backgroundColor: C.sheetBg,
    borderRadius: CARD_RADIUS,
    borderWidth: 0,
    paddingLeft: sw(4),
    paddingRight: sw(8),
    paddingVertical: sh(6),
    overflow: "hidden",
  },
  numBadge: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(999),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  numText: {
    fontSize: ms(12, 0.3),
    fontFamily: FONT_SEMI,
    color: C.ink,
    letterSpacing: -0.2,
    lineHeight: ms(14),
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ms(12),
    backgroundColor: C.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  metricIcon: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ms(12),
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
    letterSpacing: 0.1,
  },
  metaText: {
    fontSize: ms(11, 0.3),
    fontFamily: FONT_MED,
    color: C.inkMuted,
  },
});
