import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Image,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ChevronDown } from "lucide-react-native";

import Text from "@/components/ui/T";
import {
  ADVANCED_ANALYSIS_FONT,
  ADVANCED_ANALYSIS_FONT_BOLD,
  ADVANCED_ANALYSIS_FONT_SEMIBOLD,
  getAdvancedAnalysisIconStyle,
} from "@/lib/advancedAnalysisIcons";
import { SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import type { CarouselMetric } from "./AnalysisCarousel";

type SectionKey = "working" | "okay" | "needs_work";
type CategoryKey = "alert" | "moderate" | "good";

export type RefinedAnalysisMetric = CarouselMetric & {
  score: number;
  commentary: string;
};

type Props = {
  metrics: RefinedAnalysisMetric[];
  viewportWidth: number;
  onCardPress: (metric: RefinedAnalysisMetric) => void;
  footer?: ReactNode;
  bottomInset?: number;
};

const INK = "#1C1C1E";
const INK_DIM = "#5F5F66";
const INK_FAINT = "#74747C";
const ORDER: CategoryKey[] = ["alert", "moderate", "good"];

// ── Motion system ──────────────────────────────────────────────────────────
// Decelerating "settle" curve for everything that arrives on screen.
const EASE_ENTER = Easing.bezier(0.16, 1, 0.3, 1);
const MOTION = {
  press: 80, // press-in / press-out feedback
  tier: 240, // tab content cross-fade + slide
  thumb: 280, // switcher thumb glide
  enter: 340, // element entrance
  stagger: 40, // gap between sibling cards
  staggerCap: 320, // total stagger window, regardless of list length
  tierShift: 8, // px the incoming tier travels
} as const;
// Entrance timeline — container before content: verdict → switcher → cards.
const TIMELINE = {
  verdict: 60,
  switcher: 140,
  cards: 220,
} as const;
const EXPAND_SPRING = { damping: 18, stiffness: 220 } as const;
const PRESS_SCALE = 0.97;

function cardEnterDelay(index: number) {
  return TIMELINE.cards + Math.min(index * MOTION.stagger, MOTION.staggerCap);
}

// Scale-only press feedback, 80ms in and out. One signal per event.
function usePressScale(enabled = true) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const onPressIn = useCallback(() => {
    if (!enabled) return;
    scale.set(
      withTiming(PRESS_SCALE, { duration: MOTION.press, easing: EASE_ENTER }),
    );
  }, [enabled, scale]);
  const onPressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: MOTION.press, easing: EASE_ENTER }));
  }, [scale]);
  return { style, onPressIn, onPressOut };
}
// Incoming tier: cross-fade + short directional slide. No exit — the old
// tier leaves instantly so the two never share layout space.
function tierEntering(direction: 1 | -1) {
  const shift = MOTION.tierShift * direction;
  const duration = MOTION.tier;
  return () => {
    "worklet";
    const config = { duration, easing: Easing.bezier(0.16, 1, 0.3, 1) };
    return {
      initialValues: { opacity: 0, transform: [{ translateX: shift }] },
      animations: {
        opacity: withTiming(1, config),
        transform: [{ translateX: withTiming(0, config) }],
      },
    };
  };
}

const COACH_IMAGE = require("@/assets/advanced-analysis-coach.png");

const META: Record<
  CategoryKey,
  { label: string; section: SectionKey; accent: string; soft: string }
> = {
  alert: {
    label: "Fix First",
    section: "needs_work",
    accent: "#FF453A",
    soft: "rgba(255,69,58,0.18)",
  },
  moderate: {
    label: "Moderate",
    section: "okay",
    accent: "#FF9F0A",
    soft: "rgba(255,159,10,0.20)",
  },
  good: {
    label: "Strengths",
    section: "working",
    accent: "#1C1C1E",
    soft: "rgba(28,28,30,0.12)",
  },
};

// Region grouping — breaks a flat tab list into readable chapters.
const REGION_ORDER = ["JAW", "CHEEKS", "EYES", "SKIN", "HAIR"];
const REGION_LABEL: Record<string, string> = {
  JAW: "Jawline",
  CHEEKS: "Cheeks & Midface",
  EYES: "Eyes & Brows",
  SKIN: "Skin",
  HAIR: "Hair",
};

type RegionGroup = {
  key: string;
  label: string;
  metrics: RefinedAnalysisMetric[];
};

function groupByRegion(metrics: RefinedAnalysisMetric[]): RegionGroup[] {
  const buckets = new Map<string, RefinedAnalysisMetric[]>();

  metrics.forEach((metric) => {
    const key = (metric.category || "OTHER").toUpperCase();
    const bucket = buckets.get(key);
    if (bucket) bucket.push(metric);
    else buckets.set(key, [metric]);
  });

  const ordered = [
    ...REGION_ORDER.filter((key) => buckets.has(key)),
    ...[...buckets.keys()].filter((key) => !REGION_ORDER.includes(key)),
  ];

  return ordered.map((key) => ({
    key,
    label: REGION_LABEL[key] ?? key.charAt(0) + key.slice(1).toLowerCase(),
    metrics: buckets.get(key) ?? [],
  }));
}

const LIQUID_GLASS =
  Platform.OS === "ios" &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduced,
    );
    return () => subscription.remove();
  }, []);

  return reduced;
}

function Glass({
  children,
  style,
  strong = false,
  reduced = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  reduced?: boolean;
}) {
  if (LIQUID_GLASS && !reduced) {
    return (
      <GlassView
        glassEffectStyle={strong ? "regular" : "clear"}
        tintColor="rgba(255,255,255,0.22)"
        style={[styles.glassClip, style]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(255,255,255,0.58)",
            "rgba(255,255,255,0.07)",
            "rgba(255,255,255,0)",
          ]}
          locations={[0, 0.3, 0.62]}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.glassRim} />
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.glassClip, reduced && styles.solidGlass, style]}>
      {!reduced && (
        <BlurView
          tint="systemUltraThinMaterialLight"
          intensity={strong ? 72 : 58}
          blurMethod="dimezisBlurView"
          blurReductionFactor={3}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: strong
              ? "rgba(255,255,255,0.34)"
              : "rgba(255,255,255,0.53)",
          },
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(255,255,255,0.90)",
          "rgba(255,255,255,0.09)",
          "rgba(255,255,255,0)",
        ]}
        locations={[0, 0.27, 0.52]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glassRim} />
      {children}
    </View>
  );
}

function Switcher({
  active,
  counts,
  width,
  onChange,
  reduced,
}: {
  active: CategoryKey;
  counts: Record<CategoryKey, number>;
  width: number;
  onChange: (key: CategoryKey) => void;
  reduced: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const index = useSharedValue(ORDER.indexOf(active));
  const tabWidth = (width - 8) / 3;

  useEffect(() => {
    const next = ORDER.indexOf(active);
    index.value = reduceMotion
      ? next
      : withTiming(next, { duration: MOTION.thumb, easing: EASE_ENTER });
  }, [active, index, reduceMotion]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: index.value * tabWidth }],
  }));

  return (
    <Glass strong reduced={reduced} style={[styles.switcher, { width }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.switchThumb, { width: tabWidth }, thumbStyle]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.96)", "rgba(255,255,255,0.50)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.switchShine} />
      </Animated.View>

      {ORDER.map((key) => {
        const meta = META[key];
        const selected = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={
              meta.label + ", " + counts[key] + " metrics"
            }
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              hapticSelection();
              onChange(key);
            }}
            style={({ pressed }) => [
              styles.switchButton,
              { width: tabWidth },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[styles.categoryDot, { backgroundColor: meta.accent }]}
            />
            <Text
              style={[
                styles.categoryLabel,
                selected && styles.categoryLabelActive,
              ]}
            >
              {meta.label}
            </Text>
            <Text
              style={[
                styles.categoryCount,
                selected && styles.categoryCountActive,
              ]}
            >
              {counts[key]}
            </Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

function MetricAsset({
  metric,
  compact = false,
}: {
  metric: RefinedAnalysisMetric;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.assetStageCompact : styles.assetStage}>
      {metric.icon ? (
        <Image
          source={metric.icon}
          resizeMode="contain"
          style={[
            compact ? styles.metricAssetCompact : styles.metricAsset,
            getAdvancedAnalysisIconStyle(metric.id),
          ]}
        />
      ) : (
        <Text style={compact ? styles.metricEmojiCompact : styles.metricEmoji}>
          {metric.emoji}
        </Text>
      )}
    </View>
  );
}

function Battery({ score, accent }: { score: number; accent: string }) {
  const filled = Math.max(1, Math.min(6, Math.ceil((score / 100) * 6)));
  return (
    <View
      accessibilityLabel={"Score " + Math.round(score) + " out of 100"}
      style={styles.battery}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.batteryCell,
            index < filled
              ? { backgroundColor: accent, borderColor: accent }
              : styles.batteryCellEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function MetricCard({
  metric,
  index,
  category,
  reduced,
  expanded,
  animateEntrance,
  onToggle,
  onOpenDetail,
}: {
  metric: RefinedAnalysisMetric;
  index: number;
  category: CategoryKey;
  reduced: boolean;
  expanded: boolean;
  /** First reveal only — tier switches animate the container instead. */
  animateEntrance: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const meta = META[category];
  const chevron = useSharedValue(expanded ? 1 : 0);
  const press = usePressScale(!reduceMotion);

  useEffect(() => {
    chevron.value = reduceMotion
      ? expanded
        ? 1
        : 0
      : withSpring(expanded ? 1 : 0, EXPAND_SPRING);
  }, [chevron, expanded, reduceMotion]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: interpolate(chevron.value, [0, 1], [0, 180]) + "deg" },
    ],
  }));

  return (
    <Animated.View
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.springify()
              .damping(EXPAND_SPRING.damping)
              .stiffness(EXPAND_SPRING.stiffness)
      }
      entering={
        reduceMotion || !animateEntrance
          ? undefined
          : FadeInDown.delay(cardEnterDelay(index))
              .duration(MOTION.enter)
              .easing(EASE_ENTER)
      }
    >
      {/* Scale lives on the inner view so it never fights the entrance transform. */}
      <Animated.View style={[styles.cardShadow, press.style]}>
      <Glass reduced={reduced} style={styles.card}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            metric.label +
            ", " +
            metric.verdict +
            ", score " +
            (metric.score / 10).toFixed(1) +
            " out of 10" +
            (expanded ? ", collapse" : ", expand")
          }
          onPress={() => {
            // Haptic marks the reveal only; collapsing is a quiet dismissal.
            if (!expanded) hapticLight();
            onToggle();
          }}
          style={styles.cardPressable}
        >
          {/* ── Rest state: icon · name + verdict · score ── */}
          <View style={styles.cardHead}>
            <View style={styles.restIcon}>
              <MetricAsset metric={metric} compact />
            </View>

            <View style={styles.restText}>
              <Text numberOfLines={1} style={styles.metricName}>
                {metric.label}
              </Text>
              <Text numberOfLines={1} style={styles.metricVerdict}>
                {metric.verdict}
              </Text>
            </View>

            <View style={styles.statusScore}>
              <View style={styles.statusScoreTop}>
                <View style={[styles.statusDot, { backgroundColor: meta.accent }]} />
                <Text style={styles.scoreTop}>{(metric.score / 10).toFixed(1)}</Text>
              </View>
              <Battery score={metric.score} accent={meta.accent} />
            </View>

            <Animated.View style={chevronStyle}>
              <ChevronDown size={ms(16)} color={INK_FAINT} strokeWidth={2.1} />
            </Animated.View>
          </View>

          {/* ── Expanded state: hero + coach copy + full breakdown ── */}
          {expanded && (
            <Animated.View
              // Body fades in while the card is still growing, and leaves
              // faster than it arrived (exit ≈ 2/3 of enter).
              entering={
                reduceMotion
                  ? undefined
                  : FadeIn.delay(60).duration(200).easing(EASE_ENTER)
              }
              exiting={reduceMotion ? undefined : FadeOut.duration(130)}
            >
              <View style={styles.hero}>
                <MetricAsset metric={metric} />
              </View>

              <View style={styles.divider} />

              <View style={styles.coachRow}>
                <View style={styles.coachAvatar}>
                  <Image
                    source={COACH_IMAGE}
                    resizeMode="cover"
                    style={styles.coachAvatarImage}
                  />
                </View>
                <View style={styles.coachText}>
                  <Text style={styles.coachLabel}>COACH SIGMA</Text>
                  <Text style={styles.coachCopy}>{metric.commentary}</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={metric.label + ", full breakdown"}
                onPress={() => {
                  hapticLight();
                  onOpenDetail();
                }}
                style={({ pressed }) => [
                  styles.detailLink,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.detailLinkText}>FULL BREAKDOWN</Text>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Glass>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Verdict header — the whole result in one glance, above the switcher
// ---------------------------------------------------------------------------

function summarySentence(counts: Record<CategoryKey, number>): string {
  if (counts.alert > 0) {
    return counts.alert === 1
      ? "One trait is holding your face back the most. Start there."
      : counts.alert + " traits are holding your face back the most. Start there.";
  }
  if (counts.moderate > 0) {
    return "Nothing critical. " + counts.moderate + " traits still have room to sharpen.";
  }
  return "Every trait reads strong. Keep the routine locked in.";
}

function VerdictHeader({
  metrics,
  counts,
  width,
  reduced,
  onPriorityPress,
}: {
  metrics: RefinedAnalysisMetric[];
  counts: Record<CategoryKey, number>;
  width: number;
  reduced: boolean;
  onPriorityPress: (metric: RefinedAnalysisMetric) => void;
}) {
  const overall = useMemo(() => {
    if (!metrics.length) return 0;
    const total = metrics.reduce((sum, metric) => sum + metric.score, 0);
    return total / metrics.length / 10;
  }, [metrics]);

  const priorities = useMemo(
    () => [...metrics].sort((a, b) => a.score - b.score).slice(0, 3),
    [metrics],
  );

  return (
    <Glass strong reduced={reduced} style={[styles.verdict, { width }]}>
      <View style={styles.verdictTop}>
        <View style={styles.verdictScoreBlock}>
          <Text style={styles.verdictLabel}>OVERALL</Text>
          <View style={styles.verdictScoreRow}>
            <Text style={styles.verdictScore}>{overall.toFixed(1)}</Text>
            <Text style={styles.verdictScoreMax}>/10</Text>
          </View>
        </View>
        <Text style={styles.verdictSentence}>{summarySentence(counts)}</Text>
      </View>

      {priorities.length > 0 && (
        <View style={styles.priorityRow}>
          {priorities.map((metric) => (
            <Pressable
              key={metric.id}
              accessibilityRole="button"
              accessibilityLabel={
                "Priority, " +
                metric.label +
                ", score " +
                (metric.score / 10).toFixed(1) +
                " out of 10"
              }
              onPress={() => {
                hapticSelection();
                onPriorityPress(metric);
              }}
              style={({ pressed }) => [
                styles.priorityChip,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: META.alert.accent },
                ]}
              />
              <Text numberOfLines={1} style={styles.priorityLabel}>
                {metric.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Glass>
  );
}

export default function RefinedAnalysisDeck({
  metrics,
  viewportWidth,
  onCardPress,
  footer,
  bottomInset = 0,
}: Props) {
  const reduced = useReduceTransparency();
  const groups = useMemo<Record<CategoryKey, RefinedAnalysisMetric[]>>(
    () => ({
      alert: metrics.filter((metric) => metric.section === META.alert.section),
      moderate: metrics.filter(
        (metric) => metric.section === META.moderate.section,
      ),
      good: metrics.filter((metric) => metric.section === META.good.section),
    }),
    [metrics],
  );
  const counts = useMemo(
    () => ({
      alert: groups.alert.length,
      moderate: groups.moderate.length,
      good: groups.good.length,
    }),
    [groups],
  );
  const regionGroups = useMemo<Record<CategoryKey, RegionGroup[]>>(
    () => ({
      alert: groupByRegion(groups.alert),
      moderate: groupByRegion(groups.moderate),
      good: groupByRegion(groups.good),
    }),
    [groups],
  );
  // Open on what's wrong first — the user's first question is never "what's average".
  const [category, setCategory] = useState<CategoryKey>(() =>
    groups.alert.length
      ? "alert"
      : groups.moderate.length
        ? "moderate"
        : "good",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Direction the incoming tier travels from: +1 = from the right.
  const [direction, setDirection] = useState<1 | -1>(1);
  // Cards stagger in on the first reveal only; after that the tier
  // container carries the transition so switching stays quick.
  const [firstReveal, setFirstReveal] = useState(true);
  const reduceMotion = useReducedMotion();
  const contentWidth = Math.min(
    520,
    Math.max(280, viewportWidth - sw(44)),
  );
  const scrollRef = useRef<ScrollView>(null);

  // Switching tier collapses any open card, so each tier starts scannable.
  const handleCategoryChange = useCallback(
    (next: CategoryKey) => {
      if (next === category) return;
      setDirection(ORDER.indexOf(next) > ORDER.indexOf(category) ? 1 : -1);
      setFirstReveal(false);
      setExpandedId(null);
      setCategory(next);
    },
    [category],
  );

  // Horizontal swipe steps between tiers, following the switcher's order.
  const stepCategory = useCallback(
    (step: 1 | -1) => {
      const next = ORDER[ORDER.indexOf(category) + step];
      if (!next) return;
      hapticSelection();
      handleCategoryChange(next);
    },
    [category, handleCategoryChange],
  );

  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .simultaneousWithExternalGesture(scrollGesture)
        .runOnJS(true)
        .onEnd((event) => {
          // A rightward drag born at the screen edge is iOS swipe-back, not a tier change.
          const startX = event.absoluteX - event.translationX;
          if (event.translationX > 0 && startX < 28) return;
          const committed =
            Math.abs(event.translationX) > 56 ||
            Math.abs(event.velocityX) > 550;
          if (!committed) return;
          stepCategory(event.translationX < 0 ? 1 : -1);
        }),
    [scrollGesture, stepCategory],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [category]);

  const cardLayout = reduceMotion
    ? undefined
    : LinearTransition.springify()
        .damping(EXPAND_SPRING.damping)
        .stiffness(EXPAND_SPRING.stiffness);

  const renderTier = (key: CategoryKey) => {
    const group = groups[key];
    if (!group.length) {
      return (
        <Glass reduced={reduced} style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            No metrics currently fall into the{" "}
            {META[key].label.toLowerCase()} range.
          </Text>
        </Glass>
      );
    }

    const regions = regionGroups[key];
    const showRegionLabels = regions.length > 1;
    let cardIndex = -1;

    return (
      <View style={styles.groupStack}>
        {regions.map((region) => (
          // Region blocks share the card spring so captions below an
          // expanding card glide instead of jumping.
          <Animated.View
            key={region.key}
            layout={cardLayout}
            style={styles.regionBlock}
          >
            {showRegionLabels && (
              <Text style={styles.regionLabel}>{region.label}</Text>
            )}
            <View style={styles.cardStack}>
              {region.metrics.map((metric) => {
                cardIndex += 1;
                return (
                  <MetricCard
                    key={metric.id}
                    metric={metric}
                    index={cardIndex}
                    category={key}
                    reduced={reduced}
                    expanded={expandedId === metric.id}
                    animateEntrance={firstReveal}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === metric.id ? null : metric.id,
                      )
                    }
                    onOpenDetail={() => onCardPress(metric)}
                  />
                );
              })}
            </View>
          </Animated.View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeInDown.duration(MOTION.enter)
                .delay(TIMELINE.verdict)
                .easing(EASE_ENTER)
        }
        style={[styles.verdictWrap, { width: contentWidth }]}
      >
        <VerdictHeader
          metrics={metrics}
          counts={counts}
          width={contentWidth}
          reduced={reduced}
          onPriorityPress={onCardPress}
        />
      </Animated.View>

      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeInDown.duration(MOTION.enter)
                .delay(TIMELINE.switcher)
                .easing(EASE_ENTER)
        }
        style={styles.switcherWrap}
      >
        <Switcher
          active={category}
          counts={counts}
          width={contentWidth}
          onChange={handleCategoryChange}
          reduced={reduced}
        />
      </Animated.View>

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.scroll} collapsable={false}>
          <GestureDetector gesture={scrollGesture}>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollInner}
              contentInsetAdjustmentBehavior="never"
              contentContainerStyle={[
                styles.list,
                {
                  width: contentWidth,
                  paddingBottom: footer
                    ? sh(20)
                    : Math.max(bottomInset + sh(24), sh(34)),
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Keyed on tier: each switch remounts and slides in from the
                  side the user moved toward. */}
              <Animated.View
                key={category}
                entering={
                  reduceMotion || firstReveal
                    ? undefined
                    : tierEntering(direction)
                }
              >
                {renderTier(category)}
              </Animated.View>
            </ScrollView>
          </GestureDetector>
        </View>
      </GestureDetector>

      {/* ── Docked action bar — always reachable, never buried under 18 cards ── */}
      {footer ? (
        <View
          style={[
            styles.dock,
            {
              width: contentWidth,
              paddingBottom: Math.max(bottomInset, sh(12)),
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    minHeight: 0,
  },
  glassClip: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  solidGlass: {
    backgroundColor: "rgba(250,251,252,0.97)",
  },
  glassRim: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.94)",
  },
  verdictWrap: {
    flexShrink: 0,
    paddingTop: SP[3],
  },
  verdict: {
    borderRadius: ms(22),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    gap: SP[3],
    shadowColor: "#141419",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  verdictTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  verdictScoreBlock: {
    gap: sh(2),
  },
  verdictLabel: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(9.5, 0.2),
    lineHeight: ms(12),
    letterSpacing: 1.1,
    includeFontPadding: false,
  },
  verdictScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: sw(2),
  },
  verdictScore: {
    color: INK,
    fontFamily: ADVANCED_ANALYSIS_FONT_BOLD,
    fontSize: ms(34, 0.2),
    lineHeight: ms(38),
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  verdictScoreMax: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(12.5, 0.2),
    lineHeight: ms(17),
    includeFontPadding: false,
  },
  verdictSentence: {
    flex: 1,
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT,
    fontSize: ms(13, 0.2),
    lineHeight: ms(18),
    includeFontPadding: false,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
  },
  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(5),
    minHeight: 30,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,28,30,0.09)",
  },
  priorityDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: 999,
  },
  priorityLabel: {
    color: INK,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(11.5, 0.2),
    lineHeight: ms(15),
    includeFontPadding: false,
  },
  dock: {
    flexShrink: 0,
    alignSelf: "center",
    paddingTop: SP[3],
  },
  switcherWrap: {
    flexShrink: 0,
    paddingTop: SP[3],
    paddingBottom: SP[1],
  },
  switcher: {
    height: 52,
    padding: SP[1],
    borderRadius: ms(18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
    flexDirection: "row",
    shadowColor: "#141419",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  switchThumb: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: ms(14),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.64)",
    shadowColor: "#18181C",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  switchShine: {
    position: "absolute",
    left: "8%",
    right: "38%",
    top: "14%",
    height: "34%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.68)",
  },
  switchButton: {
    zIndex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[1],
    borderRadius: ms(14),
  },
  pressed: {
    transform: [{ scale: PRESS_SCALE }],
  },
  categoryDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: 999,
  },
  categoryLabel: {
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(12.5, 0.2),
    lineHeight: ms(16),
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  categoryLabelActive: {
    color: INK,
  },
  categoryCount: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(10.5, 0.2),
    lineHeight: ms(14),
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  categoryCountActive: {
    color: INK_DIM,
  },
  scroll: {
    flex: 1,
    alignSelf: "stretch",
  },
  scrollInner: {
    flex: 1,
  },
  list: {
    alignSelf: "center",
    paddingTop: SP[4],
  },
  groupStack: {
    gap: sh(40),
  },
  regionBlock: {
    gap: SP[3],
  },
  regionLabel: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(10, 0.2),
    lineHeight: ms(13),
    letterSpacing: 1.1,
    textTransform: "uppercase",
    paddingLeft: SP[1],
    includeFontPadding: false,
  },
  cardStack: {
    gap: sh(28),
  },
  cardShadow: {
    borderRadius: ms(22),
    shadowColor: "#141419",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  card: {
    borderRadius: ms(22),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.065)",
  },
  cardPressable: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    borderRadius: ms(22),
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  restIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,28,30,0.07)",
    overflow: "hidden",
  },
  restText: {
    flex: 1,
    gap: sh(2),
  },
  metricVerdict: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT,
    fontSize: ms(12, 0.2),
    lineHeight: ms(16),
    includeFontPadding: false,
  },
  metricName: {
    color: INK,
    fontFamily: ADVANCED_ANALYSIS_FONT_BOLD,
    fontSize: ms(15, 0.2),
    lineHeight: ms(20),
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  statusScore: {
    alignItems: "flex-end",
    gap: SP[1],
    minWidth: sw(68),
    paddingLeft: SP[2],
  },
  statusScoreTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  statusDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: 999,
  },
  scoreTop: {
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(12.5, 0.2),
    lineHeight: ms(17),
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  battery: {
    flexDirection: "row",
    gap: sw(2),
    padding: 2,
    borderRadius: ms(5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,28,30,0.14)",
  },
  batteryCell: {
    width: sw(6),
    height: sh(9),
    borderRadius: ms(1.5),
    borderWidth: StyleSheet.hairlineWidth,
  },
  batteryCellEmpty: {
    backgroundColor: "rgba(28,28,30,0.07)",
    borderColor: "rgba(28,28,30,0.08)",
  },
  hero: {
    height: sh(116),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: SP[3],
  },
  assetStage: {
    width: "100%",
    height: sh(116),
    alignItems: "center",
    justifyContent: "center",
  },
  assetStageCompact: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  metricAsset: {
    width: sw(124),
    height: sh(116),
  },
  metricAssetCompact: {
    width: ms(34),
    height: ms(34),
  },
  metricEmoji: {
    fontSize: ms(42),
  },
  metricEmojiCompact: {
    fontSize: ms(20),
  },
  detailLink: {
    marginTop: SP[3],
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
    paddingVertical: SP[1],
    paddingHorizontal: SP[2],
    marginLeft: -SP[2],
  },
  detailLinkText: {
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(10.5, 0.2),
    lineHeight: ms(14),
    letterSpacing: 1.05,
    includeFontPadding: false,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(28,28,30,0.09)",
    marginTop: sh(1),
    marginBottom: SP[3],
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[3],
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: ms(9),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,28,30,0.08)",
    overflow: "hidden",
  },
  coachAvatarImage: {
    width: "100%",
    height: "100%",
  },
  coachText: {
    flex: 1,
    minHeight: 48,
  },
  coachLabel: {
    color: INK_FAINT,
    fontFamily: ADVANCED_ANALYSIS_FONT_SEMIBOLD,
    fontSize: ms(9.5, 0.2),
    lineHeight: ms(12),
    letterSpacing: 1.05,
    includeFontPadding: false,
  },
  coachCopy: {
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT,
    fontSize: ms(14, 0.2),
    lineHeight: ms(19.5),
    includeFontPadding: false,
  },
  empty: {
    borderRadius: ms(26),
    padding: ms(24),
    alignItems: "center",
    gap: sh(5),
  },
  emptyTitle: {
    color: INK,
    fontFamily: ADVANCED_ANALYSIS_FONT_BOLD,
    fontSize: ms(17, 0.2),
  },
  emptyBody: {
    color: INK_DIM,
    fontFamily: ADVANCED_ANALYSIS_FONT,
    fontSize: ms(13.5, 0.2),
    lineHeight: ms(19),
    textAlign: "center",
  },
});
