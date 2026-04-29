// components/scores/ScoringCarousel.tsx
// Horizontal swipeable carousel — replaces the static 2×4 grid on the
// scoring screen. Each card represents one metric: image, label, tier name,
// loading bar, and a de-emphasized score number.
//
// Card width ~85% of viewport so the next/prev card peeks. Snap-to-interval
// paging. A `current / total` counter renders below the carousel.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { getTierLabel } from "./ScoringGrid";
import { getScoreColor } from "./MetricGridCard";
import type { DashboardMetric } from "@/lib/api/insights";
import { useOnboarding } from "@/store/onboarding";

const FONT = "ProximaNova-Bold";
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

// ─── Image map — label → asset under assets/scoring-images ───────────────────
const METRIC_IMAGE: Record<string, any> = {
  "Overall":                require("@/assets/scoring-images/fullface-vector.png"),
  "Jawline":                require("@/assets/scoring-images/jawline.png"),
  "Cheekbones":             require("@/assets/scoring-images/cheekbones.png"),
  "Eye Symmetry":           require("@/assets/scoring-images/eyearea-vector.png"),
  "Facial Symmetry":        require("@/assets/scoring-images/symmetry.png"),
  "Masculinity/Femininity": require("@/assets/scoring-images/masculanity.png"),
  "Skin Quality":           require("@/assets/scoring-images/skin-quality.png"),
  "Nose Balance":           require("@/assets/scoring-images/nose-vector.png"),
};

const API_KEY_TO_LABEL: Record<string, string> = {
  jawline:           "Jawline",
  facial_symmetry:   "Facial Symmetry",
  cheekbones:        "Cheekbones",
  eyes_symmetry:     "Eye Symmetry",
  skin_quality:      "Skin Quality",
  nose_harmony:      "Nose Balance",
  sexual_dimorphism: "Masculinity/Femininity",
};

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

export type ScoringMetric = { label: string; score: number };

type Props = {
  metrics:           ScoringMetric[];
  totalScore:        number;
  dashboardMetrics?: DashboardMetric[];
  overallDelta?:     number | null;
  /** Total usable viewport width (screen − horizontal padding). */
  viewportWidth: number;
};

// ─── Carousel ────────────────────────────────────────────────────────────────

export default function ScoringCarousel({
  metrics,
  totalScore,
  dashboardMetrics = [],
  overallDelta     = null,
  viewportWidth,
}: Props) {
  const { data: onboardingData } = useOnboarding();
  const gender = onboardingData?.gender;

  // Card sizing — 85% of viewport, side gap so neighbours peek symmetrically.
  const CARD_W      = Math.round(viewportWidth * 0.85);
  const SIDE_GAP    = Math.round((viewportWidth - CARD_W) / 2);
  const SNAP_LEN    = CARD_W; // each card = one snap interval

  // Score / delta lookup
  const scoreMap = useMemo(() => {
    const map: Record<string, number> = { Overall: totalScore };
    for (const m of metrics) map[m.label] = m.score;
    return map;
  }, [metrics, totalScore]);

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

  // Build ordered cards
  const cards = useMemo(() =>
    CARD_ORDER.map((label) => {
      const score = scoreMap[label] ?? 0;
      const displayLabel =
        label === "Masculinity/Femininity"
          ? gender === "female" ? "Femininity" : "Masculinity"
          : label;
      return {
        label,
        displayLabel,
        score,
        tier:     getTierLabel(label, score),
        image:    METRIC_IMAGE[label],
        delta:    deltaMap[label]?.delta ?? null,
      };
    }),
    [scoreMap, deltaMap, gender],
  );

  // Counter index
  const [activeIdx, setActiveIdx] = useState(0);
  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP_LEN);
    setActiveIdx(Math.max(0, Math.min(cards.length - 1, idx)));
  }, [SNAP_LEN, cards.length]);

  // Animated scrollX — used for subtle scale / opacity on neighbours
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.wrap}>
      <Animated.FlatList
        data={cards}
        keyExtractor={(c) => c.label}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_LEN}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_GAP, paddingVertical: sh(16) }}
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          // Subtle scale-down on non-active cards (peek effect)
          const inputRange = [
            (index - 1) * SNAP_LEN,
            index * SNAP_LEN,
            (index + 1) * SNAP_LEN,
          ];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.94, 1, 0.94],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.55, 1, 0.55],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              style={{
                width: CARD_W,
                transform: [{ scale }],
                opacity,
              }}
            >
              <MetricCard
                label={item.displayLabel}
                tier={item.tier}
                score={item.score}
                image={item.image}
              />
            </Animated.View>
          );
        }}
      />

      {/* Counter — current / total */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          <Text style={styles.counterCurrent}>{activeIdx + 1}</Text>
          <Text style={styles.counterDivider}> / {cards.length}</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Single card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  tier,
  score,
  image,
}: {
  label: string;
  tier:  string;
  score: number;
  image: any;
}) {
  const barColor = getScoreColor(score);
  const fillPct  = Math.max(0, Math.min(100, score));

  // Animate the fill from 0 → fillPct on mount and whenever the score changes.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width % isn't supported by the native driver
    });
    anim.start();
    return () => anim.stop();
  }, [fillPct, progress]);

  const widthInterp = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0%", `${fillPct}%`],
  });

  return (
    <View style={styles.card}>
      {/* Metric image — no surrounding tile, sits on the card surface */}
      <Image source={image} style={styles.image} resizeMode="contain" />

      {/* Label */}
      <Text style={styles.label}>{label.toUpperCase()}</Text>

      {/* Tier name (carries the meaning) */}
      <Text style={styles.tier}>{tier}</Text>

      {/* Loading bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { width: widthInterp, backgroundColor: barColor },
          ]}
        />
      </View>

      {/* De-emphasized score — sits beneath the bar like a caption */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreNum}>{Math.round(score)}</Text>
        <Text style={styles.scoreUnit}> / 100</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },

  // Single card — compact, balanced rhythm
  card: {
    backgroundColor: COLORS.lightCard,
    borderRadius:    RADII.lg,
    paddingHorizontal: SP[4],
    paddingTop:        SP[4],
    paddingBottom:     SP[4],
    marginHorizontal:  sw(6),
    alignItems:        "center",
    ...SOFT_SHADOW,
  },
  image: {
    width:  ms(180),
    height: ms(180),
    marginBottom: SP[3],
  },
  label: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 1.2,
    marginBottom: sh(4),
  },
  tier: {
    fontFamily: FONT,
    fontSize: ms(22),
    color: COLORS.lightText,
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: SP[3],
  },
  barTrack: {
    width: "100%",
    height: ms(6),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: sh(8),
  },
  scoreNum: {
    fontFamily: FONT,
    fontSize: ms(15),
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  scoreUnit: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
  },

  // Counter — sits below the carousel with breathing room from the card shadow
  counter: {
    alignItems: "center",
    marginTop: SP[4],
  },
  counterText: {
    fontFamily: FONT,
  },
  counterCurrent: {
    fontFamily: FONT,
    fontSize: ms(16),
    color: COLORS.lightText,
    letterSpacing: -0.2,
  },
  counterDivider: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    letterSpacing: 0.4,
  },
});
