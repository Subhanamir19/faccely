import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADII, SP } from "@/lib/tokens";
import { getRoutineFocusContent } from "@/lib/routineFocus";
import type { DailyTask } from "@/store/tasks";
import type { TargetArea } from "@/lib/taskSelection";
import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";

const STREAK_PREVIEW_ICON = require("../../assets/icons/streak-icon.png");
const DUMBBELL_EXERCISE_ICON = require("../../assets/icons/dumbell-exercise.png");
const ATTR_ICON_HARMONY = require("../../assets/attractiveness-icons/harmony.png");
const ATTR_ICON_DIMORPHISM = require("../../assets/attractiveness-icons/dimorphism.png");
const ATTR_ICON_ANGULARITY = require("../../assets/attractiveness-icons/angularity.png");
const ATTR_ICON_SKIN_QUALITY = require("../../assets/attractiveness-icons/skin-quality.png");

const ROUTINE_BUILD_SEQUENCE_MS = 6380;
type IntroStep = "focus" | "benefits" | "choice" | "choosing";

function getTabAwareBottomPadding(bottomInset: number) {
  return Math.max(bottomInset, 8) +
    FLOATING_TAB_BAR.pillHeight +
    FLOATING_TAB_BAR.gapBottom +
    FLOATING_TAB_BAR.raisedControlGap;
}

function splitHighlight(text: string, phrase: string) {
  const start = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (start < 0) return { before: text, match: "", after: "" };
  const end = start + phrase.length;
  return {
    before: text.slice(0, start),
    match: text.slice(start, end),
    after: text.slice(end),
  };
}

function HighlightedLine({
  text,
  phrase,
  style,
}: {
  text: string;
  phrase: string;
  style: any;
}) {
  const parts = splitHighlight(text, phrase);
  return (
    <Text style={style} numberOfLines={3} adjustsFontSizeToFit>
      {parts.before}
      {parts.match ? <Text style={styles.highlightText}>{parts.match}</Text> : null}
      {parts.after}
    </Text>
  );
}

function TopRail({
  title,
  currentStreak,
}: {
  title: string;
  currentStreak: number;
}) {
  return (
    <View style={styles.topRail}>
      <View style={styles.headerSpacer} />
      <Text style={styles.brandText} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      <View style={styles.streakBadge} accessibilityLabel={`${currentStreak} day streak`}>
        <Image
          source={STREAK_PREVIEW_ICON}
          style={styles.streakIcon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.streakText}>{currentStreak}</Text>
      </View>
    </View>
  );
}

function FocusScreen({
  currentStreak,
  image,
  intro,
  phrase,
  onContinue,
}: {
  currentStreak: number;
  image: any;
  intro: string;
  phrase: string;
  onContinue: () => void;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const [typedPrompt, setTypedPrompt] = useState("");

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [float, pulse]);

  useEffect(() => {
    setTypedPrompt("");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedPrompt(intro.slice(0, index));
      if (index >= intro.length) clearInterval(timer);
    }, 38);
    return () => clearInterval(timer);
  }, [intro]);

  const imageMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.screen}>
      <TopRail title="TODAY'S FOCUS" currentStreak={currentStreak} />
      <View style={styles.focusContent}>
        <View style={styles.stickerStage}>
          <View style={styles.stickerBase} />
          <Animated.View style={[styles.animatedSticker, imageMotionStyle]}>
            <Image
              source={image}
              style={styles.stickerShapeShadow}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Image
              source={image}
              style={styles.sticker}
              resizeMode="contain"
              accessibilityLabel="Today routine focus"
            />
          </Animated.View>
        </View>
        <HighlightedLine text={typedPrompt} phrase={phrase} style={styles.prompt} />
      </View>
      <BottomButton label="CONTINUE" onPress={onContinue} />
      </SafeAreaView>
    </AppGradientBackground>
  );
}

function BenefitsScreen({
  currentStreak,
  headline,
  body,
  phrase,
  onContinue,
}: {
  currentStreak: number;
  headline: string;
  body: string;
  phrase: string;
  onContinue: () => void;
}) {
  const [typedLineOne, setTypedLineOne] = useState("");
  const [typedLineTwo, setTypedLineTwo] = useState("");

  useEffect(() => {
    setTypedLineOne("");
    setTypedLineTwo("");
    let lineOneIndex = 0;
    let lineTwoIndex = 0;
    let lineTwoTimer: ReturnType<typeof setInterval> | null = null;

    const lineOneTimer = setInterval(() => {
      lineOneIndex += 1;
      setTypedLineOne(headline.slice(0, lineOneIndex));
      if (lineOneIndex >= headline.length) {
        clearInterval(lineOneTimer);
        lineTwoTimer = setInterval(() => {
          lineTwoIndex += 1;
          setTypedLineTwo(body.slice(0, lineTwoIndex));
          if (lineTwoIndex >= body.length && lineTwoTimer) clearInterval(lineTwoTimer);
        }, 34);
      }
    }, 38);

    return () => {
      clearInterval(lineOneTimer);
      if (lineTwoTimer) clearInterval(lineTwoTimer);
    };
  }, [body, headline]);

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.screen}>
      <TopRail title="WHY TODAY HELPS" currentStreak={currentStreak} />
      <View style={styles.benefitsContent}>
        <HighlightedLine text={typedLineOne} phrase={phrase} style={styles.benefitsHeadline} />
        <Text style={styles.benefitsBody}>{typedLineTwo}</Text>
      </View>
      <BottomButton label="CONTINUE" onPress={onContinue} />
      </SafeAreaView>
    </AppGradientBackground>
  );
}

function ChoiceScreen({
  currentStreak,
  onChooseForMe,
  onChooseMyself,
}: {
  currentStreak: number;
  onChooseForMe: () => void;
  onChooseMyself: () => void;
}) {
  const choiceInsets = useSafeAreaInsets();
  const float = useSharedValue(0);
  const tilt = useSharedValue(-9);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    tilt.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
        withTiming(-12, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [float, tilt]);

  const iconMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { rotateZ: `${tilt.value}deg` }],
  }));

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.screen}>
      <TopRail title="TODAY'S ROUTINE" currentStreak={currentStreak} />
      <View style={styles.choiceContent}>
        <View style={styles.choiceIconStage}>
          <Animated.View style={[styles.choiceIconWrap, iconMotionStyle]}>
            <Image
              source={DUMBBELL_EXERCISE_ICON}
              style={styles.choiceIcon}
              resizeMode="contain"
              accessibilityLabel="Exercise icon"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
        <Text style={styles.choiceQuestion}>Do you want us to choose today's exercises?</Text>
      </View>
      <View style={[styles.choiceBottomRail, { paddingBottom: getTabAwareBottomPadding(choiceInsets.bottom) }]}>
        <Pressable
          onPress={onChooseForMe}
          accessibilityRole="button"
          accessibilityLabel="Choose exercises for me"
          style={({ pressed }) => [styles.exerciseCtaButton, pressed && styles.exerciseCtaButtonPressed]}
        >
          <Text style={styles.exerciseCtaText}>CHOOSE FOR ME</Text>
        </Pressable>
        <Pressable
          onPress={onChooseMyself}
          accessibilityRole="button"
          accessibilityLabel="Let me choose exercises"
          style={({ pressed }) => [styles.secondaryChoiceButton, pressed && styles.secondaryChoiceButtonPressed]}
        >
          <Text style={styles.secondaryChoiceText}>I'LL CHOOSE</Text>
        </Pressable>
      </View>
      </SafeAreaView>
    </AppGradientBackground>
  );
}

function RoutineBuildTile({
  label,
  icon,
  progress,
  reveal,
  width,
}: {
  label: string;
  icon: any;
  progress: SharedValue<number>;
  reveal: SharedValue<number>;
  width: number;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: width * progress.value,
  }));
  const textRevealStyle = useAnimatedStyle(() => ({
    width: Math.max(0, width * progress.value - 20),
  }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 10 }],
  }));

  return (
    <Animated.View style={[styles.routineTileListed, { width }, revealStyle]}>
      <Animated.View style={[styles.routineTileFill, fillStyle]} />
      <Animated.View style={[styles.routineTileTextClip, textRevealStyle]}>
        <Text style={[styles.routineTileText, { width: width - 104 }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
      <Image source={icon} style={styles.routineTileWatermark} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

function ChoosingScreen({
  currentStreak,
  building,
  ready,
  phrase,
  onContinue,
}: {
  currentStreak: number;
  building: string;
  ready: string;
  phrase: string;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = Math.min(width - 76, 286);
  const fillOne = useSharedValue(0);
  const fillTwo = useSharedValue(0);
  const fillThree = useSharedValue(0);
  const fillFour = useSharedValue(0);
  const revealOne = useSharedValue(0);
  const revealTwo = useSharedValue(0);
  const revealThree = useSharedValue(0);
  const revealFour = useSharedValue(0);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setLoadingPercent(0);
    setIsComplete(false);

    revealOne.value = withSequence(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 220 }));
    revealTwo.value = withSequence(withTiming(0, { duration: 1520 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 1740 }));
    revealThree.value = withSequence(withTiming(0, { duration: 3040 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 3260 }));
    revealFour.value = withSequence(withTiming(0, { duration: 4560 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 4780 }));
    fillOne.value = withSequence(withTiming(0, { duration: 220 }), withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 1720 }));
    fillTwo.value = withSequence(withTiming(0, { duration: 1740 }), withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 3240 }));
    fillThree.value = withSequence(withTiming(0, { duration: 3260 }), withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 4760 }));
    fillFour.value = withSequence(withTiming(0, { duration: 4780 }), withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 6280 }));

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const nextPercent = Math.min(100, Math.round(((Date.now() - startedAt) / ROUTINE_BUILD_SEQUENCE_MS) * 100));
      setLoadingPercent(nextPercent);
      if (nextPercent >= 100) {
        clearInterval(timer);
        setIsComplete(true);
      }
    }, 80);

    return () => clearInterval(timer);
  }, [fillFour, fillOne, fillThree, fillTwo, revealFour, revealOne, revealThree, revealTwo]);

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.screen}>
      <TopRail title="BUILDING ROUTINE" currentStreak={currentStreak} />
      <View style={styles.choosingContent}>
        <View style={[styles.routineListStage, { width: tileWidth }]}>
          <RoutineBuildTile label="Targeting exact parts" icon={ATTR_ICON_HARMONY} progress={fillOne} reveal={revealOne} width={tileWidth} />
          <RoutineBuildTile label="Focusing on proportions" icon={ATTR_ICON_DIMORPHISM} progress={fillTwo} reveal={revealTwo} width={tileWidth} />
          <RoutineBuildTile label="Looking at every face part" icon={ATTR_ICON_ANGULARITY} progress={fillThree} reveal={revealThree} width={tileWidth} />
          <RoutineBuildTile label="Beautifying harmony" icon={ATTR_ICON_SKIN_QUALITY} progress={fillFour} reveal={revealFour} width={tileWidth} />
        </View>
        <View
          style={[styles.routineProgressRow, { width: tileWidth }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: loadingPercent }}
        >
          <View style={styles.routineProgressTrack}>
            <View style={[styles.routineProgressFill, { width: `${loadingPercent}%` }]} />
          </View>
          <Text style={styles.routineProgressText}>{loadingPercent}%</Text>
        </View>
        {isComplete ? (
          <Animated.Text
            entering={FadeInDown.duration(380).springify().damping(13).stiffness(170)}
            style={styles.choosingText}
          >
            {ready}
          </Animated.Text>
        ) : (
          <HighlightedLine text={building} phrase={phrase} style={styles.choosingText} />
        )}
      </View>
      <View style={[styles.bottomRail, { paddingBottom: getTabAwareBottomPadding(insets.bottom) }]}>
        {isComplete ? <BottomButton label="CONTINUE" onPress={onContinue} noOuterRail /> : <View style={styles.exerciseCtaPlaceholder} />}
      </View>
      </SafeAreaView>
    </AppGradientBackground>
  );
}

function BottomButton({
  label,
  onPress,
  noOuterRail,
}: {
  label: string;
  onPress: () => void;
  noOuterRail?: boolean;
}) {
  const buttonInsets = useSafeAreaInsets();
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.exerciseCtaButton, pressed && styles.exerciseCtaButtonPressed]}
    >
      <Text style={styles.exerciseCtaText}>{label}</Text>
    </Pressable>
  );
  if (noOuterRail) return button;
  return <View style={[styles.bottomRail, { paddingBottom: getTabAwareBottomPadding(buttonInsets.bottom) }]}>{button}</View>;
}

export default function DailyRoutineIntroFlow({
  tasks,
  selectedAreas,
  currentStreak,
  onReviewRoutine,
  onChooseMyself,
}: {
  tasks: DailyTask[];
  selectedAreas: TargetArea[] | null;
  currentStreak: number;
  onReviewRoutine: () => void;
  onChooseMyself: () => void;
}) {
  const [step, setStep] = useState<IntroStep>("focus");
  const focus = useMemo(() => getRoutineFocusContent(tasks, selectedAreas), [tasks, selectedAreas]);

  if (step === "focus") {
    return (
      <FocusScreen
        currentStreak={currentStreak}
        image={focus.image}
        intro={focus.intro}
        phrase={focus.phrase}
        onContinue={() => setStep("benefits")}
      />
    );
  }

  if (step === "benefits") {
    return (
      <BenefitsScreen
        currentStreak={currentStreak}
        headline={focus.benefitHeadline}
        body={focus.benefitBody}
        phrase={focus.phrase}
        onContinue={() => setStep("choice")}
      />
    );
  }

  if (step === "choice") {
    return (
      <ChoiceScreen
        currentStreak={currentStreak}
        onChooseForMe={() => setStep("choosing")}
        onChooseMyself={onChooseMyself}
      />
    );
  }

  return (
    <ChoosingScreen
      currentStreak={currentStreak}
      building={focus.building}
      ready={focus.ready}
      phrase={focus.phrase}
      onContinue={onReviewRoutine}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topRail: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  headerSpacer: {
    width: 52,
    height: 52,
  },
  brandText: {
    flex: 1,
    color: "#58CC02",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  streakBadge: {
    minWidth: 52,
    height: 38,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  streakIcon: {
    width: 24,
    height: 24,
  },
  streakText: {
    color: "#111111",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0,
  },
  focusContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 86,
  },
  stickerStage: {
    width: 318,
    height: 318,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stickerBase: {
    position: "absolute",
    top: 194,
    width: 136,
    height: 64,
    borderRadius: 64,
    backgroundColor: "#EEF2EC",
    transform: [{ scaleX: 1.08 }],
  },
  animatedSticker: {
    width: 268,
    height: 268,
  },
  stickerShapeShadow: {
    position: "absolute",
    width: "100%",
    height: "100%",
    tintColor: "#000000",
    opacity: 0.12,
    transform: [{ translateY: 8 }, { scale: 1.01 }],
  },
  sticker: {
    width: "100%",
    height: "100%",
  },
  prompt: {
    maxWidth: 326,
    minHeight: 120,
    color: "#111111",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 27,
    lineHeight: 40,
    letterSpacing: 0,
    textAlign: "center",
  },
  highlightText: {
    color: "#58CC02",
    fontFamily: "DINNextRounded-Regular",
  },
  benefitsContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingBottom: 72,
  },
  benefitsHeadline: {
    maxWidth: 334,
    color: "#111111",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 31,
    lineHeight: 42,
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: 18,
  },
  benefitsBody: {
    maxWidth: 330,
    color: "#5E625F",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 21,
    lineHeight: 32,
    letterSpacing: 0,
    textAlign: "center",
  },
  choiceContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingBottom: 56,
  },
  choiceIconStage: {
    width: 178,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  choiceIconWrap: {
    width: 148,
    height: 148,
  },
  choiceIcon: {
    width: "100%",
    height: "100%",
  },
  choiceQuestion: {
    maxWidth: 330,
    color: "#111111",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 31,
    lineHeight: 42,
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: 18,
  },
  choosingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingBottom: 18,
  },
  routineListStage: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 22,
  },
  routineTileListed: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    justifyContent: "center",
    paddingLeft: 20,
    paddingRight: 84,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  routineTileFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#111111",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  routineTileTextClip: {
    overflow: "hidden",
    zIndex: 2,
  },
  routineTileText: {
    color: "#FFFFFF",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
  },
  routineTileWatermark: {
    position: "absolute",
    right: -8,
    width: 84,
    height: 84,
    opacity: 1,
    transform: [{ rotateZ: "-8deg" }],
  },
  routineProgressRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  routineProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  routineProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#111111",
  },
  routineProgressText: {
    width: 42,
    color: "#111111",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
    textAlign: "right",
  },
  choosingText: {
    maxWidth: 326,
    color: "#111111",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 29,
    lineHeight: 38,
    letterSpacing: 0,
    textAlign: "center",
  },
  bottomRail: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 26,
  },
  choiceBottomRail: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 26,
  },
  exerciseCtaPlaceholder: {
    minHeight: 58,
  },
  exerciseCtaButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#0B0B0B",
    borderBottomWidth: 6,
    borderBottomColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  exerciseCtaButtonPressed: {
    transform: [{ translateY: 4 }],
    borderBottomWidth: 3,
  },
  exerciseCtaText: {
    color: "#FFFFFF",
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  secondaryChoiceButton: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 18,
  },
  secondaryChoiceButtonPressed: {
    backgroundColor: "#F3F4F6",
  },
  secondaryChoiceText: {
    color: "#111111",
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
