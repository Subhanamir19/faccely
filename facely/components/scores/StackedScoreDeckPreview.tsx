import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { getScoreColor } from "./MetricGridCard";
import { getTierLabel } from "./ScoringGrid";
import type { DashboardMetric } from "@/lib/api/insights";
import { useOnboarding } from "@/store/onboarding";
import { ADVANCED_ANALYSIS_FONT_BOLD } from "@/lib/advancedAnalysisIcons";

const FONT = ADVANCED_ANALYSIS_FONT_BOLD;

const CARD_IMAGES: Record<string, any> = {
  Overall: require("@/assets/scoring-images/fullface-vector.png"),
  Jawline: require("@/assets/scoring-images/jawline.png"),
  Cheekbones: require("@/assets/scoring-images/cheekbones.png"),
  "Eye Symmetry": require("@/assets/scoring-images/eyearea-vector.png"),
  "Facial Symmetry": require("@/assets/scoring-images/symmetry.png"),
  "Masculinity/Femininity": require("@/assets/scoring-images/masculanity.png"),
  "Skin Quality": require("@/assets/scoring-images/skin-quality.png"),
  "Nose Balance": require("@/assets/scoring-images/nose-vector.png"),
};

const API_KEY_TO_LABEL: Record<string, string> = {
  jawline: "Jawline",
  facial_symmetry: "Facial Symmetry",
  cheekbones: "Cheekbones",
  eyes_symmetry: "Eye Symmetry",
  skin_quality: "Skin Quality",
  nose_harmony: "Nose Balance",
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

type ScoreDeckCard = {
  label: string;
  displayLabel: string;
  score: number;
  tier: string;
  image: any;
};

const PREVIEW_CARDS: ScoreDeckCard[] = [
  ...CARD_ORDER.map((label) => {
    const scoreMap: Record<string, number> = {
      Overall: 72,
      Jawline: 78,
      Cheekbones: 82,
      "Eye Symmetry": 69,
      "Facial Symmetry": 74,
      "Masculinity/Femininity": 67,
      "Skin Quality": 54,
      "Nose Balance": 60,
    };
    const score = scoreMap[label];
    const displayLabel = label === "Masculinity/Femininity" ? "Masculinity" : label;
    return {
      label,
      displayLabel,
      score,
      tier: getTierLabel(label, score),
      image: CARD_IMAGES[label],
    };
  }),
];

export type StackedScoreMetric = { label: string; score: number };

type Props = {
  metrics?: StackedScoreMetric[];
  totalScore?: number;
  dashboardMetrics?: DashboardMetric[];
  overallDelta?: number | null;
  viewportWidth?: number;
  embedded?: boolean;
  showHeader?: boolean;
  showReset?: boolean;
  showControls?: boolean;
  showBackground?: boolean;
};

function getWrappedIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

function ScoreCard({
  card,
  barFillStyle,
  embedded,
  imageSize,
  bottomSpacerHeight,
}: {
  card: ScoreDeckCard;
  barFillStyle?: any;
  embedded?: boolean;
  imageSize: number;
  bottomSpacerHeight: number;
}) {
  const scoreColor = getScoreColor(card.score);

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        styles.cardBehind,
        { borderColor: "rgba(255,255,255,0.64)" },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${card.label} score ${card.score} out of 100`}
    >
      <View style={styles.cardContent}>
        <Image
          source={card.image}
          style={[
            styles.image,
            embedded && styles.imageEmbedded,
            { width: imageSize, height: imageSize },
          ]}
          resizeMode="contain"
        />

        <Text style={styles.label}>{card.displayLabel.toUpperCase()}</Text>
        <Text style={[styles.tier, embedded && styles.tierEmbedded]}>{card.tier}</Text>

        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: scoreColor,
              },
              barFillStyle,
            ]}
          />
        </View>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreNum}>{Math.round(card.score)}</Text>
          <Text style={styles.scoreUnit}> / 100</Text>
        </View>

        <View style={{ height: bottomSpacerHeight }} />
      </View>
    </View>
  );
}

function DeckLayer({
  card,
  cardIndex,
  layerIndex,
  deckWidth,
  cardHeight,
  imageSize,
  bottomSpacerHeight,
  barMaxWidth,
  screenWidth,
  threshold,
  translateX,
  translateY,
  activeIndex,
  cardCount,
  embedded,
}: {
  card: ScoreDeckCard;
  cardIndex: number;
  layerIndex: number;
  deckWidth: number;
  cardHeight: number;
  imageSize: number;
  bottomSpacerHeight: number;
  barMaxWidth: number;
  screenWidth: number;
  threshold: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  activeIndex: SharedValue<number>;
  cardCount: number;
  embedded?: boolean;
}) {
  const secondY = cardHeight * (embedded ? 0.072 : 0.074);
  const thirdY = cardHeight * (embedded ? 0.132 : 0.136);
  const scorePct = Math.max(0, Math.min(100, card.score));
  const scoreWidth = Math.max(0, barMaxWidth * (scorePct / 100));

  const animatedStyle = useAnimatedStyle(() => {
    const rawRelative = cardIndex - activeIndex.value;
    const relative = ((rawRelative % cardCount) + cardCount) % cardCount;

    if (relative === 0) {
      const rotate = interpolate(
        translateX.value,
        [-screenWidth, 0, screenWidth],
        [-12, 0, 8],
        Extrapolation.CLAMP,
      );

      return {
        opacity: 1,
        zIndex: 30,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${rotate}deg` },
        ],
      };
    }

    if (relative > 2) {
      return {
        opacity: 0,
        zIndex: 0,
        transform: [
          { translateY: thirdY },
          { scale: 0.918 },
        ],
      };
    }

    const relativeBaseY = relative === 1 ? secondY : thirdY;
    const relativeNextY = relative === 1 ? 0 : secondY;
    const relativeBaseScale = relative === 1 ? 0.958 : 0.918;
    const relativeNextScale = relative === 1 ? 1 : 0.958;
    const relativeBaseOpacity = relative === 1 ? 0.86 : 0.62;
    const relativeNextOpacity = relative === 1 ? 1 : 0.86;
    const promote = interpolate(
      Math.abs(translateX.value),
      [0, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: interpolate(promote, [0, 1], [relativeBaseOpacity, relativeNextOpacity]),
      zIndex: relative === 1 ? 20 : 10,
      transform: [
        { translateY: interpolate(promote, [0, 1], [relativeBaseY, relativeNextY]) },
        { scale: interpolate(promote, [0, 1], [relativeBaseScale, relativeNextScale]) },
      ],
    };
  }, [
    activeIndex,
    cardIndex,
    cardCount,
    screenWidth,
    secondY,
    threshold,
    thirdY,
  ]);

  const barProgress = useDerivedValue(() => {
    const rawRelative = cardIndex - activeIndex.value;
    const relative = ((rawRelative % cardCount) + cardCount) % cardCount;
    const underCardIsPeeking = relative === 1 && Math.abs(translateX.value) > 8;
    const shouldFill = relative === 0 || underCardIsPeeking;

    return withTiming(shouldFill ? 1 : 0, {
      duration: relative === 0 ? 0 : shouldFill ? 1350 : 320,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [activeIndex, cardCount, cardIndex]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: scoreWidth * barProgress.value,
  }), [scoreWidth]);

  return (
    <Animated.View
      key={`${card.label}-${layerIndex}`}
      pointerEvents="none"
      style={[
        styles.layer,
        {
          width: deckWidth,
          height: cardHeight,
        },
        animatedStyle,
      ]}
    >
      <ScoreCard
        card={card}
        barFillStyle={barFillStyle}
        embedded={embedded}
        imageSize={imageSize}
        bottomSpacerHeight={bottomSpacerHeight}
      />
    </Animated.View>
  );
}

export default function StackedScoreDeckPreview({
  metrics,
  totalScore = 0,
  dashboardMetrics = [],
  overallDelta = null,
  viewportWidth,
  embedded = false,
  showHeader = true,
  showReset = true,
  showControls = true,
  showBackground = true,
}: Props) {
  const { width, height } = useWindowDimensions();
  const { data: onboardingData } = useOnboarding();
  const gender = onboardingData?.gender;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const activeIndexValue = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const cards = useMemo(() => {
    if (!metrics) return PREVIEW_CARDS;

    const scoreMap: Record<string, number> = { Overall: totalScore };
    for (const metric of metrics) scoreMap[metric.label] = metric.score;

    const deltaMap: Record<string, { delta: number; direction: "up" | "down" | "flat" }> = {};
    for (const dm of dashboardMetrics) {
      const label = API_KEY_TO_LABEL[dm.key];
      if (label) deltaMap[label] = { delta: dm.delta, direction: dm.direction };
    }
    if (overallDelta != null) {
      deltaMap.Overall = {
        delta: overallDelta,
        direction: overallDelta > 0 ? "up" : overallDelta < 0 ? "down" : "flat",
      };
    }

    return CARD_ORDER.map((label) => {
      const score = scoreMap[label] ?? 0;
      const displayLabel =
        label === "Masculinity/Femininity"
          ? gender === "female" ? "Femininity" : "Masculinity"
          : label;
      return {
        label,
        displayLabel,
        score,
        tier: getTierLabel(label, score),
        image: CARD_IMAGES[label],
      };
    });
  }, [dashboardMetrics, gender, metrics, overallDelta, totalScore]);

  const cardCount = cards.length;
  const threshold = width * 0.24;
  const availableWidth = Math.max(1, viewportWidth ?? width - SP[5] * 2);
  const availableHeight = Math.max(1, height);
  const cardWidthRatio = embedded ? 0.78 : 0.82;
  const maxDeckWidth = availableWidth - availableWidth * 0.21;
  const deckWidth = Math.round(Math.min(availableWidth * cardWidthRatio, maxDeckWidth));
  const cardHeight = Math.round(
    Math.min(
      availableHeight * (embedded ? 0.31 : 0.47),
      deckWidth * (embedded ? 0.98 : 1.14),
    ),
  );
  const imageSize = Math.round(
    Math.min(
      deckWidth * (embedded ? 0.58 : 0.56),
      cardHeight * (embedded ? 0.48 : 0.48),
    ),
  );
  const bottomSpacerHeight = Math.round(cardHeight * (embedded ? 0.085 : 0.09));
  const controlSize = Math.round(
    Math.min(
      availableWidth * (embedded ? 0.105 : 0.11),
      availableHeight * (embedded ? 0.05 : 0.055),
    ),
  );
  const sideGap = Math.max(0, (availableWidth - deckWidth) / 2);
  const sideControlInset = Math.max(0, Math.round((sideGap - controlSize) / 2));
  const controlTop = Math.max(
    cardHeight * 0.04,
    Math.round(cardHeight * (embedded ? 0.07 : 0.08) + imageSize * 0.5 - controlSize * 0.5),
  );
  const stageHeight = Math.round(cardHeight * (embedded ? 1.18 : 1.15));

  const resetDrag = () => {
    "worklet";
    translateX.value = withSpring(0, { damping: 17, stiffness: 180 });
    translateY.value = withSpring(0, { damping: 17, stiffness: 180 });
  };

  const completeCardExit = (direction: -1 | 1, exitY = 0) => {
    "worklet";
    translateX.value = withTiming(direction * width * 1.18, { duration: 230 }, (finished) => {
      if (finished) {
        const nextIndex = (activeIndexValue.value + 1) % cardCount;
        activeIndexValue.value = nextIndex;
        translateX.value = 0;
        translateY.value = 0;
        runOnJS(setActiveIndex)(nextIndex);
      }
    });
    translateY.value = withTiming(exitY * 0.32, { duration: 230 });
  };

  const advanceFromButton = (step: -1 | 1, exitDirection: -1 | 1) => {
    const nextIndex = getWrappedIndex(activeIndex + step, cardCount);

    translateX.value = withTiming(exitDirection * width * 1.18, { duration: 230 }, (finished) => {
      if (finished) {
        activeIndexValue.value = nextIndex;
        translateX.value = 0;
        translateY.value = 0;
        runOnJS(setActiveIndex)(nextIndex);
      }
    });
    translateY.value = withTiming(0, { duration: 230 });
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-3, 3])
        .onBegin(() => {
          cancelAnimation(translateX);
          cancelAnimation(translateY);
        })
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          const direction = event.translationX >= 0 ? 1 : -1;
          const shouldExit = Math.abs(event.translationX) > threshold || Math.abs(event.velocityX) > 850;
          if (shouldExit) {
            completeCardExit(direction, event.translationY);
            return;
          }

          resetDrag();
        })
        .onFinalize((_, success) => {
          if (!success) {
            resetDrag();
          }
        }),
    [activeIndexValue, cardCount, threshold, translateX, translateY, width],
  );

  const content = (
    <View style={[styles.root, embedded && styles.rootEmbedded]}>
      {showHeader ? (
        <View style={styles.headerCopy}>
        <Text style={styles.title}>Your Scores</Text>
        <Text style={styles.subtitle}>Stacked card deck preview</Text>
        </View>
      ) : null}

      <View style={[styles.deckShell, { width: availableWidth, height: stageHeight }]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            collapsable={false}
            style={[styles.deckStage, { width: deckWidth, height: stageHeight }]}
          >
            {[...cards].reverse().map((card) => {
              const cardIndex = cards.findIndex((item) => item.label === card.label);
              return (
                <DeckLayer
                  key={card.label}
                  card={card}
                  cardIndex={cardIndex}
                  layerIndex={cardIndex}
                  deckWidth={deckWidth}
                  cardHeight={cardHeight}
                  imageSize={imageSize}
                  bottomSpacerHeight={bottomSpacerHeight}
                  barMaxWidth={Math.max(0, deckWidth - (embedded ? SP[4] : SP[5]) * 2)}
                  screenWidth={width}
                  threshold={threshold}
                  translateX={translateX}
                  translateY={translateY}
                  activeIndex={activeIndexValue}
                  cardCount={cardCount}
                  embedded={embedded}
                />
              );
            })}
          </Animated.View>
        </GestureDetector>

        {showControls ? (
          <View pointerEvents="box-none" style={styles.sideControls}>
            <Pressable
              onPress={() => advanceFromButton(-1, 1)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Previous score card"
              style={({ pressed }) => [
                styles.sideArrowButton,
                {
                  width: controlSize,
                  height: controlSize,
                  borderRadius: controlSize / 2,
                  top: controlTop,
                  left: sideControlInset,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <ChevronLeft color="#FFFFFF" size={embedded ? 21 : 23} strokeWidth={3.1} />
            </Pressable>
            <Pressable
              onPress={() => advanceFromButton(1, -1)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Next score card"
              style={({ pressed }) => [
                styles.sideArrowButton,
                {
                  width: controlSize,
                  height: controlSize,
                  borderRadius: controlSize / 2,
                  top: controlTop,
                  right: sideControlInset,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <ChevronRight color="#FFFFFF" size={embedded ? 21 : 23} strokeWidth={3.1} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.counterPill}>
          <Text style={styles.counterCurrent}>{activeIndex + 1}</Text>
          <Text style={styles.counterTotal}> / {cardCount}</Text>
        </View>
        {showReset ? <Pressable
          onPress={() => {
            translateX.value = 0;
            translateY.value = 0;
            activeIndexValue.value = 0;
            setActiveIndex(0);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset score deck preview"
          style={styles.resetButton}
        >
          <RotateCcw color={COLORS.lightText} size={18} strokeWidth={2.4} />
        </Pressable> : null}
      </View>
    </View>
  );

  if (!showBackground) return content;

  return (
    <LinearGradient
      colors={["#F6F0FF", "#F9FBFF", "#DFF2FF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientRoot}
    >
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    paddingBottom: SP[6],
    gap: sh(22),
  },
  gradientRoot: {
    flex: 1,
  },
  rootEmbedded: {
    flex: 0,
    width: "100%",
    paddingHorizontal: 0,
    paddingBottom: 0,
    gap: sh(8),
  },
  headerCopy: {
    alignSelf: "stretch",
    gap: sh(4),
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(30),
    lineHeight: ms(34),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightMuted,
    letterSpacing: 0,
  },
  deckStage: {
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "transparent",
  },
  deckShell: {
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: RADII.xl,
    borderWidth: 1,
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[5],
    shadowColor: "#2B2452",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
    overflow: "hidden",
  },
  cardEmbedded: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    borderRadius: RADII.lg,
  },
  cardBehind: {
    backgroundColor: "#FFFFFF",
  },
  cardContent: {
    width: "100%",
    alignItems: "center",
  },
  image: {
    width: ms(168, 0.85),
    height: ms(168, 0.85),
    marginTop: sh(8),
    marginBottom: sh(16),
  },
  imageEmbedded: {
    width: ms(148, 0.85),
    height: ms(148, 0.85),
    marginTop: sh(4),
    marginBottom: sh(12),
  },
  label: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 1.1,
    textAlign: "center",
    marginBottom: sh(5),
  },
  tier: {
    fontFamily: FONT,
    fontSize: ms(25),
    lineHeight: ms(29),
    color: COLORS.lightText,
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: sh(18),
  },
  tierEmbedded: {
    fontSize: ms(22),
    lineHeight: ms(26),
    marginBottom: SP[3],
  },
  barTrack: {
    width: "100%",
    height: sh(7),
    borderRadius: 999,
    backgroundColor: "rgba(11,11,11,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: sh(10),
  },
  scoreNum: {
    fontFamily: FONT,
    fontSize: ms(18),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  scoreUnit: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
  },
  sideControls: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  sideArrowButton: {
    position: "absolute",
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  counterPill: {
    minHeight: Math.max(44, sh(44)),
    minWidth: sw(86),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: SP[4],
  },
  counterCurrent: {
    fontFamily: FONT,
    fontSize: ms(16),
    color: COLORS.lightText,
  },
  counterTotal: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
  },
  resetButton: {
    width: Math.max(44, sh(44)),
    height: Math.max(44, sh(44)),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButton: {
    width: Math.max(44, sh(44)),
    height: Math.max(44, sh(44)),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButtonEmbedded: {
    width: Math.max(44, sh(38)),
    height: Math.max(44, sh(38)),
    backgroundColor: COLORS.lightSurfaceAlt,
    borderColor: COLORS.lightBorder,
  },
});
