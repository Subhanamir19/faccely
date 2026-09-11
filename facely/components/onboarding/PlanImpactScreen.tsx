import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
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
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  OnboardingSequenceHeader,
  OrangePrimaryButton,
} from "@/components/onboarding/OrangeOnboardingLayout";
import { hapticHeavy, hapticLight } from "@/lib/haptics";
import { useResponsiveScale } from "@/lib/responsive";

const PAPER = "#F5F0E8";
const INK = "#17140F";
const EASE_FAST_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_SETTLE = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASE_IN_HARD = Easing.bezier(0.55, 0, 1, 0.45);
const EASE_IN_OUT = Easing.inOut(Easing.ease);

const COLLISION_START_MS = 880;
const COLLISION_DURATION_MS = 300;
const COLLISION_MS = COLLISION_START_MS + COLLISION_DURATION_MS;
const AFTER_REVEAL_MS = 1240;
const SETTLE_MS = 1540;
const CTA_REVEAL_MS = 1900;

type Card = {
  before: ImageSource;
  after: ImageSource;
  element: ImageSource;
  label: string;
};

const CARDS: Card[] = [
  {
    before: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_50_16 AM.webp"),
    after: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_50_12 AM.webp"),
    element: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_49_50 AM.webp"),
    label: "Structure",
  },
  {
    before: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_49_42 AM.webp"),
    after: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_49_31 AM.webp"),
    element: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_49_56 AM.webp"),
    label: "Debloating",
  },
  {
    before: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_49_25 AM.webp"),
    after: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_50_06 AM.webp"),
    element: require("@/assets/new-onbaording-screen-assets/ChatGPT Image Sep 1, 2026, 08_50_58 AM.webp"),
    label: "Fascia Release",
  },
];

function FaceSlot({
  card,
  index,
  playing,
  reduceMotion,
}: {
  card: Card;
  index: number;
  playing: boolean;
  reduceMotion: boolean;
}) {
  const stagger = index * 70;
  const beforeOpacity = useSharedValue(0);
  const beforeScale = useSharedValue(0.8);
  const beforeY = useSharedValue(18);
  const afterOpacity = useSharedValue(0);
  const afterScale = useSharedValue(0.88);
  const idleY = useSharedValue(0);
  const idleRotation = useSharedValue(0);
  const slotScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const flashScale = useSharedValue(0.3);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.3);

  useEffect(() => {
    const values = [
      beforeOpacity, beforeScale, beforeY, afterOpacity, afterScale, idleY,
      idleRotation, slotScale, flashOpacity, flashScale, ringOpacity, ringScale,
    ];
    values.forEach(cancelAnimation);

    beforeOpacity.set(0);
    beforeScale.set(reduceMotion ? 1 : 0.8);
    beforeY.set(reduceMotion ? 0 : 18);
    afterOpacity.set(0);
    afterScale.set(reduceMotion ? 1 : 0.88);
    idleY.set(0);
    idleRotation.set(0);
    slotScale.set(1);
    flashOpacity.set(0);
    flashScale.set(reduceMotion ? 1 : 0.3);
    ringOpacity.set(0);
    ringScale.set(reduceMotion ? 1 : 0.3);
    if (!playing) return;

    const entranceDuration = reduceMotion ? 150 : 380;
    beforeOpacity.set(withSequence(
      withDelay(stagger, withTiming(1, {
        duration: entranceDuration,
        easing: EASE_FAST_OUT,
      })),
      withDelay(
        Math.max(0, COLLISION_MS - stagger - entranceDuration),
        withTiming(0, { duration: 90, easing: Easing.linear }),
      ),
    ));

    if (!reduceMotion) {
      beforeScale.set(withSequence(
        withDelay(stagger, withTiming(1, { duration: 380, easing: EASE_FAST_OUT })),
        withDelay(
          Math.max(0, COLLISION_MS - stagger - 380),
          withTiming(0.94, { duration: 90, easing: Easing.linear }),
        ),
      ));
      beforeY.set(withDelay(
        stagger,
        withTiming(0, { duration: 380, easing: EASE_FAST_OUT }),
      ));
    }

    afterOpacity.set(withDelay(
      AFTER_REVEAL_MS,
      withTiming(1, {
        duration: reduceMotion ? 150 : 180,
        easing: EASE_FAST_OUT,
      }),
    ));

    if (!reduceMotion) {
      afterScale.set(withDelay(
        AFTER_REVEAL_MS,
        withSequence(
          withTiming(1.2, { duration: 180, easing: EASE_FAST_OUT }),
          withTiming(1.14, { duration: 120, easing: EASE_FAST_OUT }),
        ),
      ));
      idleY.set(withDelay(
        SETTLE_MS,
        withRepeat(withSequence(
          withTiming(-6, { duration: 1700, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 1700, easing: EASE_IN_OUT }),
        ), -1),
      ));
      idleRotation.set(withDelay(
        SETTLE_MS,
        withRepeat(withSequence(
          withTiming(-1, { duration: 1700, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 1700, easing: EASE_IN_OUT }),
        ), -1),
      ));
      slotScale.set(withDelay(
        SETTLE_MS,
        withSequence(
          withTiming(1.04, { duration: 1 }),
          withTiming(1, { duration: 259, easing: EASE_SETTLE }),
        ),
      ));
    }

    flashOpacity.set(withDelay(
      COLLISION_MS,
      withSequence(
        withTiming(1, { duration: 96, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 224, easing: Easing.out(Easing.quad) }),
      ),
    ));
    ringOpacity.set(withDelay(
      COLLISION_MS,
      withSequence(
        withTiming(0.9, { duration: 1 }),
        withTiming(0, { duration: 479, easing: EASE_FAST_OUT }),
      ),
    ));
    if (!reduceMotion) {
      flashScale.set(withDelay(
        COLLISION_MS,
        withSequence(
          withTiming(1, { duration: 96, easing: Easing.out(Easing.quad) }),
          withTiming(1.5, { duration: 224, easing: Easing.out(Easing.quad) }),
        ),
      ));
      ringScale.set(withDelay(
        COLLISION_MS,
        withTiming(2.2, { duration: 480, easing: EASE_FAST_OUT }),
      ));
    }
  }, [
    afterOpacity, afterScale, beforeOpacity, beforeScale, beforeY,
    flashOpacity, flashScale, idleRotation, idleY, playing, reduceMotion,
    ringOpacity, ringScale, slotScale, stagger,
  ]);

  const beforeStyle = useAnimatedStyle(() => ({
    opacity: beforeOpacity.get(),
    transform: [{ translateY: beforeY.get() }, { scale: beforeScale.get() }],
  }));
  const afterStyle = useAnimatedStyle(() => ({
    opacity: afterOpacity.get(),
    transform: [{ scale: afterScale.get() }],
  }));
  const idleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: idleY.get() },
      { rotate: idleRotation.get() + "deg" },
    ],
  }));
  const slotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: slotScale.get() }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.get(),
    transform: [{ scale: flashScale.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.get(),
    transform: [{ scale: ringScale.get() }],
  }));

  return (
    <Animated.View style={[styles.faceSlot, slotStyle]}>
      <Animated.View style={[styles.faceImageLayer, beforeStyle]}>
        <Image
          source={card.before}
          contentFit="contain"
          transition={0}
          accessible={false}
          style={styles.faceImage}
        />
      </Animated.View>
      <Animated.View style={[styles.faceImageMotionLayer, idleStyle]}>
        <Animated.View style={[styles.faceImageLayer, afterStyle]}>
          <Image
            source={card.after}
            contentFit="contain"
            transition={0}
            accessible={false}
            style={styles.faceImage}
          />
        </Animated.View>
      </Animated.View>
      <View pointerEvents="none" style={styles.impact}>
        <Animated.View style={[styles.flash, flashStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="flash" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
                <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill="url(#flash)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.ring, ringStyle]} />
      </View>
    </Animated.View>
  );
}

function ElementSlot({
  card,
  index,
  playing,
  reduceMotion,
}: {
  card: Card;
  index: number;
  playing: boolean;
  reduceMotion: boolean;
}) {
  const stagger = index * 70;
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.8);
  const imageY = useSharedValue(14);
  const labelOpacity = useSharedValue(0);
  const labelY = useSharedValue(4);

  useEffect(() => {
    const values = [
      imageOpacity, imageScale, imageY, labelOpacity, labelY,
    ];
    values.forEach(cancelAnimation);

    imageOpacity.set(0);
    imageScale.set(reduceMotion ? 1 : 0.8);
    imageY.set(reduceMotion ? 0 : 14);
    labelOpacity.set(0);
    labelY.set(reduceMotion ? 0 : 4);
    if (!playing) return;

    const imageEntranceDuration = reduceMotion ? 150 : 340;
    imageOpacity.set(withSequence(
      withDelay(stagger, withTiming(1, {
        duration: imageEntranceDuration,
        easing: EASE_FAST_OUT,
      })),
      withDelay(
        Math.max(0, COLLISION_MS - stagger - imageEntranceDuration),
        withTiming(0, { duration: 120, easing: Easing.linear }),
      ),
    ));

    const labelEntranceDuration = reduceMotion ? 150 : 300;
    labelOpacity.set(withSequence(
      withDelay(stagger, withTiming(1, {
        duration: labelEntranceDuration,
        easing: EASE_FAST_OUT,
      })),
      withDelay(
        Math.max(0, 1150 - stagger - labelEntranceDuration),
        withTiming(0, { duration: 100, easing: Easing.linear }),
      ),
    ));

    if (!reduceMotion) {
      imageScale.set(withSequence(
        withDelay(stagger, withSequence(
          withTiming(1.05, { duration: 238, easing: EASE_FAST_OUT }),
          withTiming(1, { duration: 102, easing: EASE_FAST_OUT }),
        )),
        withDelay(
          Math.max(0, COLLISION_MS - stagger - 340),
          withTiming(0.6, { duration: 120, easing: Easing.linear }),
        ),
      ));
      imageY.set(withDelay(stagger, withSequence(
        withTiming(-2, { duration: 238, easing: EASE_FAST_OUT }),
        withTiming(0, { duration: 102, easing: EASE_FAST_OUT }),
      )));
      labelY.set(withDelay(
        stagger,
        withTiming(0, { duration: 300, easing: EASE_FAST_OUT }),
      ));
    }
  }, [
    imageOpacity, imageScale, imageY, labelOpacity, labelY,
    playing, reduceMotion, stagger,
  ]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.get(),
    transform: [{ translateY: imageY.get() }, { scale: imageScale.get() }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.get(),
    transform: [{ translateY: labelY.get() }],
  }));

  return (
    <View style={styles.elementSlot}>
      <Animated.View style={[styles.elementImageWrap, imageStyle]}>
        <Image
          source={card.element}
          contentFit="contain"
          transition={0}
          accessible={false}
          style={styles.elementImage}
        />
      </Animated.View>
      <Animated.View style={labelStyle}>
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          style={styles.elementLabel}
        >
          {card.label}
        </Text>
      </Animated.View>
    </View>
  );
}

export default function PlanImpactScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveScale();
  const reduceMotion = Boolean(useReducedMotion());
  const [playing, setPlaying] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);
  const initialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigated = useRef(false);

  const headlineOpacity = useSharedValue(0);
  const headlineY = useSharedValue(6);
  const faceRowY = useSharedValue(0);
  const elementRowY = useSharedValue(0);
  const haloOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(10);
  const collisionClock = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    navigated.current = false;
  }, []));

  useEffect(() => {
    initialTimer.current = setTimeout(() => setPlaying(true), 150);
    return () => {
      if (initialTimer.current) clearTimeout(initialTimer.current);
    };
  }, []);

  useEffect(() => {
    const values = [
      headlineOpacity, headlineY, faceRowY, elementRowY, haloOpacity,
      ctaOpacity, ctaY, collisionClock,
    ];
    values.forEach(cancelAnimation);

    headlineOpacity.set(0);
    headlineY.set(reduceMotion ? 0 : 6);
    faceRowY.set(0);
    elementRowY.set(0);
    haloOpacity.set(0);
    ctaOpacity.set(0);
    ctaY.set(reduceMotion ? 0 : 10);
    collisionClock.set(0);
    if (!playing) return;

    const facePopHaptic = setTimeout(hapticLight, 0);
    // Separate the simultaneous row haptics slightly so both remain perceptible.
    const elementPopHaptic = setTimeout(hapticLight, 70);
    const ctaTimer = setTimeout(() => setCtaReady(true), CTA_REVEAL_MS);

    headlineOpacity.set(withTiming(1, {
      duration: reduceMotion ? 150 : 380,
      easing: EASE_FAST_OUT,
    }));
    if (!reduceMotion) {
      headlineY.set(withTiming(0, { duration: 380, easing: EASE_FAST_OUT }));
      const collisionDistance = responsive.sh(170);
      faceRowY.set(withDelay(
        COLLISION_START_MS,
        withTiming(collisionDistance, {
          duration: COLLISION_DURATION_MS,
          easing: EASE_IN_HARD,
        }),
      ));
      elementRowY.set(withDelay(
        COLLISION_START_MS,
        withTiming(-collisionDistance, {
          duration: COLLISION_DURATION_MS,
          easing: EASE_IN_HARD,
        }),
      ));
    }
    haloOpacity.set(withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.ease }),
    ));
    ctaOpacity.set(withDelay(
      CTA_REVEAL_MS,
      withTiming(1, {
        duration: reduceMotion ? 150 : 420,
        easing: EASE_FAST_OUT,
      }),
    ));
    if (!reduceMotion) {
      ctaY.set(withDelay(
        CTA_REVEAL_MS,
        withTiming(0, { duration: 420, easing: EASE_FAST_OUT }),
      ));
    }
    collisionClock.set(withDelay(
      COLLISION_MS,
      withTiming(1, { duration: 1 }, (finished) => {
        "worklet";
        if (finished) scheduleOnRN(hapticHeavy);
      }),
    ));

    return () => {
      clearTimeout(facePopHaptic);
      clearTimeout(elementPopHaptic);
      clearTimeout(ctaTimer);
    };
  }, [
    collisionClock, ctaOpacity, ctaY, elementRowY, faceRowY, haloOpacity,
    headlineOpacity, headlineY, playing, reduceMotion, responsive,
  ]);

  const handleContinue = useCallback(() => {
    if (!ctaReady || navigated.current) return;
    navigated.current = true;
    router.push("/(onboarding)/time-dedication");
  }, [ctaReady]);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.get(),
    transform: [{ translateY: headlineY.get() }],
  }));
  const faceRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: faceRowY.get() }],
  }));
  const elementRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: elementRowY.get() }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.get(),
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.get(),
    transform: [{ translateY: ctaY.get() }],
  }));

  const footerBottom = Math.max(24, insets.bottom + 8);
  const haloSize = responsive.clampWidth(0.82, 260, 360);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER} />
      <OnboardingSequenceHeader stepKey="plan-impact" />
      <View pointerEvents="none" style={styles.content}>
        <Animated.View
          style={[
            styles.headline,
            { marginTop: 17 },
            headlineStyle,
          ]}
        >
          <Text accessibilityRole="header" style={styles.headlineText}>
            This is what the right plan unlocks
          </Text>
        </Animated.View>
        <View style={styles.stage}>
          <Animated.View
            style={[
              styles.stageHalo,
              {
                width: haloSize,
                height: haloSize,
                marginLeft: -haloSize / 2,
                marginTop: -haloSize / 2,
              },
              haloStyle,
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="stage-halo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={INK} stopOpacity="0.08" />
                  <Stop offset="0.68" stopColor={INK} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="50" fill="url(#stage-halo)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.row, faceRowStyle]}>
            {CARDS.map((card, index) => (
              <FaceSlot
                key={card.label}
                card={card}
                index={index}
                playing={playing}
                reduceMotion={reduceMotion}
              />
            ))}
          </Animated.View>
          <Animated.View style={[styles.row, elementRowStyle]}>
            {CARDS.map((card, index) => (
              <ElementSlot
                key={card.label}
                card={card}
                index={index}
                playing={playing}
                reduceMotion={reduceMotion}
              />
            ))}
          </Animated.View>
        </View>
      </View>
      <Animated.View
        pointerEvents={ctaReady ? "auto" : "none"}
        style={[
          styles.footer,
          { paddingBottom: footerBottom },
          ctaStyle,
        ]}
      >
        <OrangePrimaryButton
          label="Build My Plan"
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
    backgroundColor: PAPER,
  },
  content: {
    flex: 1,
  },
  headline: {
    marginHorizontal: 30,
    alignItems: "center",
  },
  headlineText: {
    color: INK,
    fontFamily: "SFProRounded-Bold",
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.24,
    textAlign: "center",
  },
  stage: {
    flex: 1,
    position: "relative",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingHorizontal: 22,
    paddingBottom: 6,
  },
  stageHalo: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
  row: {
    position: "relative",
    flexDirection: "row",
    gap: 10,
  },
  faceSlot: {
    position: "relative",
    flex: 1,
    aspectRatio: 3 / 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  faceImageLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  faceImageMotionLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  faceImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  impact: {
    position: "absolute",
    top: "-16%",
    right: "-16%",
    bottom: "-16%",
    left: "-16%",
    zIndex: 4,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "rgba(23,20,15,0.55)",
  },
  elementSlot: {
    position: "relative",
    flex: 1,
    aspectRatio: 1 / 1.05,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    backgroundColor: "transparent",
  },
  elementImageWrap: {
    width: "82%",
    height: "76%",
    backgroundColor: "transparent",
  },
  elementImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  elementLabel: {
    color: INK,
    fontFamily: "SFProRounded-Bold",
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.46,
    textAlign: "center",
    textTransform: "uppercase",
  },
  footer: {
    paddingTop: 18,
    paddingHorizontal: 26,
  },
});
