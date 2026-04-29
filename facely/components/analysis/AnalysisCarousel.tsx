// components/analysis/AnalysisCarousel.tsx
// Horizontal swipeable carousel of advanced-analysis sub-metrics.
// Mirrors the scoring screen's carousel pattern. Each card is identity-only
// (image · label · category chip · section chip · verdict word) — full
// commentary + ideal range live in the existing MetricDetailCard popup,
// triggered by tapping a card.

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const FONT = "ProximaNova-Bold";
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

// Section visuals — colored chip + tier verdict color.
type SectionKey = "working" | "okay" | "needs_work";
type StatusKind = "fine" | "neutral" | "alarming";

const SECTION_LABEL: Record<SectionKey, string> = {
  working:    "WORKING",
  okay:       "JUST OKAY",
  needs_work: "NEEDS WORK",
};

const SECTION_CHIP: Record<SectionKey, { bg: string; fg: string }> = {
  working:    { bg: "#E2F1D8", fg: "#3F7A2A" },
  okay:       { bg: COLORS.lightSurfaceAlt, fg: COLORS.lightText },
  needs_work: { bg: COLORS.declineRedSoft, fg: COLORS.declineRed },
};

const STATUS_VERDICT_COLOR: Record<StatusKind, string> = {
  fine:     "#3F7A2A",
  neutral:  COLORS.lightText,
  alarming: COLORS.declineRed,
};

// ─── Card data shape ─────────────────────────────────────────────────────────

export type CarouselMetric = {
  id:       string;
  label:    string;
  category: string;
  verdict:  string;
  section:  SectionKey;
  status:   StatusKind;
  icon:     number | null | undefined;
  emoji:    string;
};

type Props = {
  metrics:       CarouselMetric[];
  /** Total usable viewport width (screen − horizontal padding). */
  viewportWidth: number;
  onCardPress:   (m: CarouselMetric) => void;
};

// ─── Carousel ────────────────────────────────────────────────────────────────

export default function AnalysisCarousel({
  metrics,
  viewportWidth,
  onCardPress,
}: Props) {
  const CARD_W   = Math.round(viewportWidth * 0.85);
  const SIDE_GAP = Math.round((viewportWidth - CARD_W) / 2);
  const SNAP_LEN = CARD_W;

  const [activeIdx, setActiveIdx] = useState(0);
  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP_LEN);
    setActiveIdx(Math.max(0, Math.min(metrics.length - 1, idx)));
  }, [SNAP_LEN, metrics.length]);

  const scrollX = useRef(new Animated.Value(0)).current;

  const activeSection = metrics[activeIdx]?.section;

  return (
    <View style={styles.wrap}>
      <Animated.FlatList
        data={metrics}
        keyExtractor={(m) => m.id}
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
            <Animated.View style={{ width: CARD_W, transform: [{ scale }], opacity }}>
              <MetricCard item={item} onPress={() => onCardPress(item)} />
            </Animated.View>
          );
        }}
      />

      {/* Counter — current / total — section */}
      {activeSection && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            <Text style={styles.counterCurrent}>{activeIdx + 1}</Text>
            <Text style={styles.counterDivider}> / {metrics.length}</Text>
            <Text style={styles.counterDivider}>{"  ·  "}</Text>
            <Text style={[styles.counterSection, { color: SECTION_CHIP[activeSection].fg }]}>
              {SECTION_LABEL[activeSection]}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Single card ─────────────────────────────────────────────────────────────

function MetricCard({
  item,
  onPress,
}: {
  item:    CarouselMetric;
  onPress: () => void;
}) {
  const sectionChip   = SECTION_CHIP[item.section];
  const verdictColor  = STATUS_VERDICT_COLOR[item.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      {/* Top row — section chip (left) + category chip (right) */}
      <View style={styles.topRow}>
        <View style={[styles.sectionChip, { backgroundColor: sectionChip.bg }]}>
          <Text style={[styles.sectionChipText, { color: sectionChip.fg }]}>
            {SECTION_LABEL[item.section]}
          </Text>
        </View>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText}>{item.category}</Text>
        </View>
      </View>

      {/* Image — sits on card surface, no tile bg */}
      <View style={styles.imageWrap}>
        {item.icon ? (
          <Image source={item.icon} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.emoji}>{item.emoji}</Text>
        )}
      </View>

      {/* Label */}
      <Text style={styles.label} numberOfLines={2}>{item.label.toUpperCase()}</Text>

      {/* Verdict — loud, tier-colored */}
      <Text style={[styles.verdict, { color: verdictColor }]} numberOfLines={1}>
        {item.verdict}
      </Text>

      {/* Tap hint */}
      <Text style={styles.hint}>Tap to read your full analysis →</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: RADII.lg,
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    marginHorizontal: sw(6),
    alignItems: "center",
    ...SOFT_SHADOW,
  },

  topRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[3],
  },
  sectionChip: {
    paddingHorizontal: sw(10),
    paddingVertical: sh(4),
    borderRadius: 999,
  },
  sectionChipText: {
    fontFamily: FONT,
    fontSize: ms(10),
    letterSpacing: 0.8,
  },
  categoryChip: {
    paddingHorizontal: sw(10),
    paddingVertical: sh(4),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  categoryChipText: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: COLORS.lightSub,
    letterSpacing: 0.8,
  },

  imageWrap: {
    width: ms(160),
    height: ms(160),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[3],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emoji: {
    fontSize: ms(80),
  },

  label: {
    fontFamily: FONT,
    fontSize: ms(12),
    lineHeight: ms(16),
    color: COLORS.lightSub,
    letterSpacing: 1.2,
    marginBottom: sh(6),
    textAlign: "center",
    includeFontPadding: false,
  },
  verdict: {
    fontFamily: FONT,
    fontSize: ms(24),
    lineHeight: ms(30),
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: SP[3],
    paddingVertical: sh(2),
    includeFontPadding: false,
  },
  hint: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightMuted,
    letterSpacing: 0.2,
    marginTop: sh(2),
  },

  // Counter
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
  counterSection: {
    fontFamily: FONT,
    fontSize: ms(13),
    letterSpacing: 0.8,
  },
});
