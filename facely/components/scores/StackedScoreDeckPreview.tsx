import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  FadeIn,
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { getTierLabel } from "./ScoringGrid";
import type { DashboardMetric } from "@/lib/api/insights";
import { useOnboarding } from "@/store/onboarding";
import { hapticLight } from "@/lib/haptics";

const FONT_REGULAR = "SFProRounded-Regular";
const FONT_SEMIBOLD = "SFProRounded-Semibold";
const FONT_BOLD = "SFProRounded-Bold";

const RECYCLE_DURATION_MS = 430;
const PROGRESS_DURATION_MS = 720;
const PROGRESS_DELAY_MS = 90;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

const SCORE_COLORS = {
  extremelyBad: "#F1495C",
  bad: "#FF9F45",
  average: "#FFD966",
  good: "#8FD14F",
  excellent: "#3DB4F2",
} as const;

function getScoreColor(score: number) {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped <= 25) return SCORE_COLORS.extremelyBad;
  if (clamped <= 40) return SCORE_COLORS.bad;
  if (clamped <= 63) return SCORE_COLORS.average;
  if (clamped <= 81) return SCORE_COLORS.good;
  return SCORE_COLORS.excellent;
}

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
  "Jawline",
  "Cheekbones",
  "Eye Symmetry",
  "Facial Symmetry",
  "Masculinity/Femininity",
  "Skin Quality",
  "Nose Balance",
  "Overall",
] as const;

type ScoreDeckCard = {
  label: string;
  displayLabel: string;
  score: number;
  tier: string;
  image: any;
  delta: number | null;
  direction?: "up" | "down" | "flat";
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
      delta: null,
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
  onActiveCardChange?: (card: { label: string; score: number; index: number; count: number }) => void;
};

function getWrappedIndex(index: number, count: number) {
  "worklet";
  return ((index % count) + count) % count;
}

function ScoreProgress({
  score,
  color,
  active,
  reduceMotion,
  maxWidth,
}: {
  score: number;
  color: string;
  active: boolean;
  reduceMotion: boolean;
  maxWidth: number;
}) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const targetWidth = Math.max(0, maxWidth * (clampedScore / 100));
  const progress = useSharedValue(active ? 0 : targetWidth);

  useEffect(() => {
    cancelAnimation(progress);

    if (!active) {
      progress.set(0);
      return;
    }

    progress.set(0);
    progress.set(
      withDelay(
        reduceMotion ? 0 : PROGRESS_DELAY_MS,
        withTiming(targetWidth, {
          duration: reduceMotion ? 140 : PROGRESS_DURATION_MS,
          easing: EASE_OUT,
        }),
      ),
    );

    return () => cancelAnimation(progress);
  }, [active, progress, reduceMotion, targetWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.get(),
  }));

  return (
    <View
      style={styles.progressTrack}
      accessibilityLabel={`${clampedScore} percent`}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.progressFill, { backgroundColor: color }, fillStyle]}
      />
      <Text style={styles.progressValue}>{clampedScore}%</Text>
    </View>
  );
}

function ScoreCard({
  card,
  embedded,
  imageSize,
  active,
  reduceMotion,
  progressWidth,
}: {
  card: ScoreDeckCard;
  embedded?: boolean;
  imageSize: number;
  active: boolean;
  reduceMotion: boolean;
  progressWidth: number;
}) {
  const scoreColor = getScoreColor(card.score);

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        styles.cardBehind,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${card.displayLabel}, ${card.tier}, ${Math.round(card.score)} percent`}
    >
      <View style={styles.cardContent}>
        <View style={[styles.imageWell, embedded && styles.imageWellEmbedded]}>
          <Image
            source={card.image}
            style={[
              styles.image,
              embedded && styles.imageEmbedded,
              { width: imageSize, height: imageSize },
            ]}
            resizeMode="contain"
          />
        </View>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.tier, embedded && styles.tierEmbedded]}
        >
          {card.tier}
        </Text>

        <ScoreProgress
          score={card.score}
          color={scoreColor}
          active={active}
          reduceMotion={reduceMotion}
          maxWidth={progressWidth}
        />
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
  screenWidth,
  translateX,
  translateY,
  transitionProgress,
  recycleProgress,
  navigationStep,
  activeIndex,
  cardCount,
  embedded,
  activeCardIndex,
  reduceMotion,
  progressWidth,
}: {
  card: ScoreDeckCard;
  cardIndex: number;
  layerIndex: number;
  deckWidth: number;
  cardHeight: number;
  imageSize: number;
  screenWidth: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  transitionProgress: SharedValue<number>;
  recycleProgress: SharedValue<number>;
  navigationStep: SharedValue<number>;
  activeIndex: SharedValue<number>;
  cardCount: number;
  embedded?: boolean;
  activeCardIndex: number;
  reduceMotion: boolean;
  progressWidth: number;
}) {
  const secondY = cardHeight * (embedded ? 0.052 : 0.058);
  const thirdY = cardHeight * (embedded ? 0.096 : 0.106);
  // Responsive helpers call React Native's PixelRatio native module. Resolve
  // them on the JS thread; a UI worklet cannot invoke that module synchronously.
  const secondX = sw(8);
  const thirdX = sw(5);
  const animatedStyle = useAnimatedStyle(() => {
    const rawRelative =
      navigationStep.get() < 0 && recycleProgress.get() > 0
        ? activeIndex.get() - cardIndex
        : cardIndex - activeIndex.get();
    const relative = ((rawRelative % cardCount) + cardCount) % cardCount;
    const recycle = recycleProgress.get();

    if (relative === 0) {
      const rotate = interpolate(
        translateX.get(),
        [-screenWidth, 0, screenWidth],
        reduceMotion ? [0, 0, 0] : [-10, 0, 10],
        Extrapolation.CLAMP,
      );

      return {
        opacity: interpolate(recycle, [0, 0.72, 1], [1, 0.9, 0.54]),
        zIndex: recycle > 0.56 ? 5 : 30,
        transform: [
          { translateX: translateX.get() },
          { translateY: translateY.get() },
          { rotate: `${rotate}deg` },
          { scale: interpolate(recycle, [0, 0.5, 1], [1, 0.965, 0.918]) },
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
    const relativeBaseOpacity = relative === 1 ? 0.9 : 0.66;
    const relativeNextOpacity = relative === 1 ? 1 : 0.9;
    const relativeBaseX = relative === 1 ? secondX : -thirdX;
    const relativeNextX = relative === 1 ? 0 : secondX;
    const relativeBaseRotate = reduceMotion ? 0 : relative === 1 ? 3.2 : -1.8;
    const relativeNextRotate = reduceMotion ? 0 : relative === 1 ? 0 : 3.2;
    const promote = Math.max(transitionProgress.get(), recycle);

    return {
      opacity: interpolate(promote, [0, 1], [relativeBaseOpacity, relativeNextOpacity]),
      zIndex: relative === 1 ? 20 : 10,
      transform: [
        { translateX: interpolate(promote, [0, 1], [relativeBaseX, relativeNextX]) },
        { translateY: interpolate(promote, [0, 1], [relativeBaseY, relativeNextY]) },
        {
          rotate: `${interpolate(
            promote,
            [0, 1],
            [relativeBaseRotate, relativeNextRotate],
          )}deg`,
        },
        { scale: interpolate(promote, [0, 1], [relativeBaseScale, relativeNextScale]) },
      ],
    };
  }, [
    activeIndex,
    cardIndex,
    cardCount,
    navigationStep,
    recycleProgress,
    reduceMotion,
    screenWidth,
    secondX,
    secondY,
    thirdX,
    thirdY,
    transitionProgress,
  ]);

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
        embedded={embedded}
        imageSize={imageSize}
        active={cardIndex === activeCardIndex}
        reduceMotion={reduceMotion}
        progressWidth={progressWidth}
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
  onActiveCardChange,
}: Props) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { data: onboardingData } = useOnboarding();
  const gender = onboardingData?.gender;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const transitionProgress = useSharedValue(0);
  const recycleProgress = useSharedValue(0);
  const navigationStep = useSharedValue(1);
  const gestureLocked = useSharedValue(0);
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
        delta: deltaMap[label]?.delta ?? null,
        direction: deltaMap[label]?.direction,
      };
    });
  }, [dashboardMetrics, gender, metrics, overallDelta, totalScore]);

  const cardCount = cards.length;
  const activeCard = cards[activeIndex] ?? cards[0];

  useEffect(() => {
    const activeCard = cards[activeIndex];
    if (!activeCard) return;
    onActiveCardChange?.({
      label: activeCard.label,
      score: activeCard.score,
      index: activeIndex,
      count: cardCount,
    });
  }, [activeIndex, cardCount, cards, onActiveCardChange]);
  const threshold = width * 0.24;
  const availableWidth = Math.max(1, viewportWidth ?? width - SP[5] * 2);
  const availableHeight = Math.max(1, height);
  const cardWidthRatio = embedded ? 0.74 : 0.82;
  const maxDeckWidth = availableWidth - availableWidth * (embedded ? 0.26 : 0.21);
  const deckWidth = Math.round(Math.min(availableWidth * cardWidthRatio, maxDeckWidth));
  const cardHeight = Math.round(
    Math.min(
      availableHeight * (embedded ? 0.45 : 0.49),
      deckWidth * (embedded ? 1.42 : 1.34),
    ),
  );
  const imageSize = Math.round(
    Math.min(
      deckWidth * (embedded ? 0.66 : 0.62),
      cardHeight * (embedded ? 0.47 : 0.46),
    ),
  );
  const controlSize = Math.round(
    Math.min(
      availableWidth * (embedded ? 0.105 : 0.11),
      availableHeight * (embedded ? 0.05 : 0.055),
    ),
  );
  const sideGap = Math.max(0, (availableWidth - deckWidth) / 2);
  const sideControlInset = Math.max(0, Math.round((sideGap - controlSize) / 2));
  const controlTop = Math.max(
    0,
    Math.round(cardHeight * 0.5 - controlSize * 0.5),
  );
  const stageHeight = Math.round(cardHeight * (embedded ? 1.11 : 1.14));
  const progressWidth = Math.max(
    0,
    deckWidth - (embedded ? SP[4] : SP[5]) * 2,
  );

  const resetDrag = (velocityX = 0, velocityY = 0) => {
    "worklet";
    const duration = reduceMotion ? 120 : 400;
    translateX.set(withSpring(0, { duration, dampingRatio: 0.86, velocity: velocityX }));
    translateY.set(withSpring(0, { duration, dampingRatio: 0.86, velocity: velocityY }));
    transitionProgress.set(
      withTiming(0, { duration: reduceMotion ? 80 : 180, easing: EASE_OUT }),
    );
    recycleProgress.set(0);
    navigationStep.set(1);
  };

  const completeCardRecycle = (
    step: -1 | 1,
    direction: -1 | 1,
    exitY = 0,
  ) => {
    "worklet";
    const duration = reduceMotion ? 140 : RECYCLE_DURATION_MS;
    const firstLeg = reduceMotion ? 45 : 150;
    const landingLeg = duration - firstLeg;
    const landingY = cardHeight * (embedded ? 0.096 : 0.106);

    navigationStep.set(step);
    transitionProgress.set(
      withTiming(1, {
        duration: reduceMotion ? 80 : 150,
        easing: EASE_OUT,
      }),
    );
    recycleProgress.set(
      withTiming(1, { duration, easing: EASE_IN_OUT }, (finished) => {
        if (!finished) return;

        const nextIndex = getWrappedIndex(activeIndexValue.get() + step, cardCount);
        activeIndexValue.set(nextIndex);
        translateX.set(0);
        translateY.set(0);
        transitionProgress.set(0);
        recycleProgress.set(0);
        navigationStep.set(1);
        scheduleOnRN(hapticLight);
        scheduleOnRN(setActiveIndex, nextIndex);
      }),
    );

    translateX.set(
      withSequence(
        withTiming(reduceMotion ? 0 : direction * width * 0.62, {
          duration: firstLeg,
          easing: EASE_OUT,
        }),
        withTiming(0, {
          duration: landingLeg,
          easing: EASE_IN_OUT,
        }),
      ),
    );
    translateY.set(
      withSequence(
        withTiming(reduceMotion ? 0 : exitY * 0.1 - cardHeight * 0.025, {
          duration: firstLeg,
          easing: EASE_OUT,
        }),
        withTiming(landingY, {
          duration: landingLeg,
          easing: EASE_IN_OUT,
        }),
      ),
    );
  };

  const advanceFromButton = useCallback((step: -1 | 1, exitDirection: -1 | 1) => {
    if (recycleProgress.get() > 0) return;
    completeCardRecycle(step, exitDirection);
  }, [cardCount, cardHeight, embedded, reduceMotion, width]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          if (recycleProgress.get() > 0) {
            gestureLocked.set(1);
            return;
          }

          gestureLocked.set(0);
          cancelAnimation(translateX);
          cancelAnimation(translateY);
          cancelAnimation(transitionProgress);
          cancelAnimation(recycleProgress);
          recycleProgress.set(0);
          navigationStep.set(1);
        })
        .onUpdate((event) => {
          if (gestureLocked.get() > 0) return;
          translateX.set(event.translationX);
          translateY.set(event.translationY * 0.28);
          transitionProgress.set(
            Math.max(0, Math.min(1, Math.abs(event.translationX) / threshold)),
          );
        })
        .onEnd((event) => {
          if (gestureLocked.get() > 0) return;
          const direction = event.translationX >= 0 ? 1 : -1;
          const shouldExit =
            Math.abs(event.translationX) > threshold ||
            Math.abs(event.velocityX) > 820;

          if (shouldExit) {
            completeCardRecycle(1, direction, event.translationY);
            return;
          }

          resetDrag(event.velocityX, event.velocityY);
        })
        .onFinalize((_, success) => {
          const wasLocked = gestureLocked.get() > 0;
          gestureLocked.set(0);
          if (!success && !wasLocked) {
            resetDrag();
          }
        }),
    [
      activeIndexValue,
      cardHeight,
      cardCount,
      embedded,
      gestureLocked,
      navigationStep,
      recycleProgress,
      reduceMotion,
      threshold,
      transitionProgress,
      translateX,
      translateY,
      width,
    ],
  );

  const content = (
    <View style={[styles.root, embedded && styles.rootEmbedded]}>
      {showHeader ? (
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Your Scores</Text>
          <Text style={styles.subtitle}>Stacked card deck preview</Text>
        </View>
      ) : null}

      <View style={styles.metricHeading}>
        {activeCard ? (
          <Animated.View
            key={activeCard.label}
            entering={FadeIn.duration(reduceMotion ? 80 : 180).easing(EASE_OUT)}
            style={styles.metricHeadingLayer}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.metricName}
            >
              {activeCard.displayLabel}
            </Text>
          </Animated.View>
        ) : null}
      </View>

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
                  screenWidth={width}
                  translateX={translateX}
                  translateY={translateY}
                  transitionProgress={transitionProgress}
                  recycleProgress={recycleProgress}
                  navigationStep={navigationStep}
                  activeIndex={activeIndexValue}
                  cardCount={cardCount}
                  embedded={embedded}
                  activeCardIndex={activeIndex}
                  reduceMotion={reduceMotion}
                  progressWidth={progressWidth}
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
              <ChevronLeft color="#1C1C1E" size={embedded ? 21 : 23} strokeWidth={2.5} />
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
              <ChevronRight color="#1C1C1E" size={embedded ? 21 : 23} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.deckCounter}>
        <Text style={styles.deckCounterCurrent}>{activeIndex + 1}</Text>
        <Text style={styles.deckCounterTotal}> / {cardCount}</Text>
      </View>

      {showReset ? (
        <View style={styles.footerRow}>
          <Pressable
          onPress={() => {
            translateX.set(0);
            translateY.set(0);
            transitionProgress.set(0);
            recycleProgress.set(0);
            navigationStep.set(1);
            activeIndexValue.set(0);
            setActiveIndex(0);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset score deck preview"
          style={styles.resetButton}
          >
            <RotateCcw color={COLORS.lightText} size={18} strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : null}
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
    gap: sh(16),
  },
  gradientRoot: {
    flex: 1,
  },
  rootEmbedded: {
    flex: 0,
    width: "100%",
    paddingHorizontal: 0,
    paddingBottom: 0,
    gap: sh(7),
  },
  headerCopy: {
    alignSelf: "stretch",
    gap: sh(4),
  },
  title: {
    fontFamily: FONT_BOLD,
    fontSize: ms(30),
    lineHeight: ms(34),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(13),
    color: COLORS.lightMuted,
    letterSpacing: 0,
  },
  metricHeading: {
    width: "100%",
    height: sh(38),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  metricHeadingLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
  },
  metricName: {
    maxWidth: "100%",
    color: "#201F1D",
    fontFamily: FONT_SEMIBOLD,
    fontSize: ms(28, 0.18),
    lineHeight: ms(34),
    letterSpacing: -0.65,
    textAlign: "center",
    includeFontPadding: false,
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
    backgroundColor: "#FFFEFC",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#F0ECE7",
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[5],
    boxShadow: "0 18px 44px rgba(49, 42, 36, 0.14)",
    overflow: "hidden",
    position: "relative",
  },
  cardEmbedded: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    borderRadius: 30,
  },
  cardBehind: {
    backgroundColor: "#FFFEFC",
  },
  cardContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sh(16),
  },
  imageWell: {
    flex: 1,
    width: "100%",
    minHeight: sh(176),
    borderRadius: 25,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(111, 91, 76, 0.08)",
    backgroundColor: "#F8F1EC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageWellEmbedded: {
    minHeight: sh(170),
    borderRadius: 23,
  },
  image: {
    width: ms(168, 0.85),
    height: ms(168, 0.85),
  },
  imageEmbedded: {
    width: ms(132, 0.85),
    height: ms(132, 0.85),
  },
  tier: {
    width: "100%",
    fontFamily: FONT_BOLD,
    fontSize: ms(30, 0.16),
    lineHeight: ms(36),
    color: "#201F1D",
    letterSpacing: -0.75,
    textAlign: "center",
    includeFontPadding: false,
  },
  tierEmbedded: {
    fontSize: ms(28, 0.16),
    lineHeight: ms(34),
  },
  progressTrack: {
    width: "100%",
    height: Math.max(50, sh(54)),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D7D3CE",
    backgroundColor: "#F5F3F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  progressValue: {
    zIndex: 1,
    fontFamily: FONT_SEMIBOLD,
    fontSize: ms(22, 0.18),
    lineHeight: ms(26),
    color: "#201F1D",
    letterSpacing: -0.35,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  deckCounter: {
    minHeight: sh(20),
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  deckCounterCurrent: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: ms(14, 0.18),
    lineHeight: ms(18),
    color: "#242321",
    fontVariant: ["tabular-nums"],
  },
  deckCounterTotal: {
    fontFamily: FONT_REGULAR,
    fontSize: ms(12, 0.18),
    lineHeight: ms(16),
    color: "rgba(36,35,33,0.48)",
    fontVariant: ["tabular-nums"],
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
  },
  sideControls: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  sideArrowButton: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,28,30,0.10)",
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px rgba(30, 27, 24, 0.12)",
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
});
