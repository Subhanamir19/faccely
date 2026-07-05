// app/(onboarding)/score-projection.tsx
// 90-day score projection — visual language borrowed from the dashboard's
// MiniGraph/JourneyGraph: Y-axis 0/50/100, dashed grid, wide soft glow halo,
// pulsing end-dot ring, upward-settle reveal, and a dashed projected line
// (dashed = future/estimate). Counterfactual "no routine" is a muted red curve.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  StatusBar,
  Pressable,
  ScrollView,
  View,
  Image,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import T from "@/components/ui/T";
import { COLORS, RADII, SP, getProgressForStep } from "@/lib/tokens";
import { ms, sh, useResponsiveScale } from "@/lib/responsive";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";

const FONT_BOLD = ORANGE_ONBOARDING.font;
const LIME = "#35A854";
const SAGE = "#237A3A";
const SAGE_SOFT = "#EAF7EE";

// ---------------------------------------------------------------------------
// Chart geometry — mirrors dashboard MiniGraph
// ---------------------------------------------------------------------------

const SIDE_PAD = SP[5];

const HERO_IMAGE = require("@/assets/onbaording-images/score-projection.png");

const START_SCORE = 63;
const END_SCORE = 90;
const NO_ROUTINE_END = 52;

const WAYPOINT_30 = { frac: 1 / 3, score: 69, delta: 6 };
const WAYPOINT_60 = { frac: 2 / 3, score: 81, delta: 18 };

// Projection curve — single smooth cubic, slow start then accelerating.
// Control-point y-values tuned so the curve passes ~exactly through the
// WAYPOINT_30 (score 69) and WAYPOINT_60 (score 81) dots.
// Counterfactual — gentle drift down from 63 to 52, single smooth cubic
function createProjectionGeometry(chartWidth: number) {
  const chartHeight = Math.min(230, Math.max(180, Math.round(chartWidth * 0.595)));
  const padLeft = Math.min(40, Math.max(30, chartWidth * 0.096));
  const padRight = Math.min(36, Math.max(28, chartWidth * 0.085));
  const padTop = Math.min(32, Math.max(24, chartHeight * 0.133));
  const padBottom = Math.min(28, Math.max(22, chartHeight * 0.114));
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const sy = (score: number) =>
    padTop + (1 - Math.max(0, Math.min(100, score)) / 100) * innerHeight;
  const sx = (fraction: number) => padLeft + fraction * innerWidth;
  const x0 = sx(0);
  const xn = sx(1);
  const y0 = sy(START_SCORE);
  const ya = sy(END_SCORE);
  const yb = sy(NO_ROUTINE_END);
  const sigmaPath =
    `M ${x0},${y0} ` +
    `C ${sx(0.33)},${sy(64)} ${sx(0.67)},${sy(85)} ${xn},${ya}`;
  const noRoutinePath =
    `M ${x0},${y0} ` +
    `C ${sx(0.35)},${sy(62)} ${sx(0.65)},${sy(53)} ${xn},${yb}`;

  return {
    chartWidth,
    chartHeight,
    padLeft,
    padRight,
    padTop,
    innerHeight,
    sx,
    sy,
    x0,
    xn,
    y0,
    ya,
    yb,
    sigmaPath,
    noRoutinePath,
    sigmaFillPath:
      sigmaPath +
      ` L ${xn},${padTop + innerHeight} L ${x0},${padTop + innerHeight} Z`,
  };
}

// ---------------------------------------------------------------------------

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FOCUS_LABEL: Record<string, string> = {
  angularity: "facial angularity",
  harmony: "facial harmony",
  leanness: "facial leanness",
  overall: "routine",
};

// ---------------------------------------------------------------------------
// Pulsing end dot — same pattern as dashboard LastDot
// ---------------------------------------------------------------------------
function PulsingEndDot({ cx, cy, delay }: { cx: number; cy: number; delay: number }) {
  const pulse = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 180 }));
    pulse.value = withDelay(
      delay + 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const ringProps = useAnimatedProps(() => ({
    r: (7 + pulse.value * 10) * appear.value,
    opacity: (1 - pulse.value) * 0.6 * appear.value,
  }));
  const coreProps = useAnimatedProps(() => ({ r: 5 * appear.value }));
  const haloProps = useAnimatedProps(() => ({
    r: 9 * appear.value,
    opacity: 0.25 * appear.value,
  }));

  return (
    <>
      <AnimatedCircle cx={cx} cy={cy} fill={LIME} animatedProps={haloProps} />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill="none"
        stroke={LIME}
        strokeWidth={1.5}
        animatedProps={ringProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill={COLORS.lightBg}
        stroke={LIME}
        strokeWidth={2}
        animatedProps={coreProps}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

export default function ScoreProjectionScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveScale();
  const improveFocus = useOnboarding((s) => s.data.improveFocus);
  const goals = useOnboarding((s) => s.data.goals);

  const focusWord = useMemo(() => {
    const first = improveFocus?.[0];
    if (first && FOCUS_LABEL[first]) return FOCUS_LABEL[first];
    if (goals && goals.length > 0) return "routine";
    return "daily routine";
  }, [improveFocus, goals]);

  const chartWidth = Math.min(560, Math.max(240, responsive.width - SIDE_PAD * 2));
  const geometry = useMemo(() => createProjectionGeometry(chartWidth), [chartWidth]);
  const {
    chartWidth: CHART_W,
    chartHeight: CHART_H,
    padLeft: PAD_LEFT,
    padRight: PAD_RIGHT,
    padTop: PAD_TOP,
    innerHeight: INNER_H,
    sx,
    sy,
    x0: X0,
    xn: XN,
    y0: Y0,
    ya: YA,
    yb: YB,
    sigmaPath: PATH_SIGMA,
    noRoutinePath: PATH_NOROUTINE,
    sigmaFillPath: PATH_SIGMA_FILL,
  } = geometry;
  const axisLabelWidth = Math.min(52, Math.max(40, CHART_W * 0.125));

  // Reveal: both lines draw left-to-right via strokeDashoffset.
  const DASH_LEN = Math.ceil(CHART_W * 2.5);
  const sigmaOffset = useSharedValue(DASH_LEN);
  const noRouteOffset = useSharedValue(DASH_LEN);
  const fillA = useSharedValue(0);
  const scoreVal = useSharedValue(START_SCORE);
  const deltaChipOp = useSharedValue(0);
  const waypoint30A = useSharedValue(0);
  const waypoint60A = useSharedValue(0);

  const [displayScore, setDisplayScore] = useState<number>(START_SCORE);
  const [displayDelta, setDisplayDelta] = useState<number>(0);

  const deltaVal = useSharedValue(0);
  const insightCardOpacity = useSharedValue(0);
  const insightCardY = useSharedValue(14);

  useEffect(() => {
    const REVEAL_DURATION = 1400;
    const EASE = Easing.out(Easing.cubic);

    sigmaOffset.value = withDelay(200, withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.cubic) }));
    noRouteOffset.value = withDelay(300, withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.cubic) }));
    fillA.value = withDelay(900, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));

    scoreVal.value = withDelay(
      200,
      withTiming(END_SCORE, { duration: REVEAL_DURATION, easing: Easing.inOut(Easing.cubic) }),
    );

    waypoint30A.value = withDelay(700, withSpring(1, { damping: 11, stiffness: 190 }));
    waypoint60A.value = withDelay(950, withSpring(1, { damping: 11, stiffness: 190 }));
    deltaChipOp.value = withDelay(1300, withTiming(1, { duration: 400, easing: EASE }));

    // Insight card — enters after the graph has drawn
    insightCardOpacity.value = withDelay(1500, withTiming(1, { duration: 500, easing: EASE }));
    insightCardY.value = withDelay(1500, withSpring(0, { damping: 14, stiffness: 180 }));
    deltaVal.value = withDelay(
      1700,
      withTiming(END_SCORE - START_SCORE, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [sigmaOffset, noRouteOffset, fillA, scoreVal, waypoint30A, waypoint60A, deltaChipOp, deltaVal, insightCardOpacity, insightCardY]);

  useAnimatedReaction(
    () => Math.round(scoreVal.value),
    (current, prev) => {
      if (current !== prev) runOnJS(setDisplayScore)(current);
    },
  );

  useAnimatedReaction(
    () => Math.round(deltaVal.value),
    (current, prev) => {
      if (current !== prev) runOnJS(setDisplayDelta)(current);
    },
  );

  const fillProps = useAnimatedProps(() => ({ fillOpacity: fillA.value }));
  const sigmaProps = useAnimatedProps(() => ({ strokeDashoffset: sigmaOffset.value }));
  const noRouteProps = useAnimatedProps(() => ({ strokeDashoffset: noRouteOffset.value }));

  const deltaChipStyle = useAnimatedStyle(() => ({
    opacity: deltaChipOp.value,
    transform: [{ translateY: (1 - deltaChipOp.value) * 8 }],
  }));

  const wp30Style = useAnimatedStyle(() => ({
    opacity: waypoint30A.value,
    transform: [{ scale: waypoint30A.value }],
  }));
  const wp60Style = useAnimatedStyle(() => ({
    opacity: waypoint60A.value,
    transform: [{ scale: waypoint60A.value }],
  }));

  const insightCardStyle = useAnimatedStyle(() => ({
    opacity: insightCardOpacity.value,
    transform: [{ translateY: insightCardY.value }],
  }));

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const handleContinue = useCallback(() => {
    hapticSuccess();
    router.push("/(onboarding)/transformation");
  }, []);

  const progress = getProgressForStep("score-projection");

  const wp30X = sx(WAYPOINT_30.frac);
  const wp30Y = sy(WAYPOINT_30.score);
  const wp60X = sx(WAYPOINT_60.frac);
  const wp60Y = sy(WAYPOINT_60.score);

  return (
    <OrangeOnboardingLayout
      headerImage={HERO_IMAGE}
      headerImageMode="contain"
      scrollable={false}
      footer={<OrangePrimaryButton label="See my plan" onPress={handleContinue} />}
    >

      {/* Top row: circular back + progress */}
      <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <ChevronLeft size={ms(20)} color={COLORS.lightText} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.heroWrap}>
          <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <T style={styles.headline}>Your score in 90 days</T>
          <T style={styles.subtext}>
            If you commit to your {focusWord}, here's the trajectory
          </T>
        </Animated.View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <View style={[styles.chart, { width: CHART_W, height: CHART_H }]}>
            <Svg width={CHART_W} height={CHART_H}>
              <Defs>
                <SvgGradient id="sigmaFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={LIME} stopOpacity="0.42" />
                  <Stop offset="100%" stopColor={LIME} stopOpacity="0" />
                </SvgGradient>
              </Defs>

              {/* Dashed grid — matches dashboard MiniGraph (3,5) */}
              {[0.33, 0.66].map((frac, i) => (
                <Line
                  key={i}
                  x1={PAD_LEFT}
                  y1={PAD_TOP + frac * INNER_H}
                  x2={CHART_W - PAD_RIGHT}
                  y2={PAD_TOP + frac * INNER_H}
                  stroke="rgba(0,0,0,0.10)"
                  strokeWidth={1}
                  strokeDasharray="3,5"
                />
              ))}

              {/* Y-axis labels — 0 / 50 / 100 */}
              {[100, 50, 0].map((score) => (
                <SvgText
                  key={score}
                  x={PAD_LEFT - 10}
                  y={sy(score) + 3.5}
                  fontSize="10"
                  fontWeight="600"
                  fill="rgba(0,0,0,0.50)"
                  textAnchor="end"
                >
                  {score}
                </SvgText>
              ))}

              {/* Area fill under sigma line */}
              <AnimatedPath d={PATH_SIGMA_FILL} fill="url(#sigmaFill)" animatedProps={fillProps} />

              {/* No-routine counterfactual — solid red, draws in */}
              <AnimatedPath
                d={PATH_NOROUTINE}
                stroke={COLORS.declineRed}
                strokeOpacity={0.78}
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={DASH_LEN}
                animatedProps={noRouteProps}
              />

              {/* Wide soft glow halo behind the lime line */}
              <AnimatedPath
                d={PATH_SIGMA}
                stroke={LIME}
                strokeWidth={14}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.20}
                strokeDasharray={DASH_LEN}
                animatedProps={sigmaProps}
              />

              {/* Main projection — lime, draws in */}
              <AnimatedPath
                d={PATH_SIGMA}
                stroke={LIME}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={DASH_LEN}
                animatedProps={sigmaProps}
              />

              {/* Start dot */}
              <Circle cx={X0} cy={Y0} r={4} fill="rgba(0,0,0,0.65)" />

              {/* Waypoint dots */}
              <Circle cx={wp30X} cy={wp30Y} r={3.5} fill="#FFFFFF" stroke={LIME} strokeWidth={1.5} />
              <Circle cx={wp60X} cy={wp60Y} r={3.5} fill="#FFFFFF" stroke={LIME} strokeWidth={1.5} />

              {/* No-routine end dot */}
              <Circle cx={XN} cy={YB} r={3.5} fill={COLORS.declineRed} fillOpacity={0.7} />

              {/* Pulsing end dot — LastDot pattern */}
              <PulsingEndDot cx={XN} cy={YA} delay={1200} />
            </Svg>

            {/* Waypoint delta chips (positioned in JS over the SVG) */}
            <Animated.View
              style={[styles.wpLabel, { left: wp30X - 18, top: wp30Y - 28 }, wp30Style]}
              pointerEvents="none"
            >
              <T style={styles.wpLabelText}>+{WAYPOINT_30.delta}</T>
            </Animated.View>
            <Animated.View
              style={[styles.wpLabel, { left: wp60X - 20, top: wp60Y - 28 }, wp60Style]}
              pointerEvents="none"
            >
              <T style={styles.wpLabelText}>+{WAYPOINT_60.delta}</T>
            </Animated.View>
          </View>

          {/* X-axis */}
          <View style={styles.xAxis}>
            {[
              { label: "DAY 1", x: X0 },
              { label: "DAY 30", x: sx(WAYPOINT_30.frac) },
              { label: "DAY 60", x: sx(WAYPOINT_60.frac) },
              { label: "DAY 90", x: XN },
            ].map((tick) => (
              <T
                key={tick.label}
                style={[
                  styles.axisLabel,
                  { left: tick.x - axisLabelWidth / 2, width: axisLabelWidth },
                ]}
              >
                {tick.label}
              </T>
            ))}
          </View>

          {/* Legend */}
          <View style={[styles.legend, { paddingHorizontal: PAD_LEFT }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: LIME }]} />
              <T style={styles.legendText}>With SigmaMax</T>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: COLORS.declineRed, opacity: 0.78 }]} />
              <T style={styles.legendText}>No routine</T>
            </View>
          </View>
        </View>

        {/* Insight line — simple animated delta */}
        <Animated.View style={[styles.insightTextOnly, insightCardStyle]}>
          <T style={styles.insightLeadCentered}>Your score can increase up to</T>
          <T style={styles.insightDeltaBig}>+{displayDelta}</T>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.cta,
            pressed && { backgroundColor: COLORS.ctaBlackPressed },
          ]}
        >
          <T style={styles.ctaText}>SEE MY PLAN</T>
        </Pressable>
      </View>
    </OrangeOnboardingLayout>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },

  topRow: {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SIDE_PAD,
    paddingBottom: SP[3],
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: sh(6),
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 0,
    paddingTop: SP[3],
    paddingBottom: SP[4],
  },

  heroWrap: {
    display: "none",
    alignItems: "center",
    marginBottom: SP[3],
  },
  heroImage: {
    width: "100%",
    aspectRatio: 2,
  },
  headline: {
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: 0,
    color: COLORS.lightText,
    textAlign: "left",
    marginBottom: SP[2],
  },
  subtext: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
    textAlign: "left",
    marginBottom: SP[4],
  },

  chartCard: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.lightHairline,
    paddingVertical: SP[4],
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  chart: {
    position: "relative",
    alignSelf: "center",
  },
  wpLabel: {
    position: "absolute",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.sm,
    backgroundColor: SAGE_SOFT,
    borderWidth: 1,
    borderColor: LIME,
  },
  wpLabelText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(11),
    color: SAGE,
    letterSpacing: 0.2,
  },

  xAxis: {
    position: "relative",
    height: 16,
    marginTop: SP[2],
  },
  axisLabel: {
    position: "absolute",
    textAlign: "center",
    fontFamily: FONT_BOLD,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: COLORS.lightSub,
  },

  legend: {
    flexDirection: "row",
    gap: SP[5],
    marginTop: SP[3],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  legendLine: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(12),
    color: COLORS.lightSub,
  },

  insightTextOnly: {
    alignItems: "center",
    marginTop: SP[5],
    marginBottom: SP[4],
  },
  insightLeadCentered: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(13),
    lineHeight: ms(18),
    letterSpacing: 0.2,
    color: COLORS.lightSub,
    textAlign: "center",
  },
  insightDeltaBig: {
    fontFamily: FONT_BOLD,
    fontSize: ms(56),
    lineHeight: ms(64),
    letterSpacing: -1.5,
    color: SAGE,
    marginTop: SP[1],
  },
  footer: {
    display: "none",
    paddingTop: SP[3],
    paddingHorizontal: SIDE_PAD,
    backgroundColor: COLORS.lightBg,
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
