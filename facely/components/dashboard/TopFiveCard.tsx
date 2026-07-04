// components/dashboard/TopFiveCard.tsx
// Mission-style top-five trainable sub-metrics card.

import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, Image, StyleSheet, type ImageSourcePropType } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import type { SvgProps } from "react-native-svg";
import { LocalSvg } from "react-native-svg/css";

import Text from "@/components/ui/T";
import { ms, sh, sw } from "@/lib/responsive";
import { MetricDetailCard, type DetailMetric } from "@/components/analysis/MetricDetailCard";
import type { SubCategory, SubMetricRow, TopFiveResult } from "@/lib/submetrics";
import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import PriorityStackIcon from "@/assets/icons/priority-stack.svg";
import {
  ADVANCED_ANALYSIS_FONT_BOLD,
  getAdvancedAnalysisIconStyle,
} from "@/lib/advancedAnalysisIcons";

const C = {
  bg: "#FFF8F4",
  sheetBorder: "rgba(229,72,77,0.14)",
  hero: "#FFF0F1",
  heroBorder: "rgba(229,72,77,0.20)",
  row: "#FFFFFF",
  rowFeatured: "#FFF2F3",
  ink: COLORS.lightText,
  sub: COLORS.lightSub,
  warmSub: "#7C5A5A",
  red: COLORS.declineRed,
  redSoft: "#FCE4E5",
  lime: COLORS.accentDepth,
  limeSoft: "#EFF8DF",
  cream: "#FFF1D9",
  avatarBg: "#FFFFFF",
  border: "rgba(0,0,0,0.07)",
  shadow: "#000000",
  lockedBg: "#FFF8F4",
  lockedIcon: COLORS.lightSub,
  lockedText: COLORS.lightText,
} as const;

const CATEGORY_LABELS: Record<SubCategory, string> = {
  SKIN: "Skin",
  CHEEKS: "Cheeks",
  JAW: "Jaw",
  EYES: "Eyes",
  HAIR: "Hair",
};

const FONT_BOLD = ADVANCED_ANALYSIS_FONT_BOLD;
const CARD_RADIUS = ms(26);
const ICON_SIZE = ms(56);

type SvgIconSource = React.ComponentType<SvgProps> | ImageSourcePropType;

function SvgIcon({
  icon,
  width,
  height,
}: {
  icon: SvgIconSource;
  width: number;
  height: number;
}) {
  if (typeof icon === "function") {
    const Icon = icon;
    return <Icon width={width} height={height} />;
  }

  return <LocalSvg asset={icon} width={width} height={height} />;
}

function dominantCategory(rows: SubMetricRow[]): string {
  const counts = new Map<SubCategory, number>();
  for (const row of rows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? CATEGORY_LABELS[top] : "Mixed";
}

function lowestScore(rows: SubMetricRow[]): number | null {
  if (!rows.length) return null;
  return Math.round(Math.min(...rows.map((row) => row.score)));
}

function metricCue(item: SubMetricRow, improving: boolean): string {
  if (improving && item.delta !== null && item.delta > 0) {
    return `+${item.delta.toFixed(1)} since previous scan`;
  }
  return `Score ${Math.round(item.score)}/100`;
}

function categoryLabel(category: SubCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

function metricEmoji(item: Pick<SubMetricRow, "id" | "emoji">): string {
  return item.id.startsWith("haircut.") ? "✂️" : item.emoji;
}

function Row({
  item,
  index,
  improving,
  onPress,
}: {
  item: SubMetricRow;
  index: number;
  improving: boolean;
  onPress: (m: SubMetricRow) => void;
}) {
  const featured = index === 0;

  return (
    <Animated.View entering={FadeInDown.duration(340).delay(140 + index * 48)}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.verdict}`}
        style={({ pressed }) => [
          rowStyles.card,
          featured && rowStyles.cardFeatured,
          pressed && rowStyles.cardPressed,
        ]}
      >
        <View style={[rowStyles.rankChip, featured && rowStyles.rankChipFeatured]}>
          <Text style={[rowStyles.rankText, featured && rowStyles.rankTextFeatured]}>
            {index + 1}
          </Text>
        </View>

        <View style={rowStyles.iconTile}>
          {item.icon ? (
            <Image
              source={item.icon}
              style={[rowStyles.iconImage, getAdvancedAnalysisIconStyle(item.id)]}
              resizeMode="contain"
            />
          ) : (
            <Text style={rowStyles.metricEmoji}>{metricEmoji(item)}</Text>
          )}
        </View>

        <View style={rowStyles.copy}>
          <Text style={rowStyles.metricLabel} numberOfLines={1}>
            {item.label}
          </Text>
          <View style={rowStyles.chipRow}>
            <View style={rowStyles.categoryChip}>
              <Text style={rowStyles.categoryChipText}>{categoryLabel(item.category)}</Text>
            </View>
            <View style={[rowStyles.verdictChip, featured && rowStyles.verdictChipFeatured]}>
              <Text style={[rowStyles.verdictChipText, featured && rowStyles.verdictChipTextFeatured]} numberOfLines={1}>
                {item.verdict}
              </Text>
            </View>
          </View>
          <Text style={rowStyles.cueText} numberOfLines={1}>
            {metricCue(item, improving)}
          </Text>
        </View>

        <View style={rowStyles.chevronCircle}>
          <ChevronRight size={ms(18)} color={C.ink} strokeWidth={2.6} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function TopFiveCard({ result }: { result: TopFiveResult }) {
  const [selected, setSelected] = useState<SubMetricRow | null>(null);

  const handlePress = useCallback((m: SubMetricRow) => setSelected(m), []);
  const handleDismiss = useCallback(() => setSelected(null), []);

  if (result.mode === "none" || result.rows.length === 0) {
    return (
      <Animated.View entering={FadeInDown.duration(380)} style={styles.lockedZone}>
        <View style={styles.lockedRow}>
          <View style={styles.lockedIconBadge}>
            <Sparkles size={ms(18)} color={C.lime} strokeWidth={2.4} />
          </View>
          <View style={styles.lockedCopy}>
            <Text style={styles.lockedTitle}>Priority stack locked</Text>
            <Text style={styles.lockedSubtitle}>
              Run advanced analysis to unlock trainable targets.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(tabs)/analysis")}
          style={({ pressed }) => [styles.lockedCta, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Run advanced analysis"
        >
          <Text style={styles.lockedCtaText}>RUN ADVANCED ANALYSIS</Text>
          <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>
    );
  }

  const rows = result.rows.slice(0, 5);
  const improving = result.mode === "improving";
  const title = improving ? "Gaining Stack" : "Priority Stack";
  const subtitle = improving
    ? "These targets are already moving. Keep pressure here."
    : "Fix these first for the fastest visible change.";

  const summary = useMemo(() => {
    const low = lowestScore(rows);
    return [
      { label: `${rows.length}`, sub: rows.length === 1 ? "target" : "targets", tone: "red" as const },
      { label: dominantCategory(rows), sub: "leads", tone: "cream" as const },
      { label: low === null ? "--" : String(low), sub: "lowest", tone: "lime" as const },
    ];
  }, [rows]);

  const detailMetric: DetailMetric | null = selected
    ? {
        id: selected.id,
        label: selected.label,
        category: selected.category,
        score: selected.score,
        verdict: selected.verdict,
        commentary: selected.commentary,
        idealRange: selected.idealRange,
        status: selected.status,
        section: selected.section,
        icon: selected.icon,
        emoji: metricEmoji(selected),
      }
    : null;

  return (
    <>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.sheetDepth}>
        <View style={styles.sheetFace}>
          <View style={styles.heroCard}>
            {improving ? (
              <View style={styles.heroIcon}>
                <SvgIcon icon={PriorityStackIcon} width={ms(30)} height={ms(36)} />
              </View>
            ) : (
              <View style={styles.heroPriorityIconStage}>
                <SvgIcon icon={PriorityStackIcon} width={ms(70)} height={ms(92)} />
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>
                {improving ? "MOMENTUM BRIEF" : "TODAY'S FIX LIST"}
              </Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            {summary.map((item, index) => (
              <Animated.View
                key={`${item.label}-${item.sub}`}
                entering={FadeInDown.duration(300).delay(70 + index * 45)}
                style={[
                  styles.summaryCell,
                  item.tone === "red" && styles.summaryCellRed,
                  item.tone === "cream" && styles.summaryCellCream,
                  item.tone === "lime" && styles.summaryCellLime,
                ]}
              >
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summarySub}>{item.sub}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Priority targets</Text>
              <Text style={styles.sectionSubtitle}>
                Tap any target to see the full analysis card.
              </Text>
            </View>
          </View>

          <View style={styles.rowList}>
            {rows.map((row, i) => (
              <Row
                key={row.id}
                item={row}
                index={i}
                improving={improving}
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

const styles = StyleSheet.create({
  sheetDepth: {
    borderRadius: CARD_RADIUS,
    backgroundColor: C.bg,
    shadowColor: C.shadow,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  sheetFace: {
    borderRadius: CARD_RADIUS,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.sheetBorder,
    padding: SP[4],
    overflow: "hidden",
  },
  heroCard: {
    minHeight: sh(104),
    borderRadius: ms(22),
    backgroundColor: C.hero,
    borderWidth: 1,
    borderColor: C.heroBorder,
    padding: SP[4],
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
  },
  heroIcon: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: C.red,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroIconImage: {
    width: ms(30),
    height: ms(30),
    resizeMode: "contain",
  },
  heroPriorityIconStage: {
    width: ms(76),
    height: ms(96),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginLeft: -sw(2),
  },
  heroPriorityIconImage: {
    width: ms(70),
    height: ms(92),
    resizeMode: "contain",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: ms(10, 0.3),
    color: C.red,
    letterSpacing: 1.2,
    marginBottom: sh(3),
  },
  title: {
    ...TYPE.proximaSection,
    fontFamily: FONT_BOLD,
    fontSize: ms(24, 0.25),
    lineHeight: ms(28),
    color: C.ink,
  },
  subtitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13, 0.25),
    lineHeight: ms(18),
    color: C.warmSub,
    marginTop: sh(4),
  },
  summaryRow: {
    flexDirection: "row",
    gap: sw(10),
    marginTop: SP[3],
  },
  summaryCell: {
    flex: 1,
    minHeight: sh(70),
    borderRadius: ms(18),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryCellRed: {
    backgroundColor: C.redSoft,
    borderColor: "rgba(229,72,77,0.20)",
  },
  summaryCellCream: {
    backgroundColor: C.cream,
    borderColor: "rgba(245,158,11,0.18)",
  },
  summaryCellLime: {
    backgroundColor: C.limeSoft,
    borderColor: "rgba(107,154,30,0.18)",
  },
  summaryLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(19, 0.3),
    lineHeight: ms(22),
    color: C.ink,
  },
  summarySub: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11, 0.3),
    lineHeight: ms(14),
    color: C.sub,
    marginTop: sh(2),
  },
  sectionHeader: {
    marginTop: SP[5],
    marginBottom: SP[3],
  },
  sectionTitle: {
    ...TYPE.proximaSection,
    fontFamily: FONT_BOLD,
    fontSize: ms(21, 0.25),
    color: C.ink,
  },
  sectionSubtitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12, 0.25),
    lineHeight: ms(16),
    color: C.sub,
    marginTop: sh(2),
  },
  rowList: {
    gap: sh(12),
  },
  lockedZone: {
    borderRadius: CARD_RADIUS,
    backgroundColor: C.lockedBg,
    borderWidth: 1,
    borderColor: C.sheetBorder,
    padding: SP[4],
    shadowColor: C.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    marginBottom: SP[4],
  },
  lockedIconBadge: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.limeSoft,
  },
  lockedCopy: {
    flex: 1,
  },
  lockedTitle: {
    fontSize: ms(17, 0.3),
    fontFamily: FONT_BOLD,
    color: C.lockedText,
  },
  lockedSubtitle: {
    fontSize: ms(12, 0.3),
    lineHeight: ms(16),
    fontFamily: FONT_BOLD,
    color: C.lockedIcon,
    marginTop: sh(2),
  },
  lockedCta: {
    minHeight: sh(46),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    backgroundColor: COLORS.ctaBlack,
    borderRadius: RADII.circle,
    paddingHorizontal: sw(16),
  },
  lockedCtaText: {
    fontSize: ms(13, 0.3),
    fontFamily: FONT_BOLD,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});

const rowStyles = StyleSheet.create({
  card: {
    minHeight: sh(82),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
    borderRadius: ms(20),
    backgroundColor: C.row,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: sh(10),
    paddingLeft: sw(10),
    paddingRight: sw(8),
  },
  cardFeatured: {
    backgroundColor: C.rowFeatured,
    borderColor: "rgba(229,72,77,0.18)",
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  rankChip: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
    flexShrink: 0,
  },
  rankChipFeatured: {
    backgroundColor: C.red,
  },
  rankText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12, 0.3),
    color: C.ink,
  },
  rankTextFeatured: {
    color: "#FFFFFF",
  },
  iconTile: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ms(16),
    backgroundColor: C.avatarBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  iconImage: {
    width: "100%",
    height: "100%",
  },
  metricEmoji: {
    fontSize: ms(22),
    lineHeight: ms(24),
    textAlign: "center" as const,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(15, 0.25),
    lineHeight: ms(18),
    color: C.ink,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
    marginTop: sh(5),
  },
  categoryChip: {
    borderRadius: RADII.circle,
    backgroundColor: C.limeSoft,
    paddingHorizontal: sw(9),
    paddingVertical: sh(3),
  },
  categoryChipText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(10, 0.3),
    lineHeight: ms(12),
    color: C.lime,
  },
  verdictChip: {
    maxWidth: sw(90),
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightSurfaceAlt,
    paddingHorizontal: sw(9),
    paddingVertical: sh(3),
  },
  verdictChipFeatured: {
    backgroundColor: C.redSoft,
  },
  verdictChipText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(10, 0.3),
    lineHeight: ms(12),
    color: C.sub,
  },
  verdictChipTextFeatured: {
    color: C.red,
  },
  cueText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11, 0.25),
    lineHeight: ms(14),
    color: C.sub,
    marginTop: sh(5),
  },
  chevronCircle: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F2F0",
    flexShrink: 0,
  },
});
