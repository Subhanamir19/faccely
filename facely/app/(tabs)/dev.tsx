// app/(tabs)/dev.tsx
// Developer tooling screen — only reachable in __DEV__ builds.

import React, { useState, useEffect, useCallback } from "react";
import { Asset } from "expo-asset";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
} from "react-native";
import InsightRevealCard from "@/components/scores/InsightRevealCard";
import StackedScoreDeckPreview from "@/components/scores/StackedScoreDeckPreview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import LottieView from "lottie-react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import T from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ConsentModalInner } from "@/hooks/useAdvancedAnalysisConsent";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import ComebackModal from "@/components/ui/ComebackModal";
import StreakCelebrationModal from "@/components/ui/StreakCelebrationModal";
import HalfwayHypeModal from "@/components/ui/HalfwayHypeModal";
import DidYouKnowModal from "@/components/ui/DidYouKnowModal";
import { resetAllLifeModalFlags, DID_YOU_KNOW_FACTS } from "@/lib/lifeModals";
import { useTasksStore } from "@/store/tasks";
import { BlueprintModal } from "@/components/analysis/BlueprintModal";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useScores } from "@/store/scores";
import { usePotentialFace } from "@/store/potentialFace";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import ProgramHero from "@/components/program/ProgramHero";
import ProgramLoadingScreen, { PROGRAM_LOADING_BG } from "@/components/program/ProgramLoadingScreen";
import InsightPulseCard, { PulseType } from "@/components/ui/InsightPulseCard";
import { useNotifications } from "@/store/notifications";
import RingLoader, { type RingLoaderKind } from "@/components/ui/RingLoader";
import { Image as RNImage } from "react-native";
import { API_BASE } from "@/lib/api/config";
import { buildAuthHeadersAsync } from "@/lib/api/authHeaders";
import {
  AlarmClock,
  Aperture,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  Flame,
  Home,
  Pause,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import SpeechBubble from "@/components/program/SpeechBubble";
import { CARD_FACE_IMAGES } from "@/lib/faceTargets";

const FONT = "ProximaNova-Bold";

const DASH_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONSENT_KEY = "advanced_analysis_consent";
const LOWER_FACE_PREVIEW_STICKER = require("../../assets/preview-screen-images/lower-face.png");
const MIDFACE_PREVIEW_STICKER = require("../../assets/preview-screen-images/midface.png");
const FULL_FACE_PREVIEW_STICKER = require("../../assets/preview-screen-images/full-face.png");
const STREAK_PREVIEW_ICON = require("../../assets/icons/streak-icon.png");
const DUMBBELL_EXERCISE_ICON = require("../../assets/icons/dumbell-exercise.png");
const ATTR_ICON_HARMONY = require("../../assets/attractiveness-icons/harmony.png");
const ATTR_ICON_DIMORPHISM = require("../../assets/attractiveness-icons/dimorphism.png");
const ATTR_ICON_ANGULARITY = require("../../assets/attractiveness-icons/angularity.png");
const ATTR_ICON_SKIN_QUALITY = require("../../assets/attractiveness-icons/skin-quality.png");
const EXERCISE_INTRO_PROMPT = "We are about to sculpt your lower face today";
const EXERCISE_INTRO_TARGET = "lower face";
const EXERCISE_BENEFITS_LINE_ONE = "Today builds a cleaner lower face.";
const EXERCISE_BENEFITS_LINE_TWO = "Each rep supports sharper jawline posture and tighter under-chin control.";
const ROUTINE_BUILD_TILE_WIDTH = 286;
const ROUTINE_BUILD_SEQUENCE_MS = 6380;
type ExercisePreviewStep = "focus" | "benefits" | "choice" | "choosing";

// Actual sequence the user sees from a fresh install.
// Entry is /(onboarding)/splash (see app/index.tsx). Each step's router.push
// traced to confirm the chain. End: /(tabs)/program.
const ONBOARDING_FLOW_SCREENS: { label: string; route: string }[] = [
  { label: "Splash",            route: "/(onboarding)/splash" },           // → warmup
  { label: "Warmup",            route: "/(onboarding)/warmup" },           // → goals
  { label: "Goals",             route: "/(onboarding)/goals" },            // → gender
  { label: "Gender",            route: "/(onboarding)/gender" },           // → age
  { label: "Birthday",          route: "/(onboarding)/age" },              // → ethnicity
  { label: "Ethnicity",         route: "/(onboarding)/ethnicity" },        // → scan
  { label: "Scan",              route: "/(onboarding)/scan" },             // → trust
  { label: "Trust",             route: "/(onboarding)/trust" },            // → time-dedication
  { label: "Time Dedication",   route: "/(onboarding)/time-dedication" },  // → score-projection
  { label: "Score Projection",  route: "/(onboarding)/score-projection" }, // → features
  { label: "Features",          route: "/(onboarding)/features" },         // → transformation
  { label: "Transformation",    route: "/(onboarding)/transformation" },   // → paywall
  { label: "Paywall",           route: "/(onboarding)/paywall" },          // → potential face workflow
  { label: "Potential Face",    route: "/(onboarding)/potential-face-reveal" }, // → analysis intro
  { label: "Analysis Intro",    route: "/(onboarding)/analysis-intro" },    // → bridge
  { label: "Analysis Bridge",   route: "/(onboarding)/potential-face-bridge" }, // → advanced analysis
  { label: "Plan Intro",        route: "/(onboarding)/plan-intro" },        // → routine-animation
  { label: "Routine Animation", route: "/(onboarding)/routine-animation" }, // → program
];

// Screens that exist but are NOT reachable from the main splash → potential-face flow.
// Preview only.
const ONBOARDING_ORPHANS: { label: string; route: string; note: string }[] = [
  { label: "Hook",            route: "/(onboarding)/hook",           note: "alt entry — only used by loading.tsx for returning users" },
  { label: "Intro",           route: "/(onboarding)/intro",          note: "routes to goals, but nothing routes to intro except hook" },
  { label: "Improve Areas",   route: "/(onboarding)/improve-areas",  note: "removed from live flow — duplicated goals selection" },
  { label: "Welcome",         route: "/(onboarding)/welcome",        note: "legacy entry — no inbound route" },
  { label: "Experience",      route: "/(onboarding)/experience",     note: "no inbound route" },
  { label: "Face Scan (alt)", route: "/(onboarding)/face-scan",      note: "alt to /scan" },
  { label: "Results Reveal",  route: "/(onboarding)/results-reveal", note: "legacy" },
  { label: "Score Teaser",    route: "/(onboarding)/score-teaser",    note: "legacy score reveal — removed from onboarding" },
  { label: "Building Plan",   route: "/(onboarding)/building-plan",  note: "unlinked" },
];

// ---------------------------------------------------------------------------
// Small reusable row button
// ---------------------------------------------------------------------------
function DevButton({
  label,
  onPress,
  accent,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.devBtn, accent && styles.devBtnAccent]}
    >
      <T style={[styles.devBtnText, accent && styles.devBtnTextAccent]}>{label}</T>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <T style={styles.sectionTitle}>{title}</T>
      {subtitle ? <T style={styles.sectionSubtitle}>{subtitle}</T> : null}
    </View>
  );
}

function ExerciseIntroPreviewCard({
  currentStreak,
  onClose,
  onContinue,
}: {
  currentStreak: number;
  onClose: () => void;
  onContinue?: () => void;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const [typedPrompt, setTypedPrompt] = useState("");

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1350, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [float, pulse]);

  useEffect(() => {
    setTypedPrompt("");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedPrompt(EXERCISE_INTRO_PROMPT.slice(0, index));
      if (index >= EXERCISE_INTRO_PROMPT.length) clearInterval(timer);
    }, 38);

    return () => clearInterval(timer);
  }, []);

  const stickerMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  const targetStart = EXERCISE_INTRO_PROMPT.indexOf(EXERCISE_INTRO_TARGET);
  const targetEnd = targetStart + EXERCISE_INTRO_TARGET.length;
  const typedBeforeTarget =
    targetStart >= 0 ? typedPrompt.slice(0, Math.min(typedPrompt.length, targetStart)) : typedPrompt;
  const typedTarget =
    targetStart >= 0 && typedPrompt.length > targetStart
      ? typedPrompt.slice(targetStart, Math.min(typedPrompt.length, targetEnd))
      : "";
  const typedAfterTarget =
    targetStart >= 0 && typedPrompt.length > targetEnd ? typedPrompt.slice(targetEnd) : "";

  return (
    <SafeAreaView style={previewIntroStyles.screen}>
      <View style={previewIntroStyles.topRail}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close exercise intro preview"
          style={previewIntroStyles.closeButton}
        >
          <X size={38} color="#9AA4AA" strokeWidth={2.4} />
        </Pressable>
        <Text style={previewIntroStyles.brandText}>TODAY'S FOCUS</Text>
        <View
          style={previewIntroStyles.streakBadge}
          accessibilityLabel={`${currentStreak} day streak`}
        >
          <RNImage
            source={STREAK_PREVIEW_ICON}
            style={previewIntroStyles.streakIcon}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={previewIntroStyles.streakText}>{currentStreak}</Text>
        </View>
      </View>

      <View style={previewIntroStyles.content}>
        <View style={previewIntroStyles.stickerStage}>
          <View style={previewIntroStyles.stickerBase} />
          <Animated.View style={[previewIntroStyles.animatedSticker, stickerMotionStyle]}>
            <RNImage
              source={LOWER_FACE_PREVIEW_STICKER}
              style={previewIntroStyles.sticker}
              resizeMode="contain"
              accessibilityLabel="Lower face exercise area sticker"
            />
          </Animated.View>
        </View>

        <Text style={previewIntroStyles.prompt} numberOfLines={3} adjustsFontSizeToFit>
          {typedBeforeTarget}
          {typedTarget ? <Text style={previewIntroStyles.promptTarget}>{typedTarget}</Text> : null}
          {typedAfterTarget}
        </Text>
      </View>

      <View style={previewIntroStyles.bottomRail}>
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          style={({ pressed }) => [
            previewIntroStyles.exerciseCtaButton,
            pressed && previewIntroStyles.exerciseCtaButtonPressed,
          ]}
        >
          <Text style={previewIntroStyles.exerciseCtaText}>CONTINUE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ExerciseBenefitsPreviewScreen({
  currentStreak,
  onClose,
  onContinue,
}: {
  currentStreak: number;
  onClose: () => void;
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
      setTypedLineOne(EXERCISE_BENEFITS_LINE_ONE.slice(0, lineOneIndex));

      if (lineOneIndex >= EXERCISE_BENEFITS_LINE_ONE.length) {
        clearInterval(lineOneTimer);
        lineTwoTimer = setInterval(() => {
          lineTwoIndex += 1;
          setTypedLineTwo(EXERCISE_BENEFITS_LINE_TWO.slice(0, lineTwoIndex));
          if (lineTwoIndex >= EXERCISE_BENEFITS_LINE_TWO.length && lineTwoTimer) {
            clearInterval(lineTwoTimer);
          }
        }, 34);
      }
    }, 38);

    return () => {
      clearInterval(lineOneTimer);
      if (lineTwoTimer) clearInterval(lineTwoTimer);
    };
  }, []);

  const targetStart = EXERCISE_BENEFITS_LINE_ONE.indexOf(EXERCISE_INTRO_TARGET);
  const targetEnd = targetStart + EXERCISE_INTRO_TARGET.length;
  const typedBeforeTarget =
    targetStart >= 0 ? typedLineOne.slice(0, Math.min(typedLineOne.length, targetStart)) : typedLineOne;
  const typedTarget =
    targetStart >= 0 && typedLineOne.length > targetStart
      ? typedLineOne.slice(targetStart, Math.min(typedLineOne.length, targetEnd))
      : "";
  const typedAfterTarget =
    targetStart >= 0 && typedLineOne.length > targetEnd ? typedLineOne.slice(targetEnd) : "";

  return (
    <SafeAreaView style={previewIntroStyles.screen}>
      <View style={previewIntroStyles.topRail}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close exercise benefits preview"
          style={previewIntroStyles.closeButton}
        >
          <X size={38} color="#9AA4AA" strokeWidth={2.4} />
        </Pressable>
        <Text style={previewIntroStyles.brandText}>WHY TODAY HELPS</Text>
        <View
          style={previewIntroStyles.streakBadge}
          accessibilityLabel={`${currentStreak} day streak`}
        >
          <RNImage
            source={STREAK_PREVIEW_ICON}
            style={previewIntroStyles.streakIcon}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={previewIntroStyles.streakText}>{currentStreak}</Text>
        </View>
      </View>

      <View style={previewIntroStyles.benefitsContent}>
        <Text style={previewIntroStyles.benefitsHeadline}>
          {typedBeforeTarget}
          {typedTarget ? <Text style={previewIntroStyles.promptTarget}>{typedTarget}</Text> : null}
          {typedAfterTarget}
        </Text>
        <Text style={previewIntroStyles.benefitsBody}>{typedLineTwo}</Text>
      </View>

      <View style={previewIntroStyles.bottomRail}>
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Start routine"
          style={({ pressed }) => [
            previewIntroStyles.exerciseCtaButton,
            pressed && previewIntroStyles.exerciseCtaButtonPressed,
          ]}
        >
          <Text style={previewIntroStyles.exerciseCtaText}>START ROUTINE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ExerciseChoicePreviewScreen({
  currentStreak,
  onClose,
  onChooseForMe,
  onChooseMyself,
}: {
  currentStreak: number;
  onClose: () => void;
  onChooseForMe: () => void;
  onChooseMyself: () => void;
}) {
  const float = useSharedValue(0);
  const tilt = useSharedValue(-9);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    tilt.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
        withTiming(-12, { duration: 1250, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [float, tilt]);

  const iconMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { rotateZ: `${tilt.value}deg` }],
  }));

  return (
    <SafeAreaView style={previewIntroStyles.screen}>
      <View style={previewIntroStyles.topRail}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close exercise choice preview"
          style={previewIntroStyles.closeButton}
        >
          <X size={38} color="#9AA4AA" strokeWidth={2.4} />
        </Pressable>
        <Text style={previewIntroStyles.brandText}>TODAY'S ROUTINE</Text>
        <View
          style={previewIntroStyles.streakBadge}
          accessibilityLabel={`${currentStreak} day streak`}
        >
          <RNImage
            source={STREAK_PREVIEW_ICON}
            style={previewIntroStyles.streakIcon}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={previewIntroStyles.streakText}>{currentStreak}</Text>
        </View>
      </View>

      <View style={previewIntroStyles.choiceContent}>
        <View style={previewIntroStyles.choiceIconStage}>
          <Animated.View style={[previewIntroStyles.choiceIconWrap, iconMotionStyle]}>
            <RNImage
              source={DUMBBELL_EXERCISE_ICON}
              style={previewIntroStyles.choiceIcon}
              resizeMode="contain"
              accessibilityLabel="Exercise dumbbell icon"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
        <Text style={previewIntroStyles.choiceQuestion}>
          Do you want us to choose today's exercises?
        </Text>
      </View>

      <View style={previewIntroStyles.choiceBottomRail}>
        <Pressable
          onPress={onChooseForMe}
          accessibilityRole="button"
          accessibilityLabel="Choose exercises for me"
          style={({ pressed }) => [
            previewIntroStyles.exerciseCtaButton,
            pressed && previewIntroStyles.exerciseCtaButtonPressed,
          ]}
        >
          <Text style={previewIntroStyles.exerciseCtaText}>CHOOSE FOR ME</Text>
        </Pressable>
        <Pressable
          onPress={onChooseMyself}
          accessibilityRole="button"
          accessibilityLabel="Let me choose exercises"
          style={({ pressed }) => [
            previewIntroStyles.secondaryChoiceButton,
            pressed && previewIntroStyles.secondaryChoiceButtonPressed,
          ]}
        >
          <Text style={previewIntroStyles.secondaryChoiceText}>I'LL CHOOSE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RoutineBuildTile({
  label,
  icon,
  progress,
  reveal,
}: {
  label: string;
  icon: any;
  progress: { value: number };
  reveal: { value: number };
}) {
  const fillStyle = useAnimatedStyle(() => ({
    width: ROUTINE_BUILD_TILE_WIDTH * progress.value,
  }));
  const textRevealStyle = useAnimatedStyle(() => ({
    width: Math.max(0, ROUTINE_BUILD_TILE_WIDTH * progress.value - 20),
  }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 10 }],
  }));

  return (
    <Animated.View style={[previewIntroStyles.routineTileListed, revealStyle]}>
      <Animated.View style={[previewIntroStyles.routineTileFill, fillStyle]} />
      <Animated.View style={[previewIntroStyles.routineTileTextClip, textRevealStyle]}>
        <Text style={previewIntroStyles.routineTileText} numberOfLines={1}>{label}</Text>
      </Animated.View>
      <RNImage
        source={icon}
        style={previewIntroStyles.routineTileWatermark}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

function ExerciseChoosingPreviewScreen({
  currentStreak,
  onClose,
  onContinue,
}: {
  currentStreak: number;
  onClose: () => void;
  onContinue: () => void;
}) {
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

    revealOne.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 220 })
    );
    revealTwo.value = withSequence(
      withTiming(0, { duration: 1520 }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 1740 })
    );
    revealThree.value = withSequence(
      withTiming(0, { duration: 3040 }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 3260 })
    );
    revealFour.value = withSequence(
      withTiming(0, { duration: 4560 }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 4780 })
    );
    fillOne.value = withSequence(
      withTiming(0, { duration: 220 }),
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 1720 })
    );
    fillTwo.value = withSequence(
      withTiming(0, { duration: 1740 }),
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 3240 })
    );
    fillThree.value = withSequence(
      withTiming(0, { duration: 3260 }),
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 4760 })
    );
    fillFour.value = withSequence(
      withTiming(0, { duration: 4780 }),
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: ROUTINE_BUILD_SEQUENCE_MS - 6280 })
    );

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
    <SafeAreaView style={previewIntroStyles.screen}>
      <View style={previewIntroStyles.topRail}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close exercise choosing preview"
          style={previewIntroStyles.closeButton}
        >
          <X size={38} color="#9AA4AA" strokeWidth={2.4} />
        </Pressable>
        <Text style={previewIntroStyles.brandText}>BUILDING ROUTINE</Text>
        <View
          style={previewIntroStyles.streakBadge}
          accessibilityLabel={`${currentStreak} day streak`}
        >
          <RNImage
            source={STREAK_PREVIEW_ICON}
            style={previewIntroStyles.streakIcon}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={previewIntroStyles.streakText}>{currentStreak}</Text>
        </View>
      </View>

      <View style={previewIntroStyles.choosingContent}>
        <View style={previewIntroStyles.routineListStage}>
          <RoutineBuildTile label="Targeting exact parts" icon={ATTR_ICON_HARMONY} progress={fillOne} reveal={revealOne} />
          <RoutineBuildTile label="Focusing on proportions" icon={ATTR_ICON_DIMORPHISM} progress={fillTwo} reveal={revealTwo} />
          <RoutineBuildTile label="Looking at every face part" icon={ATTR_ICON_ANGULARITY} progress={fillThree} reveal={revealThree} />
          <RoutineBuildTile label="Beautifying harmony" icon={ATTR_ICON_SKIN_QUALITY} progress={fillFour} reveal={revealFour} />
        </View>
        <View
          style={previewIntroStyles.routineProgressRow}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: loadingPercent }}
        >
          <View style={previewIntroStyles.routineProgressTrack}>
            <View
              style={[
                previewIntroStyles.routineProgressFill,
                { width: `${loadingPercent}%` },
              ]}
            />
          </View>
          <Text style={previewIntroStyles.routineProgressText}>
            {loadingPercent}%
          </Text>
        </View>
        {isComplete ? (
          <Animated.Text
            entering={FadeInDown.duration(380).springify().damping(13).stiffness(170)}
            style={previewIntroStyles.choosingText}
          >
            Your routine is ready!
          </Animated.Text>
        ) : (
          <Text style={previewIntroStyles.choosingText}>
            <>
              Building your <Text style={previewIntroStyles.promptTarget}>lower face</Text> routine
            </>
          </Text>
        )}
      </View>

      <View style={previewIntroStyles.bottomRail}>
        {isComplete ? (
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={({ pressed }) => [
              previewIntroStyles.exerciseCtaButton,
              pressed && previewIntroStyles.exerciseCtaButtonPressed,
            ]}
          >
            <Text style={previewIntroStyles.exerciseCtaText}>CONTINUE</Text>
          </Pressable>
        ) : (
          <View style={previewIntroStyles.exerciseCtaPlaceholder} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Progress Dashboard Mockups
// ---------------------------------------------------------------------------

const MOCK_METRICS = [
  { label: "Jawline Definition", score: 61, delta: -0.8 },
  { label: "Cheek Hollows", score: 58, delta: 1.2 },
  { label: "Skin Clarity", score: 74, delta: 2.4 },
  { label: "Eye Symmetry", score: 79, delta: 3.1 },
  { label: "Maxilla Projection", score: 55, delta: 0.9 },
];

function DashCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[mockStyles.dashCard, style]}>{children}</View>;
}

function MiniFace({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={mockStyles.faceCol}>
      <View style={[mockStyles.faceBox, accent && mockStyles.faceBoxAccent]}>
        <View style={mockStyles.faceHead} />
        <View style={mockStyles.faceNeck} />
      </View>
      <T style={[mockStyles.faceLabel, accent && mockStyles.faceLabelAccent]}>{label}</T>
    </View>
  );
}

function Sparkline() {
  return (
    <View style={mockStyles.sparkWrap}>
      {[18, 28, 23, 42, 36, 58, 64, 72].map((h, i) => (
        <View key={i} style={[mockStyles.sparkBar, { height: h }]} />
      ))}
    </View>
  );
}

function WeekRibbon() {
  return (
    <View style={mockStyles.weekRow}>
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <View key={`${d}-${i}`} style={mockStyles.weekCell}>
          <View
            style={[
              mockStyles.weekDot,
              i < 4 && mockStyles.weekDotDone,
              i === 4 && mockStyles.weekDotToday,
            ]}
          />
          <T style={[mockStyles.weekText, i === 4 && mockStyles.weekTextToday]}>{d}</T>
        </View>
      ))}
    </View>
  );
}

function MetricLine({
  label,
  score,
  delta,
  index,
  compact,
}: {
  label: string;
  score: number;
  delta: number;
  index?: number;
  compact?: boolean;
}) {
  const positive = delta >= 0;
  return (
    <View style={[mockStyles.metricLine, compact && mockStyles.metricLineCompact]}>
      {typeof index === "number" && (
        <View style={mockStyles.rankPill}>
          <T style={mockStyles.rankText}>{String(index).padStart(2, "0")}</T>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T style={mockStyles.metricName} numberOfLines={1}>{label.toUpperCase()}</T>
        {!compact && (
          <T style={mockStyles.metricMeta}>
            {positive ? "+" : ""}{delta.toFixed(1)} since baseline
          </T>
        )}
      </View>
      <T style={[mockStyles.metricDelta, !positive && { color: COLORS.declineRed }]}>
        {positive ? "+" : ""}{delta.toFixed(1)}
      </T>
      <T style={mockStyles.metricScore}>{score}</T>
    </View>
  );
}

function BlackPill({ label }: { label: string }) {
  return (
    <View style={mockStyles.blackPill}>
      <T style={mockStyles.blackPillText}>{label}</T>
    </View>
  );
}

function MockupShell({
  number,
  title,
  thesis,
  children,
}: {
  number: string;
  title: string;
  thesis: string;
  children: React.ReactNode;
}) {
  return (
    <View style={mockStyles.mockupShell}>
      <View style={mockStyles.mockupHeader}>
        <View style={mockStyles.mockupNum}>
          <T style={mockStyles.mockupNumText}>{number}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T style={mockStyles.mockupTitle}>{title}</T>
          <T style={mockStyles.mockupThesis}>{thesis}</T>
        </View>
      </View>
      <View style={mockStyles.phoneFrame}>
        {children}
      </View>
    </View>
  );
}

function CommandCenterMockup() {
  return (
    <MockupShell
      number="01"
      title="Command Center"
      thesis="One transformation state, one action stack."
    >
      <View style={mockStyles.identityRow}>
        <T style={mockStyles.identityText}>Day 18 - Alex's transformation</T>
        <View style={mockStyles.streakPill}><T style={mockStyles.streakText}>4</T></View>
      </View>
      <WeekRibbon />
      <DashCard style={mockStyles.heroMock}>
        <View style={mockStyles.heroTopRow}>
          <View>
            <T style={mockStyles.heroEyebrow}>OVERALL RATING</T>
            <T style={mockStyles.heroScore}>72</T>
            <T style={mockStyles.heroTier}>S T R O N G</T>
          </View>
          <Sparkline />
        </View>
        <View style={mockStyles.heroBottomRow}>
          <View>
            <T style={mockStyles.heroSmallNum}>+4.2</T>
            <T style={mockStyles.heroSmallLabel}>FROM START</T>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <T style={mockStyles.heroSmallNum}>+8</T>
            <T style={mockStyles.heroSmallLabel}>TO ELITE</T>
          </View>
        </View>
        <View style={mockStyles.compareMiniRow}>
          <MiniFace label="Today" />
          <T style={mockStyles.arrowText}>{"->"}</T>
          <MiniFace label="Potential" accent />
        </View>
        <View style={mockStyles.progressTrack}>
          <View style={[mockStyles.progressFill, { width: "38%" }]} />
        </View>
        <T style={mockStyles.progressCaption}>38% closer to stage 1</T>
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>TODAY'S MOVE</T>
        <MetricLine label="Jawline Definition" score={61} delta={-0.8} />
        <BlackPill label="TRAIN THIS METRIC" />
        <View style={mockStyles.dividerLight} />
        {MOCK_METRICS.slice(1, 4).map((m, i) => (
          <MetricLine key={m.label} {...m} index={i + 1} compact />
        ))}
      </DashCard>
    </MockupShell>
  );
}

function ProgressStoryMockup() {
  return (
    <MockupShell
      number="02"
      title="Progress Story"
      thesis="A vertical narrative: now, next, potential, evidence."
    >
      <View style={mockStyles.storyLine} />
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>NOW</T>
        <T style={mockStyles.storyBig}>72 STRONG</T>
        <T style={mockStyles.storySub}>+4.2 since baseline - strongest gain: Eyes</T>
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>NEXT INFLECTION</T>
        <T style={mockStyles.storyBig}>+8 to Elite band</T>
        <T style={mockStyles.storySub}>Focus: Jawline Definition</T>
        <BlackPill label="START SESSION" />
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>POTENTIAL STAGE</T>
        <View style={mockStyles.compareMiniRow}>
          <MiniFace label="Today" />
          <T style={mockStyles.arrowText}>{"->"}</T>
          <MiniFace label="Stage 1" accent />
        </View>
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>EVIDENCE</T>
        <MetricLine label="Top sub-metrics" score={5} delta={3.1} compact />
        <Sparkline />
      </DashCard>
    </MockupShell>
  );
}

function PriorityStackMockup() {
  return (
    <MockupShell
      number="03"
      title="Priority Stack"
      thesis="Training-first. One ranked queue replaces scattered cards."
    >
      <DashCard style={mockStyles.compactHero}>
        <View>
          <T style={mockStyles.heroScoreSmall}>72 STRONG</T>
          <T style={mockStyles.storySub}>Day 18 - 6 scans - streak 4</T>
        </View>
        <Sparkline />
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>PRIORITY STACK</T>
        {MOCK_METRICS.map((m, i) => (
          <MetricLine key={m.label} {...m} index={i + 1} compact={i !== 0} />
        ))}
        <BlackPill label="TRAIN PRIORITY 01" />
      </DashCard>
      <DashCard>
        <View style={mockStyles.inlinePotential}>
          <MiniFace label="Today" />
          <View style={{ flex: 1 }}>
            <T style={mockStyles.metricName}>POTENTIAL PREVIEW</T>
            <T style={mockStyles.metricMeta}>Stage 1 - 38% closer</T>
            <View style={mockStyles.progressTrack}>
              <View style={[mockStyles.progressFill, { width: "38%" }]} />
            </View>
          </View>
        </View>
      </DashCard>
    </MockupShell>
  );
}

function TransformationSplitMockup() {
  return (
    <MockupShell
      number="04"
      title="Transformation Split"
      thesis="Makes potential face the emotional centerpiece."
    >
      <DashCard>
        <T style={mockStyles.sectionKicker}>TRANSFORMATION</T>
        <View style={mockStyles.compareLargeRow}>
          <MiniFace label="Today" />
          <MiniFace label="Potential" accent />
        </View>
        <View style={mockStyles.heroBottomRow}>
          <View>
            <T style={mockStyles.heroSmallNum}>72 now</T>
            <T style={mockStyles.heroSmallLabel}>CURRENT</T>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <T style={mockStyles.heroSmallNum}>38%</T>
            <T style={mockStyles.heroSmallLabel}>CLOSER</T>
          </View>
        </View>
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>WHAT CHANGED</T>
        <MetricLine label="Eye Symmetry" score={79} delta={3.1} compact />
        <MetricLine label="Skin Quality" score={74} delta={2.4} compact />
        <MetricLine label="Jawline" score={61} delta={-0.8} compact />
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>WHAT TO DO</T>
        <MetricLine label="Jawline Definition" score={61} delta={-0.8} />
        <BlackPill label="START WORKOUT" />
      </DashCard>
    </MockupShell>
  );
}

function AnalystModeMockup() {
  return (
    <MockupShell
      number="05"
      title="Compact Analyst Mode"
      thesis="Power-user density with the least card chrome."
    >
      <View style={mockStyles.analystHeader}>
        <View>
          <T style={mockStyles.heroScoreSmall}>72 STRONG</T>
          <T style={mockStyles.storySub}>+4.2 - 6 scans tracked</T>
        </View>
        <Sparkline />
      </View>
      <DashCard style={mockStyles.heatmapCard}>
        <T style={mockStyles.sectionKicker}>METRIC HEATMAP</T>
        {MOCK_METRICS.map((m) => (
          <View key={m.label} style={mockStyles.heatRow}>
            <T style={mockStyles.heatName}>{m.label}</T>
            <T style={mockStyles.heatScore}>{m.score}</T>
            <T style={[mockStyles.heatDelta, m.delta < 0 && { color: COLORS.declineRed }]}>
              {m.delta >= 0 ? "+" : ""}{m.delta.toFixed(1)}
            </T>
            <View style={[mockStyles.heatDot, m.delta < 0 && { backgroundColor: COLORS.declineRedSoft }]} />
          </View>
        ))}
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>SELECTED: JAWLINE</T>
        <T style={mockStyles.storySub}>Definition - Gonial angle - Chin projection</T>
        <BlackPill label="TRAIN THIS METRIC" />
      </DashCard>
    </MockupShell>
  );
}

function ProgressDashboardMockupsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={mockStyles.modalRoot}>
        <View style={mockStyles.modalHeader}>
          <View style={{ flex: 1 }}>
            <T style={mockStyles.modalTitle}>Progress UI Mockups</T>
            <T style={mockStyles.modalSub}>Static previews using current dashboard language</T>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={mockStyles.closeBtn}>
            <T style={mockStyles.closeText}>Close</T>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={mockStyles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <CommandCenterMockup />
          <ProgressStoryMockup />
          <PriorityStackMockup />
          <TransformationSplitMockup />
          <AnalystModeMockup />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const STORY_GREEN = "#58BF19";
const STORY_GREEN_SOFT = "#EFFAE9";
const STORY_TEXT = "#111111";
const STORY_SUB = "#5E625F";
const STORY_HAIRLINE = "rgba(17,17,17,0.08)";
const STORY_AXES = [
  { label: "SKIN", value: 74 },
  { label: "EYES", value: 79 },
  { label: "SYMMETRY", value: 68 },
  { label: "JAW", value: 61 },
  { label: "MIDFACE", value: 72 },
] as const;

const PROGRESS_FOCUS_STEPS = [
  {
    brand: "PROGRESS CHECK",
    image: FULL_FACE_PREVIEW_STICKER,
    before: "Your face has moved ",
    highlight: "+4.2 points",
    after: " since Day 1",
    cta: "CONTINUE",
  },
  {
    brand: "BIGGEST LIFT",
    image: MIDFACE_PREVIEW_STICKER,
    before: "Your ",
    highlight: "midface and eyes",
    after: " are carrying the lift",
    cta: "CONTINUE",
  },
  {
    brand: "NEXT FOCUS",
    image: LOWER_FACE_PREVIEW_STICKER,
    before: "Next we train your ",
    highlight: "jaw definition",
    after: " to unlock the next jump",
    cta: "START WORKOUT",
  },
] as const;

function storyRadarPoint(index: number, value: number, cx: number, cy: number, radius: number) {
  const step = (Math.PI * 2) / STORY_AXES.length;
  const angle = -Math.PI / 2 + index * step;
  const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

function storyRadarPath(values: number[], cx: number, cy: number, radius: number) {
  return values
    .map((value, index) => {
      const p = storyRadarPoint(index, value, cx, cy, radius);
      return `${index === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function StoryStatTile({
  Icon,
  label,
  value,
  unit,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={storyStyles.tile}>
      <View style={storyStyles.tileIconChip}>
        <Icon size={16} color={STORY_GREEN} strokeWidth={2.2} />
      </View>
      <Text style={storyStyles.tileLabel}>{label}</Text>
      <View style={storyStyles.tileValueRow}>
        <Text style={storyStyles.tileValue}>{value}</Text>
        <Text style={storyStyles.tileUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function StoryFaceMap({ width }: { width: number }) {
  const chartW = Math.min(300, width - SP[10]);
  const chartH = 238;
  const cx = chartW / 2;
  const cy = 118;
  const radius = 78;
  const labelRadius = 102;
  const values = STORY_AXES.map((axis) => axis.value);

  return (
    <View style={storyStyles.faceMapCard}>
      <View style={storyStyles.cardHeaderRow}>
        <View>
          <Text style={storyStyles.cardTitle}>Face map</Text>
          <Text style={storyStyles.cardSub}>Your current shape across five areas.</Text>
        </View>
        <View style={storyStyles.avgPill}>
          <Text style={storyStyles.avgPillValue}>71</Text>
          <Text style={storyStyles.avgPillLabel}>AVG</Text>
        </View>
      </View>

      <View style={storyStyles.radarWrap}>
        <Svg width={chartW} height={chartH}>
          <Defs>
            <SvgGradient id="storyRadarFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={STORY_GREEN} stopOpacity="0.34" />
              <Stop offset="1" stopColor={STORY_GREEN} stopOpacity="0.10" />
            </SvgGradient>
          </Defs>

          {[20, 40, 60, 80, 100].map((level) => (
            <Path
              key={`story-ring-${level}`}
              d={storyRadarPath(STORY_AXES.map(() => level), cx, cy, radius)}
              stroke="rgba(17,17,17,0.11)"
              strokeWidth={1}
              fill="none"
            />
          ))}

          <Path
            d={storyRadarPath(values, cx, cy, radius)}
            stroke={STORY_GREEN}
            strokeWidth={2.6}
            strokeLinejoin="round"
            fill="url(#storyRadarFill)"
          />

          {values.map((value, index) => {
            const p = storyRadarPoint(index, value, cx, cy, radius);
            return (
              <Circle
                key={`story-dot-${STORY_AXES[index].label}`}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={STORY_GREEN}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            );
          })}

          {STORY_AXES.map((axis, index) => {
            const p = storyRadarPoint(index, 100, cx, cy, labelRadius);
            const left = p.x < cx - 8;
            const right = p.x > cx + 8;
            const labelX = left ? Math.max(64, p.x) : right ? Math.min(chartW - 58, p.x) : p.x;
            const yNudge = index === 0 ? -6 : index === 2 || index === 3 ? 8 : 2;
            return (
              <SvgText
                key={`story-label-${axis.label}`}
                x={labelX}
                y={p.y + yNudge}
                fill="rgba(17,17,17,0.62)"
                fontFamily={FONT}
                fontSize={10}
                textAnchor={left ? "end" : right ? "start" : "middle"}
              >
                {axis.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

function JourneyPathPreview() {
  return (
    <View style={storyStyles.pathCard}>
      <View style={storyStyles.cardHeaderRow}>
        <View>
          <Text style={storyStyles.cardTitle}>Progress path</Text>
          <Text style={storyStyles.cardSub}>Six scans tracked since Day 1.</Text>
        </View>
        <Text style={storyStyles.pathGain}>+4.2</Text>
      </View>
      <View style={storyStyles.pathRail}>
        {[0, 1, 2, 3, 4, 5].map((step) => (
          <View key={step} style={storyStyles.pathStepWrap}>
            <View
              style={[
                storyStyles.pathStep,
                step < 5 && storyStyles.pathStepDone,
                step === 5 && storyStyles.pathStepCurrent,
              ]}
            >
              {step < 5 ? <CircleCheck size={11} color="#FFFFFF" strokeWidth={2.6} /> : null}
            </View>
            <Text style={[storyStyles.pathStepLabel, step === 5 && storyStyles.pathStepLabelCurrent]}>
              {step === 0 ? "Day 1" : step === 5 ? "Now" : String(step + 1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DashboardStoryScreenContent({ onClose }: { onClose: () => void }) {
  const { width } = useWindowDimensions();
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const cardWidth = Math.min(width - SP[8], 430);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [float, pulse]);

  const stickerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  return (
    <SafeAreaView style={storyTopStyles.screen}>
      <ScrollView
        contentContainerStyle={storyTopStyles.screenScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[storyTopStyles.screenInner, { width: cardWidth }]}>
        <View style={storyTopStyles.topRail}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close dashboard story preview"
            style={({ pressed }) => [
              storyTopStyles.iconButton,
              pressed && storyTopStyles.iconButtonPressed,
            ]}
          >
            <X size={22} color={STORY_TEXT} strokeWidth={2.7} />
          </Pressable>
          <View style={storyTopStyles.streakPill}>
            <RNImage
              source={STREAK_PREVIEW_ICON}
              style={storyTopStyles.streakIcon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={storyTopStyles.streakText}>4 day streak</Text>
          </View>
          <View style={storyTopStyles.iconButton}>
            <TrendingUp size={20} color={STORY_TEXT} strokeWidth={2.7} />
          </View>
        </View>

        <View style={storyTopStyles.briefingHero}>
          <View style={storyTopStyles.heroCopy}>
            <Text style={storyTopStyles.heroKicker}>TODAY'S BRIEFING</Text>
            <Text style={storyTopStyles.heroTitle}>
              Your profile held steady.
            </Text>
            <Text style={storyTopStyles.heroSub}>
              Midface and eyes are carrying the lift. Jaw definition is the next lever.
            </Text>
          </View>

          <View style={storyTopStyles.heroVisual}>
            <View style={storyTopStyles.heroShadow} />
            <Animated.View style={[storyTopStyles.heroStickerWrap, stickerStyle]}>
              <RNImage
                source={FULL_FACE_PREVIEW_STICKER}
                style={storyTopStyles.heroSticker}
                resizeMode="contain"
                accessibilityLabel="Face profile preview"
              />
            </Animated.View>
            <View style={storyTopStyles.scoreBubble}>
              <Text style={storyTopStyles.scoreValue}>71</Text>
              <Text style={storyTopStyles.scoreLabel}>AVG</Text>
            </View>
          </View>
        </View>

        <View style={storyTopStyles.pathStrip}>
          {[
            { label: "Scan", done: true },
            { label: "Insight", done: true },
            { label: "Focus", done: true },
            { label: "Train", done: false },
          ].map((item, index) => (
            <View key={item.label} style={storyTopStyles.pathItem}>
              <View style={[storyTopStyles.pathDot, item.done && storyTopStyles.pathDotDone]}>
                {item.done ? <CircleCheck size={11} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
              {index < 3 ? <View style={[storyTopStyles.pathLine, item.done && storyTopStyles.pathLineDone]} /> : null}
              <Text style={[storyTopStyles.pathText, item.done && storyTopStyles.pathTextDone]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={storyTopStyles.insightRow}>
          <View style={storyTopStyles.insightCard}>
            <View style={storyTopStyles.insightIconTile}>
              <RNImage source={MIDFACE_PREVIEW_STICKER} style={storyTopStyles.insightImage} resizeMode="contain" />
            </View>
            <Text style={storyTopStyles.insightKicker}>BIGGEST LIFT</Text>
            <Text style={storyTopStyles.insightTitle}>Eyes + midface</Text>
            <Text style={storyTopStyles.insightMeta}>+3.1 since baseline</Text>
          </View>

          <View style={storyTopStyles.insightCard}>
            <View style={[storyTopStyles.insightIconTile, storyTopStyles.nextTile]}>
              <Target size={22} color={STORY_GREEN} strokeWidth={2.6} />
            </View>
            <Text style={storyTopStyles.insightKicker}>NEXT MOVE</Text>
            <Text style={storyTopStyles.insightTitle}>Jaw definition</Text>
            <Text style={storyTopStyles.insightMeta}>Best lever today</Text>
          </View>
        </View>

        <View style={storyTopStyles.nextCard}>
          <View style={storyTopStyles.nextImageTile}>
            <RNImage source={LOWER_FACE_PREVIEW_STICKER} style={storyTopStyles.nextImage} resizeMode="contain" />
          </View>
          <View style={storyTopStyles.nextCopy}>
            <Text style={storyTopStyles.nextKicker}>YOUR NEXT QUEST</Text>
            <Text style={storyTopStyles.nextTitle}>Train lower face control</Text>
            <Text style={storyTopStyles.nextMeta}>One session moves the weakest lever first.</Text>
          </View>
          <View style={storyTopStyles.nextScore}>
            <Flame size={15} color="#E85F00" strokeWidth={2.5} />
            <Text style={storyTopStyles.nextScoreText}>12</Text>
          </View>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardStoryScreenPreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <DashboardStoryScreenContent onClose={onClose} />
    </Modal>
  );
}

function DashboardStoryLaunchCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open dashboard story redesign preview"
      style={({ pressed }) => [
        storyTopStyles.launchCard,
        pressed && storyTopStyles.launchCardPressed,
      ]}
    >
      <View style={storyTopStyles.launchCopy}>
        <Text style={storyTopStyles.devKicker}>DASHBOARD REDESIGN</Text>
        <Text style={storyTopStyles.devTitle}>Story-first daily briefing</Text>
        <Text style={storyTopStyles.launchSub}>
          Opens the full-screen prototype using current preview assets.
        </Text>
      </View>
      <View style={storyTopStyles.launchPreview}>
        <RNImage
          source={FULL_FACE_PREVIEW_STICKER}
          style={storyTopStyles.launchImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={storyTopStyles.launchArrow}>
          <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
        </View>
      </View>
    </Pressable>
  );
}

function ProgressStoryDashboardPreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const step = PROGRESS_FOCUS_STEPS[stepIndex];

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1350, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 1250, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [float, pulse]);

  const stickerMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  const handleContinue = () => {
    if (stepIndex < PROGRESS_FOCUS_STEPS.length - 1) {
      setStepIndex((index) => index + 1);
      return;
    }
    router.push("/(tabs)/program");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={progressFocusStyles.screen}>
        <View style={progressFocusStyles.topRail}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close progress story preview"
            style={progressFocusStyles.closeButton}
          >
            <X size={38} color="#9AA4AA" strokeWidth={2.4} />
          </Pressable>
          <Text style={progressFocusStyles.brandText}>{step.brand}</Text>
          <View style={progressFocusStyles.streakBadge} accessibilityLabel="4 day streak">
            <RNImage
              source={STREAK_PREVIEW_ICON}
              style={progressFocusStyles.streakIcon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={progressFocusStyles.streakText}>4</Text>
          </View>
        </View>

        <View style={progressFocusStyles.content}>
          <View style={progressFocusStyles.stepDots}>
            {PROGRESS_FOCUS_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  progressFocusStyles.stepDot,
                  index <= stepIndex && progressFocusStyles.stepDotActive,
                ]}
              />
            ))}
          </View>

          <View style={progressFocusStyles.stickerStage}>
            <View style={progressFocusStyles.stickerBase} />
            <Animated.View key={step.brand} style={[progressFocusStyles.animatedSticker, stickerMotionStyle]}>
              <RNImage
                source={step.image}
                style={progressFocusStyles.sticker}
                resizeMode="contain"
                accessibilityLabel={step.brand}
              />
            </Animated.View>
          </View>

          <Text style={progressFocusStyles.prompt} numberOfLines={3} adjustsFontSizeToFit>
            {step.before}
            <Text style={progressFocusStyles.promptTarget}>{step.highlight}</Text>
            {step.after}
          </Text>
        </View>

        <View style={progressFocusStyles.bottomRail}>
          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={step.cta}
            style={({ pressed }) => [
              progressFocusStyles.exerciseCtaButton,
              pressed && progressFocusStyles.exerciseCtaButtonPressed,
            ]}
          >
            <Text style={progressFocusStyles.exerciseCtaText}>{step.cta}</Text>
          </Pressable>

          <View style={progressFocusStyles.previewTabBar}>
            <View style={progressFocusStyles.tabIcon}>
              <Aperture size={24} color="#8A8F93" strokeWidth={2.3} />
            </View>
            <View style={[progressFocusStyles.tabIcon, progressFocusStyles.tabIconActive]}>
              <CircleCheck size={35} color="#111111" strokeWidth={2.3} />
            </View>
            <View style={progressFocusStyles.tabIcon}>
              <TrendingUp size={27} color="#8A8F93" strokeWidth={2.3} />
            </View>
            <View style={progressFocusStyles.tabIcon}>
              <Home size={25} color="#8A8F93" strokeWidth={2.2} />
            </View>
            <View style={progressFocusStyles.tabIcon}>
              <Dumbbell size={25} color="#8A8F93" strokeWidth={2.2} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const SCAN_BYPASS_KEY = "dev_bypass_scan_limit";
type PotentialPromptMode = "conservative" | "balanced" | "aggressive";
type PotentialDevPayload = {
  b64?: string;
  model?: string;
  promptVersion?: string;
  promptMode?: PotentialPromptMode;
  message?: string;
  error?: string;
  providerStatus?: number;
  providerCode?: string | null;
  providerType?: string | null;
  providerMessage?: string;
};
const POTENTIAL_PROMPT_MODES: PotentialPromptMode[] = ["aggressive", "balanced", "conservative"];
const LOTTIE_PREVIEWS = {
  neck1: {
    title: "neck1.lottie",
    detail: "neck1.embedded.json",
    source: require("../../assets/new-exercises-images/neck1.embedded.json"),
  },
  nose1: {
    title: "nose1-slimnose.lottie",
    detail: "nose1-slimnose.embedded.json",
    source: require("../../assets/new-exercises-images/nose1-slimnose.embedded.json"),
  },
  noseSlim2: {
    title: "Slim Nose 2",
    detail: "nose-slim2.embedded.json",
    source: require("../../assets/new-exercises-images/nose-slim2.embedded.json"),
  },
  slimNose3: {
    title: "Slim Nose 3",
    detail: "slim-nose3.embedded.json",
    source: require("../../assets/new-exercises-images/slim-nose3.embedded.json"),
  },
  chinTucksBasic: {
    title: "chin-tucks-basic.lottie",
    detail: "chin-tucks-basic.embedded.json",
    source: require("../../assets/new-exercises-images/chin-tucks-basic.embedded.json"),
  },
  neck2: {
    title: "neck2.lottie",
    detail: "neck2.embedded.json",
    source: require("../../assets/new-exercises-images/neck2.embedded.json"),
  },
  neck3: {
    title: "neck3.lottie",
    detail: "neck3.embedded.json",
    source: require("../../assets/new-exercises-images/neck3.embedded.json"),
  },
  eyeArea1: {
    title: "eye-area1.lottie",
    detail: "eye-area1.embedded.json",
    source: require("../../assets/new-exercises-images/eye-area1.embedded.json"),
  },
  eyeBrowsLifting: {
    title: "Eye Brow Lifting",
    detail: "eye-brows-lifting.embedded.json",
    source: require("../../assets/new-exercises-images/eye-brows-lifting.embedded.json"),
  },
  jawForcing: {
    title: "jaw-forcing.lottie",
    detail: "jaw-forcing.embedded.json",
    source: require("../../assets/new-exercises-images/jaw-forcing.embedded.json"),
  },
  tongueTouching1: {
    title: "tongue-touching-1.lottie",
    detail: "tongue-touching-1.embedded.json",
    source: require("../../assets/new-exercises-images/tongue-touching-1.embedded.json"),
  },
  chinTraining: {
    title: "Chin Ball Press",
    detail: "chin-ball-pressing.embedded.json",
    source: require("../../assets/new-exercises-images/chin-ball-pressing.embedded.json"),
  },
  cheekPuffs: {
    title: "cheek-puffs",
    detail: "cheek-puffs.embedded.json",
    source: require("../../assets/new-exercises-images/cheek-puffs.embedded.json"),
  },
  chinStretch: {
    title: "chin-stretch",
    detail: "chin-stretch.embedded.json",
    source: require("../../assets/new-exercises-images/chin-stretch.embedded.json"),
  },
  upwardChinStretch: {
    title: "Upward Chin Stretch",
    detail: "upward-chin-stretch.embedded.json",
    source: require("../../assets/new-exercises-images/upward-chin-stretch.embedded.json"),
  },
  chinBallPressing: {
    title: "Chin Ball Pressing",
    detail: "chin-ball-pressing.embedded.json",
    source: require("../../assets/new-exercises-images/chin-ball-pressing.embedded.json"),
  },
  midfaceLift: {
    title: "midface-lift",
    detail: "midface-lift.embedded.json",
    source: require("../../assets/new-exercises-images/midface-lift.embedded.json"),
  },
} as const;
type LottiePreviewId = keyof typeof LOTTIE_PREVIEWS;
const LOTTIE_PREVIEW_OPTIONS: { id: LottiePreviewId; label: string }[] = [
  { id: "neck1", label: "Neck 1" },
  { id: "nose1", label: "Nose 1" },
  { id: "noseSlim2", label: "Slim Nose 2" },
  { id: "slimNose3", label: "Slim Nose 3" },
  { id: "chinTucksBasic", label: "Chin Tucks" },
  { id: "neck2", label: "Neck 2" },
  { id: "neck3", label: "Neck 3" },
  { id: "eyeArea1", label: "Eye Area 1" },
  { id: "eyeBrowsLifting", label: "Eye Brow Lifting" },
  { id: "jawForcing", label: "Jaw Forcing" },
  { id: "tongueTouching1", label: "Tongue Touching" },
  { id: "chinTraining", label: "Chin Training" },
  { id: "cheekPuffs", label: "Cheek Puffs" },
  { id: "chinStretch", label: "Chin Stretch" },
  { id: "upwardChinStretch", label: "Upward Chin Stretch" },
  { id: "chinBallPressing", label: "Chin Ball Pressing" },
  { id: "midfaceLift", label: "Midface Lift" },
];

type TimerExercisePreview = {
  id: LottiePreviewId;
  title: string;
  target: string;
  instruction: string;
  duration: number;
};

type TimerMediaLayout = {
  scale: number;
  x: number;
  y: number;
};

const TIMER_MEDIA_LAYOUTS: Record<LottiePreviewId, TimerMediaLayout> = {
  neck1: { scale: 1.04, x: 0.16, y: 0.03 },
  nose1: { scale: 0.98, x: 0, y: 0.01 },
  noseSlim2: { scale: 0.98, x: 0, y: 0.01 },
  slimNose3: { scale: 0.98, x: 0, y: 0.01 },
  chinTucksBasic: { scale: 1.12, x: 0, y: 0.02 },
  neck2: { scale: 1.36, x: 0.16, y: 0.02 },
  neck3: { scale: 1.18, x: 0.16, y: 0.02 },
  eyeArea1: { scale: 0.96, x: 0, y: 0.03 },
  eyeBrowsLifting: { scale: 0.96, x: 0, y: 0.03 },
  jawForcing: { scale: 0.98, x: 0, y: 0.02 },
  tongueTouching1: { scale: 0.94, x: 0, y: 0.02 },
  chinTraining: { scale: 1.12, x: 0, y: 0.02 },
  cheekPuffs: { scale: 1.02, x: 0, y: 0.02 },
  chinStretch: { scale: 1.02, x: 0, y: 0.02 },
  upwardChinStretch: { scale: 1.02, x: 0, y: 0.02 },
  chinBallPressing: { scale: 1.02, x: 0, y: 0.02 },
  midfaceLift: { scale: 1.02, x: 0, y: 0.02 },
};

const TIMER_DESIGN_EXERCISES: TimerExercisePreview[] = [
  {
    id: "neck1",
    title: "Neck Lift",
    target: "Jawline",
    instruction: "Lie back, keep shoulders low, and lift through the neck with slow control.",
    duration: 30,
  },
  {
    id: "nose1",
    title: "Nose Contour",
    target: "Nose",
    instruction: "Glide both fingers along the nose bridge with steady, even pressure.",
    duration: 30,
  },
  {
    id: "noseSlim2",
    title: "Slim Nose 2",
    target: "Nose",
    instruction: "Use both fingertips to contour along the nose with light, symmetrical pressure.",
    duration: 30,
  },
  {
    id: "slimNose3",
    title: "Slim Nose 3",
    target: "Nose",
    instruction: "Follow the nose-slimming motion slowly, keeping pressure controlled and even.",
    duration: 30,
  },
  {
    id: "chinTucksBasic",
    title: "Chin Tucks",
    target: "Posture",
    instruction: "Slide your chin straight back without looking down. Hold the tuck briefly.",
    duration: 30,
  },
  {
    id: "neck2",
    title: "Neck Raise",
    target: "Neck",
    instruction: "Brace your torso and raise your head from the bench in a smooth line.",
    duration: 30,
  },
  {
    id: "neck3",
    title: "Neck Curl",
    target: "Under Chin",
    instruction: "Curl from the neck only, then return slowly until the head is neutral.",
    duration: 30,
  },
  {
    id: "eyeArea1",
    title: "Eye Area Lift",
    target: "Eyes",
    instruction: "Place your fingers lightly and lift the under-eye area without forehead tension.",
    duration: 30,
  },
  {
    id: "eyeBrowsLifting",
    title: "Eye Brow Lifting",
    target: "Brows",
    instruction: "Lift through the brow area with steady fingertip support and relaxed forehead tension.",
    duration: 30,
  },
  {
    id: "jawForcing",
    title: "Jaw Forcing",
    target: "Jawline",
    instruction: "Press both palms together and drive the jaw gently against resistance.",
    duration: 30,
  },
  {
    id: "tongueTouching1",
    title: "Tongue Touching",
    target: "Tongue Posture",
    instruction: "Lift the tongue toward the upper palate and hold steady without jaw tension.",
    duration: 30,
  },
  {
    id: "chinTraining",
    title: "Chin Ball Press",
    target: "Chin",
    instruction: "Press the chin into the ball with firm, controlled resistance while keeping shoulders low.",
    duration: 30,
  },
  {
    id: "cheekPuffs",
    title: "Cheek Puffs",
    target: "Cheeks",
    instruction: "Fill one cheek with air, hold the tension, then switch sides with control.",
    duration: 30,
  },
  {
    id: "chinStretch",
    title: "Chin Stretch",
    target: "Jawline",
    instruction: "Lengthen through the chin and neck, then return slowly to neutral posture.",
    duration: 30,
  },
  {
    id: "upwardChinStretch",
    title: "Upward Chin Stretch",
    target: "Chin",
    instruction: "Tilt upward into the stretch and keep the chin line long without forcing the neck.",
    duration: 30,
  },
  {
    id: "chinBallPressing",
    title: "Chin Ball Pressing",
    target: "Under Chin",
    instruction: "Press the chin into the ball with firm, controlled resistance while keeping shoulders low.",
    duration: 30,
  },
  {
    id: "midfaceLift",
    title: "Midface Lift",
    target: "Midface",
    instruction: "Place your fingers near the midface and lift with steady, controlled pressure.",
    duration: 30,
  },
];

function useResolvedLottieSource(source: any, enabled: boolean) {
  const [resolvedSource, setResolvedSource] = useState<any>(source);

  useEffect(() => {
    let cancelled = false;
    setResolvedSource(source);

    if (!enabled || typeof source !== "number") {
      return () => {
        cancelled = true;
      };
    }

    Asset.fromModule(source)
      .downloadAsync()
      .then((asset) => {
        if (cancelled) return;
        const uri = asset.localUri ?? asset.uri;
        setResolvedSource(uri ? { uri } : source);
      })
      .catch(() => {
        if (!cancelled) setResolvedSource(source);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, source]);

  return resolvedSource;
}

function formatSeconds(total: number) {
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const previewIntroStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#111A20",
  },
  topRail: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  closeButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#8FA0AA",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.5,
  },
  topSpacer: {
    width: 52,
    height: 52,
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
    color: "#E9EFF2",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0,
  },
  content: {
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
    backgroundColor: "#2B363C",
    transform: [{ scaleX: 1.08 }],
  },
  animatedSticker: {
    width: 268,
    height: 268,
  },
  sticker: {
    width: "100%",
    height: "100%",
  },
  prompt: {
    maxWidth: 326,
    minHeight: 120,
    color: "#E9EFF2",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 27,
    lineHeight: 40,
    letterSpacing: 0,
    textAlign: "center",
  },
  promptTarget: {
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
    color: "#E9EFF2",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 31,
    lineHeight: 42,
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: 18,
  },
  benefitsBody: {
    maxWidth: 330,
    color: "#C5D0D6",
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
    color: "#E9EFF2",
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
    width: ROUTINE_BUILD_TILE_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 22,
  },
  routineTileListed: {
    width: ROUTINE_BUILD_TILE_WIDTH,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#34424A",
    backgroundColor: "#2B363C",
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  routineTileTextClip: {
    overflow: "hidden",
    zIndex: 2,
  },
  routineTileText: {
    width: ROUTINE_BUILD_TILE_WIDTH - 104,
    color: "#111A20",
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
    width: ROUTINE_BUILD_TILE_WIDTH,
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
    backgroundColor: "#2B363C",
    overflow: "hidden",
  },
  routineProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  routineProgressText: {
    width: 42,
    color: "#E9EFF2",
    fontFamily: "DINNextRounded-Regular",
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
    textAlign: "right",
  },
  choosingText: {
    maxWidth: 326,
    color: "#E9EFF2",
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
  exerciseCtaPlaceholder: {
    minHeight: 58,
  },
  choiceBottomRail: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 26,
  },
  exerciseCtaButton: {
    minHeight: 58,
    borderRadius: RADII.circle,
    backgroundColor: "#58CC02",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 18,
    shadowColor: "#58CC02",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  exerciseCtaButtonPressed: {
    backgroundColor: "#46A302",
    transform: [{ translateY: 1 }],
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
    borderRadius: RADII.circle,
    borderWidth: 2,
    borderColor: "#2B363C",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 18,
  },
  secondaryChoiceButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  secondaryChoiceText: {
    color: "#E9EFF2",
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});

const timerStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
  },
  header: {
    minHeight: 96,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: FONT,
    fontSize: 25,
    lineHeight: 30,
    color: "#050505",
  },
  counterPill: {
    width: 116,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0F0F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 8,
  },
  counterText: {
    fontFamily: FONT,
    fontSize: 22,
    lineHeight: 24,
    color: "#050505",
  },
  counterTrack: {
    width: "100%",
    height: 7,
    borderRadius: 4,
    backgroundColor: "#DCDDE0",
    overflow: "hidden",
  },
  counterFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#050505",
  },
  mediaSlot: {
    alignSelf: "center",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  mediaCanvas: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  info: {
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 15,
  },
  time: {
    fontFamily: FONT,
    fontSize: 64,
    lineHeight: 68,
    color: "#000000",
  },
  progressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E6E7EA",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#000000",
  },
  instruction: {
    maxWidth: 360,
    fontFamily: FONT,
    color: "#7D7D86",
    fontSize: 21,
    lineHeight: 28,
    textAlign: "center",
  },
  target: {
    fontFamily: FONT,
    color: "#A2A2AA",
    fontSize: 12,
  },
  transport: {
    marginTop: "auto",
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 28,
    paddingBottom: 8,
  },
  transportBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
  },
  playBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  bottomBar: {
    height: 78,
    marginHorizontal: -22,
    paddingHorizontal: 54,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEEEF0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  closeChip: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});

function ExerciseTimerDesignPreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const exercise = TIMER_DESIGN_EXERCISES[index];
  const duration = exercise.duration;
  const [timeLeft, setTimeLeft] = useState(duration - 7);
  const progress = duration > 0 ? (duration - timeLeft) / duration : 0;
  const mediaWidth = Math.min(width - 44, 410);
  const mediaHeight = Math.min(Math.max(height * 0.36, 280), 360);
  const mediaLayout = TIMER_MEDIA_LAYOUTS[exercise.id];
  const lottieSource = useResolvedLottieSource(LOTTIE_PREVIEWS[exercise.id].source, visible);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setIsPlaying(true);
    setTimeLeft(TIMER_DESIGN_EXERCISES[0].duration - 7);
    setReplayKey((key) => key + 1);
  }, [visible]);

  useEffect(() => {
    setTimeLeft(Math.max(0, duration - 7));
    setReplayKey((key) => key + 1);
  }, [index, duration]);

  useEffect(() => {
    if (!visible || !isPlaying || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, isPlaying, timeLeft]);

  const goTo = (nextIndex: number) => {
    setIndex((nextIndex + TIMER_DESIGN_EXERCISES.length) % TIMER_DESIGN_EXERCISES.length);
    setIsPlaying(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={timerStyles.safe}>
        <View style={timerStyles.root}>
          <View style={timerStyles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close timer design preview"
              style={timerStyles.backBtn}
            >
              <ChevronLeft color="#050505" size={34} strokeWidth={3.2} />
            </Pressable>

            <Text
              style={timerStyles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {exercise.title.toUpperCase()}
            </Text>

            <View style={timerStyles.counterPill}>
              <Text style={timerStyles.counterText}>{index + 1}/{TIMER_DESIGN_EXERCISES.length}</Text>
              <View style={timerStyles.counterTrack}>
                <View
                  style={[
                    timerStyles.counterFill,
                    { width: `${((index + 1) / TIMER_DESIGN_EXERCISES.length) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={[timerStyles.mediaSlot, { width: mediaWidth, height: mediaHeight }]}>
            <View
              style={[
                timerStyles.mediaCanvas,
                {
                  transform: [
                    { translateX: mediaWidth * mediaLayout.x },
                    { translateY: mediaHeight * mediaLayout.y },
                    { scale: mediaLayout.scale },
                  ],
                },
              ]}
            >
              <LottieView
                key={`${exercise.id}-${replayKey}`}
                source={lottieSource}
                autoPlay
                loop
                speed={isPlaying ? 1 : 0}
                resizeMode="contain"
                renderMode="SOFTWARE"
                style={timerStyles.media}
              />
            </View>
          </View>

          <View style={timerStyles.info}>
            <Text style={timerStyles.time}>{formatSeconds(timeLeft)}</Text>
            <View style={timerStyles.progressTrack}>
              <View style={[timerStyles.progressFill, { width: `${Math.max(0.03, progress) * 100}%` }]} />
            </View>
            <Text style={timerStyles.instruction}>{exercise.instruction}</Text>
            <Text style={timerStyles.target}>{exercise.target.toUpperCase()} - {duration}s set</Text>
          </View>

          <View style={timerStyles.transport}>
            <Pressable
              onPress={() => goTo(index - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous exercise"
              style={timerStyles.transportBtn}
            >
              <SkipBack color="#808080" size={28} strokeWidth={2.8} />
            </Pressable>

            <Pressable
              onPress={() => setIsPlaying((playing) => !playing)}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause exercise" : "Play exercise"}
              style={timerStyles.playBtn}
            >
              {isPlaying ? (
                <Pause color="#FFFFFF" size={42} fill="#FFFFFF" strokeWidth={2.2} />
              ) : (
                <Play color="#FFFFFF" size={42} fill="#FFFFFF" strokeWidth={2.2} />
              )}
            </Pressable>

            <Pressable
              onPress={() => goTo(index + 1)}
              accessibilityRole="button"
              accessibilityLabel="Next exercise"
              style={timerStyles.transportBtn}
            >
              <SkipForward color="#808080" size={28} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={timerStyles.bottomBar}>
            <Home color="#050505" size={33} strokeWidth={3.2} />
            <BookOpen color="#8A8A8E" size={32} strokeWidth={2.8} />
            <Aperture color="#8A8A8E" size={34} strokeWidth={2.6} />
            <AlarmClock color="#8A8A8E" size={34} strokeWidth={2.8} />
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            style={timerStyles.closeChip}
          >
            <X color="#FFFFFF" size={16} strokeWidth={3} />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function DevScreen() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)/program" />;
  }

  const [consentValue, setConsentValue] = useState<string | null | "…">("…");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [lottiePreviewVisible, setLottiePreviewVisible] = useState(false);
  const [lottiePreviewKey, setLottiePreviewKey] = useState(0);
  const [lottiePreviewStatus, setLottiePreviewStatus] = useState("Ready");
  const [lottiePreviewId, setLottiePreviewId] = useState<LottiePreviewId>("neck1");
  const [timerDesignPreviewVisible, setTimerDesignPreviewVisible] = useState(false);
  const [exerciseIntroPreviewVisible, setExerciseIntroPreviewVisible] = useState(false);
  const [exerciseIntroPreviewStep, setExerciseIntroPreviewStep] = useState<ExercisePreviewStep>("focus");
  const lottiePreviewSource = useResolvedLottieSource(
    LOTTIE_PREVIEWS[lottiePreviewId].source,
    lottiePreviewVisible
  );
  const [dashboardStoryPreviewVisible, setDashboardStoryPreviewVisible] = useState(false);
  const [progressMockupsVisible, setProgressMockupsVisible] = useState(false);
  const [progressStoryPreviewVisible, setProgressStoryPreviewVisible] = useState(false);
  const [potentialSourceUri, setPotentialSourceUri] = useState<string | null>(null);
  const [potentialResultUri, setPotentialResultUri] = useState<string | null>(null);
  const [potentialGenerating, setPotentialGenerating] = useState(false);
  const [potentialMeta, setPotentialMeta] = useState<string | null>(null);
  const [potentialPromptMode, setPotentialPromptMode] = useState<PotentialPromptMode>("aggressive");
  const [potentialPreview, setPotentialPreview] = useState<{ uri: string; label: string } | null>(null);
  const [dayCompleteVisible, setDayCompleteVisible] = useState(false);
  const [insightPreviewVisible, setInsightPreviewVisible] = useState(false);
  const [insightPreviewKey, setInsightPreviewKey] = useState(0); // bump to replay
  const [scoreDeckPreviewVisible, setScoreDeckPreviewVisible] = useState(false);
  const [scoreDeckPreviewKey, setScoreDeckPreviewKey] = useState(0);
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const history       = useTasksStore((s) => s.history);
  const dayNumber     = history.length + 1; // total days since user started
  const [scanBypass, setScanBypass] = useState<boolean | "…">("…");

  // Program hero preview
  const [heroVisible, setHeroVisible] = useState(false);
  const HERO_ZONE_SETS = [
    ["jawline", "cheekbones"],
    ["eyes", "cheekbones"],
    ["jawline", "nose"],
    ["eyes", "jawline", "cheekbones"],
  ];
  const [heroZoneIdx, setHeroZoneIdx] = useState(0);

  // Blueprint modal preview
  const [blueprintVisible, setBlueprintVisible] = useState(false);
  const [programLoadingPreviewVisible, setProgramLoadingPreviewVisible] = useState(false);
  const [loaderPreviewVisible, setLoaderPreviewVisible] = useState(false);
  const [loaderKindIdx, setLoaderKindIdx] = useState(0);
  const { data: advancedData } = useAdvancedAnalysis();
  const { imageUri } = useScores();
  const MOCK_ADVANCED: AdvancedAnalysis = {
    cheekbones: { width: "", width_score: 48, width_verdict: "", maxilla: "", maxilla_score: 38, maxilla_verdict: "", bone_structure: "", bone_structure_score: 52, bone_structure_verdict: "", face_fat: "", face_fat_score: 41, face_fat_verdict: "", fwhr: "", fwhr_score: 54, fwhr_verdict: "" },
    jawline:    { development: "", development_score: 44, development_verdict: "", gonial_angle: "", gonial_angle_score: 62, gonial_angle_verdict: "", projection: "", projection_score: 35, projection_verdict: "", ramus: "", ramus_score: 50, ramus_verdict: "" },
    eyes:       { canthal_tilt: "", canthal_tilt_score: 57, canthal_tilt_verdict: "", eye_type: "", eye_type_score: 66, eye_type_verdict: "", brow_volume: "", brow_volume_score: 71, brow_volume_verdict: "", symmetry: "", symmetry_score: 49, symmetry_verdict: "" },
    skin:       { color: "", color_score: 73, color_verdict: "", quality: "", quality_score: 60, quality_verdict: "" },
  };

  // Insight Pulse preview
  const PULSE_VARIANTS: {
    type: PulseType;
    message: string;
    detail: string;
    ctaLabel: string;
  }[] = [
    {
      type: "momentum",
      message: "Jawline definition improved 4.1% this week",
      detail: "Based on your last 3 scans. Your best streak yet — mewing + posture work is showing.",
      ctaLabel: "View Full Breakdown",
    },
    {
      type: "alert",
      message: "Facial symmetry dipped 2.3% since last scan",
      detail: "Could be sleep, hydration, or lighting. Don't sweat it — scan again tomorrow.",
      ctaLabel: "See What Changed",
    },
    {
      type: "milestone",
      message: "New personal best — overall score: 8.3 / 10",
      detail: "Top 18% in facial harmony this month. You're trending up across 5 metrics.",
      ctaLabel: "See Full Report",
    },
    {
      type: "insight",
      message: "Your cheekbone score has improved 3 weeks in a row",
      detail: "Consistent gains suggest your routine is working. Keep the mewing pressure consistent.",
      ctaLabel: "View Trend",
    },
    {
      type: "nudge",
      message: "It's been 4 days since your last scan",
      detail: "",
      ctaLabel: "",
    },
  ];
  const [pulseVariantIdx, setPulseVariantIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0); // bump to remount

  // Life modal previews
  type LifeModal = "comeback" | "streak" | "halfway" | "didyouknow";
  const [lifeModal, setLifeModal] = useState<LifeModal | null>(null);
  const [celebMilestone, setCelebMilestone] = useState(0);
  const [previewFact] = useState(
    DID_YOU_KNOW_FACTS[Math.floor(Math.random() * DID_YOU_KNOW_FACTS.length)],
  );

  const refreshConsent = useCallback(async () => {
    const val = await AsyncStorage.getItem(CONSENT_KEY);
    setConsentValue(val);
  }, []);

  const refreshScanBypass = useCallback(async () => {
    const val = await AsyncStorage.getItem(SCAN_BYPASS_KEY);
    setScanBypass(val === "true");
  }, []);

  useEffect(() => {
    void refreshConsent();
    void refreshScanBypass();
  }, [refreshConsent, refreshScanBypass]);

  const handleResetConsent = async () => {
    await AsyncStorage.removeItem(CONSENT_KEY);
    await refreshConsent();
    Alert.alert("Reset", "Consent cleared — gate will fire on next Advanced Analysis tap.");
  };

  const consentStatus =
    consentValue === "…"
      ? "Loading…"
      : consentValue
      ? `Granted · ${consentValue}`
      : "Not granted";

  const consentColor =
    consentValue === "…" ? COLORS.sub : consentValue ? COLORS.success : COLORS.sub;

  const handlePickPotentialSource = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri ?? null;
    if (!uri) return;
    setPotentialSourceUri(uri);
    setPotentialResultUri(null);
    setPotentialMeta(null);
  };

  const handleGeneratePotentialDev = async () => {
    if (!potentialSourceUri || potentialGenerating) return;
    setPotentialGenerating(true);
    setPotentialMeta(null);

    try {
      const form = new FormData();
      form.append("image", {
        uri: potentialSourceUri,
        name: "potential-face-source.jpg",
        type: "image/jpeg",
      } as any);
      form.append("promptMode", potentialPromptMode);

      const headers = await buildAuthHeadersAsync({ includeLegacy: true });
      const res = await fetch(`${API_BASE}/generate/potential-face-dev`, {
        method: "POST",
        headers: { Accept: "application/json", ...headers },
        body: form,
      });

      const responseText = await res.text().catch(() => "");
      let payload: PotentialDevPayload | null = null;
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as PotentialDevPayload;
        } catch {
          payload = null;
        }
      }

      if (!res.ok || !payload?.b64) {
        const providerDetails = [
          `HTTP status: ${res.status}`,
          res.headers?.get?.("content-type") ? `Content-Type: ${res.headers.get("content-type")}` : null,
          payload?.providerStatus ? `Provider status: ${payload.providerStatus}` : null,
          payload?.providerCode ? `Provider code: ${payload.providerCode}` : null,
          payload?.providerType ? `Provider type: ${payload.providerType}` : null,
          payload?.providerMessage ? `Provider message: ${payload.providerMessage}` : null,
          !payload && responseText ? `Raw response: ${responseText.slice(0, 500)}` : null,
        ].filter(Boolean).join("\n");
        throw new Error(
          [
            payload?.message ?? payload?.error ?? `Generation failed (${res.status})`,
            providerDetails || null,
          ].filter(Boolean).join("\n\n")
        );
      }

      setPotentialResultUri(`data:image/png;base64,${payload.b64}`);
      setPotentialMeta(
        `${payload.model ?? "gpt-image-2"} · ${payload.promptMode ?? potentialPromptMode} · prompt ${payload.promptVersion ?? "unknown"}`
      );
    } catch (err: any) {
      const message = err?.message ?? String(err);
      Alert.alert(
        "Potential face dev gen failed",
        `${message}\n\nEndpoint:\n${API_BASE}/generate/potential-face-dev\n\nIf this says Network request failed, the app cannot reach the deployed Railway backend from the simulator/network.`
      );
    } finally {
      setPotentialGenerating(false);
    }
  };

  const handlePreviewPotentialFaceFlowFree = () => {
    const fallbackCurrent = RNImage.resolveAssetSource(require("../../assets/before.jpeg")).uri;
    const fallbackPotential = RNImage.resolveAssetSource(require("../../assets/after.jpeg")).uri;
    const currentUri = potentialSourceUri ?? imageUri ?? fallbackCurrent;
    const potentialUri = potentialResultUri ?? fallbackPotential;

    useScores.getState().seedDevScan({
      frontUri: currentUri,
      sideUri: currentUri,
      scanId: "dev-scan-preview",
      scores: {
        jawline: 67,
        facial_symmetry: 72,
        skin_quality: 60,
        cheekbones: 64,
        eyes_symmetry: 71,
        nose_harmony: 68,
        sexual_dimorphism: 66,
      },
    });
    useAdvancedAnalysis.getState().seedDevData(MOCK_ADVANCED, "dev-scan-preview");
    usePotentialFace.getState().seedDevPreview({ potentialUri });
    router.push("/(onboarding)/potential-face-reveal");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DashboardStoryLaunchCard onPress={() => setDashboardStoryPreviewVisible(true)} />

        <T style={styles.screenTitle}>Dev Tools</T>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Progress Story Preview"
            subtitle="Duolingo-style progress dashboard concept"
          />
          <DevButton
            label="Preview Progress Story Screen"
            accent
            onPress={() => setProgressStoryPreviewVisible(true)}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Exercise Preview Redesign"
            subtitle="New low-cognitive-load intro screen for the exercise tab"
          />
          <DevButton
            label="Preview Exercise Intro Screen"
            accent
            onPress={() => {
              setExerciseIntroPreviewStep("focus");
              setExerciseIntroPreviewVisible(true);
            }}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="New Exercise Video Preview"
            subtitle="Open the production-style player for assets/new-exercises-videos"
          />
          <DevButton
            label="Preview New Exercise Videos"
            accent
            onPress={() => router.push("/(tabs)/new-exercises-preview" as any)}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Exercise Timer Redesign"
            subtitle="Production-style preview using the exercise Lottie animations"
          />
          <DevButton
            label="Preview Timer Screen"
            accent
            onPress={() => setTimerDesignPreviewVisible(true)}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Lottie Animation Preview"
            subtitle="Preview exercise animation files from assets/new-exercises-images"
          />
          <View style={styles.lottieButtonGrid}>
            {LOTTIE_PREVIEW_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  setLottiePreviewId(option.id);
                  setLottiePreviewKey((key) => key + 1);
                  setLottiePreviewStatus("Loading");
                  setLottiePreviewVisible(true);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${option.label}`}
                style={[styles.devBtn, styles.lottieGridBtn, styles.devBtnAccent]}
              >
                <T style={[styles.devBtnText, styles.devBtnTextAccent]}>{option.label}</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Progress Dashboard Mockups */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Progress Dashboard Mockups"
            subtitle="Five layout directions for reducing tracking-screen cognitive load"
          />
          <DevButton
            label="Preview All Variations"
            onPress={() => setProgressMockupsVisible(true)}
          />
        </GlassCard>

        {/* ── Insight Pulse Preview ─────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Potential Face Image Lab"
            subtitle="Pick any face photo and compare conservative, balanced, and aggressive potential-face prompts"
          />

          <View style={styles.potentialLabGrid}>
            <View style={styles.potentialLabPane}>
              <T style={styles.subLabel}>SOURCE</T>
              {potentialSourceUri ? (
                <Pressable
                  onPress={() => setPotentialPreview({ uri: potentialSourceUri, label: "Source" })}
                  style={styles.potentialLabImagePressable}
                >
                  <RNImage source={{ uri: potentialSourceUri }} style={styles.potentialLabImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={styles.potentialLabPlaceholder}>
                  <T style={styles.potentialLabPlaceholderText}>No image selected</T>
                </View>
              )}
            </View>

            <View style={styles.potentialLabPane}>
              <T style={styles.subLabel}>POTENTIAL</T>
              {potentialResultUri ? (
                <Pressable
                  onPress={() => setPotentialPreview({ uri: potentialResultUri, label: "Potential" })}
                  style={styles.potentialLabImagePressable}
                >
                  <RNImage source={{ uri: potentialResultUri }} style={styles.potentialLabImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={styles.potentialLabPlaceholder}>
                  <T style={styles.potentialLabPlaceholderText}>
                    {potentialGenerating ? "Generating..." : "Result appears here"}
                  </T>
                </View>
              )}
            </View>
          </View>

          {potentialMeta ? (
            <T style={styles.sectionSubtitle} variant="small" color="sub">{potentialMeta}</T>
          ) : null}

          <View style={styles.row}>
            {POTENTIAL_PROMPT_MODES.map((mode) => (
              <DevButton
                key={mode}
                label={mode.charAt(0).toUpperCase() + mode.slice(1)}
                accent={potentialPromptMode === mode}
                onPress={() => {
                  setPotentialPromptMode(mode);
                  setPotentialResultUri(null);
                  setPotentialMeta(null);
                }}
              />
            ))}
          </View>

          <View style={styles.row}>
            <DevButton label="Choose Image" accent onPress={handlePickPotentialSource} />
            <DevButton
              label={potentialGenerating ? "Generating..." : "Generate"}
              accent={!!potentialSourceUri && !potentialGenerating}
              onPress={handleGeneratePotentialDev}
            />
          </View>

          <View style={styles.divider} />

          <DevButton
            label="Preview Full Story Flow (Free)"
            accent
            onPress={handlePreviewPotentialFaceFlowFree}
          />
          <T style={styles.sectionSubtitle} variant="small" color="sub">
            Uses the current lab result if present, then opens the full reveal-to-routine story flow. No backend call.
          </T>
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Insight Pulse Card"
            subtitle="In-app notification banner — tap card to expand, × to dismiss"
          />

          {/* Live preview inline */}
          <InsightPulseCard
            key={pulseKey}
            type={PULSE_VARIANTS[pulseVariantIdx].type}
            message={PULSE_VARIANTS[pulseVariantIdx].message}
            detail={PULSE_VARIANTS[pulseVariantIdx].detail || undefined}
            ctaLabel={PULSE_VARIANTS[pulseVariantIdx].ctaLabel || undefined}
            autoDismissMs={0}
            onDismiss={() => setPulseKey((k) => k + 1)}
          />

          {/* Variant switcher */}
          <View style={styles.row}>
            <DevButton
              label="◀  Prev"
              onPress={() => {
                setPulseVariantIdx((i) => (i - 1 + PULSE_VARIANTS.length) % PULSE_VARIANTS.length);
                setPulseKey((k) => k + 1);
              }}
            />
            <DevButton
              label="Next  ▶"
              onPress={() => {
                setPulseVariantIdx((i) => (i + 1) % PULSE_VARIANTS.length);
                setPulseKey((k) => k + 1);
              }}
            />
          </View>

          <DevButton
            label="↺  Replay Animation"
            accent
            onPress={() => setPulseKey((k) => k + 1)}
          />

          <T style={styles.sectionSubtitle} variant="small" color="sub">
            {pulseVariantIdx + 1} / {PULSE_VARIANTS.length} — {PULSE_VARIANTS[pulseVariantIdx].type.toUpperCase()}
          </T>

          <View style={styles.divider} />

          <DevButton
            label="🗑  Reset All Notification Cooldowns"
            onPress={async () => {
              await useNotifications.getState().resetCooldowns();
              Alert.alert("Reset", "All cooldowns cleared — notifications will re-evaluate on next dashboard focus.");
            }}
          />
        </GlassCard>

        {/* ── Onboarding Flow ────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Onboarding Flow"
            subtitle="Screens in the order they appear to the user"
          />

          {/* Full sequence launcher */}
          <DevButton
            label="▶  Run Full Sequence (from Splash)"
            accent
            onPress={() => router.push("/(onboarding)/splash")}
          />

          <View style={styles.divider} />

          <T style={styles.subLabel}>Step-by-step · tap to preview</T>
          <View style={styles.screenGrid}>
            {ONBOARDING_FLOW_SCREENS.map(({ label, route }, idx) => (
              <TouchableOpacity
                key={route}
                style={styles.flowChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.flowIndex}>
                  <T style={styles.flowIndexText}>{String(idx + 1).padStart(2, "0")}</T>
                </View>
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Orphan Onboarding Screens ──────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Orphan Screens"
            subtitle="Exist but not reachable from the main onboarding flow"
          />
          <View style={styles.screenGrid}>
            {ONBOARDING_ORPHANS.map(({ label, route, note }) => (
              <TouchableOpacity
                key={route}
                style={styles.orphanChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <T style={styles.screenChipText}>{label}</T>
                  <T style={styles.orphanNote}>{note}</T>
                </View>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Advanced Analysis UI Preview ─────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Advanced Analysis"
            subtitle="3-section accordion breakdown — What's Working / Just Okay / Needs Work"
          />
          <DevButton
            label="▶  Preview UI"
            accent
            onPress={() => router.push("/(tabs)/analysis")}
          />
        </GlassCard>

        {/* ── Blueprint Modal Preview ───────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Blueprint Modal"
            subtitle={advancedData ? "Using real scan data" : "Using mock data (no scan yet)"}
          />
          <DevButton
            label="▶  Preview Modal"
            accent
            onPress={() => setBlueprintVisible(true)}
          />
        </GlassCard>

        {/* ── Loaders Preview ───────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Loaders"
            subtitle="Ring loader — mascot · user photo · brand. Switch via header."
          />
          <DevButton
            label="▶  Preview Program Loading"
            accent
            onPress={() => setProgramLoadingPreviewVisible(true)}
          />
          <View style={{ height: SP[2] }} />
          <DevButton
            label="▶  Preview All Loaders"
            accent
            onPress={() => {
              setLoaderKindIdx(0);
              setLoaderPreviewVisible(true);
            }}
          />
        </GlassCard>

        {/* ── Score Card Shortcut ───────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Score Card"
            subtitle="Preview the stacked swipe deck before wiring it into the live scoring screen"
          />
          <DevButton
            label="▶  Preview Stacked Score Cards"
            accent
            onPress={() => {
              setScoreDeckPreviewKey((key) => key + 1);
              setScoreDeckPreviewVisible(true);
            }}
          />
        </GlassCard>

        {/* ── Insight Reveal Preview ────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Insight Reveal (new score screen)"
            subtitle="Two-section animated reveal: What's working / Needs attention"
          />
          <DevButton
            label="▶  Preview Full Screen"
            accent
            onPress={() => {
              setInsightPreviewKey((k) => k + 1);
              setInsightPreviewVisible(true);
            }}
          />
        </GlassCard>

        {/* ── Day Complete Modal ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Day Complete Modal"
            subtitle="Celebration shown when all tasks are finished"
          />
          <DevButton
            label="▶  Preview Modal"
            accent
            onPress={() => setDayCompleteVisible(true)}
          />
        </GlassCard>

        {/* ── Session Completion Screen ─────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Session Completion Screen"
            subtitle="Redesigned: stats → streak ring → tomorrow card hierarchy"
          />
          <DevButton
            label="▶  Preview (2 / 5 done)"
            accent
            onPress={() => router.push("/program/complete?doneCount=2&total=5" as any)}
          />
          <DevButton
            label="▶  Preview (5 / 5 done)"
            accent
            onPress={() => router.push("/program/complete?doneCount=5&total=5" as any)}
          />
        </GlassCard>

        {/* ── Consent Modal ──────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Consent Modal"
            subtitle="Advanced Analysis gate"
          />

          <View style={styles.statusRow}>
            <T style={styles.statusLabel}>Storage value</T>
            <T style={[styles.statusValue, { color: consentColor }]} numberOfLines={1}>
              {consentStatus}
            </T>
          </View>

          <View style={styles.row}>
            <DevButton
              label="Preview Modal"
              accent
              onPress={() => setPreviewVisible(true)}
            />
            <DevButton label="Reset Consent" onPress={handleResetConsent} />
          </View>
        </GlassCard>

        {/* ── Life Moment Modals ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Life Moment Modals"
            subtitle="Pose overlays that appear on the daily routine screen"
          />

          <DevButton
            label="😬  Comeback  (2+ days absent)"
            accent
            onPress={() => setLifeModal("comeback")}
          />
          <DevButton
            label={`🔥  Streak — Day ${currentStreak} (real)`}
            accent
            onPress={() => { setCelebMilestone(currentStreak); setLifeModal("streak"); }}
          />
          <DevButton
            label="👍  Halfway Hype  (50% tasks done)"
            accent
            onPress={() => setLifeModal("halfway")}
          />
          <DevButton
            label="💡  Did You Know"
            accent
            onPress={() => setLifeModal("didyouknow")}
          />

          <View style={styles.divider} />

          <DevButton
            label="Reset All Life Modal Flags"
            onPress={async () => {
              await resetAllLifeModalFlags();
              Alert.alert("Reset", "All life modal flags cleared.\nSession flags reset on next app restart.");
            }}
          />
        </GlassCard>

        {/* ── New Exercise Previews ─────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="New Exercise Preview"
            subtitle="Preview the 2 new exercises in the session player"
          />
          <DevButton
            label="▶  Midface Lift"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=midface-exercise" as any)}
          />
          <DevButton
            label="▶  Lower Face Lift"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=lowerface-exercise" as any)}
          />
          <DevButton
            label="▶  Both Together"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=midface-exercise,lowerface-exercise" as any)}
          />
        </GlassCard>

        {/* ── 3 Newest Exercises ────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="3 New Exercises"
            subtitle="Guide screen + session player previews"
          />
          {[
            { label: "Chin Stretch",         id: "chin-stretch" },
            { label: "Neck Stretch",         id: "neck-stretch" },
            { label: "Tongue Posture Press", id: "tongue-touching" },
            { label: "Side Tongue Stretch",  id: "side-tongue" },
          ].map(({ label, id }) => (
            <View key={id} style={styles.row}>
              <DevButton
                label={`Guide — ${label}`}
                accent
                onPress={() => router.push(`/program/guide/${id}` as any)}
              />
              <DevButton
                label="Session"
                accent
                onPress={() => router.push(`/program/session?previewExerciseIds=${id}` as any)}
              />
            </View>
          ))}
          <DevButton
            label="▶  All 4 Together"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=chin-stretch,neck-stretch,tongue-touching,side-tongue" as any)}
          />
        </GlassCard>

        {/* ── Exercise Timer Preview ───────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Exercise Timer Preview"
            subtitle="Preview every exercise exactly as it appears in the session player"
          />
          <View style={styles.screenGrid}>
            {[
              { label: "Neck & Jawline Extension", id: "jawline-1" },
              { label: "Chin Tuck",                id: "chin-tucks" },
              { label: "Fish Face",                id: "fish-face" },
              { label: "Gua Sha Sculpting",        id: "gua-sha" },
              { label: "Eyelid Isolation Squint",  id: "hunter-eyes-1" },
              { label: "Hunter Eyes Squinch",      id: "hunter-eyes-2" },
              { label: "Jaw Resistance Press",     id: "jaw-resistance" },
              { label: "Lymphatic Drainage",       id: "lymphatic-drainage" },
              { label: "Neck Lift",                id: "neck-lift-1" },
              { label: "Skyward Neck Stretch",     id: "neck-lift-2" },
              { label: "Nasal Bridge Sculpting",   id: "nose-massage" },
              { label: "Nose Contouring Massage",  id: "slim-nose-massage" },
              { label: "Neck Curls",               id: "neck-curls" },
              { label: "Towel Chewing",            id: "towel-chewing" },
              { label: "Cheek Puffs",              id: "alternating-cheek-puffs" },
              { label: "Midface Lift",             id: "midface-exercise" },
              { label: "Lower Face Lift",          id: "lowerface-exercise" },
              { label: "Chin Training",            id: "chin-training" },
              { label: "Chin Stretch",             id: "chin-stretch" },
              { label: "Neck Stretch",             id: "neck-stretch" },
              { label: "Tongue Posture Press",     id: "tongue-touching" },
              { label: "Side Tongue Stretch",      id: "side-tongue" },
            ].map(({ label, id }) => (
              <TouchableOpacity
                key={id}
                style={styles.screenChip}
                onPress={() => router.push(`/program/session?previewExerciseIds=${id}` as any)}
                activeOpacity={0.7}
              >
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <SectionHeader
            title="Routine List Screen"
            subtitle="Preview the edited light routine list at /program/list"
          />
          <DevButton
            label="▶  Preview Routine List"
            accent
            onPress={() => router.push("/program/list" as any)}
          />
        </GlassCard>

        {/* ── Daily Flow Screen Previews ────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Daily Flow Screens"
            subtitle="Preview the 4-screen daily workflow"
          />
          <View style={styles.screenGrid}>
            {[
              { label: "🔥  Streak Screen",       route: "/program/streak" },
              { label: "💪  Workout Reveal",       route: "/program/workout-reveal" },
              { label: "📋  Exercise List",        route: "/program/list" },
              { label: "▶  Session Player",       route: "/program/session" },
              { label: "🏆  Completion Screen",    route: "/program/complete" },
            ].map(({ label, route }) => (
              <TouchableOpacity
                key={route}
                style={styles.screenChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Program Hero ──────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Program Hero"
            subtitle="Mascot header with animated zone overlays — exercise screen top section"
          />
          <DevButton
            label="▶  Preview Hero"
            accent
            onPress={() => setHeroVisible(true)}
          />
        </GlassCard>

        {/* ── Tasks / Exercises ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Today's Exercises"
            subtitle="Reset completion state for UI testing"
          />
          <DevButton
            label="↺  Rebuild Diet Protocols"
            accent
            onPress={() => {
              useTasksStore.getState().rebuildProtocols();
              Alert.alert("Done", "Diet protocols rebuilt from updated catalog.");
            }}
          />
          <DevButton
            label="✓  Complete All Exercises (preview all-done state)"
            accent
            onPress={() => {
              const { today, completeTask } = useTasksStore.getState();
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              today.tasks.forEach((t) => {
                if (t.status !== "completed") completeTask(t.exerciseId);
              });
              router.push("/(tabs)/program" as any);
            }}
          />
          <DevButton
            label="↺  Uncheck All Exercises"
            accent
            onPress={() => {
              const { today } = useTasksStore.getState();
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              const { uncompleteTask } = useTasksStore.getState();
              today.tasks.forEach((t) => {
                if (t.status === "completed") uncompleteTask(t.exerciseId);
              });
              Alert.alert("Done", "All exercises reset to pending.");
            }}
          />
          <DevButton
            label="🔄  Full Reset Today (UI flip test)"
            accent
            onPress={() => {
              const state = useTasksStore.getState();
              const today = state.today;
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              useTasksStore.setState({
                today: {
                  ...today,
                  tasks: today.tasks.map((t) => ({ ...t, status: "pending" as const })),
                  protocols: today.protocols.map((p) => ({ ...p, status: "pending" as const })),
                  allComplete: false,
                  completedOnce: false,
                  mood: null,
                },
                completionModalShownDate: null,
              });
              router.push("/(tabs)/program" as any);
            }}
          />
        </GlassCard>

        {/* ── Scan Limit Bypass ──────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Scan Limit Bypass"
            subtitle="Skip the 24-hour rolling window for testing"
          />

          <View style={styles.statusRow}>
            <T style={styles.statusLabel}>Status</T>
            <T
              style={[
                styles.statusValue,
                {
                  color:
                    scanBypass === "…"
                      ? COLORS.sub
                      : scanBypass
                      ? COLORS.success
                      : COLORS.sub,
                },
              ]}
              numberOfLines={1}
            >
              {scanBypass === "…" ? "Loading…" : scanBypass ? "Bypassed ✓" : "Enforced (normal)"}
            </T>
          </View>

          <View style={styles.row}>
            <DevButton
              label="Enable Bypass"
              accent
              onPress={async () => {
                await AsyncStorage.setItem(SCAN_BYPASS_KEY, "true");
                await refreshScanBypass();
              }}
            />
            <DevButton
              label="Disable Bypass"
              onPress={async () => {
                await AsyncStorage.removeItem(SCAN_BYPASS_KEY);
                await refreshScanBypass();
              }}
            />
          </View>
        </GlassCard>
      </ScrollView>

      <ProgressDashboardMockupsModal
        visible={progressMockupsVisible}
        onClose={() => setProgressMockupsVisible(false)}
      />
      <DashboardStoryScreenPreview
        visible={dashboardStoryPreviewVisible}
        onClose={() => setDashboardStoryPreviewVisible(false)}
      />
      <ProgressStoryDashboardPreview
        visible={progressStoryPreviewVisible}
        onClose={() => setProgressStoryPreviewVisible(false)}
      />

      <ExerciseTimerDesignPreview
        visible={timerDesignPreviewVisible}
        onClose={() => setTimerDesignPreviewVisible(false)}
      />

      <Modal
        visible={exerciseIntroPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setExerciseIntroPreviewVisible(false)}
      >
        {exerciseIntroPreviewStep === "focus" ? (
          <ExerciseIntroPreviewCard
            currentStreak={currentStreak}
            onClose={() => setExerciseIntroPreviewVisible(false)}
            onContinue={() => setExerciseIntroPreviewStep("benefits")}
          />
        ) : exerciseIntroPreviewStep === "benefits" ? (
          <ExerciseBenefitsPreviewScreen
            currentStreak={currentStreak}
            onClose={() => setExerciseIntroPreviewVisible(false)}
            onContinue={() => setExerciseIntroPreviewStep("choice")}
          />
        ) : exerciseIntroPreviewStep === "choice" ? (
          <ExerciseChoicePreviewScreen
            currentStreak={currentStreak}
            onClose={() => setExerciseIntroPreviewVisible(false)}
            onChooseForMe={() => setExerciseIntroPreviewStep("choosing")}
            onChooseMyself={() => {
              setExerciseIntroPreviewVisible(false);
              router.push("/(tabs)/program?openList=1&openEdit=1" as any);
            }}
          />
        ) : (
          <ExerciseChoosingPreviewScreen
            currentStreak={currentStreak}
            onClose={() => setExerciseIntroPreviewVisible(false)}
            onContinue={() => {
              setExerciseIntroPreviewVisible(false);
              router.push("/(tabs)/program?openList=1" as any);
            }}
          />
        )}
      </Modal>

      <Modal
        visible={lottiePreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setLottiePreviewVisible(false)}
      >
        <SafeAreaView style={styles.lottieModalRoot}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1 }}>
              <T style={styles.previewTitle}>{LOTTIE_PREVIEWS[lottiePreviewId].title}</T>
              <T style={styles.lottieModalSub}>
                {lottiePreviewStatus} - {LOTTIE_PREVIEWS[lottiePreviewId].detail}
              </T>
            </View>
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => {
                  setLottiePreviewStatus("Loading");
                  setLottiePreviewKey((key) => key + 1);
                }}
                hitSlop={12}
                style={styles.previewBtn}
                accessibilityRole="button"
                accessibilityLabel="Replay lottie animation"
              >
                <T style={styles.previewBtnText}>Replay</T>
              </Pressable>
              <Pressable
                onPress={() => setLottiePreviewVisible(false)}
                hitSlop={12}
                style={[styles.previewBtn, styles.previewBtnClose]}
                accessibilityRole="button"
                accessibilityLabel="Close lottie preview"
              >
                <T style={styles.previewBtnText}>Close</T>
              </Pressable>
            </View>
          </View>

          <View style={styles.lottieStage}>
            <LottieView
              key={lottiePreviewKey}
              source={lottiePreviewSource}
              autoPlay
              loop
              resizeMode="contain"
              renderMode="SOFTWARE"
              onAnimationLoaded={() => setLottiePreviewStatus("Loaded")}
              onAnimationFailure={(error) => setLottiePreviewStatus(`Failed: ${error}`)}
              style={styles.lottieAnimation}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!potentialPreview}
        animationType="fade"
        transparent
        onRequestClose={() => setPotentialPreview(null)}
      >
        <Pressable
          style={styles.potentialPreviewBackdrop}
          onPress={() => setPotentialPreview(null)}
        >
          <SafeAreaView style={styles.potentialPreviewSafe}>
            <View style={styles.potentialPreviewHeader}>
              <T style={styles.potentialPreviewTitle}>
                {potentialPreview?.label ?? "Image"} Preview
              </T>
              <Pressable
                onPress={() => setPotentialPreview(null)}
                hitSlop={12}
                style={[styles.previewBtn, styles.previewBtnClose]}
              >
                <T style={styles.previewBtnText}>Close</T>
              </Pressable>
            </View>
            {potentialPreview ? (
              <Pressable style={styles.potentialPreviewImageWrap}>
                <RNImage
                  source={{ uri: potentialPreview.uri }}
                  style={styles.potentialPreviewImage}
                  resizeMode="contain"
                />
              </Pressable>
            ) : null}
          </SafeAreaView>
        </Pressable>
      </Modal>

      {/* Program Hero full-screen preview */}
      <Modal
        visible={heroVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setHeroVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgBottom }}>
          {/* Header bar */}
          <View style={styles.previewHeader}>
            <T style={styles.previewTitle}>Program Hero Preview</T>
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => setHeroZoneIdx((i) => (i + 1) % HERO_ZONE_SETS.length)}
                hitSlop={12}
                style={styles.previewBtn}
              >
                <T style={styles.previewBtnText}>↺  Zones</T>
              </Pressable>
              <Pressable
                onPress={() => setHeroVisible(false)}
                hitSlop={12}
                style={[styles.previewBtn, styles.previewBtnClose]}
              >
                <T style={styles.previewBtnText}>✕  Close</T>
              </Pressable>
            </View>
          </View>

          {/* The hero itself */}
          <ProgramHero
            userName="Alex"
            streak={7}
            activeZones={HERO_ZONE_SETS[heroZoneIdx]}
            completedTasks={2}
            totalTasks={5}
          />

          {/* Spacer so you can see where the screen content would begin */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Blueprint modal preview */}
      <BlueprintModal
        data={advancedData ?? MOCK_ADVANCED}
        imageUri={imageUri ?? null}
        visible={blueprintVisible}
        onDismiss={() => setBlueprintVisible(false)}
      />

      {/* ── Program loading screen preview ───────────────────────────── */}
      <Modal
        visible={programLoadingPreviewVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setProgramLoadingPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: PROGRAM_LOADING_BG }}>
          <ProgramLoadingScreen phrase="Focusing on your overall improvement goal" />
          <SafeAreaView
            pointerEvents="box-none"
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          >
            <View style={[styles.previewHeader, { borderBottomColor: "rgba(17,17,17,0.08)" }]}>
              <T style={[styles.previewTitle, { color: COLORS.lightText }]}>
                Program Loading
              </T>
              <Pressable
                onPress={() => setProgramLoadingPreviewVisible(false)}
                hitSlop={12}
                style={[styles.previewBtn, styles.previewBtnClose]}
              >
                <T style={styles.previewBtnText}>✕  Close</T>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Loaders preview ──────────────────────────────────────────── */}
      <Modal
        visible={loaderPreviewVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLoaderPreviewVisible(false)}
      >
        {(() => {
          const KINDS: { kind: RingLoaderKind; label: string; title: string; subtitle: string }[] = [
            { kind: "mascot", label: "Mascot",     title: "Building your routine",  subtitle: "Personalising your daily plan" },
            { kind: "photo",  label: "Photo Scan", title: "Analyzing your face",    subtitle: "Mapping proportions & harmony" },
            { kind: "brand",  label: "Brand",      title: "Preparing SigmaMax",     subtitle: "Setting things up" },
          ];
          const current = KINDS[loaderKindIdx];
          const fallbackPhoto = RNImage.resolveAssetSource(
            require("../../assets/loading/face-loader.jpg")
          ).uri;
          const photoUri =
            current.kind === "photo" ? (imageUri ?? fallbackPhoto) : undefined;
          return (
            <View style={{ flex: 1, backgroundColor: COLORS.lightBg }}>
              <RingLoader
                kind={current.kind}
                photoUri={photoUri}
                title={current.title}
                subtitle={current.subtitle}
              />

              {/* Floating header — switcher + close */}
              <SafeAreaView
                pointerEvents="box-none"
                style={{ position: "absolute", top: 0, left: 0, right: 0 }}
              >
                <View style={styles.previewHeader}>
                  <T style={[styles.previewTitle, { color: COLORS.lightText }]}>
                    Loader · {current.label}
                  </T>
                  <View style={styles.previewActions}>
                    <Pressable
                      onPress={() => setLoaderKindIdx((i) => (i + 1) % KINDS.length)}
                      hitSlop={12}
                      style={[styles.previewBtn, { backgroundColor: "rgba(0,0,0,0.06)" }]}
                    >
                      <T style={[styles.previewBtnText, { color: COLORS.lightText }]}>
                        ↺  Switch
                      </T>
                    </Pressable>
                    <Pressable
                      onPress={() => setLoaderPreviewVisible(false)}
                      hitSlop={12}
                      style={[styles.previewBtn, styles.previewBtnClose]}
                    >
                      <T style={styles.previewBtnText}>✕  Close</T>
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </View>
          );
        })()}
      </Modal>

      {/* Day Complete preview modal */}
      <DayCompleteModal
        visible={dayCompleteVisible}
        dayNumber={dayNumber}
        streak={currentStreak}
        onClose={() => setDayCompleteVisible(false)}
        dismissOnBackdropPress
      />

      {/* Consent preview modal — no storage interaction */}
      <ConsentModalInner
        visible={previewVisible}
        onAgree={() => {
          setPreviewVisible(false);
          Alert.alert("Preview only", '"I Agree" tapped — nothing was saved.');
        }}
        onCancel={() => setPreviewVisible(false)}
      />

      {/* Stacked score deck preview */}
      <Modal
        visible={scoreDeckPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScoreDeckPreviewVisible(false)}
      >
        <GestureHandlerRootView style={styles.scoreDeckModalRoot}>
          <SafeAreaView style={styles.scoreDeckModalRoot}>
            <View style={styles.previewHeader}>
              <T style={[styles.previewTitle, { color: COLORS.lightText }]}>Stacked Score Cards</T>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => setScoreDeckPreviewKey((key) => key + 1)}
                  hitSlop={12}
                  style={[styles.previewBtn, styles.lightPreviewBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="Replay stacked score cards preview"
                >
                  <T style={[styles.previewBtnText, styles.lightPreviewBtnText]}>Replay</T>
                </Pressable>
                <Pressable
                  onPress={() => setScoreDeckPreviewVisible(false)}
                  hitSlop={12}
                  style={[styles.previewBtn, styles.previewBtnClose]}
                  accessibilityRole="button"
                  accessibilityLabel="Close stacked score cards preview"
                >
                  <T style={styles.previewBtnText}>Close</T>
                </Pressable>
              </View>
            </View>
            <StackedScoreDeckPreview key={scoreDeckPreviewKey} />
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>

      {/* ── Insight Reveal full-screen preview ──────────────────────── */}
      <Modal
        visible={insightPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setInsightPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: COLORS.bgBottom }}>
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" }} />
          <SafeAreaView style={{ flex: 1 }}>
            {/* Close + replay header */}
            <View style={styles.previewHeader}>
              <T style={styles.previewTitle}>Score Screen Preview</T>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => {
                    setInsightPreviewKey((k) => k + 1);
                  }}
                  hitSlop={12}
                  style={styles.previewBtn}
                >
                  <T style={styles.previewBtnText}>↺  Replay</T>
                </Pressable>
                <Pressable
                  onPress={() => setInsightPreviewVisible(false)}
                  hitSlop={12}
                  style={[styles.previewBtn, styles.previewBtnClose]}
                >
                  <T style={styles.previewBtnText}>✕  Close</T>
                </Pressable>
              </View>
            </View>

            {/* The card itself with mock data */}
            <InsightRevealCard
              key={insightPreviewKey}
              totalScore={71}
              imageUri={null}
              metrics={[
                { label: "Jawline",       score: 78 },
                { label: "Cheekbones",    score: 82 },
                { label: "Eye Symmetry",  score: 69 },
                { label: "Symmetry",      score: 74 },
                { label: "Masculinity",   score: 67 },
                { label: "Skin Quality",  score: 54 },
                { label: "Nose Balance",  score: 60 },
              ]}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Life moment modal previews */}
      <ComebackModal
        visible={lifeModal === "comeback"}
        missedDays={3}
        onClose={() => setLifeModal(null)}
      />
      <StreakCelebrationModal
        visible={lifeModal === "streak"}
        streakDays={celebMilestone}
        onClose={() => setLifeModal(null)}
      />
      <HalfwayHypeModal
        visible={lifeModal === "halfway"}
        completedCount={3}
        totalCount={5}
        onClose={() => setLifeModal(null)}
      />
      <DidYouKnowModal
        visible={lifeModal === "didyouknow"}
        fact={previewFact}
        onClose={() => setLifeModal(null)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const storyTopStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  screenScroll: {
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[8],
  },
  screenInner: {
    alignSelf: "center",
  },
  shell: {
    alignSelf: "center",
    gap: SP[3],
  },
  devLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
  },
  devKicker: {
    color: COLORS.accent,
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  devTitle: {
    color: COLORS.text,
    fontFamily: FONT,
    fontSize: 20,
    lineHeight: 24,
    marginTop: 2,
  },
  launchCard: {
    minHeight: 128,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    padding: SP[4],
    overflow: "hidden",
  },
  launchCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  launchCopy: {
    flex: 1,
    minWidth: 0,
  },
  launchSub: {
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  launchPreview: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: "#F9FBF8",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  launchImage: {
    width: 112,
    height: 112,
    marginBottom: -13,
  },
  launchArrow: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: STORY_GREEN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.bgBottom,
  },
  devBadge: {
    minWidth: 48,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  devBadgeText: {
    color: COLORS.accent,
    fontFamily: FONT,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  phone: {
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  streakPill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  streakIcon: {
    width: 18,
    height: 18,
  },
  streakText: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 12,
  },
  briefingHero: {
    minHeight: 342,
    borderRadius: 24,
    backgroundColor: "#F9FBF8",
    borderWidth: 1,
    borderColor: "#EEF2EC",
    overflow: "hidden",
  },
  heroCopy: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingRight: 18,
    zIndex: 2,
  },
  heroKicker: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 10,
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: 0,
    marginTop: 5,
  },
  heroSub: {
    color: STORY_SUB,
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  heroVisual: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 184,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroShadow: {
    position: "absolute",
    bottom: 13,
    width: 150,
    height: 42,
    borderRadius: 30,
    backgroundColor: "rgba(17,17,17,0.08)",
    transform: [{ scaleX: 1.2 }],
  },
  heroStickerWrap: {
    width: 184,
    height: 184,
  },
  heroSticker: {
    width: "100%",
    height: "100%",
  },
  scoreBubble: {
    position: "absolute",
    right: 18,
    bottom: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#111111",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 22,
    lineHeight: 24,
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: FONT,
    fontSize: 8,
    marginTop: 1,
  },
  pathStrip: {
    marginTop: 14,
    minHeight: 70,
    borderRadius: 20,
    backgroundColor: STORY_GREEN_SOFT,
    borderWidth: 1,
    borderColor: "#DDEFD6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  pathItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pathDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D5E6CD",
    alignItems: "center",
    justifyContent: "center",
  },
  pathDotDone: {
    backgroundColor: STORY_GREEN,
    borderColor: STORY_GREEN,
  },
  pathLine: {
    position: "absolute",
    top: 13,
    left: "50%",
    right: "-50%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D5E6CD",
    zIndex: -1,
  },
  pathLineDone: {
    backgroundColor: STORY_GREEN,
  },
  pathText: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 10,
    marginTop: 8,
  },
  pathTextDone: {
    color: STORY_TEXT,
  },
  insightRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  insightCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    padding: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  insightIconTile: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 11,
  },
  nextTile: {
    backgroundColor: STORY_GREEN_SOFT,
  },
  insightImage: {
    width: "116%",
    height: "116%",
  },
  insightKicker: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  insightTitle: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 16,
    lineHeight: 19,
    marginTop: 4,
  },
  insightMeta: {
    color: STORY_SUB,
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  nextCard: {
    marginTop: 14,
    minHeight: 96,
    borderRadius: 22,
    backgroundColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  nextImageTile: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#222222",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  nextImage: {
    width: "124%",
    height: "124%",
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextKicker: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 9,
    letterSpacing: 0.9,
  },
  nextTitle: {
    color: "#FFFFFF",
    fontFamily: FONT,
    fontSize: 17,
    lineHeight: 20,
    marginTop: 4,
  },
  nextMeta: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  nextScore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nextScoreText: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 14,
  },
});

const progressFocusStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topRail: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  closeButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#58CC02",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 1.5,
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
    color: "#58CC02",
    fontFamily: "DuolingoFeather-Bold",
    fontSize: 18,
    lineHeight: 22,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 96,
  },
  stepDots: {
    position: "absolute",
    top: 8,
    flexDirection: "row",
    gap: 8,
  },
  stepDot: {
    width: 34,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E7EAEC",
  },
  stepDotActive: {
    backgroundColor: "#58CC02",
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
    top: 202,
    width: 150,
    height: 60,
    borderRadius: 64,
    backgroundColor: "#E6E6E6",
    transform: [{ scaleX: 1.1 }],
  },
  animatedSticker: {
    width: 268,
    height: 268,
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
  promptTarget: {
    color: "#58CC02",
    fontFamily: "DINNextRounded-Regular",
  },
  bottomRail: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  exerciseCtaButton: {
    minHeight: 58,
    borderRadius: RADII.circle,
    backgroundColor: "#58CC02",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    paddingVertical: 18,
    shadowColor: "#58CC02",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  exerciseCtaButtonPressed: {
    backgroundColor: "#46A302",
    transform: [{ translateY: 1 }],
  },
  exerciseCtaText: {
    color: "#FFFFFF",
    fontFamily: "ProximaNova-Bold",
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  previewTabBar: {
    minHeight: 70,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tabIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: {
    backgroundColor: "#F0F1F3",
  },
});

const storyStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: SP[8],
  },
  topRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
    paddingBottom: SP[2],
  },
  railButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#F8F9F8",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    alignItems: "center",
    justifyContent: "center",
    ...DASH_SHADOW,
  },
  streakPill: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    ...DASH_SHADOW,
  },
  streakNum: {
    color: "#E85F00",
    fontFamily: FONT,
    fontSize: 13,
  },
  streakUnit: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 12,
  },
  headBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[3],
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0,
    marginBottom: 6,
  },
  subtitle: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 232,
  },
  doneBadge: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F0F4EF",
  },
  doneBadgeText: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 12,
  },
  heroCard: {
    height: 322,
    marginHorizontal: SP[5],
    marginTop: SP[2],
    borderRadius: 18,
    backgroundColor: "#F9FBF8",
    borderWidth: 1,
    borderColor: "#EEF2EC",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    ...DASH_SHADOW,
  },
  heroStage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#FBFCFA",
  },
  heroFace: {
    width: "146%",
    height: "146%",
    marginBottom: -88,
  },
  statsCard: {
    marginHorizontal: SP[5],
    marginTop: SP[5],
    marginBottom: SP[4],
    padding: SP[4],
    backgroundColor: STORY_GREEN_SOFT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDEFD6",
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[3],
  },
  statsTitle: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 17,
  },
  viewAllText: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 11,
  },
  tileRow: {
    flexDirection: "row",
    gap: SP[3],
  },
  tile: {
    flex: 1,
    minHeight: 118,
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
  },
  tileIconChip: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: STORY_GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 10,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  tileValue: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 24,
  },
  tileUnit: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 11,
  },
  faceMapCard: {
    marginHorizontal: SP[5],
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[2],
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    ...DASH_SHADOW,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SP[3],
  },
  cardTitle: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 18,
  },
  cardSub: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  avgPill: {
    minWidth: 48,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: STORY_GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  avgPillValue: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 18,
    lineHeight: 20,
  },
  avgPillLabel: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 9,
  },
  radarWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP[2],
  },
  nextCard: {
    marginHorizontal: SP[5],
    marginTop: SP[4],
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    padding: SP[3],
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    ...DASH_SHADOW,
  },
  nextIconTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: COLORS.iconTileLavender,
    overflow: "hidden",
  },
  nextIconImage: {
    width: "100%",
    height: "100%",
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextKicker: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 10,
  },
  nextTitle: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 18,
    marginTop: 2,
  },
  nextSub: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  nextScorePill: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F0F4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  nextScore: {
    color: STORY_TEXT,
    fontFamily: FONT,
    fontSize: 16,
  },
  pathCard: {
    marginHorizontal: SP[5],
    marginTop: SP[4],
    padding: SP[4],
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEEC",
    ...DASH_SHADOW,
  },
  pathGain: {
    color: STORY_GREEN,
    fontFamily: FONT,
    fontSize: 22,
  },
  pathRail: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: SP[4],
  },
  pathStepWrap: {
    flex: 1,
    alignItems: "center",
    gap: 7,
  },
  pathStep: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EFF1EF",
    borderWidth: 2,
    borderColor: "#E2E7E1",
    alignItems: "center",
    justifyContent: "center",
  },
  pathStepDone: {
    backgroundColor: STORY_GREEN,
    borderColor: STORY_GREEN,
  },
  pathStepCurrent: {
    backgroundColor: "#FFFFFF",
    borderColor: STORY_GREEN,
  },
  pathStepLabel: {
    color: STORY_SUB,
    fontFamily: FONT,
    fontSize: 10,
  },
  pathStepLabelCurrent: {
    color: STORY_GREEN,
  },
  ctaDockInline: {
    marginHorizontal: SP[5],
    marginTop: SP[5],
  },
  ctaBtn: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADII.circle,
    backgroundColor: STORY_GREEN,
    paddingHorizontal: SP[6],
    shadowColor: STORY_GREEN,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaBtnPressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: FONT,
    fontSize: 14,
  },
});

const mockStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  modalHeader: {
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightHairline,
    backgroundColor: COLORS.lightBg,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  modalSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  closeBtn: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
  },
  closeText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  modalContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[12],
    gap: SP[6],
  },
  mockupShell: {
    gap: SP[3],
  },
  mockupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  mockupNum: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ctaBlack,
  },
  mockupNumText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  mockupTitle: {
    fontFamily: FONT,
    fontSize: 20,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  mockupThesis: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  phoneFrame: {
    borderRadius: RADII.card,
    backgroundColor: COLORS.lightBg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: SP[4],
    gap: SP[3],
    ...DASH_SHADOW,
  },
  dashCard: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    padding: SP[4],
    gap: SP[3],
    ...DASH_SHADOW,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identityText: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightSub,
  },
  streakPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
  },
  streakText: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[1],
  },
  weekCell: {
    alignItems: "center",
    flex: 1,
    gap: 5,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lightBorder,
  },
  weekDotDone: {
    backgroundColor: COLORS.ctaBlack,
  },
  weekDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  weekText: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
  },
  weekTextToday: {
    color: COLORS.lightText,
  },
  heroMock: {
    padding: SP[5],
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SP[4],
  },
  heroEyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.9,
  },
  heroScore: {
    fontFamily: FONT,
    fontSize: 76,
    lineHeight: 78,
    color: COLORS.lightText,
    letterSpacing: -3,
  },
  heroTier: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightMuted,
    letterSpacing: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroSmallNum: {
    fontFamily: FONT,
    fontSize: 17,
    color: COLORS.lightText,
  },
  heroSmallLabel: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  heroScoreSmall: {
    fontFamily: FONT,
    fontSize: 24,
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  sparkWrap: {
    height: 76,
    minWidth: 96,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 5,
  },
  sparkBar: {
    width: 7,
    borderRadius: 4,
    backgroundColor: COLORS.ctaBlack,
    opacity: 0.88,
  },
  compareMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
  },
  compareLargeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
  },
  faceCol: {
    flex: 1,
    alignItems: "center",
    gap: SP[2],
  },
  faceBox: {
    width: "100%",
    height: 112,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faceBoxAccent: {
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  faceHead: {
    width: 54,
    height: 66,
    borderRadius: 28,
    backgroundColor: "#D8CDD9",
  },
  faceNeck: {
    width: 36,
    height: 28,
    marginTop: -4,
    borderRadius: 14,
    backgroundColor: "#D8CDD9",
  },
  faceLabel: {
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.3,
  },
  faceLabelAccent: {
    color: COLORS.lightText,
  },
  arrowText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLORS.lightSub,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.ctaBlack,
  },
  progressCaption: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightSub,
    textAlign: "right",
  },
  sectionKicker: {
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.9,
  },
  metricLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[2],
  },
  metricLineCompact: {
    paddingVertical: SP[2],
  },
  rankPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  rankText: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightText,
  },
  metricName: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
    letterSpacing: 0.1,
  },
  metricMeta: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  metricDelta: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightText,
    minWidth: 44,
    textAlign: "right",
  },
  metricScore: {
    fontFamily: FONT,
    fontSize: 18,
    color: COLORS.lightText,
    minWidth: 28,
    textAlign: "right",
  },
  blackPill: {
    minHeight: 46,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
  },
  blackPillText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  dividerLight: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightHairline,
  },
  storyLine: {
    position: "absolute",
    left: SP[8],
    top: 80,
    bottom: 30,
    width: 2,
    backgroundColor: COLORS.lightHairline,
  },
  storyCard: {
    marginLeft: SP[6],
  },
  storyBig: {
    fontFamily: FONT,
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  storySub: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.lightSub,
  },
  compactHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlinePotential: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  analystHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[1],
  },
  heatmapCard: {
    gap: SP[2],
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightHairline,
  },
  heatName: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
  },
  heatScore: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLORS.lightText,
    width: 28,
    textAlign: "right",
  },
  heatDelta: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightText,
    width: 42,
    textAlign: "right",
  },
  heatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.lightSurfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  content: {
    paddingHorizontal: SP[4],
    paddingTop: SP[5],
    paddingBottom: SP[12],
    gap: SP[4],
  },
  screenTitle: {
    fontSize: 26,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: SP[1],
  },

  // Card
  card: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    gap: SP[3],
  },

  // Section header
  sectionHeader: {
    gap: SP[1],
    marginBottom: SP[1],
  },
  sectionTitle: {
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: SP[1],
  },

  subLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: "Poppins-Regular",
  },
  potentialLabGrid: {
    flexDirection: "row",
    gap: SP[3],
  },
  potentialLabPane: {
    flex: 1,
    gap: SP[2],
  },
  potentialLabImagePressable: {
    borderRadius: RADII.lg,
    overflow: "hidden",
  },
  potentialLabImage: {
    width: "100%",
    aspectRatio: 0.76,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.whiteGlass,
  },
  potentialLabPlaceholder: {
    width: "100%",
    aspectRatio: 0.76,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
  },
  potentialLabPlaceholderText: {
    fontSize: 12,
    color: COLORS.sub,
    textAlign: "center",
  },
  potentialPreviewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  potentialPreviewSafe: {
    flex: 1,
    paddingHorizontal: SP[4],
    paddingBottom: SP[5],
  },
  potentialPreviewHeader: {
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  potentialPreviewTitle: {
    fontSize: 16,
    color: COLORS.text,
  },
  potentialPreviewImageWrap: {
    flex: 1,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  potentialPreviewImage: {
    width: "100%",
    height: "100%",
  },

  // Screen grid
  screenGrid: {
    gap: SP[2],
  },
  screenChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  screenChipText: {
    fontSize: 14,
    color: COLORS.dim,
  },
  screenChipArrow: {
    fontSize: 14,
    color: COLORS.sub,
  },

  // Numbered flow chip
  flowChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  flowIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  flowIndexText: {
    fontSize: 11,
    color: COLORS.accent,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.4,
  },

  // Orphan chip — muted styling
  orphanChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "dashed",
  },
  orphanNote: {
    fontSize: 11,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
    fontStyle: "italic",
  },

  // Dev buttons
  devBtn: {
    flex: 1,
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
  },
  devBtnAccent: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.accentBorder,
  },
  devBtnText: {
    fontSize: 14,
    color: COLORS.dim,
  },
  devBtnTextAccent: {
    color: COLORS.accent,
  },
  lottieButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[3],
  },
  lottieGridBtn: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 48,
    justifyContent: "center",
  },

  // Consent status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    borderRadius: RADII.sm,
    backgroundColor: COLORS.whiteGlass,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },
  statusValue: {
    fontSize: 12,
    color: COLORS.sub,
    flex: 1,
    textAlign: "right",
    fontFamily: "Poppins-Regular",
  },

  // Row of two buttons
  row: {
    flexDirection: "row",
    gap: SP[3],
  },

  // Insight preview modal header
  previewHeader: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
    marginBottom: SP[2],
  },
  previewTitle: {
    fontSize: 15,
    color: COLORS.text,
  },
  previewActions: {
    flexDirection: "row",
    gap: SP[2],
  },
  previewBtn: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  previewBtnClose: {
    borderColor: "rgba(255,80,80,0.3)",
    backgroundColor: "rgba(255,80,80,0.08)",
  },
  lightPreviewBtn: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  previewBtnText: {
    fontSize: 13,
    color: COLORS.dim,
  },
  lightPreviewBtnText: {
    color: COLORS.lightText,
  },
  scoreDeckModalRoot: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  lottieModalRoot: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  lottieModalSub: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },
  lottieStage: {
    flex: 1,
    marginHorizontal: SP[4],
    marginBottom: SP[5],
    borderRadius: RADII.xl,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  lottieAnimation: {
    width: "100%",
    height: "100%",
  },
});
