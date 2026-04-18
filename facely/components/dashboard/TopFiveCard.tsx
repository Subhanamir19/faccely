// components/dashboard/TopFiveCard.tsx
// Top 5 trainable sub-metrics card for the dashboard.
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
// Visual tokens — mirror analysis tab's zone + card language
// ---------------------------------------------------------------------------

const C = {
  card:        "#1A1A1A",
  cardDepth:   "#0A0A0A",
  iconBox:     "#222222",
  iconDepth:   "#111111",
  textPrimary: "#FFFFFF",
  textMuted:   "#808080",

  // Lime — improving
  fineBg:      "#B4F34D",
  fineBorder:  "#8ECA45",
  fineText:    "#2D3B1F",
  fineIcon:    "#B4F34D",

  // Red — to target
  alarmBg:     "#FF6B6B",
  alarmBorder: "#D94A4A",
  alarmText:   "#4A0D0D",
  alarmIcon:   "#FF6B6B",

  // Zone slabs
  limeZoneBg:  "#0C1900",
  limeZoneBrd: "#192E00",
  limeCardBg:  "#142100",

  redZoneBg:   "#160202",
  redZoneBrd:  "#280808",
  redCardBg:   "#1F0606",
  redCardBrd:  "#380E0E",
  redCardDep:  "#0D0101",
};

const CARD_RADIUS   = ms(18);
const ICON_BOX_SIZE = ms(36);
const ICON_RADIUS   = ms(10);
const PILL_RADIUS   = ms(999);

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function Row({
  item,
  mode,
  index,
  onPress,
}: {
  item: SubMetricRow;
  mode: "improving" | "toTarget";
  index: number;
  onPress: (m: SubMetricRow) => void;
}) {
  const pill = mode === "improving"
    ? { bg: C.fineBg, brd: C.fineBorder, text: C.fineText }
    : { bg: C.alarmBg, brd: C.alarmBorder, text: C.alarmText };

  const cardStyle = mode === "improving" ? rowStyles.cardLime : rowStyles.cardRed;

  const showDelta = mode === "improving" && typeof item.delta === "number" && item.delta > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(360).delay(Math.min(index * 60, 280))}
      style={cardStyle}
    >
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => [
          rowStyles.header,
          pressed && { opacity: 0.82, transform: [{ scale: 0.984 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}`}
      >
        <View style={[rowStyles.iconBox, { borderBottomColor: C.iconDepth }]}>
          {item.icon ? (
            <Image source={item.icon} style={rowStyles.metricIcon} />
          ) : (
            <Text style={rowStyles.metricEmoji}>{item.emoji}</Text>
          )}
        </View>

        <View style={rowStyles.labelBlock}>
          <Text style={rowStyles.metricLabel} numberOfLines={1}>{item.label}</Text>
          <View style={rowStyles.metaRow}>
            <Text style={rowStyles.metaCategory}>{item.category}</Text>
            {showDelta && (
              <>
                <Text style={rowStyles.metaDot}>·</Text>
                <Text style={rowStyles.metaDelta}>+{(item.delta as number).toFixed(1)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={[rowStyles.pillDepth, { backgroundColor: pill.brd }]}>
          <View style={[rowStyles.pillFace, { backgroundColor: pill.bg }]}>
            <Text style={[rowStyles.pillText, { color: pill.text }]} numberOfLines={1}>
              {item.verdict}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function TopFiveCard({ result }: { result: TopFiveResult }) {
  const [selected, setSelected] = useState<SubMetricRow | null>(null);

  const handlePress = useCallback((m: SubMetricRow) => setSelected(m), []);
  const handleDismiss = useCallback(() => setSelected(null), []);

  if (result.mode === "none" || result.rows.length === 0) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        style={[styles.zone, styles.zoneLocked]}
      >
        <View style={styles.lockedRow}>
          <View style={[styles.iconBadge, styles.lockedIconBadge]}>
            <Sparkles size={ms(14)} color={C.textMuted} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Top 5 Insights</Text>
            <Text style={styles.subtitle}>
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
          <ChevronRight size={ms(14)} color={C.textPrimary} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
    );
  }

  const isImproving = result.mode === "improving";
  const zoneBg  = isImproving ? C.limeZoneBg  : C.redZoneBg;
  const zoneBrd = isImproving ? C.limeZoneBrd : C.redZoneBrd;
  const accent  = isImproving ? C.fineIcon    : C.alarmIcon;
  const title   = isImproving ? "Top 5 Improving" : "Top 5 to Target";
  const subtitle = isImproving
    ? "Biggest gains since your first scan"
    : "Where your next scans should move the needle";
  const Icon = isImproving ? TrendingUp : Target;

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

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(400).delay(320)}
        style={[styles.zone, { backgroundColor: zoneBg, borderColor: zoneBrd }]}
      >
        <View style={styles.zoneHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: `${accent}1F`, borderColor: `${accent}40` }]}>
              <Icon size={ms(14)} color={accent} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Text style={[styles.count, { color: accent }]}>{result.rows.length}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: `${accent}30` }]} />

        <View style={styles.rowList}>
          {result.rows.map((row, i) => (
            <Row
              key={row.id}
              item={row}
              mode={result.mode}
              index={i}
              onPress={handlePress}
            />
          ))}
        </View>
      </Animated.View>

      <MetricDetailCard metric={detailMetric} onDismiss={handleDismiss} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  zone: {
    borderRadius: ms(20),
    borderWidth: 1,
    paddingTop: sh(14),
    paddingBottom: sh(16),
    paddingHorizontal: sw(12),
    overflow: "hidden",
    marginTop: sh(8),
  },
  zoneHeader: {
    marginBottom: sh(10),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
  },
  iconBadge: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: ms(15, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: ms(11.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: C.textMuted,
    marginTop: sh(1),
  },
  count: {
    fontSize: ms(22, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    marginBottom: sh(12),
  },
  rowList: { gap: sh(8) },

  // ── Locked / empty state ──
  zoneLocked: {
    backgroundColor: "#141414",
    borderColor: "#222222",
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
    marginBottom: sh(12),
  },
  lockedIconBadge: {
    backgroundColor: "#1E1E1E",
    borderColor: "#2C2C2C",
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
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
});

const rowStyles = StyleSheet.create({
  cardLime: {
    backgroundColor: C.limeCardBg,
    borderRadius: CARD_RADIUS,
    borderBottomWidth: 6,
    borderBottomColor: C.limeZoneBg,
    paddingHorizontal: sw(12),
    paddingTop: sh(9),
    paddingBottom: sh(7),
    overflow: "hidden",
  },
  cardRed: {
    backgroundColor: C.redCardBg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: C.redCardBrd,
    borderBottomWidth: 4,
    borderBottomColor: C.redCardDep,
    paddingHorizontal: sw(12),
    paddingTop: sh(9),
    paddingBottom: sh(7),
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: C.iconBox,
    borderBottomWidth: 4,
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
    gap: sh(3),
  },
  metricLabel: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textPrimary,
    lineHeight: ms(16),
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
  },
  metaCategory: {
    fontSize: ms(9.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.textMuted,
    letterSpacing: 0.8,
  },
  metaDot: {
    fontSize: ms(10),
    color: C.textMuted,
  },
  metaDelta: {
    fontSize: ms(10, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: C.fineIcon,
    letterSpacing: 0.3,
  },
  pillDepth: {
    borderRadius: PILL_RADIUS,
    paddingBottom: 4,
    flexShrink: 0,
  },
  pillFace: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: sw(8),
    paddingVertical: sh(3),
    minWidth: sw(56),
    maxWidth: sw(130),
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: ms(10.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    lineHeight: ms(13),
    textAlign: "center" as const,
  },
});
