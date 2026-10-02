// app/(onboarding)/sigma-choice.tsx
// "Why SigmaMax" — three proof cards fly in and settle into a loose stack
// under a headline that types itself out, then the CTA rises in.
// Ported 1:1 from the standalone HTML direction (402 x 874 design frame); every
// size is multiplied by `s`, a single fit-to-device scale, so the composition
// holds its proportions instead of reflowing.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  hapticHeavy,
  hapticLight,
  hapticRigid,
  hapticSuccess,
  hapticThud,
  hapticTick,
} from "@/lib/haptics";
import { useResponsiveScale } from "@/lib/responsive";

// ---------------------------------------------------------------------------
// Design frame + palette (verbatim from the HTML)
// ---------------------------------------------------------------------------
const FRAME_W = 402;
const FRAME_H = 874;

const INK = "#1F1F24";
const CHEVRON = "#26262B";
const BLUE = "#2E7BF6";
const SLATE = "#3B3E45";
const RUST = "#E4512F";
const CTA_BG = "#1B1B1F";
const BG_1 = "#EDEBF7";
const BG_2 = "#E4E3F2";
const BG_3 = "#DCDCEC";

// Archivo 900 at font-stretch 78% is a condensed grotesque. SF Pro Rounded Bold
// sets roughly 12% wider per character, so the display size drops from the
// design's 45px to keep the same three-line break inside the same 142px block.
const HEADLINE_FS = 40;
const HEADLINE_LH_RATIO = 0.94;

const FONT_BOLD = "SFProRounded-Bold";
const FONT_SEMI = "SFProRounded-Semibold";

const HEADLINE = "Why SigmaMax’s unique approach works";
const CTA_LABEL = "Let’s go";
const TYPE_SPEED = 58;
const HAPTIC_EVERY_CHARS = 3;

// ---------------------------------------------------------------------------
// Motion (ms) — keyframe stops converted from the CSS animations
// ---------------------------------------------------------------------------
const BEZ = Easing.bezier(0.22, 0.8, 0.3, 1);
const EASE_FLOAT = Easing.inOut(Easing.ease);

const FLY_DURATION = 900;
const FLY_SEG_1 = Math.round(FLY_DURATION * 0.58); // 0% -> 58%
const FLY_SEG_2 = Math.round(FLY_DURATION * 0.2); // 58% -> 78%
const FLY_SEG_3 = FLY_DURATION - FLY_SEG_1 - FLY_SEG_2; // 78% -> 100%

const CTA_DELAY = 2500;
const CTA_DURATION = 600;

const CARET_PERIOD = 1100;

type CardMotion = {
  flyDelay: number;
  floatDelay: number;
  floatDuration: number;
};

const CARD_MOTION: Record<"measure" | "studies" | "progress", CardMotion> = {
  measure: { flyDelay: 1550, floatDelay: 2600, floatDuration: 5200 },
  studies: { flyDelay: 1780, floatDelay: 2900, floatDuration: 5800 },
  progress: { flyDelay: 2010, floatDelay: 3100, floatDuration: 4900 },
};

// ---------------------------------------------------------------------------
// One card's entrance + idle float. The HTML nests three elements — fly wrapper,
// float wrapper, rotated face — and the rotation has to stay innermost or the
// translate axes rotate with it.
// ---------------------------------------------------------------------------
function FlyInCard({
  motion,
  s,
  reduceMotion,
  style,
  children,
}: {
  motion: CardMotion;
  s: number;
  reduceMotion: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const op = useSharedValue(0);
  const ty = useSharedValue(150 * s);
  const sc = useSharedValue(0.9);
  const floatY = useSharedValue(0);

  useEffect(() => {
    [op, ty, sc, floatY].forEach(cancelAnimation);

    if (reduceMotion) {
      ty.value = 0;
      sc.value = 1;
      floatY.value = 0;
      op.value = withDelay(motion.flyDelay * 0.25, withTiming(1, { duration: 200 }));
      return;
    }

    op.value = 0;
    ty.value = 150 * s;
    sc.value = 0.9;
    floatY.value = 0;

    op.value = withDelay(
      motion.flyDelay,
      withTiming(1, { duration: FLY_SEG_1, easing: BEZ }),
    );
    ty.value = withDelay(
      motion.flyDelay,
      withSequence(
        withTiming(-16 * s, { duration: FLY_SEG_1, easing: BEZ }),
        withTiming(5 * s, { duration: FLY_SEG_2, easing: BEZ }),
        withTiming(0, { duration: FLY_SEG_3, easing: BEZ }),
      ),
    );
    sc.value = withDelay(
      motion.flyDelay,
      withSequence(
        withTiming(1.025, { duration: FLY_SEG_1, easing: BEZ }),
        withTiming(0.995, { duration: FLY_SEG_2, easing: BEZ }),
        withTiming(1, { duration: FLY_SEG_3, easing: BEZ }),
      ),
    );
    floatY.value = withDelay(
      motion.floatDelay,
      withRepeat(
        withSequence(
          withTiming(-9 * s, {
            duration: motion.floatDuration / 2,
            easing: EASE_FLOAT,
          }),
          withTiming(0, {
            duration: motion.floatDuration / 2,
            easing: EASE_FLOAT,
          }),
        ),
        -1,
      ),
    );
  }, [floatY, motion, op, reduceMotion, s, sc, ty]);

  const flyStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }, { scale: sc.value }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View style={[style, flyStyle]}>
      <Animated.View style={floatStyle}>{children}</Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export default function SigmaChoiceScreen() {
  const insets = useSafeAreaInsets();
  const R = useResponsiveScale();
  const reduceMotion = Boolean(useReducedMotion());

  // Fit the whole 402 x 874 frame, never crop it — the card stack is a fixed
  // block, so scaling off width alone would overflow short devices.
  const s = useMemo(
    () => Math.min(R.width / FRAME_W, R.height / FRAME_H),
    [R.height, R.width],
  );
  const px = (value: number) => value * s;

  // Typewriter headline. Reduced motion skips the reveal by rendering the full
  // string, so the effect never has to reset state synchronously.
  const [typed, setTyped] = useState(0);
  const shown = reduceMotion ? HEADLINE : HEADLINE.slice(0, typed);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setTyped((n) => {
        const next = n + 1;
        if (next >= HEADLINE.length) clearInterval(timer);
        return Math.min(next, HEADLINE.length);
      });
    }, TYPE_SPEED);

    return () => clearInterval(timer);
  }, [reduceMotion]);

  // Caret rides the end of the last typed line. Measured via onTextLayout and
  // drawn as an absolute sibling — never as a View nested inside <Text>, which
  // is the one text construct that can take the native renderer down.
  const [caret, setCaret] = useState<{ x: number; y: number } | null>(null);
  const onHeadlineLayout = (e: {
    nativeEvent: { lines: { x: number; y: number; width: number }[] };
  }) => {
    const lines = e.nativeEvent.lines;
    const last = lines[lines.length - 1];
    if (!last) return;
    const next = { x: last.x + last.width, y: last.y };
    setCaret((prev) =>
      prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5
        ? prev
        : next,
    );
  };

  // Caret: the CSS uses steps(1, end), so this is a hard on/off, not a fade.
  const [caretOn, setCaretOn] = useState(true);
  useEffect(() => {
    if (reduceMotion) return;
    const blink = setInterval(() => setCaretOn((on) => !on), CARET_PERIOD / 2);
    return () => clearInterval(blink);
  }, [reduceMotion]);

  // A tick every few typed letters, so the headline feels like it's typing.
  useEffect(() => {
    if (reduceMotion || typed === 0) return;
    if (HEADLINE[typed - 1]?.trim() && typed % HAPTIC_EVERY_CHARS === 0) hapticTick();
  }, [reduceMotion, typed]);

  // Each card landing gets a solid tap; the last one lands with a thud.
  useEffect(() => {
    if (reduceMotion) return;
    const land = FLY_SEG_1;
    const timers = [
      setTimeout(hapticRigid, CARD_MOTION.measure.flyDelay + land),
      setTimeout(hapticRigid, CARD_MOTION.studies.flyDelay + land),
      setTimeout(hapticThud, CARD_MOTION.progress.flyDelay + land),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  // CTA rise
  const ctaA = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(ctaA);
    ctaA.value = 0;
    ctaA.value = withDelay(
      reduceMotion ? 400 : CTA_DELAY,
      withTiming(1, {
        duration: reduceMotion ? 200 : CTA_DURATION,
        easing: BEZ,
      }),
    );
  }, [ctaA, reduceMotion]);

  // Resolve the scaled offset on the JS thread. `px` is not a worklet, so
  // calling it inside useAnimatedStyle would invoke a plain JS function on the
  // UI thread and take the whole app down.
  const ctaRise = px(18);
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaA.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - ctaA.value) * ctaRise }],
  }));

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  const handleContinue = () => {
    hapticSuccess();
    router.push("/(onboarding)/feature-sequence");
  };

  const cardLabel = {
    fontFamily: FONT_SEMI,
    fontSize: px(17),
    lineHeight: px(17 * 1.16),
    color: "#FFFFFF",
    letterSpacing: px(-0.17),
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={BG_1} />
      {/* 175deg — straight down, tipped a few degrees to the left */}
      <LinearGradient
        colors={[BG_1, BG_2, BG_3]}
        locations={[0, 0.62, 1]}
        start={{ x: 0.545, y: 0 }}
        end={{ x: 0.455, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.frame,
          {
            paddingTop: Math.max(px(58), insets.top + px(6)),
            paddingHorizontal: px(22),
          },
        ]}
      >
        {/* Back */}
        <View style={[styles.backRow, { height: px(34) }]}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={16}
            style={({ pressed }) => [
              styles.backHit,
              { width: px(34), height: px(34) },
              pressed && { opacity: 0.45 },
            ]}
          >
            <Svg width={px(13)} height={px(22)} viewBox="0 0 13 22" fill="none">
              <Path
                d="M11 1.5L2 11l9 9.5"
                stroke={CHEVRON}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Headline — types itself in, caret parked at the end */}
        <View style={{ height: px(142), marginTop: px(14) }}>
          <Text
            accessibilityRole="header"
            accessibilityLabel={HEADLINE}
            maxFontSizeMultiplier={1.1}
            onTextLayout={onHeadlineLayout}
            style={[
              styles.headline,
              {
                fontSize: px(HEADLINE_FS),
                lineHeight: px(HEADLINE_FS * HEADLINE_LH_RATIO),
                letterSpacing: px(HEADLINE_FS * -0.024),
              },
            ]}
          >
            {shown}
          </Text>
          {caret ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: caret.x + px(3),
                top:
                  caret.y +
                  (px(HEADLINE_FS * HEADLINE_LH_RATIO) - px(HEADLINE_FS * 0.78)) / 2 +
                  px(HEADLINE_FS * 0.04),
                width: px(4),
                height: px(HEADLINE_FS * 0.78),
                borderRadius: px(1),
                backgroundColor: INK,
                opacity: caretOn ? 1 : 0,
              }}
            />
          ) : null}
        </View>

        {/* Card stack */}
        <View
          style={{
            position: "relative",
            height: px(456),
            marginTop: px(4),
            marginHorizontal: px(-6),
          }}
        >
          {/* Accurate measurements */}
          <FlyInCard
            motion={CARD_MOTION.measure}
            s={s}
            reduceMotion={reduceMotion}
            style={{ position: "absolute", left: px(6), top: px(2), zIndex: 3 }}
          >
            <View
              style={[
                styles.card,
                {
                  width: px(206),
                  height: px(206),
                  padding: px(16),
                  paddingBottom: px(14),
                  borderRadius: px(34),
                  backgroundColor: BLUE,
                  transform: [{ rotate: "-7deg" }],
                  shadowColor: BLUE,
                  shadowOpacity: 0.55,
                  shadowRadius: px(18),
                  shadowOffset: { width: 0, height: px(14) },
                },
              ]}
            >
              <View style={styles.cardArt}>
                <Svg width={px(148)} height={px(104)} viewBox="0 0 148 104" fill="none">
                  <Path
                    d="M3 3h5M3 3v5M145 3h-5M145 3v5M3 101h5M3 101v-5M145 101h-5M145 101v-5"
                    stroke="#fff"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M74 14v76"
                    stroke="#fff"
                    strokeOpacity={0.5}
                    strokeWidth={1.6}
                    strokeDasharray="5 6"
                  />
                  <Path
                    d="M74 20L100 52 74 84 48 52 74 20z"
                    stroke="#fff"
                    strokeWidth={2.6}
                    strokeLinejoin="round"
                  />
                  <Circle
                    cx={74}
                    cy={52}
                    r={12}
                    stroke="#fff"
                    strokeOpacity={0.75}
                    strokeWidth={2}
                  />
                  <Path
                    d="M30 32h-8M22 32v40M30 72h-8"
                    stroke="#fff"
                    strokeOpacity={0.85}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M112 44v-8M112 36h26M138 36v8"
                    stroke="#fff"
                    strokeOpacity={0.85}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Rect x={104} y={60} width={42} height={21} rx={7} fill="#fff" />
                  <SvgText
                    x={125}
                    y={75}
                    textAnchor="middle"
                    fontFamily={FONT_BOLD}
                    fontSize={13}
                    fill={BLUE}
                  >
                    1.618
                  </SvgText>
                </Svg>
              </View>
              <Text maxFontSizeMultiplier={1.1} style={cardLabel}>
                Accurate{"\n"}measurements
              </Text>
            </View>
          </FlyInCard>

          {/* Analysis on studies */}
          <FlyInCard
            motion={CARD_MOTION.studies}
            s={s}
            reduceMotion={reduceMotion}
            style={{ position: "absolute", right: px(2), top: px(108), zIndex: 2 }}
          >
            <View
              style={[
                styles.card,
                {
                  width: px(198),
                  height: px(198),
                  paddingTop: px(16),
                  paddingRight: px(16),
                  paddingBottom: px(14),
                  paddingLeft: px(60),
                  borderRadius: px(34),
                  backgroundColor: SLATE,
                  transform: [{ rotate: "6deg" }],
                  shadowColor: "#26282E",
                  shadowOpacity: 0.5,
                  shadowRadius: px(18),
                  shadowOffset: { width: 0, height: px(14) },
                },
              ]}
            >
              <View style={{ flex: 1, justifyContent: "center", gap: px(9) }}>
                <Text
                  maxFontSizeMultiplier={1.1}
                  style={{
                    fontFamily: FONT_BOLD,
                    fontSize: px(11),
                    color: "#A6A9B2",
                    letterSpacing: px(11 * 0.07),
                  }}
                >
                  PEER-REVIEWED
                </Text>
                <View style={[styles.statRow, { gap: px(5) }]}>
                  <Text
                    maxFontSizeMultiplier={1.1}
                    style={{
                      fontFamily: FONT_BOLD,
                      fontSize: px(34),
                      lineHeight: px(34 * 0.9),
                      color: "#FFFFFF",
                      letterSpacing: px(34 * -0.03),
                    }}
                  >
                    142
                  </Text>
                  <Text
                    maxFontSizeMultiplier={1.1}
                    style={{
                      fontFamily: FONT_BOLD,
                      fontSize: px(12),
                      color: "#F5624A",
                      letterSpacing: px(12 * 0.03),
                    }}
                  >
                    STUDIES
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: px(4), height: px(9) }}>
                  <View style={{ flex: 3, borderRadius: px(6), backgroundColor: BLUE }} />
                  <View style={{ flex: 2, borderRadius: px(6), backgroundColor: "#4FC08A" }} />
                  <View style={{ flex: 4, borderRadius: px(6), backgroundColor: "#E8D44D" }} />
                </View>
                <View style={{ gap: px(5) }}>
                  <View
                    style={{
                      height: px(7),
                      width: "100%",
                      borderRadius: px(6),
                      backgroundColor: "#55585F",
                    }}
                  />
                  <View
                    style={{
                      height: px(7),
                      width: "66%",
                      borderRadius: px(6),
                      backgroundColor: "#4A4D54",
                    }}
                  />
                </View>
              </View>
              <Text maxFontSizeMultiplier={1.1} style={cardLabel}>
                Analysis on{"\n"}studies
              </Text>
            </View>
          </FlyInCard>

          {/* Real progress tracking */}
          <FlyInCard
            motion={CARD_MOTION.progress}
            s={s}
            reduceMotion={reduceMotion}
            style={{ position: "absolute", left: px(78), top: px(228), zIndex: 1 }}
          >
            <View
              style={[
                styles.card,
                {
                  width: px(200),
                  height: px(200),
                  padding: px(16),
                  paddingBottom: px(14),
                  borderRadius: px(34),
                  backgroundColor: RUST,
                  transform: [{ rotate: "-5deg" }],
                  shadowColor: RUST,
                  shadowOpacity: 0.5,
                  shadowRadius: px(18),
                  shadowOffset: { width: 0, height: px(14) },
                },
              ]}
            >
              <View
                style={[
                  styles.ptsChip,
                  {
                    top: px(-12),
                    left: px(14),
                    paddingHorizontal: px(12),
                    paddingTop: px(6),
                    paddingBottom: px(7),
                    borderRadius: px(12),
                    transform: [{ rotate: "-9deg" }],
                    shadowRadius: px(8),
                    shadowOffset: { width: 0, height: px(4) },
                  },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.1}
                  style={{
                    fontFamily: FONT_BOLD,
                    fontSize: px(14),
                    color: INK,
                    letterSpacing: px(14 * -0.01),
                  }}
                >
                  +18 pts
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingBottom: px(6),
                }}
              >
                <Svg width={px(150)} height={px(96)} viewBox="0 0 150 96" fill="none">
                  <Path
                    d="M2 94h146"
                    stroke="#fff"
                    strokeOpacity={0.45}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Rect x={10} y={62} width={24} height={30} rx={7} fill="#fff" fillOpacity={0.3} />
                  <Rect x={45} y={46} width={24} height={46} rx={7} fill="#fff" fillOpacity={0.45} />
                  <Rect x={80} y={30} width={24} height={62} rx={7} fill="#fff" fillOpacity={0.62} />
                  <Rect x={115} y={10} width={24} height={82} rx={7} fill="#fff" />
                  <Path
                    d="M22 50l35-14 35-16 35-14"
                    stroke={INK}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx={127} cy={6} r={6} fill={INK} />
                </Svg>
              </View>
              <Text maxFontSizeMultiplier={1.1} style={cardLabel}>
                Real progress{"\n"}tracking
              </Text>
            </View>
          </FlyInCard>
        </View>

        {/* CTA */}
        <Animated.View
          style={[
            styles.ctaSlot,
            { paddingBottom: Math.max(px(44), insets.bottom + px(12)) },
            ctaStyle,
          ]}
        >
          <Pressable
            onPress={handleContinue}
            onPressIn={hapticHeavy}
            accessibilityRole="button"
            accessibilityLabel={CTA_LABEL}
            style={({ pressed }) => [
              styles.cta,
              {
                width: px(258),
                height: px(64),
                gap: px(12),
                shadowRadius: px(14),
                shadowOffset: { width: 0, height: px(10) },
              },
              pressed && { backgroundColor: "#000000", transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.15}
              style={{
                fontFamily: FONT_BOLD,
                fontSize: px(20),
                color: "#FFFFFF",
                letterSpacing: px(20 * -0.01),
              }}
            >
              {CTA_LABEL}
            </Text>
            <Svg width={px(10)} height={px(16)} viewBox="0 0 10 16" fill="none">
              <Path
                d="M1.5 1.5L8 8l-6.5 6.5"
                stroke="#fff"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_2,
  },
  frame: {
    flex: 1,
    overflow: "hidden",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backHit: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headline: {
    fontFamily: FONT_BOLD,
    color: INK,
    textAlign: "center",
  },
  card: {
    overflow: "visible",
    elevation: 10,
  },
  cardArt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  ptsChip: {
    position: "absolute",
    zIndex: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    elevation: 6,
  },
  ctaSlot: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: CTA_BG,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    elevation: 10,
  },
});
