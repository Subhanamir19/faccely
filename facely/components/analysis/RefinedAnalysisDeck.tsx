import React, {
  type ReactNode,
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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
const EASE = Easing.bezier(0.22, 0.8, 0.2, 1);
const ORDER: CategoryKey[] = ["alert", "moderate", "good"];
const COACH_IMAGE = require("@/assets/advanced-analysis-coach.png");

const META: Record<
  CategoryKey,
  { label: string; section: SectionKey; accent: string; soft: string }
> = {
  alert: {
    label: "Alert",
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
    label: "Good",
    section: "working",
    accent: "#1C1C1E",
    soft: "rgba(28,28,30,0.12)",
  },
};

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
      : withTiming(next, { duration: 400, easing: EASE });
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

function MetricAsset({ metric }: { metric: RefinedAnalysisMetric }) {
  return (
    <View style={styles.assetStage}>
      {metric.icon ? (
        <Image
          source={metric.icon}
          resizeMode="contain"
          style={[styles.metricAsset, getAdvancedAnalysisIconStyle(metric.id)]}
        />
      ) : (
        <Text style={styles.metricEmoji}>{metric.emoji}</Text>
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

function Typewriter({
  text,
  delay,
  reduceMotion,
  enabled,
}: {
  text: string;
  delay: number;
  reduceMotion: boolean;
  enabled: boolean;
}) {
  const startedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [visible, setVisible] = useState(reduceMotion ? text : "");

  useEffect(() => {
    if (!enabled || startedRef.current) return;

    startedRef.current = true;
    hapticLight();

    if (reduceMotion) {
      setVisible(text);
      return;
    }

    let cursor = 0;
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        cursor += 1;
        setVisible(text.slice(0, cursor));
        if (cursor >= text.length && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 19);
    }, delay);

    return undefined;
  }, [delay, enabled, reduceMotion, text]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  return <Text style={styles.coachCopy}>{visible}</Text>;
}

function MetricCard({
  metric,
  index,
  category,
  reduced,
  visible,
  onPress,
}: {
  metric: RefinedAnalysisMetric;
  index: number;
  category: CategoryKey;
  reduced: boolean;
  visible: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const meta = META[category];

  return (
    <Animated.View
      entering={
        reduceMotion
          ? FadeIn.duration(1)
          : FadeInDown.delay(90 + index * 75)
              .duration(520)
              .easing(EASE)
      }
      style={styles.cardShadow}
    >
      <Glass reduced={reduced} style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={metric.label + ", open details"}
          onPress={() => {
            hapticLight();
            onPress();
          }}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && styles.pressedCard,
          ]}
        >
          <View style={styles.cardHead}>
            <Text numberOfLines={1} style={styles.metricName}>
              {metric.label}
            </Text>
            <View style={styles.statusScore}>
              <View style={styles.statusScoreTop}>
                <View style={[styles.statusDot, { backgroundColor: meta.accent }]} />
                <Text style={styles.scoreTop}>{(metric.score / 10).toFixed(1)}</Text>
              </View>
              <Battery score={metric.score} accent={meta.accent} />
            </View>
          </View>

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
              <Typewriter
                text={metric.commentary}
                delay={420 + index * 90}
                reduceMotion={reduceMotion}
                enabled={visible}
              />
            </View>
          </View>

        </Pressable>
      </Glass>
    </Animated.View>
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
  const [category, setCategory] = useState<CategoryKey>(() =>
    groups.moderate.length
      ? "moderate"
      : groups.alert.length
        ? "alert"
        : "good",
  );
  const contentWidth = Math.min(
    520,
    Math.max(280, viewportWidth - sw(44)),
  );
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [category]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={FadeInDown.duration(550).delay(100).easing(EASE)}
        style={styles.switcherWrap}
      >
        <Switcher
          active={category}
          counts={counts}
          width={contentWidth}
          onChange={setCategory}
          reduced={reduced}
        />
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.list,
          {
            width: contentWidth,
            paddingBottom: Math.max(bottomInset + sh(24), sh(34)),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {ORDER.map((key) => {
          const selected = key === category;
          const group = groups[key];
          return (
            <View key={key} style={!selected && styles.hiddenCategory}>
              {group.length ? (
                group.map((metric, index) => (
                  <MetricCard
                    key={metric.id}
                    metric={metric}
                    index={index}
                    category={key}
                    reduced={reduced}
                    visible={selected}
                    onPress={() => onCardPress(metric)}
                  />
                ))
              ) : selected ? (
                <Glass reduced={reduced} style={styles.empty}>
                  <Text style={styles.emptyTitle}>Nothing here yet</Text>
                  <Text style={styles.emptyBody}>
                    No metrics currently fall into the{" "}
                    {META[key].label.toLowerCase()} range.
                  </Text>
                </Glass>
              ) : null}
            </View>
          );
        })}
        {footer}
      </ScrollView>
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
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
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
  hiddenCategory: {
    display: "none",
  },
  list: {
    alignSelf: "center",
    paddingTop: SP[4],
    gap: SP[5],
  },
  cardShadow: {
    borderRadius: ms(28),
    shadowColor: "#141419",
    shadowOpacity: 0.045,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  card: {
    borderRadius: ms(28),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.065)",
  },
  cardPressable: {
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[4],
    borderRadius: ms(28),
  },
  pressedCard: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
    paddingBottom: SP[2],
  },
  metricName: {
    flex: 1,
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
  },
  assetStage: {
    width: "100%",
    height: sh(116),
    alignItems: "center",
    justifyContent: "center",
  },
  metricAsset: {
    width: sw(124),
    height: sh(116),
  },
  metricEmoji: {
    fontSize: ms(42),
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
