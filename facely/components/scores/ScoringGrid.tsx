// facely/components/scores/ScoringGrid.tsx
// 2-column grid of MetricGridCards — Quench-Rating-style scoring layout.
//
// ALL layout constants (gap, avatar size, cell width) are derived from the
// `cardWidth` prop — no hardcoded pixel values.
//
// Data flow:
//   • Current scores     → useScores().scores           (after first scan)
//   • Delta / direction  → InsightData.metrics[]        (scan_count ≥ 2)
//   • Overall delta      → InsightData.overall          (scan_count ≥ 2)
//   • Gender label       → useOnboarding().data.gender

import React, { useMemo } from "react";
import { View, Image, StyleSheet } from "react-native";
import {
  Star, Eye, Zap, Sparkles, Scan, Droplets, Triangle, Minus,
} from "lucide-react-native";

import MetricGridCard, { getScoreColor } from "./MetricGridCard";
import type { DashboardMetric } from "@/lib/api/insights";
import { useOnboarding } from "@/store/onboarding";
import { COLORS, SP } from "@/lib/tokens";

// ─── Tier anchor vocabulary ───────────────────────────────────────────────────

type AnchorRow = [string, string, string, string, string, string, string, string];

const ANCHORS: Record<string, AnchorRow> = {
  "Overall":                ["Weak",       "Below Avg",  "Developing", "Decent",      "Mediocre",   "Strong",      "Elite",        "Top-tier"],
  "Jawline":                ["Undefined",  "Soft",       "Mild",       "Average",     "Basic",      "Sharp",       "Chiseled",     "Razor-sharp"],
  "Cheekbones":             ["Recessed",   "Flat",       "Mild",       "Average",     "Modest",     "Prominent",   "High-set",     "Sculpted"],
  "Facial Symmetry":        ["Asymmetric", "Off-center", "Uneven",     "Minor shift", "Passable",   "Balanced",    "Near-perfect", "Mirror-like"],
  "Eye Symmetry":           ["Uneven",     "Misaligned", "Slight off", "Minor offset","Ordinary",   "Aligned",     "Harmonious",   "Perfect"],
  "Skin Quality":           ["Damaged",    "Rough",      "Dull",       "Average",     "Fair",       "Clear",       "Radiant",      "Glass-like"],
  "Nose Balance":           ["Misaligned", "Off-center", "Unbalanced", "Average",     "Plain",      "Proportioned","Refined",      "Ideal"],
  "Masculinity/Femininity": ["Faint",      "Subtle",     "Mild",       "Average",     "Common",     "Pronounced",  "Strong",       "Peak"],
};

export function getTierLabel(label: string, score: number): string {
  const row = ANCHORS[label] ?? ANCHORS["Overall"];
  const s   = Math.max(0, Math.min(100, score));
  if (s <= 25) return row[0];
  if (s <= 40) return row[1];
  if (s <= 50) return row[2];
  if (s <= 60) return row[3];
  if (s <= 70) return row[4];
  if (s <= 80) return row[5];
  if (s <= 89) return row[6];
  return row[7];
}

// ─── API key → display label ──────────────────────────────────────────────────

const API_KEY_TO_LABEL: Record<string, string> = {
  jawline:           "Jawline",
  facial_symmetry:   "Facial Symmetry",
  cheekbones:        "Cheekbones",
  eyes_symmetry:     "Eye Symmetry",
  skin_quality:      "Skin Quality",
  nose_harmony:      "Nose Balance",
  sexual_dimorphism: "Masculinity/Femininity",
};

// ─── Canonical card order ─────────────────────────────────────────────────────

const CARD_ORDER = [
  "Overall",
  "Jawline",
  "Cheekbones",
  "Eye Symmetry",
  "Facial Symmetry",
  "Masculinity/Femininity",
  "Skin Quality",
  "Nose Balance",
] as const;

// ─── Icons — swap with custom art by updating the switch cases ────────────────

function getIcon(label: string, iconColor: string, iconSize: number): React.ReactNode {
  switch (label) {
    case "Overall":                return <Star        size={iconSize} color={iconColor} />;
    case "Jawline":                return <Minus       size={iconSize} color={iconColor} />;
    case "Cheekbones":             return <Triangle    size={iconSize} color={iconColor} />;
    case "Eye Symmetry":           return <Eye         size={iconSize} color={iconColor} />;
    case "Facial Symmetry":        return <Scan        size={iconSize} color={iconColor} />;
    case "Masculinity/Femininity": return <Zap         size={iconSize} color={iconColor} />;
    case "Skin Quality":           return <Sparkles    size={iconSize} color={iconColor} />;
    case "Nose Balance":           return <Droplets    size={iconSize} color={iconColor} />;
    default:                       return <Star        size={iconSize} color={iconColor} />;
  }
}

// ─── Layout sizing hook — all derived from cardWidth ─────────────────────────

function useGridSizing(cardWidth: number) {
  return useMemo(() => {
    const colGap      = Math.max(4,  Math.round(cardWidth * 0.017)); // ~6px on 358
    const cellWidth   = (cardWidth - colGap) / 2;
    const avatarSize  = Math.max(88, Math.round(cardWidth * 0.36));  // ~129px on 358
    const avatarBorder= Math.max(3,  Math.round(cardWidth * 0.011)); // ~4px
    const avatarTotal = avatarSize + avatarBorder * 2;
    const avatarOffset= Math.round(avatarTotal * 0.5);               // overlap into grid
    const iconSize    = Math.max(10, Math.round(cellWidth * 0.063)); // mirrors MetricGridCard
    return { colGap, cellWidth, avatarSize, avatarBorder, avatarTotal, avatarOffset, iconSize };
  }, [cardWidth]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoringMetric = {
  label: string;
  score: number;
};

type ScoringGridProps = {
  metrics: ScoringMetric[];
  totalScore: number;
  dashboardMetrics?: DashboardMetric[];
  overallDelta?: number | null;
  active: boolean;
  /** Total usable width (screen width − horizontal padding) */
  cardWidth: number;
  /** User's scan photo — shown as circular avatar above the grid */
  imageUri?: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoringGrid({
  metrics,
  totalScore,
  dashboardMetrics = [],
  overallDelta     = null,
  active,
  cardWidth,
  imageUri,
}: ScoringGridProps) {
  const { data: onboardingData } = useOnboarding();
  const gender = onboardingData?.gender;
  const sz     = useGridSizing(cardWidth);

  // Delta lookup: label → { delta, direction }
  const deltaMap = useMemo(() => {
    const map: Record<string, { delta: number; direction: "up" | "down" | "flat" }> = {};
    for (const dm of dashboardMetrics) {
      const label = API_KEY_TO_LABEL[dm.key];
      if (label) map[label] = { delta: dm.delta, direction: dm.direction };
    }
    if (overallDelta != null) {
      map["Overall"] = {
        delta:     overallDelta,
        direction: overallDelta > 0 ? "up" : overallDelta < 0 ? "down" : "flat",
      };
    }
    return map;
  }, [dashboardMetrics, overallDelta]);

  // Score lookup
  const scoreMap = useMemo(() => {
    const map: Record<string, number> = { Overall: totalScore };
    for (const m of metrics) map[m.label] = m.score;
    return map;
  }, [metrics, totalScore]);

  // Build ordered card descriptors
  const cards = useMemo(() =>
    CARD_ORDER.map((label) => {
      const score     = scoreMap[label] ?? 0;
      const isOverall = label === "Overall";
      const deltaInfo = deltaMap[label] ?? null;
      // Overall is solid-filled → icon must be white; others use muted color
      const iconColor = isOverall ? "#FFFFFF" : COLORS.sub;

      let displayLabel: string = label;
      if (label === "Masculinity/Femininity") {
        displayLabel = gender === "female" ? "Femininity" : "Masculinity";
      }

      return {
        label, displayLabel, score, isOverall, iconColor,
        tierLabel: getTierLabel(label, score),
        delta:     deltaInfo?.delta     ?? null,
        direction: deltaInfo?.direction ?? undefined,
      };
    }),
    [scoreMap, deltaMap, gender]
  );

  // Pair into rows of 2
  const rows = useMemo(() => {
    const result: (typeof cards)[] = [];
    for (let i = 0; i < cards.length; i += 2) result.push(cards.slice(i, i + 2));
    return result;
  }, [cards]);

  return (
    <View style={styles.wrapper}>
      {/* ── Circular user photo ─────────────────────────────────────────── */}
      <View
        style={[
          styles.avatarRing,
          {
            width:         sz.avatarTotal,
            height:        sz.avatarTotal,
            borderRadius:  sz.avatarTotal / 2,
            borderWidth:   sz.avatarBorder,
            marginBottom:  -sz.avatarOffset,
          },
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: sz.avatarSize, height: sz.avatarSize }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { width: sz.avatarSize, height: sz.avatarSize, borderRadius: sz.avatarSize / 2 },
            ]}
          />
        )}
      </View>

      {/* ── Card grid ───────────────────────────────────────────────────── */}
      <View style={{ width: "100%", gap: sz.colGap, paddingTop: sz.avatarOffset + SP[1] }}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={[styles.row, { gap: sz.colGap }]}>
            {row.map((card, colIdx) => (
              <MetricGridCard
                key={card.label}
                label={card.displayLabel}
                score={card.score}
                tierLabel={card.tierLabel}
                icon={getIcon(card.label, card.iconColor, sz.iconSize)}
                delta={card.delta}
                direction={card.direction}
                isOverall={card.isOverall}
                active={active}
                delay={(rowIdx * 2 + colIdx) * 80}
                width={sz.cellWidth}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    width:      "100%",
  },
  avatarRing: {
    borderColor:     COLORS.cardBorder,
    backgroundColor: COLORS.bgBottom,
    overflow:        "hidden",
    zIndex:          10,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.track,
  },
  row: {
    flexDirection: "row",
  },
});
