import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const HEADING_FONT = "DINNextRounded-Bold";
const BODY_FONT = "DINNextRounded-Regular";
const BUTTON_FONT = "DINNextRounded-Bold";
const ORANGE = "#F26A13";
const TEXT = "#050505";
const COPY = "#3E454B";
const PAPER = "#FFFCF7";
const ASSET_TRANSITION_MS = 560;
const TRANSITION_LOCK_MS = 620;
const HAPTIC_EVERY_CHARS = 3;

const STRUCTURE_IMAGE = require("../../assets/features-assets/structure.png");
const POSTURE_IMAGE = require("../../assets/features-assets/posture.png");

const DIET_ITEMS: Array<{
  source: ImageSourcePropType;
  x: number;
  y: number;
  size: number;
  rotate: string;
  label: string;
}> = [
  {
    source: require("../../assets/ASSETS-FOR-DIET/plate-only/sweet-potato.png"),
    x: 0.27,
    y: 0.17,
    size: 0.27,
    rotate: "-8deg",
    label: "Sweet potato",
  },
  {
    source: require("../../assets/ASSETS-FOR-DIET/plate-only/beef-steak.png"),
    x: 0.67,
    y: 0.20,
    size: 0.30,
    rotate: "7deg",
    label: "Beef steak",
  },
  {
    source: require("../../assets/ASSETS-FOR-DIET/plate-only/whole-eggs.png"),
    x: 0.34,
    y: 0.50,
    size: 0.29,
    rotate: "5deg",
    label: "Eggs",
  },
  {
    source: require("../../assets/ASSETS-FOR-DIET/plate-only/carrot.png"),
    x: 0.70,
    y: 0.50,
    size: 0.27,
    rotate: "-6deg",
    label: "Carrot",
  },
  {
    source: require("../../assets/ASSETS-FOR-DIET/plate-only/avocado-halves.png"),
    x: 0.52,
    y: 0.78,
    size: 0.30,
    rotate: "8deg",
    label: "Avocado",
  },
];

const SCREENS = [
  {
    key: "structure",
    accent: "Fix",
    heading: "Fix structure.",
    copy: "Refine posture, jawline, cheekbones, and forward facial support.",
  },
  {
    key: "posture",
    accent: "Fix",
    heading: "Fix posture.",
    copy: "Align your neck, shoulders, and facial support from the base.",
  },
  {
    key: "diet",
    accent: "Get",
    heading: "Get the right diet.",
    copy: "Support clearer skin, lower puffiness, and stronger definition.",
  },
] as const;

function useTypedText(value: string, delayMs: number) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");

    let frame: number | null = null;
    let startedAt = 0;
    let lastLength = 0;
    const duration = Math.max(900, value.length * 52);

    const tick = (timestamp: number) => {
      if (!startedAt) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const nextLength = Math.min(value.length, Math.floor(progress * value.length));

      if (nextLength !== lastLength) {
        lastLength = nextLength;
        if (value[nextLength - 1]?.trim() && nextLength % HAPTIC_EVERY_CHARS === 0) {
          hapticSelection();
        }
        setTyped(value.slice(0, nextLength));
      }

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setTyped(value);
      }
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [delayMs, value]);

  return typed;
}

function TypewriterHeading({
  value,
  accent,
  fontSize,
  lineHeight,
}: {
  value: string;
  accent: string;
  fontSize: number;
  lineHeight: number;
}) {
  const typed = useTypedText(value, 240);
  const accentText = typed.slice(0, Math.min(typed.length, accent.length));
  const bodyText = typed.slice(accentText.length);
  const headingStyle = [styles.heading, { fontSize, lineHeight }];

  return (
    <View style={styles.headingFrame}>
      <Text
        style={[headingStyle, styles.headingMeasure]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        accessible={false}
      >
        {value}
      </Text>
      <Text
        style={[headingStyle, styles.headingTyped]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        <Text style={styles.headingAccent}>{accentText}</Text>
        {bodyText}
      </Text>
    </View>
  );
}

function DietVisual({ stageWidth, stageHeight }: { stageWidth: number; stageHeight: number }) {
  return (
    <View style={[styles.dietStage, { width: stageWidth, height: stageHeight }]}>
      {DIET_ITEMS.map((item, index) => {
        const size = stageWidth * item.size;
        return (
          <DietTile
            key={item.label}
            item={item}
            index={index}
            left={stageWidth * item.x - size / 2}
            top={stageHeight * item.y - size / 2}
            size={size}
          />
        );
      })}
    </View>
  );
}

function DietTile({
  item,
  index,
  left,
  top,
  size,
}: {
  item: (typeof DIET_ITEMS)[number];
  index: number;
  left: number;
  top: number;
  size: number;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    const delay = index * 140;
    float.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1350 + index * 90, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1350 + index * 90, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [float, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -5 * float.value },
      { rotate: item.rotate },
      { scale: 1 + 0.012 * float.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.dietTile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          left,
          top,
        },
        animatedStyle,
      ]}
    >
      <Image
        source={item.source}
        style={[
          styles.dietImage,
          {
            width: size * (index === 4 ? 0.9 : 0.84),
            height: size * (index === 4 ? 0.9 : 0.84),
          },
        ]}
        fadeDuration={0}
        resizeMode="contain"
        accessibilityLabel={item.label}
      />
    </Animated.View>
  );
}

function EdgeFade({ height }: { height: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,252,247,0)", "rgba(255,252,247,0.86)", PAPER]}
      locations={[0, 0.58, 1]}
      style={[styles.edgeFade, { height }]}
    />
  );
}

function StageVisual({
  index,
  stageWidth,
  stageHeight,
}: {
  index: number;
  stageWidth: number;
  stageHeight: number;
}) {
  if (index === 2) {
    return <DietVisual stageWidth={stageWidth} stageHeight={stageHeight} />;
  }

  const isStructure = index === 0;
  return (
    <View style={[styles.imageStage, { width: stageWidth, height: stageHeight }]}>
      <Image
        key={isStructure ? "structure-visual" : "posture-visual"}
        source={isStructure ? STRUCTURE_IMAGE : POSTURE_IMAGE}
        style={[
          isStructure ? styles.structureImage : styles.secondaryImage,
          { width: stageWidth * (isStructure ? 1.03 : 1.62), height: stageHeight * (isStructure ? 1.02 : 1.5) },
        ]}
        fadeDuration={0}
        resizeMode="contain"
        accessibilityLabel={isStructure ? "Annotated facial structure visual" : "Posture alignment visual"}
      />
      <EdgeFade height={stageHeight * (isStructure ? 0.18 : 0.22)} />
    </View>
  );
}

const MemoizedStageVisual = memo(StageVisual);

export default function FeatureSequenceScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [transitionCount, setTransitionCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const enter = useSharedValue(0);
  const exit = useSharedValue(1);
  const copyOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const buttonPressDepth = useSharedValue(0);

  const screen = SCREENS[index];

  const layout = useMemo(() => {
    const compact = height < 760;
    const stageWidth = Math.min(width * 0.94, 500);
    const stageHeight = Math.min(
      Math.max(height * (compact ? 0.49 : 0.52), 318),
      compact ? 420 : 486,
    );
    const headingSize = Math.min(Math.max(width * 0.114, 42), 66);
    const copySize = Math.min(Math.max(width * 0.041, 15), 20);

    return {
      compact,
      stageWidth,
      stageHeight,
      headingSize,
      headingLineHeight: headingSize * 1.06,
      copySize,
      copyLineHeight: copySize * 1.36,
      horizontalPadding: Math.min(Math.max(width * 0.065, 22), 38),
      ctaHeight: Math.min(Math.max(height * 0.073, 56), 72),
      ctaDepth: Math.min(Math.max(height * 0.008, 6), 9),
    };
  }, [height, width]);

  useLayoutEffect(() => {
    enter.value = 0;
    exit.value = 0;
    copyOpacity.value = 0;

    enter.value =
      index === 0
        ? withTiming(1, {
            duration: 860,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })
        : withTiming(1, {
            duration: ASSET_TRANSITION_MS,
            easing: Easing.bezier(0.18, 0.82, 0.2, 1),
          });
    exit.value = withTiming(1, {
      duration: ASSET_TRANSITION_MS,
      easing: Easing.bezier(0.45, 0, 0.25, 1),
    });
    copyOpacity.value = withDelay(
      index === 0 ? 520 : 230,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );

    return undefined;
  }, [copyOpacity, enter, exit, index, transitionCount]);

  useEffect(() => {
    buttonOpacity.value = withDelay(
      620,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
  }, [buttonOpacity]);

  useEffect(() => {
    if (previousIndex === null) return undefined;

    const timeout = setTimeout(() => setPreviousIndex(null), ASSET_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [previousIndex]);

  useEffect(() => {
    if (!isTransitioning) return undefined;

    const timeout = setTimeout(() => setIsTransitioning(false), TRANSITION_LOCK_MS);
    return () => clearTimeout(timeout);
  }, [isTransitioning, index]);

  const currentVisualStyle = useAnimatedStyle(() => {
    const fromBottom = index === 0 && transitionCount === 0;
    return {
      opacity: enter.value,
      transform: [
        { translateX: fromBottom ? 0 : (1 - enter.value) * width * 0.14 },
        { translateY: fromBottom ? (1 - enter.value) * 58 : 0 },
        { scale: 0.985 + enter.value * 0.015 },
      ],
    };
  });

  const previousVisualStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { translateX: -exit.value * width * 0.1 },
      { translateY: 0 },
      { scale: 1 - exit.value * 0.012 },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: (1 - copyOpacity.value) * 8 }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [
      { translateY: (1 - buttonOpacity.value) * 10 },
      { scale: buttonScale.value },
    ],
  }));

  const buttonFaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonPressDepth.value }],
  }));

  const setButtonPressed = useCallback(
    (pressed: boolean) => {
      if (isTransitioning) return;
      if (pressed) hapticLight();
      buttonScale.value = withTiming(pressed ? 0.995 : 1, {
        duration: pressed ? 80 : 150,
        easing: Easing.out(Easing.cubic),
      });
      buttonPressDepth.value = withTiming(pressed ? layout.ctaDepth : 0, {
        duration: pressed ? 80 : 150,
        easing: Easing.out(Easing.cubic),
      });
    },
    [buttonPressDepth, buttonScale, isTransitioning, layout.ctaDepth],
  );

  const goNext = useCallback(() => {
    if (isTransitioning) return;

    if (index >= SCREENS.length - 1) {
      router.replace("/(onboarding)/warmup");
      return;
    }

    enter.value = 0;
    exit.value = 0;
    copyOpacity.value = 0;

    setIsTransitioning(true);
    setPreviousIndex(index);
    setIndex((current) => current + 1);
    setTransitionCount((current) => current + 1);
  }, [copyOpacity, enter, exit, index, isTransitioning]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER} />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + (layout.compact ? 4 : 8),
            paddingBottom: Math.max(insets.bottom, 10) + 10,
            paddingHorizontal: layout.horizontalPadding,
          },
        ]}
      >
        <View style={[styles.visualSlot, { height: layout.stageHeight }]}>
          {previousIndex !== null ? (
            <Animated.View style={[styles.visualLayer, previousVisualStyle]}>
              <MemoizedStageVisual
                index={previousIndex}
                stageWidth={layout.stageWidth}
                stageHeight={layout.stageHeight}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.visualLayer, currentVisualStyle]}>
            <MemoizedStageVisual index={index} stageWidth={layout.stageWidth} stageHeight={layout.stageHeight} />
          </Animated.View>
        </View>

        <View style={styles.copySlot}>
          <View style={styles.copyBlock}>
            <TypewriterHeading
              key={screen.key}
              value={screen.heading}
              accent={screen.accent}
              fontSize={layout.headingSize}
              lineHeight={layout.headingLineHeight}
            />
            <Animated.View style={[styles.bodyBlock, copyStyle]}>
              <Text
                style={[
                  styles.copyLine,
                  {
                    fontSize: layout.copySize,
                    lineHeight: layout.copyLineHeight,
                  },
                ]}
              >
                {screen.copy}
              </Text>
            </Animated.View>
          </View>
        </View>

        <Animated.View style={[styles.footer, buttonStyle]}>
          <View style={[styles.ctaShell, { paddingBottom: layout.ctaDepth }]}>
            <View style={[styles.ctaDepth, { top: layout.ctaDepth }]} />
            <Animated.View style={[styles.ctaFaceMotion, buttonFaceStyle]}>
              <Pressable
                onPress={goNext}
                onPressIn={() => setButtonPressed(true)}
                onPressOut={() => setButtonPressed(false)}
                disabled={isTransitioning}
                accessibilityRole="button"
                accessibilityLabel="Continue"
                accessibilityState={{ disabled: isTransitioning }}
                style={[styles.cta, { minHeight: layout.ctaHeight }]}
              >
                <Text style={styles.ctaText}>Continue</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER,
  },
  safe: {
    flex: 1,
  },
  visualSlot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  visualLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  imageStage: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  structureImage: {
    marginTop: 8,
  },
  secondaryImage: {
    marginTop: -18,
  },
  edgeFade: {
    position: "absolute",
    left: -4,
    right: -4,
    bottom: -1,
    zIndex: 2,
  },
  dietStage: {
    alignSelf: "center",
  },
  dietTile: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2A1A10",
    shadowOpacity: 0.11,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  dietImage: {
    alignSelf: "center",
  },
  copySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 14,
  },
  copyBlock: {
    alignItems: "center",
    marginTop: 0,
    width: "100%",
  },
  headingFrame: {
    width: "100%",
    minHeight: 56,
    position: "relative",
  },
  heading: {
    width: "100%",
    color: TEXT,
    fontFamily: HEADING_FONT,
    letterSpacing: 0,
    textAlign: "center",
  },
  headingMeasure: {
    opacity: 0,
  },
  headingTyped: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  headingAccent: {
    color: ORANGE,
  },
  bodyBlock: {
    alignItems: "center",
    marginTop: 10,
    minHeight: 42,
    maxWidth: 316,
  },
  copyLine: {
    color: COPY,
    fontFamily: BODY_FONT,
    letterSpacing: 0,
    textAlign: "center",
  },
  footer: {
    paddingTop: 4,
  },
  ctaShell: {
    width: "100%",
    position: "relative",
  },
  ctaDepth: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 23,
    backgroundColor: "#050505",
  },
  ctaFaceMotion: {
    width: "100%",
  },
  cta: {
    width: "100%",
    borderRadius: 23,
    backgroundColor: "#151515",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: BUTTON_FONT,
    fontSize: 27,
    lineHeight: 32,
  },
});
