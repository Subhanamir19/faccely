import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  OnboardingSequenceHeader,
  OrangePrimaryButton,
} from "@/components/onboarding/OrangeOnboardingLayout";
import { useResponsiveScale } from "@/lib/responsive";

const BACKGROUND = "#F5F0E8";
const INK = "#17140F";
const PAPER = "#FFFDF8";
const PAPER_LINE = "#D9D0BA";
const MUTED = "rgba(23,20,15,0.52)";
const BLUE = "#7C93FF";
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_BURST = Easing.bezier(0.34, 1.4, 0.6, 1);
const CTA_REVEAL_MS = 1300;

type Paper = {
  tag: string;
  title: string;
  bars: Array<"full" | "mid" | "short" | "accent">;
  startX: number;
  startY: number;
  startRotation: number;
  targetX: number;
  targetY: number;
  targetRotation: number;
  delay: number;
  zIndex: number;
};

const PAPERS: Paper[] = [
  {
    tag: "Evolution & Human Behavior · 1999",
    title: "Facial shape symmetry ratings",
    bars: ["full", "mid", "short"],
    startX: -230,
    startY: 170,
    startRotation: -64,
    targetX: -40,
    targetY: 16,
    targetRotation: -13,
    delay: 150,
    zIndex: 1,
  },
  {
    tag: "J. Amer. Acad. Dermatology",
    title: "Skin evenness and perceived health",
    bars: ["full", "full", "mid"],
    startX: 220,
    startY: -190,
    startRotation: 58,
    targetX: 24,
    targetY: -8,
    targetRotation: 10,
    delay: 220,
    zIndex: 2,
  },
  {
    tag: "Int'l J. Cosmetic Science · 2010",
    title: "Skin condition as a mate-value cue",
    bars: ["mid", "full", "short"],
    startX: -210,
    startY: -210,
    startRotation: -48,
    targetX: -16,
    targetY: -27,
    targetRotation: -6,
    delay: 290,
    zIndex: 3,
  },
  {
    tag: "Frontiers in Psychology · 2022",
    title: "Skin homogeneity & attractiveness",
    bars: ["full", "mid", "mid"],
    startX: 240,
    startY: 150,
    startRotation: 76,
    targetX: 30,
    targetY: 20,
    targetRotation: 16,
    delay: 360,
    zIndex: 4,
  },
  {
    tag: "Vision Research",
    title: "Machine ratings vs. human judgment",
    bars: ["mid", "full", "short"],
    startX: 0,
    startY: -250,
    startRotation: 18,
    targetX: -6,
    targetY: 5,
    targetRotation: -3,
    delay: 430,
    zIndex: 5,
  },
  {
    tag: "Psychonomic Bulletin & Review · 1998",
    title: "Symmetry & attractiveness perception",
    bars: ["full", "accent", "mid"],
    startX: 0,
    startY: 250,
    startRotation: -18,
    targetX: 8,
    targetY: -13,
    targetRotation: 4,
    delay: 540,
    zIndex: 6,
  },
];

function StudyPaper({
  paper,
  playing,
  reduceMotion,
}: {
  paper: Paper;
  playing: boolean;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(0);
  const x = useSharedValue(paper.startX);
  const y = useSharedValue(paper.startY);
  const rotation = useSharedValue(paper.startRotation);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    [opacity, x, y, rotation, scale].forEach(cancelAnimation);

    opacity.set(0);
    x.set(reduceMotion ? paper.targetX : paper.startX);
    y.set(reduceMotion ? paper.targetY : paper.startY);
    rotation.set(reduceMotion ? paper.targetRotation : paper.startRotation);
    scale.set(reduceMotion ? 1 : 0.4);
    if (!playing) return;

    if (reduceMotion) {
      opacity.set(withDelay(
        paper.delay,
        withTiming(1, { duration: 400, easing: EASE_OUT }),
      ));
      return;
    }

    opacity.set(withDelay(
      paper.delay,
      withTiming(1, { duration: 385, easing: EASE_BURST }),
    ));
    x.set(withDelay(paper.delay, withSequence(
      withTiming(paper.targetX * 1.06, { duration: 385, easing: EASE_BURST }),
      withTiming(paper.targetX * 0.97, { duration: 161, easing: EASE_BURST }),
      withTiming(paper.targetX, { duration: 154, easing: EASE_BURST }),
    )));
    y.set(withDelay(paper.delay, withSequence(
      withTiming(paper.targetY * 1.06, { duration: 385, easing: EASE_BURST }),
      withTiming(paper.targetY * 0.97, { duration: 161, easing: EASE_BURST }),
      withTiming(paper.targetY, { duration: 154, easing: EASE_BURST }),
    )));
    rotation.set(withDelay(paper.delay, withSequence(
      withTiming(paper.targetRotation * 1.12, {
        duration: 385,
        easing: EASE_BURST,
      }),
      withTiming(paper.targetRotation * 0.94, {
        duration: 161,
        easing: EASE_BURST,
      }),
      withTiming(paper.targetRotation, { duration: 154, easing: EASE_BURST }),
    )));
    scale.set(withDelay(paper.delay, withSequence(
      withTiming(1.04, { duration: 385, easing: EASE_BURST }),
      withTiming(0.985, { duration: 161, easing: EASE_BURST }),
      withTiming(1, { duration: 154, easing: EASE_BURST }),
    )));
  }, [opacity, paper, playing, reduceMotion, rotation, scale, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: rotation.get() + "deg" },
      { scale: scale.get() },
    ],
  }));

  return (
    <Animated.View
      style={[styles.paper, { zIndex: paper.zIndex }, animatedStyle]}
    >
      <Text numberOfLines={2} style={styles.paperTag}>
        {paper.tag}
      </Text>
      <Text numberOfLines={3} style={styles.paperTitle}>
        {paper.title}
      </Text>
      <View style={styles.paperBars}>
        {paper.bars.map((bar, index) => (
          <View
            key={index}
            style={[
              styles.paperBar,
              bar === "mid" && styles.paperBarMid,
              bar === "short" && styles.paperBarShort,
              bar === "accent" && styles.paperBarAccent,
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function StudiesScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveScale();
  const reduceMotion = Boolean(useReducedMotion());
  const [playing, setPlaying] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);
  const frameRef = useRef<number | null>(null);
  const navigated = useRef(false);

  const noteOpacity = useSharedValue(0);
  const noteY = useSharedValue(10);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(10);

  useFocusEffect(useCallback(() => {
    navigated.current = false;
  }, []));

  useEffect(() => {
    frameRef.current = requestAnimationFrame(() => setPlaying(true));
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    [noteOpacity, noteY, ctaOpacity, ctaY].forEach(cancelAnimation);
    noteOpacity.set(0);
    noteY.set(reduceMotion ? 0 : 10);
    ctaOpacity.set(0);
    ctaY.set(reduceMotion ? 0 : 10);
    if (!playing) return;

    const ctaTimer = setTimeout(() => setCtaReady(true), CTA_REVEAL_MS);
    noteOpacity.set(withTiming(1, {
      duration: reduceMotion ? 300 : 500,
      easing: EASE_OUT,
    }));
    if (!reduceMotion) {
      noteY.set(withTiming(0, { duration: 500, easing: EASE_OUT }));
    }
    ctaOpacity.set(withDelay(
      CTA_REVEAL_MS,
      withTiming(1, {
        duration: reduceMotion ? 300 : 500,
        easing: EASE_OUT,
      }),
    ));
    if (!reduceMotion) {
      ctaY.set(withDelay(
        CTA_REVEAL_MS,
        withTiming(0, { duration: 500, easing: EASE_OUT }),
      ));
    }
    return () => clearTimeout(ctaTimer);
  }, [ctaOpacity, ctaY, noteOpacity, noteY, playing, reduceMotion]);

  const handleContinue = useCallback(() => {
    if (!ctaReady || navigated.current) return;
    navigated.current = true;
    router.push("/(onboarding)/plan-impact");
  }, [ctaReady]);

  const noteStyle = useAnimatedStyle(() => ({
    opacity: noteOpacity.get(),
    transform: [{ translateY: noteY.get() }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.get(),
    transform: [{ translateY: ctaY.get() }],
  }));

  const sceneScale = Math.min(
    1,
    Math.max(0.78, Math.min(responsive.width / 390, responsive.height / 844)),
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
      <OnboardingSequenceHeader stepKey="studies" />

      <Animated.View style={[styles.note, noteStyle]}>
        <Text style={styles.eyebrow}>A quick note before we start</Text>
        <Text accessibilityRole="header" style={styles.noteText}>
          Your analysis is designed around published studies — not random numbers.
        </Text>
      </Animated.View>

      <View style={styles.stage}>
        <View pointerEvents="none" style={styles.groundShadow}>
          <Svg width="100%" height="100%" viewBox="0 0 150 26">
            <Defs>
              <RadialGradient id="paper-shadow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.24" />
                <Stop offset="0.72" stopColor="#000000" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="75" cy="13" rx="75" ry="13" fill="url(#paper-shadow)" />
          </Svg>
        </View>
        <View style={[styles.scene, { transform: [{ scale: sceneScale }] }]}>
          {PAPERS.map((paper) => (
            <StudyPaper
              key={paper.title}
              paper={paper}
              playing={playing}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      </View>

      <Animated.View
        pointerEvents={ctaReady ? "auto" : "none"}
        style={[
          styles.bottom,
          {
            paddingHorizontal: responsive.clamp(24, 20, 38),
            paddingBottom: Math.max(24, insets.bottom + 6),
          },
          ctaStyle,
        ]}
      >
        <OrangePrimaryButton
          label="Continue"
          onPress={handleContinue}
          disabled={!ctaReady}
          tone="ink"
          uppercase={false}
          fontFamily="SFProRounded-Bold"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: BACKGROUND,
  },
  note: {
    flexShrink: 0,
    alignItems: "center",
    paddingTop: 26,
    paddingHorizontal: 32,
  },
  eyebrow: {
    color: MUTED,
    fontFamily: "SFProRounded-Semibold",
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 6,
    textAlign: "center",
  },
  noteText: {
    maxWidth: 280,
    color: INK,
    fontFamily: "SFProRounded-Bold",
    fontSize: 19,
    lineHeight: 26,
    textAlign: "center",
  },
  stage: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groundShadow: {
    position: "absolute",
    left: "50%",
    bottom: "34%",
    width: 150,
    height: 26,
    marginLeft: -75,
  },
  scene: {
    position: "relative",
    width: 2,
    height: 2,
  },
  paper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 150,
    height: 196,
    marginLeft: -75,
    marginTop: -98,
    borderWidth: 1,
    borderColor: "rgba(68,55,34,0.08)",
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: PAPER,
    paddingHorizontal: 15,
    paddingVertical: 16,
    boxShadow: "0 10px 22px rgba(36, 27, 14, 0.24)",
  },
  paperTag: {
    color: "#8A8265",
    fontFamily: "SFProRounded-Regular",
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.18,
  },
  paperTitle: {
    color: "#2A2A22",
    fontFamily: "SFProRounded-Semibold",
    fontSize: 13.5,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 12,
  },
  paperBars: {
    gap: 6,
  },
  paperBar: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: PAPER_LINE,
  },
  paperBarMid: {
    width: "82%",
  },
  paperBarShort: {
    width: "60%",
  },
  paperBarAccent: {
    backgroundColor: BLUE,
    opacity: 0.55,
  },
  bottom: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    flexShrink: 0,
  },
});
