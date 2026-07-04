import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ArrowLeft, ChevronRight } from "lucide-react-native";

import T from "@/components/ui/T";
import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { useTasksStore } from "@/store/tasks";
import ProgressIcon from "@/assets/icons/progress.svg";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const FONT = "ProximaNova-Bold";
const DETAIL_FONT = "DINNextRounded-Regular";
const GREEN = "#67C900";
const TARGET_SCORE = 95;
const DEFAULT_SCORE = 66;

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

type ProgressPreviewRouteProps = {
  data: any;
  loading: boolean;
  onRefresh: () => void;
};

function clampScore(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_SCORE;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getCurrentScore(data: any): number {
  return clampScore(data?.overall?.current ?? data?.overall_score ?? data?.score);
}

function getCurrentImage(data: any): string | null {
  return (
    data?.latest_scan?.images?.front?.url ??
    data?.latestScan?.images?.front?.url ??
    data?.history?.[0]?.images?.front?.url ??
    data?.history?.[0]?.front_image_url ??
    data?.current_image_url ??
    null
  );
}

function getPotentialImage(data: any): string | null {
  return (
    data?.potential_face?.primaryImageUrl ??
    data?.potentialFace?.primaryImageUrl ??
    data?.potential_face_url ??
    null
  );
}

function RollingDigit({
  digit,
  delay,
  style,
  height,
}: {
  digit: string;
  delay: number;
  style: any;
  height: number;
}) {
  const previous = useRef(digit);
  const [fromDigit, setFromDigit] = useState(digit);
  const motion = useSharedValue(1);

  useEffect(() => {
    if (previous.current === digit) return;
    setFromDigit(previous.current);
    previous.current = digit;
    motion.value = 0;
    motion.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
  }, [delay, digit, motion]);

  useEffect(() => {
    motion.value = 0;
    motion.value = withDelay(delay, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
  }, []);

  const outgoing = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(motion.value, [0, 1], [0, -height]) }],
    opacity: interpolate(motion.value, [0, 0.78, 1], [1, 0.2, 0]),
  }));

  const incoming = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(motion.value, [0, 1], [height, 0]) }],
    opacity: interpolate(motion.value, [0, 0.18, 1], [0, 1, 1]),
  }));

  return (
    <View style={[styles.rollingDigitClip, { height }]}> 
      <Animated.Text style={[style, styles.rollingDigit, outgoing]}>{fromDigit}</Animated.Text>
      <Animated.Text style={[style, styles.rollingDigit, incoming]}>{digit}</Animated.Text>
    </View>
  );
}

function RollingNumber({
  value,
  style,
  height,
}: {
  value: number;
  style: any;
  height: number;
}) {
  const chars = String(Math.max(0, Math.round(value))).split("");
  return (
    <View style={styles.rollingNumber} accessibilityLabel={`${value}`}>
      {chars.map((digit, index) => (
        <RollingDigit
          key={`${chars.length}-${index}`}
          digit={digit}
          delay={index * 45}
          style={style}
          height={height}
        />
      ))}
    </View>
  );
}

function TypewriterText({
  text,
  style,
  delay = 260,
}: {
  text: string;
  style: any;
  delay?: number;
}) {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    setVisible("");
    let index = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setVisible(text.slice(0, index));
        if (index >= text.length && interval) clearInterval(interval);
      }, 24);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [delay, text]);

  return <T style={style}>{visible}</T>;
}

function AnimatedPercent({ value }: { value: number }) {
  return (
    <View style={styles.percentRow} accessibilityLabel={`${value} percent`}>
      <RollingNumber value={value} height={46} style={styles.percentNumber} />
      <T style={styles.percentUnit}>%</T>
    </View>
  );
}

export function ProgressPreviewRoute({ data, loading, onRefresh }: ProgressPreviewRouteProps) {
  const { width } = useWindowDimensions();
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const score = getCurrentScore(data);
  const pointsAway = Math.max(0, TARGET_SCORE - score);
  const currentImage = getCurrentImage(data);
  const potentialImage = getPotentialImage(data);
  const cardWidth = Math.min(width - SP[5] * 2, 430);
  const progress = useSharedValue(0);
  const reveal = useSharedValue(0);
  const scoreValue = useSharedValue(0);

  const currentSource = currentImage ? { uri: currentImage } : require("@/assets/before.jpeg");
  const potentialSource = potentialImage ? { uri: potentialImage } : require("@/assets/after.jpeg");

  const levelCopy = useMemo(() => {
    if (pointsAway <= 0) return "Potential unlocked";
    return `${pointsAway} points until your next visible level`;
  }, [pointsAway]);

  useEffect(() => {
    reveal.value = 0;
    progress.value = 0;
    scoreValue.value = 0;
    reveal.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    progress.value = withDelay(150, withTiming(score, { duration: 940, easing: Easing.out(Easing.cubic) }));
    scoreValue.value = withDelay(100, withTiming(score, { duration: 780, easing: Easing.out(Easing.cubic) }));
  }, [progress, reveal, score, scoreValue]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 14 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(4, progress.value)}%`,
  }));

  const scoreProps = useAnimatedProps(() => ({
    text: `${Math.round(scoreValue.value)}%`,
    defaultValue: "",
  } as any));

  return (
    <AppGradientBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.lightText} />}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: FLOATING_TAB_BAR.contentClearance + SP[6] },
          ]}
        >
          <View style={[styles.inner, { width: cardWidth }]}> 
            <View style={styles.topRail}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/dashboard"))}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <ArrowLeft size={21} color={COLORS.lightText} strokeWidth={2.5} />
              </Pressable>

              <View style={styles.pointsPill}>
                <RollingNumber value={pointsAway} height={24} style={styles.pointsNumber} />
                <TypewriterText text=" points away" style={styles.pointsText} />
              </View>

              <View style={styles.streakPill}>
                <T style={styles.streakIcon}>*</T>
                <T style={styles.streakText}>{currentStreak}</T>
              </View>
            </View>

            <View style={styles.header}>
              <T style={styles.eyebrow}>YOUR PROGRESS</T>
              <T style={styles.title}>See your gap</T>
              <T style={styles.subtitle}>Track the difference between where you are and your best self.</T>
            </View>

            <Animated.View style={[styles.heroCard, heroStyle]}>
              <Image source={require("@/assets/icons/potential-stage.png")} style={styles.stageImage} resizeMode="contain" />
              <View style={styles.heroCopy}>
                <View style={styles.heroTitleRow}>
                  <RollingNumber value={pointsAway} height={34} style={styles.heroPointsNumber} />
                  <TypewriterText text=" points away" style={styles.heroTitleText} delay={340} />
                </View>
                <T style={styles.heroSub}>from your potential</T>
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: score }}>
                    <Animated.View style={[styles.progressFill, fillStyle]} />
                    <View style={[styles.targetMarker, { left: `${TARGET_SCORE}%` }]}> 
                      <T style={styles.targetMarkerText}>{TARGET_SCORE}</T>
                    </View>
                  </View>
                  <T style={styles.progressCaption}>Keep going. Small steps, big change.</T>
                </View>
              </View>
            </Animated.View>

            <View style={styles.compareCard}>
              <View style={styles.compareHeader}>
                <View>
                  <T style={styles.compareKicker}>LEVEL PROGRESS</T>
                  <T style={styles.compareTitle}>{levelCopy}</T>
                </View>
                <AnimatedPercent value={score} />
              </View>

              <View style={styles.faceRow}>
                <View style={styles.faceCol}>
                  <T style={styles.faceLabel}>Current</T>
                  <Image source={currentSource} style={styles.faceImage} resizeMode="cover" />
                </View>
                <View style={styles.faceConnector}>
                  <AnimatedTextInput
                    animatedProps={scoreProps}
                    editable={false}
                    pointerEvents="none"
                    style={styles.animatedPercentInput}
                  />
                  <ChevronRight size={24} color={COLORS.lightSub} strokeWidth={2.5} />
                </View>
                <View style={styles.faceCol}>
                  <T style={styles.faceLabel}>Potential</T>
                  <Image source={potentialSource} style={styles.faceImage} resizeMode="cover" />
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/(tabs)/history")}
              accessibilityRole="button"
              accessibilityLabel="View full progress history"
              style={({ pressed }) => [styles.levelCard, pressed && styles.pressed]}
            >
              <View style={styles.levelIconWrap}>
                <ProgressIcon width={96} height={96} />
              </View>
              <View style={styles.levelCopy}>
                <T style={styles.levelTitle}>Track your progress</T>
                <T style={styles.levelSubtitle}>Score changes, photo history, and next focus areas.</T>
              </View>
              <ChevronRight size={26} color={COLORS.lightSub} strokeWidth={2.4} />
            </Pressable>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={COLORS.lightText} />
                <T style={styles.loadingText}>Refreshing progress</T>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppGradientBackground>
  );
}

export default ProgressPreviewRoute;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    gap: SP[4],
  },
  inner: {
    gap: SP[4],
  },
  topRail: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  pressed: {
    opacity: 0.78,
  },
  pointsPill: {
    minHeight: 40,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightCard,
    paddingHorizontal: SP[4],
    ...SOFT_SHADOW,
  },
  pointsNumber: {
    fontFamily: FONT,
    fontSize: ms(20),
    lineHeight: ms(24),
    color: GREEN,
    letterSpacing: 0,
  },
  pointsText: {
    fontFamily: FONT,
    fontSize: ms(16),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  streakPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  streakIcon: {
    position: "absolute",
    top: 5,
    color: GREEN,
    fontFamily: FONT,
    fontSize: ms(10),
  },
  streakText: {
    color: COLORS.lightText,
    fontFamily: FONT,
    fontSize: ms(17),
  },
  header: {
    alignItems: "center",
    paddingHorizontal: SP[5],
    gap: SP[1],
  },
  eyebrow: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(11),
    color: COLORS.lightSub,
    letterSpacing: 1,
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(34),
    lineHeight: ms(38),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  heroCard: {
    minHeight: sh(158),
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    padding: SP[5],
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    ...SOFT_SHADOW,
  },
  stageImage: {
    position: "absolute",
    right: -sw(8),
    top: sh(8),
    width: sw(142),
    height: sh(132),
  },
  heroCopy: {
    flex: 1,
    paddingRight: sw(102),
    gap: SP[1],
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroPointsNumber: {
    fontFamily: FONT,
    fontSize: ms(30),
    lineHeight: ms(34),
    color: GREEN,
    letterSpacing: 0,
  },
  heroTitleText: {
    fontFamily: FONT,
    fontSize: ms(25),
    lineHeight: ms(31),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  heroSub: {
    fontFamily: FONT,
    fontSize: ms(24),
    lineHeight: ms(28),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  progressWrap: {
    marginTop: SP[3],
    gap: SP[2],
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "visible",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
  },
  targetMarker: {
    position: "absolute",
    top: -8,
    width: 25,
    height: 25,
    marginLeft: -12,
    borderRadius: 13,
    backgroundColor: COLORS.lightText,
    alignItems: "center",
    justifyContent: "center",
  },
  targetMarkerText: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: "#FFFFFF",
  },
  progressCaption: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
  },
  compareCard: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    padding: SP[4],
    ...SOFT_SHADOW,
  },
  compareHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SP[3],
    marginBottom: SP[4],
  },
  compareKicker: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(10),
    color: COLORS.lightSub,
    letterSpacing: 1,
  },
  compareTitle: {
    marginTop: 3,
    fontFamily: FONT,
    fontSize: ms(18),
    lineHeight: ms(22),
    color: COLORS.lightText,
    letterSpacing: 0,
    maxWidth: sw(210),
  },
  percentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  percentNumber: {
    fontFamily: FONT,
    fontSize: ms(42),
    lineHeight: ms(46),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  percentUnit: {
    fontFamily: FONT,
    fontSize: ms(25),
    color: COLORS.lightText,
    marginLeft: 1,
  },
  faceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  faceCol: {
    flex: 1,
    gap: SP[2],
  },
  faceLabel: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  faceImage: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.iconTileLavender,
  },
  faceConnector: {
    width: sw(58),
    alignItems: "center",
    justifyContent: "center",
    gap: SP[1],
  },
  animatedPercentInput: {
    width: sw(58),
    padding: 0,
    textAlign: "center",
    fontFamily: FONT,
    fontSize: ms(18),
    color: COLORS.lightText,
  },
  levelCard: {
    minHeight: sh(118),
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    ...SOFT_SHADOW,
  },
  levelIconWrap: {
    width: 112,
    height: 112,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  levelCopy: {
    flex: 1,
    minWidth: 0,
  },
  levelTitle: {
    fontFamily: FONT,
    fontSize: ms(19),
    lineHeight: ms(23),
    color: COLORS.lightText,
    letterSpacing: 0,
  },
  levelSubtitle: {
    marginTop: 4,
    fontFamily: DETAIL_FONT,
    fontSize: ms(12),
    lineHeight: ms(17),
    color: COLORS.lightSub,
  },
  loadingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SP[2],
  },
  loadingText: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
  },
  rollingNumber: {
    flexDirection: "row",
    alignItems: "center",
  },
  rollingDigitClip: {
    minWidth: ms(13),
    overflow: "hidden",
  },
  rollingDigit: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
});
