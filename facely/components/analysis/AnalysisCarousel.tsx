// components/analysis/AnalysisCarousel.tsx
// Horizontal swipeable carousel of advanced-analysis sub-metrics.
// Mirrors the scoring screen's carousel pattern. Each card is identity-only
// (image · label · category chip · section chip · verdict word) — full
// commentary + ideal range live in the existing MetricDetailCard popup,
// triggered by tapping a card.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { ORANGE_ONBOARDING } from "@/components/onboarding/OrangeOnboardingLayout";
import {
  ADVANCED_ANALYSIS_FONT_BOLD,
  getAdvancedAnalysisIconStyle,
} from "@/lib/advancedAnalysisIcons";

const FONT = ADVANCED_ANALYSIS_FONT_BOLD;
const PARROT_GREEN = COLORS.accent;
const PARROT_GREEN_DARK = COLORS.accentDepth;
const PARROT_GREEN_SOFT = "rgba(180,243,77,0.22)";
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
  working:    { bg: PARROT_GREEN_SOFT, fg: PARROT_GREEN_DARK },
  okay:       { bg: COLORS.lightSurfaceAlt, fg: COLORS.lightText },
  needs_work: { bg: COLORS.declineRedSoft, fg: COLORS.declineRed },
};

const STATUS_VERDICT_COLOR: Record<StatusKind, string> = {
  fine:     PARROT_GREEN,
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
  showControls?: boolean;
  onboarding?: boolean;
};

// ─── Carousel ────────────────────────────────────────────────────────────────

export default function AnalysisCarousel({
  metrics,
  viewportWidth,
  onCardPress,
  showControls = false,
  onboarding = false,
}: Props) {
  const CARD_W   = Math.round(viewportWidth * 0.85);
  const SIDE_GAP = Math.round((viewportWidth - CARD_W) / 2);
  const SNAP_LEN = CARD_W;

  const listRef = useRef<FlatList<CarouselMetric> | null>(null);
  const metricKey = useMemo(() => metrics.map((m) => m.id).join("|"), [metrics]);
  const [activeIdx, setActiveIdx] = useState(0);
  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP_LEN);
    setActiveIdx(Math.max(0, Math.min(metrics.length - 1, idx)));
  }, [SNAP_LEN, metrics.length]);

  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setActiveIdx(0);
    scrollX.setValue(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [metricKey, scrollX]);

  const activeSection = metrics[activeIdx]?.section;
  const canGoPrev = activeIdx > 0;
  const canGoNext = activeIdx < metrics.length - 1;
  const scrollToMetric = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(metrics.length - 1, nextIdx));
      listRef.current?.scrollToOffset({ offset: clamped * SNAP_LEN, animated: true });
      setActiveIdx(clamped);
    },
    [SNAP_LEN, metrics.length]
  );

  return (
    <View style={styles.wrap}>
      <Animated.FlatList
        ref={listRef}
        data={metrics}
        keyExtractor={(m) => m.id}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_LEN}
        snapToAlignment="start"
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
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
              <MetricCard item={item} onboarding={onboarding} onPress={() => onCardPress(item)} />
            </Animated.View>
          );
        }}
      />

      {/* Counter — current / total — section */}
      {activeSection && (
        <View style={styles.counter}>
          <Text style={[styles.counterText, onboarding && styles.onboardingFont]}>
            <Text style={[styles.counterCurrent, onboarding && styles.onboardingFont]}>{activeIdx + 1}</Text>
            <Text style={[styles.counterDivider, onboarding && styles.onboardingFont]}> / {metrics.length}</Text>
            <Text style={[styles.counterDivider, onboarding && styles.onboardingFont]}>{"  ·  "}</Text>
            <Text style={[styles.counterSection, onboarding && styles.onboardingFont, { color: SECTION_CHIP[activeSection].fg }]}>
              {SECTION_LABEL[activeSection]}
            </Text>
          </Text>
        </View>
      )}

      {showControls && metrics.length > 1 ? (
        <View style={styles.controlsRow}>
          <Pressable
            onPress={() => scrollToMetric(activeIdx - 1)}
            disabled={!canGoPrev}
            accessibilityRole="button"
            accessibilityLabel="Previous metric"
            style={({ pressed }) => [
              styles.metricNavBtn,
              onboarding && styles.onboardingNavBtn,
              !canGoPrev && styles.metricNavBtnDisabled,
              pressed && canGoPrev && { opacity: 0.82 },
            ]}
          >
            <ChevronLeft size={ms(17)} color={COLORS.lightText} strokeWidth={2.4} />
            <Text style={[styles.metricNavText, onboarding && styles.onboardingFont]}>PREV</Text>
          </Pressable>

          <Pressable
            onPress={() => scrollToMetric(activeIdx + 1)}
            disabled={!canGoNext}
            accessibilityRole="button"
            accessibilityLabel="Next metric"
            style={({ pressed }) => [
              styles.metricNavBtn,
              onboarding && styles.onboardingNavBtn,
              !canGoNext && styles.metricNavBtnDisabled,
              pressed && canGoNext && { opacity: 0.82 },
            ]}
          >
            <Text style={[styles.metricNavText, onboarding && styles.onboardingFont]}>NEXT METRIC</Text>
            <ChevronRight size={ms(17)} color={COLORS.lightText} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ─── Single card ─────────────────────────────────────────────────────────────

function MetricCard({
  item,
  onPress,
  onboarding,
}: {
  item:    CarouselMetric;
  onPress: () => void;
  onboarding: boolean;
}) {
  const sectionChip   = SECTION_CHIP[item.section];
  const verdictColor  = STATUS_VERDICT_COLOR[item.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        onboarding && styles.onboardingCard,
        pressed && { opacity: 0.92 },
      ]}
    >
      {/* Top row — section chip (left) + category chip (right) */}
      <View style={styles.topRow}>
        <View style={[styles.sectionChip, { backgroundColor: sectionChip.bg }]}>
          <Text style={[styles.sectionChipText, onboarding && styles.onboardingFont, { color: sectionChip.fg }]}>
            {SECTION_LABEL[item.section]}
          </Text>
        </View>
        <View style={styles.categoryChip}>
          <Text style={[styles.categoryChipText, onboarding && styles.onboardingFont]}>{item.category}</Text>
        </View>
      </View>

      {/* Image — sits on card surface, no tile bg */}
      <View style={styles.imageWrap}>
        {item.icon ? (
          <Image
            source={item.icon}
            style={[styles.image, getAdvancedAnalysisIconStyle(item.id)]}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.emoji}>{item.emoji}</Text>
        )}
      </View>

      {/* Label */}
      <Text style={[styles.label, onboarding && styles.onboardingFont]} numberOfLines={2}>{item.label.toUpperCase()}</Text>

      {/* Verdict — loud, tier-colored */}
      <Text style={[styles.verdict, onboarding && styles.onboardingFont, { color: verdictColor }]} numberOfLines={1}>
        {item.verdict}
      </Text>

      {/* Tap hint */}
      <Text style={[styles.hint, onboarding && styles.onboardingFont]}>
        Tap to read your full analysis →
      </Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: "transparent",
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
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(10),
    marginTop: SP[4],
  },
  metricNavBtn: {
    minHeight: sh(44),
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(5),
    paddingHorizontal: sw(14),
  },
  metricNavBtnDisabled: {
    opacity: 0.38,
  },
  metricNavText: {
    fontFamily: FONT,
    fontSize: ms(11, 0.2),
    color: COLORS.lightText,
    letterSpacing: 0.4,
  },
  onboardingCard: {
    borderRadius: ms(17),
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    shadowOpacity: 0.06,
  },
  onboardingNavBtn: {
    borderRadius: ms(14),
    backgroundColor: ORANGE_ONBOARDING.orangeSoft,
    borderColor: "#FFD1A8",
  },
  onboardingFont: {
    fontFamily: ORANGE_ONBOARDING.font,
  },
});
