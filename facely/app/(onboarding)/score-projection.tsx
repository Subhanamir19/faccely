// app/(onboarding)/score-projection.tsx
// Trust screen — "SigmaMax supports steady progress".
// A white card holds two curves: a solid green one (SigmaMax) that climbs and
// settles high, and a dashed coral one (other apps) that wobbles and stalls.
// Both draw left-to-right on entry; the solid line uses strokeDashoffset, the
// dashed line uses an animated clip rect because its dash array is the texture.
import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";
import ScreenBackground from "@/components/onboarding/ScreenBackground";
import {
  hapticLight,
  hapticCrescendo,
  hapticTick,
  hapticSuccess,
} from "@/lib/haptics";
import { useResponsiveScale } from "@/lib/responsive";
import { BG_MOODS } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";

// ---------------------------------------------------------------------------
// Palette — carried over 1:1 from the reference trust screen.
// ---------------------------------------------------------------------------
const INK = "#16181A";
const GREEN = "#4FAF55";
const GREEN_BUBBLE = "#56B85F";
const GREEN_SPARK = "#57BC5F";
const GREEN_DEEP = "#3E9B47";
const STAT_BG = "#DCEFD6";
const STAT_BADGE = "#BCE3B5";
const CORAL = "#F4694F";
const AXIS = "rgba(23,24,26,0.16)";
const AXIS_TEXT = "rgba(23,24,26,0.34)";
const CARD = "#FFFFFF";
const BG_SHELL = BG_MOODS.mint.bottom;

const FONT_BOLD = "SFProRounded-Bold";
const FONT_SEMI = "SFProRounded-Semibold";
const FONT_REG = "SFProRounded-Regular";

// TODO(copy): 62% is the reference figure. Swap in the real SigmaMax number.
const STAT_LEAD = "62% SigmaMax users";
const STAT_TAIL = " maintain their score gain over 6 months";

// ---------------------------------------------------------------------------
// Motion schedule (ms)
// ---------------------------------------------------------------------------
const T_HEAD = 60;
const T_CARD = 180;
const T_GREEN = 420;
const D_GREEN = 1150;
const T_CORAL = 560;
const D_CORAL = 1100;
const T_LBL_SCORE = 780;
const T_LBL_OTHER = 920;
const T_DOT_END = T_GREEN + D_GREEN - 140;
const T_BUBBLE = T_DOT_END + 110;
const T_STAT = 1780;
const T_CTA = 1960;

const EASE_DRAW = Easing.inOut(Easing.cubic);
const EASE_OUT = Easing.out(Easing.cubic);

// Haptics track the pen, not the clock. Ticks are spaced evenly along the
// drawn *distance*, then mapped back through the draw easing, so they bunch up
// where the line accelerates and thin out as it settles.
const GREEN_TICKS = 14;

function inverseEaseInOutCubic(p: number) {
  return p < 0.5
    ? Math.cbrt(p / 4)
    : 1 - Math.cbrt(2 * (1 - p)) / 2;
}

function drawTickTimes(start: number, duration: number, count: number) {
  const times: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    times.push(start + inverseEaseInOutCubic(i / count) * duration);
  }
  return times;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Chart geometry — every point is a fraction of the card box, so the whole
// composition scales with the device instead of drifting off a fixed viewBox.
// ---------------------------------------------------------------------------
type Pt = { x: number; y: number };

const P_START: Pt = { x: 0.103, y: 0.542 };
const P_GREEN_END: Pt = { x: 0.804, y: 0.218 };
const P_CORAL_1: Pt = { x: 0.288, y: 0.471 };
const P_CORAL_2: Pt = { x: 0.436, y: 0.548 };
const P_CORAL_3: Pt = { x: 0.636, y: 0.403 };
const P_CORAL_END: Pt = { x: 0.821, y: 0.428 };

const AXIS_X0 = 0.126;
const AXIS_X1 = 0.888;
const AXIS_Y = 0.85;
const AXIS_Y_TOP = 0.668;

function createChartGeometry(w: number, h: number) {
  const at = (p: Pt): Pt => ({ x: p.x * w, y: p.y * h });
  const s = at(P_START);
  const g = at(P_GREEN_END);

  // Solid curve: one symmetric cubic, flat at both ends — gentle start, firm
  // middle, settled finish.
  const gdx = g.x - s.x;
  const greenPath =
    "M " + s.x + "," + s.y +
    " C " + (s.x + gdx * 0.42) + "," + s.y +
    " " + (g.x - gdx * 0.42) + "," + g.y +
    " " + g.x + "," + g.y;

  // Dashed curve: chained cubics with horizontal tangents at each extremum, so
  // every peak and trough reads as a real turn rather than a kink.
  const knots = [s, at(P_CORAL_1), at(P_CORAL_2), at(P_CORAL_3), at(P_CORAL_END)];
  let coralPath = "M " + knots[0].x + "," + knots[0].y;
  for (let i = 0; i < knots.length - 1; i += 1) {
    const a = knots[i];
    const b = knots[i + 1];
    const k = (b.x - a.x) * 0.35;
    coralPath +=
      " C " + (a.x + k) + "," + a.y +
      " " + (b.x - k) + "," + b.y +
      " " + b.x + "," + b.y;
  }

  const stroke = Math.max(5, w * 0.023);

  return {
    greenPath,
    coralPath,
    stroke,
    start: s,
    greenEnd: g,
    coralEnd: at(P_CORAL_END),
    dotR: stroke * 1.26,
    dotStroke: stroke * 0.46,
    coralDotR: stroke * 0.84,
    dash: [stroke * 2.4, stroke * 1.7] as [number, number],
    axisX0: AXIS_X0 * w,
    axisX1: AXIS_X1 * w,
    axisY: AXIS_Y * h,
    axisYTop: AXIS_Y_TOP * h,
    drawLen: Math.ceil(w * 2.6),
  };
}

// ---------------------------------------------------------------------------
// Decorative four-point sparkle
// ---------------------------------------------------------------------------
function Sparkle({
  size,
  left,
  top,
  delay,
  reduceMotion,
}: {
  size: number;
  left: number;
  top: number;
  delay: number;
  reduceMotion: boolean;
}) {
  const a = useSharedValue(0);

  useEffect(() => {
    a.value = withDelay(
      delay,
      reduceMotion
        ? withTiming(1, { duration: 160 })
        : withSpring(1, { damping: 12, stiffness: 190 }),
    );
  }, [a, delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: a.value,
    transform: [{ scale: reduceMotion ? 1 : a.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left, top, width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 0 C13.1 7.2 16.8 10.9 24 12 C16.8 13.1 13.1 16.8 12 24 C10.9 16.8 7.2 13.1 0 12 C7.2 10.9 10.9 7.2 12 0 Z"
          fill={GREEN_SPARK}
        />
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export default function ScoreProjectionScreen() {
  const insets = useSafeAreaInsets();
  const R = useResponsiveScale();
  const reduceMotion = Boolean(useReducedMotion());

  const sidePad = Math.round(R.width * 0.087);
  const cardW = R.width - sidePad * 2;
  const cardH = Math.round(cardW * 0.983);
  const geo = useMemo(() => createChartGeometry(cardW, cardH), [cardW, cardH]);

  const headA = useSharedValue(0);
  const cardA = useSharedValue(0);
  const greenOffset = useSharedValue(geo.drawLen);
  const coralClip = useSharedValue(0);
  const startDotA = useSharedValue(0);
  const endDotA = useSharedValue(0);
  const coralDotA = useSharedValue(0);
  const scoreLblA = useSharedValue(0);
  const otherLblA = useSharedValue(0);
  const bubbleA = useSharedValue(0);
  const statA = useSharedValue(0);
  const ctaA = useSharedValue(0);

  useEffect(() => {
    greenOffset.value = geo.drawLen;

    if (reduceMotion) {
      headA.value = withTiming(1, { duration: 200 });
      cardA.value = withDelay(80, withTiming(1, { duration: 200 }));
      greenOffset.value = 0;
      coralClip.value = 1;
      startDotA.value = withDelay(160, withTiming(1, { duration: 200 }));
      endDotA.value = withDelay(160, withTiming(1, { duration: 200 }));
      coralDotA.value = withDelay(160, withTiming(1, { duration: 200 }));
      scoreLblA.value = withDelay(240, withTiming(1, { duration: 200 }));
      otherLblA.value = withDelay(240, withTiming(1, { duration: 200 }));
      bubbleA.value = withDelay(320, withTiming(1, { duration: 200 }));
      statA.value = withDelay(400, withTiming(1, { duration: 200 }));
      ctaA.value = withDelay(480, withTiming(1, { duration: 200 }));
      return;
    }

    headA.value = withDelay(T_HEAD, withTiming(1, { duration: 460, easing: EASE_OUT }));
    cardA.value = withDelay(T_CARD, withTiming(1, { duration: 480, easing: EASE_OUT }));

    greenOffset.value = withDelay(
      T_GREEN,
      withTiming(0, { duration: D_GREEN, easing: EASE_DRAW }),
    );
    coralClip.value = withDelay(
      T_CORAL,
      withTiming(1, { duration: D_CORAL, easing: EASE_DRAW }),
    );

    startDotA.value = withDelay(
      T_GREEN - 60,
      withSpring(1, { damping: 11, stiffness: 200 }),
    );
    endDotA.value = withDelay(T_DOT_END, withSpring(1, { damping: 10, stiffness: 190 }));
    coralDotA.value = withDelay(
      T_CORAL + D_CORAL - 160,
      withSpring(1, { damping: 12, stiffness: 190 }),
    );

    scoreLblA.value = withDelay(
      T_LBL_SCORE,
      withTiming(1, { duration: 380, easing: EASE_OUT }),
    );
    otherLblA.value = withDelay(
      T_LBL_OTHER,
      withTiming(1, { duration: 380, easing: EASE_OUT }),
    );
    bubbleA.value = withDelay(T_BUBBLE, withSpring(1, { damping: 12, stiffness: 210 }));
    statA.value = withDelay(T_STAT, withTiming(1, { duration: 440, easing: EASE_OUT }));
    ctaA.value = withDelay(T_CTA, withTiming(1, { duration: 440, easing: EASE_OUT }));
  }, [
    bubbleA, cardA, coralClip, coralDotA, ctaA, endDotA, geo.drawLen, greenOffset,
    headA, otherLblA, reduceMotion, scoreLblA, startDotA, statA,
  ]);

  // Haptic track for the draw: a run of ticks under the climbing green line,
  // one light tap when the coral line gives up, a building crescendo on the bubble.
  useEffect(() => {
    if (reduceMotion) return;

    const timers = drawTickTimes(T_GREEN, D_GREEN, GREEN_TICKS).map((at) =>
      setTimeout(hapticTick, Math.round(at)),
    );
    timers.push(setTimeout(hapticLight, T_CORAL + D_CORAL - 160));
    timers.push(setTimeout(hapticCrescendo, T_BUBBLE));

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const greenProps = useAnimatedProps(() => ({
    strokeDashoffset: greenOffset.value,
  }));
  const coralClipProps = useAnimatedProps(() => ({
    width: Math.max(0.01, coralClip.value * cardW),
  }));
  const startDotProps = useAnimatedProps(() => ({
    r: geo.dotR * startDotA.value,
    strokeWidth: geo.dotStroke * startDotA.value,
  }));
  const endDotProps = useAnimatedProps(() => ({
    r: geo.dotR * endDotA.value,
    strokeWidth: geo.dotStroke * endDotA.value,
  }));
  const coralDotProps = useAnimatedProps(() => ({
    r: geo.coralDotR * coralDotA.value,
  }));

  const headStyle = useAnimatedStyle(() => ({
    opacity: headA.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - headA.value) * 10 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardA.value,
    transform: [
      { translateY: reduceMotion ? 0 : (1 - cardA.value) * 14 },
      { scale: reduceMotion ? 1 : 0.972 + cardA.value * 0.028 },
    ],
  }));
  const scoreLblStyle = useAnimatedStyle(() => ({
    opacity: scoreLblA.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - scoreLblA.value) * -8 }],
  }));
  const otherLblStyle = useAnimatedStyle(() => ({
    opacity: otherLblA.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - otherLblA.value) * -8 }],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, bubbleA.value * 1.6),
    transform: [{ scale: reduceMotion ? 1 : 0.4 + bubbleA.value * 0.6 }],
  }));
  const statStyle = useAnimatedStyle(() => ({
    opacity: statA.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - statA.value) * 12 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaA.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - ctaA.value) * 12 }],
  }));

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const handleContinue = useCallback(() => {
    hapticSuccess();
    // Locked findings need the user's scan photo; skippers go straight to the paywall.
    const scanned = !!useOnboarding.getState().scanFrontalUri;
    router.push(scanned ? "/(onboarding)/weak-points-locked" : "/(onboarding)/paywall");
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenBackground mood="mint" />

      <Sparkle
        size={R.ms(20)}
        left={R.width * 0.744}
        top={insets.top + R.sh(44)}
        delay={reduceMotion ? 0 : 260}
        reduceMotion={reduceMotion}
      />
      <Sparkle
        size={R.ms(24)}
        left={R.width * 0.028}
        top={insets.top + R.sh(190)}
        delay={reduceMotion ? 0 : 360}
        reduceMotion={reduceMotion}
      />
      <Sparkle
        size={R.ms(18)}
        left={R.width * 0.912}
        top={insets.top + R.sh(186)}
        delay={reduceMotion ? 0 : 440}
        reduceMotion={reduceMotion}
      />

      <View
        style={[
          styles.topRow,
          { paddingTop: insets.top + R.sh(10), paddingHorizontal: Math.round(sidePad * 0.72) },
        ]}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.45 }]}
        >
          <ChevronLeft size={R.ms(30)} color={INK} strokeWidth={2.6} />
        </Pressable>
      </View>

      <Animated.View style={[styles.headline, { paddingHorizontal: sidePad }, headStyle]}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.15}
          style={[
            styles.headlineText,
            { fontSize: R.clamp(40, 30, 44), lineHeight: R.clamp(41, 32, 45) },
          ]}
        >
          SigmaMax supports{"\n"}steady progress
        </Text>
      </Animated.View>

      {/* Card + chart */}
      <View style={[styles.stage, { paddingBottom: R.sh(18) }]}>
        <Animated.View
          style={[
            styles.card,
            { width: cardW, height: cardH, borderRadius: R.clamp(28, 22, 34) },
            cardStyle,
          ]}
        >
          <Svg width={cardW} height={cardH}>
            <Defs>
              <ClipPath id="coral-reveal">
                <AnimatedRect x={0} y={0} height={cardH} animatedProps={coralClipProps} />
              </ClipPath>
            </Defs>

            {/* Faint L-axis */}
            <Path
              d={
                "M " + geo.axisX0 + "," + geo.axisYTop +
                " L " + geo.axisX0 + "," + geo.axisY +
                " L " + geo.axisX1 + "," + geo.axisY
              }
              stroke={AXIS}
              strokeWidth={1}
              fill="none"
            />

            {/* Other apps — dashed, revealed by the sweeping clip rect */}
            <G clipPath="url(#coral-reveal)">
              <Path
                d={geo.coralPath}
                stroke={CORAL}
                strokeWidth={geo.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={geo.dash}
                fill="none"
              />
            </G>

            {/* SigmaMax — solid, drawn by strokeDashoffset */}
            <AnimatedPath
              d={geo.greenPath}
              stroke={GREEN}
              strokeWidth={geo.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={geo.drawLen}
              animatedProps={greenProps}
            />

            <AnimatedCircle
              cx={geo.coralEnd.x}
              cy={geo.coralEnd.y}
              fill={CORAL}
              animatedProps={coralDotProps}
            />
            <AnimatedCircle
              cx={geo.start.x}
              cy={geo.start.y}
              fill={CARD}
              stroke={GREEN}
              animatedProps={startDotProps}
            />
            <AnimatedCircle
              cx={geo.greenEnd.x}
              cy={geo.greenEnd.y}
              fill={CARD}
              stroke={GREEN}
              animatedProps={endDotProps}
            />
          </Svg>

          {/* Axis caption sits on the baseline, same as the reference */}
          <Text
            maxFontSizeMultiplier={1.1}
            style={[
              styles.axisLabel,
              {
                left: cardW * 0.17,
                top: cardH * AXIS_Y - R.ms(12),
                fontSize: R.clamp(17, 13, 19),
              },
            ]}
          >
            Time
          </Text>

          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", left: cardW * 0.06, top: cardH * 0.355 },
              scoreLblStyle,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.1}
              style={[styles.curveLabel, { color: INK, fontSize: R.clamp(17, 13, 19) }]}
            >
              Your score
            </Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", left: cardW * 0.555, top: cardH * 0.295 },
              otherLblStyle,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.1}
              style={[styles.curveLabel, { color: CORAL, fontSize: R.clamp(17, 13, 19) }]}
            >
              Other apps
            </Text>
          </Animated.View>

          {/* Brand bubble with a tail aimed at the end dot */}
          <Animated.View
            pointerEvents="none"
            style={[styles.bubbleWrap, { left: cardW * 0.648, top: cardH * 0.048 }, bubbleStyle]}
          >
            <View
              style={[
                styles.bubble,
                {
                  paddingHorizontal: R.ms(13),
                  paddingVertical: R.ms(7),
                  borderRadius: R.clamp(12, 9, 15),
                },
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.1}
                style={[styles.bubbleText, { fontSize: R.clamp(17, 13, 19) }]}
              >
                SigmaMax
              </Text>
            </View>
            <View
              style={[
                styles.bubbleTail,
                {
                  width: R.ms(11),
                  height: R.ms(11),
                  left: R.ms(13),
                  bottom: -R.ms(4),
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Proof pill */}
      <Animated.View
        style={[
          styles.statPill,
          {
            marginHorizontal: sidePad,
            borderRadius: R.clamp(20, 16, 26),
            paddingVertical: R.sh(16),
            paddingHorizontal: R.ms(16),
            gap: R.ms(12),
          },
          statStyle,
        ]}
      >
        <View
          style={[
            styles.statBadge,
            { width: R.ms(22), height: R.ms(22), borderRadius: R.ms(11) },
          ]}
        >
          <View
            style={[
              styles.statTriangle,
              {
                borderLeftWidth: R.ms(5),
                borderRightWidth: R.ms(5),
                borderBottomWidth: R.ms(8),
              },
            ]}
          />
        </View>
        <Text
          maxFontSizeMultiplier={1.2}
          style={[
            styles.statText,
            { fontSize: R.clamp(17, 14, 19), lineHeight: R.clamp(21, 18, 24) },
          ]}
        >
          <Text style={styles.statLead}>{STAT_LEAD}</Text>
          {STAT_TAIL}
        </Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View
        style={[
          styles.footer,
          {
            paddingTop: R.sh(26),
            paddingBottom: Math.max(R.sh(20), insets.bottom + R.sh(14)),
            paddingHorizontal: sidePad,
          },
          ctaStyle,
        ]}
      >
        <OrangePrimaryButton
          label="Next"
          onPress={handleContinue}
          tone="ink"
          uppercase={false}
          fontFamily={FONT_BOLD}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SHELL,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headline: {
    alignItems: "center",
  },
  headlineText: {
    color: INK,
    fontFamily: FONT_BOLD,
    letterSpacing: -1.3,
    textAlign: "center",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: CARD,
    overflow: "visible",
    shadowColor: "#1F3A22",
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  axisLabel: {
    position: "absolute",
    color: AXIS_TEXT,
    fontFamily: FONT_SEMI,
    letterSpacing: -0.2,
  },
  curveLabel: {
    fontFamily: FONT_BOLD,
    letterSpacing: -0.3,
  },
  bubbleWrap: {
    position: "absolute",
    transformOrigin: "left bottom",
  },
  bubble: {
    backgroundColor: GREEN_BUBBLE,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: {
    color: "#FFFFFF",
    fontFamily: FONT_BOLD,
    letterSpacing: -0.3,
  },
  bubbleTail: {
    position: "absolute",
    backgroundColor: GREEN_BUBBLE,
    transform: [{ rotate: "45deg" }],
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: STAT_BG,
  },
  statBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: STAT_BADGE,
  },
  statTriangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: GREEN_DEEP,
  },
  statText: {
    flex: 1,
    color: INK,
    fontFamily: FONT_REG,
    letterSpacing: -0.3,
  },
  statLead: {
    fontFamily: FONT_BOLD,
  },
  footer: {
    alignSelf: "stretch",
  },
});
