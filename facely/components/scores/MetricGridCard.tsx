// facely/components/scores/MetricGridCard.tsx
// Single card in the Quench-Rating-style scoring grid.
//
// ALL sizing is derived from the `width` prop — no hardcoded pixel values.
// Overall card  → solid score-color fill, all interior elements go white.
// Regular cards → dark glass bg, tier-colored accents.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import Text from "@/components/ui/T";
import { COLORS } from "@/lib/tokens";

// ─── Score → color ────────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s < 40) return COLORS.error;
  if (s < 60) return COLORS.errorLight;
  if (s < 70) return COLORS.warning;
  if (s < 80) return "#C8DA45";
  if (s < 90) return COLORS.accent;
  return COLORS.success;
}

// ─── Sizing hook — all values derived from cell width ────────────────────────

function useSizing(width: number) {
  return useMemo(() => {
    const barH = Math.max(3, Math.round(width * 0.018));
    return {
      pad:          Math.max(6,  Math.round(width * 0.042)), // card padding
      minH:         Math.max(65, Math.round(width * 0.48)),  // card min height
      topGap:       Math.max(2,  Math.round(width * 0.013)), // icon ↔ label gap
      rowGap:       Math.max(3,  Math.round(width * 0.020)), // score ↔ chip gap
      iconSize:     Math.max(9,  Math.round(width * 0.044)), // lucide icon px
      iconWrap:     Math.max(11, Math.round(width * 0.058)), // icon container px
      radius:       Math.max(7,  Math.round(width * 0.050)), // card border-radius
      borderW:      Math.max(1,  Math.round(width * 0.006)), // card + chip border width
      barH,
      barRadius:    barH * 2,                                // pill — derived from bar height
      chipPadH:     Math.max(4,  Math.round(width * 0.028)), // chip horizontal padding
      chipPadV:     Math.max(1,  Math.round(width * 0.008)), // chip vertical padding
      chipRadius:   Math.max(3,  Math.round(width * 0.038)), // chip border-radius
      letterSp:     Math.max(0,  width * 0.001),             // letter spacing scales with width
      scoreSize:    Math.max(16, Math.round(width * 0.16)),  // score number font
      labelSize:    Math.max(11, Math.round(width * 0.068)), // metric label font
      tierSize:     Math.max(8,  Math.round(width * 0.050)), // tier chip font
    };
  }, [width]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricGridCardProps = {
  label: string;
  score: number;
  tierLabel: string;
  icon: React.ReactNode;
  delta?: number | null;
  direction?: "up" | "down" | "flat";
  isOverall?: boolean;
  active: boolean;
  delay: number;
  /** Cell width in px — drives ALL sizing */
  width: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricGridCard({
  label,
  score,
  tierLabel,
  icon,
  isOverall = false,
  active,
  delay,
  width,
}: MetricGridCardProps) {
  const sz      = useSizing(width);
  const color   = getScoreColor(score);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  // Colour roles — Overall: solid fill + white interior
  const labelColor    = isOverall ? "rgba(255,255,255,0.80)" : COLORS.text;
  const scoreColor    = "#FFFFFF";
  const tierTextColor = "#FFFFFF";
  const tierBg        = isOverall ? "rgba(0,0,0,0.28)" : color;
  const tierBorder    = isOverall ? "rgba(0,0,0,0.15)" : color;
  const barTrackBg    = isOverall ? "rgba(255,255,255,0.20)" : COLORS.track;
  const barFillColor  = isOverall ? "rgba(255,255,255,0.85)" : color;

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const barAnim   = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!active) return;

    fadeAnim.setValue(0);
    countAnim.setValue(0);
    barAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1, duration: 300, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    const id = countAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    Animated.timing(countAnim, {
      toValue: clamped, duration: 900, delay: delay + 80,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => countAnim.removeListener(id));

    Animated.timing(barAnim, {
      toValue: clamped, duration: 800, delay: delay + 80,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();

    return () => countAnim.removeListener(id);
  }, [active, clamped, delay]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 100], outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.cardBase,
        {
          borderRadius: sz.radius,
          borderWidth:  sz.borderW,
          padding:      sz.pad,
          minHeight:    sz.minH,
          width,
          opacity:      fadeAnim,
        },
        isOverall
          ? { backgroundColor: color,                    borderColor: color }
          : { backgroundColor: "rgba(255,255,255,0.05)", borderColor: COLORS.cardBorder },
      ]}
    >
      {/* ── Row 1: icon · label ───────────────────────────────────────── */}
      <View style={[styles.topRow, { gap: sz.topGap }]}>
        <View style={{ width: sz.iconWrap, height: sz.iconWrap, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        <Text
          style={[styles.label, { fontSize: sz.labelSize, lineHeight: Math.round(sz.labelSize * 1.35), color: labelColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      {/* ── Row 2: score · tier chip ──────────────────────────────────── */}
      <View style={[styles.scoreRow, { gap: sz.rowGap }]}>
        <Text style={[styles.score, { fontSize: sz.scoreSize, lineHeight: Math.round(sz.scoreSize * 1.15), color: scoreColor }]}>
          {displayScore}
        </Text>
        <View
          style={{
            backgroundColor:   tierBg,
            borderColor:       tierBorder,
            borderWidth:       sz.borderW,
            borderRadius:      sz.chipRadius,
            paddingHorizontal: sz.chipPadH,
            paddingVertical:   sz.chipPadV,
          }}
        >
          <Text style={[styles.tierText, { fontSize: sz.tierSize, lineHeight: Math.round(sz.tierSize * 1.4), letterSpacing: sz.letterSp, color: tierTextColor }]}>
            {tierLabel}
          </Text>
        </View>
      </View>

      {/* ── Row 3: progress bar ───────────────────────────────────────── */}
      <View style={[styles.barTrack, { height: sz.barH, borderRadius: sz.barRadius, backgroundColor: barTrackBg }]}>
        <Animated.View style={[styles.barFill, { width: barWidth, borderRadius: sz.barRadius, backgroundColor: barFillColor }]} />
      </View>
    </Animated.View>
  );
}

// ─── Static styles (layout only — no hardcoded sizing values) ─────────────────

const styles = StyleSheet.create({
  cardBase: {
    flexGrow:       1,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  label: {
    flex:       1,
    fontFamily: "Poppins-Regular",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "nowrap",
  },
  score: {
    fontFamily: "Poppins-SemiBold",
    flexShrink: 0,
    flexGrow:   0,
    color:      "#FFFFFF",
  },
  tierText: {
    fontFamily: "Poppins-SemiBold",
  },
  barTrack: {
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
});
