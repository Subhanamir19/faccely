import React, { memo, useEffect } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PORTRAIT_SOURCE = require("@/assets/splash-portrait.png");
const ARTBOARD_SIZE = 1254;
const SPLASH_DURATION_MS = 2740;

const REVEAL_EASE = Easing.bezier(0.2, 0.72, 0.22, 1);
const SETTLE_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const MICRO_EASE = Easing.bezier(0.33, 0, 0.2, 1);
const BRAND_EASE = Easing.bezier(0.18, 0.78, 0.24, 1);

type MaskStop = {
  offset: string;
  opacity: number;
};

const LAYER_MASKS: Record<"jaw" | "mid" | "eyes" | "hair", MaskStop[]> = {
  jaw: [
    { offset: "0%", opacity: 0 },
    { offset: "49%", opacity: 0 },
    { offset: "54%", opacity: 0.05 },
    { offset: "61%", opacity: 1 },
    { offset: "100%", opacity: 1 },
  ],
  mid: [
    { offset: "0%", opacity: 0 },
    { offset: "34%", opacity: 0 },
    { offset: "39%", opacity: 0.1 },
    { offset: "45%", opacity: 1 },
    { offset: "72%", opacity: 1 },
    { offset: "78%", opacity: 0.13 },
    { offset: "84%", opacity: 0 },
    { offset: "100%", opacity: 0 },
  ],
  eyes: [
    { offset: "0%", opacity: 0 },
    { offset: "27%", opacity: 0 },
    { offset: "31%", opacity: 0.1 },
    { offset: "36%", opacity: 1 },
    { offset: "53%", opacity: 1 },
    { offset: "58%", opacity: 0.1 },
    { offset: "63%", opacity: 0 },
    { offset: "100%", opacity: 0 },
  ],
  hair: [
    { offset: "0%", opacity: 0 },
    { offset: "8%", opacity: 0 },
    { offset: "12%", opacity: 0.1 },
    { offset: "17%", opacity: 1 },
    { offset: "37%", opacity: 1 },
    { offset: "42%", opacity: 0.1 },
    { offset: "48%", opacity: 0 },
    { offset: "100%", opacity: 0 },
  ],
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export type VideoSplashProps = {
  visible?: boolean;
};

type FaceLayerProps = {
  id: keyof typeof LAYER_MASKS;
};

const FaceLayer = memo(function FaceLayer({ id }: FaceLayerProps) {
  const gradientId = `${id}-mask-gradient`;
  const maskId = `${id}-mask`;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ARTBOARD_SIZE} ${ARTBOARD_SIZE}`}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          {LAYER_MASKS[id].map((stop, index) => (
            <Stop
              key={`${stop.offset}-${index}`}
              offset={stop.offset}
              stopColor="#FFFFFF"
              stopOpacity={stop.opacity}
            />
          ))}
        </SvgLinearGradient>
        <Mask
          id={maskId}
          x="0"
          y="0"
          width={ARTBOARD_SIZE}
          height={ARTBOARD_SIZE}
          maskUnits="userSpaceOnUse"
        >
          <Rect
            x="0"
            y="0"
            width={ARTBOARD_SIZE}
            height={ARTBOARD_SIZE}
            fill={`url(#${gradientId})`}
          />
        </Mask>
      </Defs>
      <SvgImage
        href={PORTRAIT_SOURCE}
        x="0"
        y="0"
        width={ARTBOARD_SIZE}
        height={ARTBOARD_SIZE}
        preserveAspectRatio="xMidYMid meet"
        mask={`url(#${maskId})`}
      />
    </Svg>
  );
});

type BlinkOverlayProps = {
  progress: SharedValue<number>;
};

function BlinkOverlay({ progress }: BlinkOverlayProps) {
  const upperLeftProps = useAnimatedProps(() => ({
    y: 535 + interpolate(progress.value, [0, 0.22, 0.4, 0.58, 0.76, 1], [-58, -18, 0, 0, -16, -58]),
  }));
  const upperRightProps = useAnimatedProps(() => ({
    y: 534 + interpolate(progress.value, [0, 0.22, 0.4, 0.58, 0.76, 1], [-58, -18, 0, 0, -16, -58]),
  }));
  const lowerLeftProps = useAnimatedProps(() => ({
    y: 589 + interpolate(progress.value, [0, 0.24, 0.4, 0.58, 0.78, 1], [58, 33, 15, 15, 34, 58]),
  }));
  const lowerRightProps = useAnimatedProps(() => ({
    y: 588 + interpolate(progress.value, [0, 0.24, 0.4, 0.58, 0.78, 1], [58, 33, 15, 15, 34, 58]),
  }));
  const creaseProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 0.43, 0.58, 0.78, 1], [0, 0, 0.96, 0.96, 0, 0]),
  }));

  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox={`0 0 ${ARTBOARD_SIZE} ${ARTBOARD_SIZE}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <ClipPath id="left-eye-clip">
          <Path d="M 466 580 Q 520 555 582 579 Q 525 607 466 580 Z" />
        </ClipPath>
        <ClipPath id="right-eye-clip">
          <Path d="M 657 579 Q 717 555 779 578 Q 722 605 657 579 Z" />
        </ClipPath>
        <SvgLinearGradient id="left-lid-skin" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#EBAE80" />
          <Stop offset="48%" stopColor="#F2B686" />
          <Stop offset="100%" stopColor="#E9AD80" />
        </SvgLinearGradient>
        <SvgLinearGradient id="right-lid-skin" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#A08170" />
          <Stop offset="42%" stopColor="#BD9276" />
          <Stop offset="100%" stopColor="#E5AA7D" />
        </SvgLinearGradient>
      </Defs>

      <G clipPath="url(#left-eye-clip)">
        <AnimatedRect
          animatedProps={upperLeftProps}
          x="452"
          width="145"
          height="57"
          rx="22"
          fill="url(#left-lid-skin)"
        />
        <AnimatedRect
          animatedProps={lowerLeftProps}
          x="452"
          width="145"
          height="57"
          rx="22"
          fill="url(#left-lid-skin)"
        />
      </G>

      <G clipPath="url(#right-eye-clip)">
        <AnimatedRect
          animatedProps={upperRightProps}
          x="645"
          width="148"
          height="57"
          rx="22"
          fill="url(#right-lid-skin)"
        />
        <AnimatedRect
          animatedProps={lowerRightProps}
          x="645"
          width="148"
          height="57"
          rx="22"
          fill="url(#right-lid-skin)"
        />
      </G>

      <AnimatedPath
        animatedProps={creaseProps}
        d="M 469 584 Q 521 596 578 582"
        fill="none"
        stroke="#171717"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <AnimatedPath
        animatedProps={creaseProps}
        d="M 661 582 Q 716 595 775 581"
        fill="none"
        stroke="#171717"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const VideoSplash: React.FC<VideoSplashProps> = ({ visible = true }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const basePortraitSize = width >= 700
    ? clamp(width * 0.5, 420, 590)
    : clamp(width * 0.86, 300, 560);
  const portraitSize = height <= 650 ? Math.min(height * 0.72, 360) : basePortraitSize;
  const wordmarkSize = width >= 700 ? 22 : clamp(width * 0.048, 17, 23);
  const finalLetterSpacing = wordmarkSize * 0.11;
  const initialLetterSpacing = wordmarkSize * 0.17;
  const lockupOffset = width >= 700
    ? -height * 0.015
    : clamp(-height * 0.022, -26, -12);
  const ambientSize = Math.min(width * 0.92, 660);

  const ambientOpacity = useSharedValue(0);
  const ambientScale = useSharedValue(0.92);
  const portraitProgress = useSharedValue(0);
  const masterOpacity = useSharedValue(0);
  const jawOpacity = useSharedValue(0);
  const jawY = useSharedValue(8);
  const midOpacity = useSharedValue(0);
  const midY = useSharedValue(6);
  const eyesOpacity = useSharedValue(0);
  const eyesY = useSharedValue(5);
  const hairOpacity = useSharedValue(0);
  const hairY = useSharedValue(-5);
  const scanOpacity = useSharedValue(0);
  const scanProgress = useSharedValue(0);
  const blinkProgress = useSharedValue(0);
  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(9);
  const wordmarkY = useSharedValue(wordmarkSize * 1.15);
  const wordmarkTracking = useSharedValue(initialLetterSpacing);

  useEffect(() => {
    if (!visible) return;

    ambientOpacity.value = 0;
    ambientScale.value = 0.92;
    portraitProgress.value = 0;
    masterOpacity.value = 0;
    jawOpacity.value = 0;
    jawY.value = 8;
    midOpacity.value = 0;
    midY.value = 6;
    eyesOpacity.value = 0;
    eyesY.value = 5;
    hairOpacity.value = 0;
    hairY.value = -5;
    scanOpacity.value = 0;
    scanProgress.value = 0;
    blinkProgress.value = 0;
    brandOpacity.value = 0;
    brandY.value = 9;
    wordmarkY.value = wordmarkSize * 1.15;
    wordmarkTracking.value = initialLetterSpacing;

    if (reduceMotion) {
      ambientOpacity.value = 0.72;
      ambientScale.value = 1;
      portraitProgress.value = 1;
      masterOpacity.value = 1;
      brandOpacity.value = 1;
      brandY.value = 0;
      wordmarkY.value = 0;
      wordmarkTracking.value = finalLetterSpacing;
      return;
    }

    ambientOpacity.value = withDelay(130, withTiming(0.72, { duration: 980, easing: REVEAL_EASE }));
    ambientScale.value = withDelay(130, withTiming(1, { duration: 980, easing: REVEAL_EASE }));
    portraitProgress.value = withDelay(190, withTiming(1, { duration: 1420, easing: SETTLE_EASE }));

    jawOpacity.value = withDelay(220, withSequence(
      withTiming(1, { duration: 510, easing: REVEAL_EASE }),
      withDelay(660, withTiming(0, { duration: 240, easing: MICRO_EASE })),
    ));
    jawY.value = withDelay(220, withTiming(0, { duration: 510, easing: REVEAL_EASE }));

    midOpacity.value = withDelay(430, withSequence(
      withTiming(1, { duration: 520, easing: REVEAL_EASE }),
      withDelay(458, withTiming(0, { duration: 240, easing: MICRO_EASE })),
    ));
    midY.value = withDelay(430, withTiming(0, { duration: 520, easing: REVEAL_EASE }));

    eyesOpacity.value = withDelay(650, withSequence(
      withTiming(1, { duration: 520, easing: REVEAL_EASE }),
      withDelay(256, withTiming(0, { duration: 240, easing: MICRO_EASE })),
    ));
    eyesY.value = withDelay(650, withTiming(0, { duration: 520, easing: REVEAL_EASE }));

    hairOpacity.value = withDelay(840, withSequence(
      withTiming(1, { duration: 550, easing: REVEAL_EASE }),
      withDelay(54, withTiming(0, { duration: 240, easing: MICRO_EASE })),
    ));
    hairY.value = withDelay(840, withTiming(0, { duration: 550, easing: REVEAL_EASE }));

    masterOpacity.value = withDelay(1236, withTiming(1, { duration: 264, easing: REVEAL_EASE }));

    scanOpacity.value = withDelay(1230, withSequence(
      withTiming(0.78, { duration: 94, easing: Easing.linear }),
      withDelay(281, withTiming(0, { duration: 145, easing: Easing.linear })),
    ));
    scanProgress.value = withDelay(
      1220,
      withTiming(1, { duration: 530, easing: Easing.bezier(0.35, 0.02, 0.45, 1) }),
    );

    blinkProgress.value = withDelay(
      1660,
      withTiming(1, { duration: 540, easing: Easing.bezier(0.36, 0.08, 0.2, 1) }),
    );

    brandOpacity.value = withDelay(2110, withTiming(1, { duration: 440, easing: BRAND_EASE }));
    brandY.value = withDelay(2110, withTiming(0, { duration: 440, easing: BRAND_EASE }));
    wordmarkY.value = withDelay(2100, withTiming(0, { duration: 480, easing: BRAND_EASE }));
    wordmarkTracking.value = withDelay(
      2100,
      withTiming(finalLetterSpacing, { duration: 480, easing: BRAND_EASE }),
    );

    return () => {
      [
        ambientOpacity,
        ambientScale,
        portraitProgress,
        masterOpacity,
        jawOpacity,
        jawY,
        midOpacity,
        midY,
        eyesOpacity,
        eyesY,
        hairOpacity,
        hairY,
        scanOpacity,
        scanProgress,
        blinkProgress,
        brandOpacity,
        brandY,
        wordmarkY,
        wordmarkTracking,
      ].forEach(cancelAnimation);
    };
  }, [
    visible,
    reduceMotion,
    wordmarkSize,
    initialLetterSpacing,
    finalLetterSpacing,
  ]);

  const ambientStyle = useAnimatedStyle(() => ({
    opacity: ambientOpacity.value,
    transform: [{ scale: ambientScale.value }],
  }));
  const portraitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(portraitProgress.value, [0, 0.78, 1], [12, -2, 0]) },
      { scale: interpolate(portraitProgress.value, [0, 0.78, 1], [0.965, 1.008, 1]) },
    ],
  }));
  const masterStyle = useAnimatedStyle(() => ({ opacity: masterOpacity.value }));
  const jawStyle = useAnimatedStyle(() => ({
    opacity: jawOpacity.value,
    transform: [{ translateY: jawY.value }],
  }));
  const midStyle = useAnimatedStyle(() => ({
    opacity: midOpacity.value,
    transform: [{ translateY: midY.value }],
  }));
  const eyesStyle = useAnimatedStyle(() => ({
    opacity: eyesOpacity.value,
    transform: [{ translateY: eyesY.value }],
  }));
  const hairStyle = useAnimatedStyle(() => ({
    opacity: hairOpacity.value,
    transform: [{ translateY: hairY.value }],
  }));
  const scanWindowStyle = useAnimatedStyle(() => ({ opacity: scanOpacity.value }));
  const scanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: scanProgress.value * portraitSize * 0.75264 },
      { skewX: "-7deg" },
    ],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    letterSpacing: wordmarkTracking.value,
    transform: [{ translateY: wordmarkY.value }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.root} accessibilityLabel="Sigma Max splash screen">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambient,
          {
            width: ambientSize,
            height: ambientSize,
            left: (width - ambientSize) / 2,
            top: height * 0.47 - ambientSize / 2,
          },
          ambientStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFB26F" stopOpacity="0.07" />
              <Stop offset="36%" stopColor="#9A7E63" stopOpacity="0.025" />
              <Stop offset="70%" stopColor="#000000" stopOpacity="0" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#ambient-glow)" />
        </Svg>
      </Animated.View>

      <View
        style={[
          styles.stage,
          {
            paddingTop: insets.top,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
          },
        ]}
      >
        <View style={[styles.lockup, { transform: [{ translateY: lockupOffset }] }]}>
          <Animated.View
            accessible={false}
            style={[
              styles.portrait,
              { width: portraitSize, height: portraitSize },
              portraitStyle,
            ]}
          >
            <Animated.Image
              source={PORTRAIT_SOURCE}
              resizeMode="contain"
              style={[styles.fullLayer, masterStyle]}
            />

            <Animated.View style={[styles.fullLayer, jawStyle]}>
              <FaceLayer id="jaw" />
            </Animated.View>
            <Animated.View style={[styles.fullLayer, midStyle]}>
              <FaceLayer id="mid" />
            </Animated.View>
            <Animated.View style={[styles.fullLayer, eyesStyle]}>
              <FaceLayer id="eyes" />
            </Animated.View>
            <Animated.View style={[styles.fullLayer, hairStyle]}>
              <FaceLayer id="hair" />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanWindow,
                { borderRadius: portraitSize * 0.22 },
                scanWindowStyle,
              ]}
            >
              <Animated.View style={[styles.scanBand, scanStyle]}>
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0)",
                    "rgba(255,255,255,0.02)",
                    "rgba(255,239,221,0.18)",
                    "rgba(255,255,255,0.03)",
                    "rgba(255,255,255,0)",
                  ]}
                  locations={[0, 0.22, 0.48, 0.73, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Animated.View>

            <BlinkOverlay progress={blinkProgress} />
          </Animated.View>

          <Animated.View
            style={[
              styles.brand,
              { width: Math.min(width * 0.88, 520) },
              brandStyle,
            ]}
          >
            <View style={[styles.wordmarkMask, { height: wordmarkSize + 12 }]}>
              <Animated.Text
                allowFontScaling={false}
                style={[
                  styles.wordmark,
                  { fontSize: wordmarkSize, lineHeight: wordmarkSize },
                  wordmarkStyle,
                ]}
              >
                SIGMA MAX
              </Animated.Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

export { SPLASH_DURATION_MS };
export default VideoSplash;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  ambient: {
    position: "absolute",
    borderRadius: 999,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockup: {
    width: "100%",
    alignItems: "center",
  },
  portrait: {
    position: "relative",
    transformOrigin: "50% 62%",
  },
  fullLayer: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  scanWindow: {
    position: "absolute",
    left: "22%",
    top: "18%",
    width: "56%",
    height: "66%",
    overflow: "hidden",
  },
  scanBand: {
    position: "absolute",
    top: "-10%",
    left: "-38%",
    width: "28%",
    height: "120%",
  },
  brand: {
    alignItems: "center",
    marginTop: -2,
  },
  wordmarkMask: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  wordmark: {
    color: "#F7F7F7",
    fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.98,
  },
});
