import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticSelection } from "@/lib/haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const HEADING_FONT = "DINNextRounded-Bold";
const ORANGE = "#F26A13";
const TEXT = "#050505";
const PAPER = "#FFFCF7";
const CTA_FACE = "#151515";
const CTA_DEPTH = "#050505";
const HAPTIC_EVERY_CHARS = 3;

type HeadingSegment = {
  text: string;
  accent?: boolean;
};

type Props = {
  heading: HeadingSegment[];
  asset: ImageSourcePropType;
  assetLabel: string;
  assetScale?: number;
  assetRounded?: boolean;
  nextRoute: Href;
};

function useTypedSegments(segments: HeadingSegment[], delayMs = 240) {
  const fullText = useMemo(() => segments.map((segment) => segment.text).join(""), [segments]);
  const [length, setLength] = useState(0);

  useEffect(() => {
    setLength(0);

    let frame: number | null = null;
    let startedAt = 0;
    let lastLength = 0;
    const duration = Math.max(900, fullText.length * 52);

    const tick = (timestamp: number) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const nextLength = Math.min(fullText.length, Math.floor(progress * fullText.length));

      if (nextLength !== lastLength) {
        lastLength = nextLength;
        if (fullText[nextLength - 1]?.trim() && nextLength % HAPTIC_EVERY_CHARS === 0) {
          hapticSelection();
        }
        setLength(nextLength);
      }

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setLength(fullText.length);
      }
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [delayMs, fullText]);

  return useMemo(() => {
    let remaining = length;
    return segments.map((segment) => {
      const text = segment.text.slice(0, Math.max(0, Math.min(segment.text.length, remaining)));
      remaining -= segment.text.length;
      return { ...segment, text };
    });
  }, [length, segments]);
}

export default function FeatureStatementScreen({
  heading,
  asset,
  assetLabel,
  assetScale = 1,
  assetRounded = false,
  nextRoute,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const buttonOpacity = useSharedValue(0);
  const buttonTranslate = useSharedValue(12);
  const buttonScale = useSharedValue(1);
  const buttonPressDepth = useSharedValue(0);
  const assetOpacity = useSharedValue(0);
  const assetTranslate = useSharedValue(110);
  const assetMotionScale = useSharedValue(0.84);
  const typedHeading = useTypedSegments(heading);

  const compact = height < 760;
  const horizontalPadding = Math.min(Math.max(width * 0.065, 22), 38);
  const headingSize = Math.min(Math.max(width * 0.084, 31), 48);
  const headingLineHeight = headingSize * 1.16;
  const stageWidth = Math.min(width * 1.08, 560);
  const stageHeight = Math.min(Math.max(height * (compact ? 0.58 : 0.62), 360), compact ? 470 : 560);
  const roundedAssetSize = Math.min(stageWidth, stageHeight) * assetScale;
  const ctaHeight = Math.min(Math.max(height * 0.073, 56), 72);
  const ctaDepth = Math.min(Math.max(height * 0.008, 6), 9);

  React.useEffect(() => {
    assetOpacity.value = withDelay(
      180,
      withTiming(1, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      }),
    );
    assetTranslate.value = withDelay(
      160,
      withTiming(0, {
        duration: 720,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
    assetMotionScale.value = withDelay(
      160,
      withSequence(
        withTiming(1.035, { duration: 520, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
      ),
    );
    buttonOpacity.value = withDelay(
      520,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
    buttonTranslate.value = withDelay(
      520,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [assetMotionScale, assetOpacity, assetTranslate, buttonOpacity, buttonTranslate]);

  const assetStyle = useAnimatedStyle(() => ({
    opacity: assetOpacity.value,
    transform: [
      { translateY: assetTranslate.value },
      { scale: assetMotionScale.value },
    ],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [
      { translateY: buttonTranslate.value },
      { scale: buttonScale.value },
    ],
  }));

  const buttonFaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonPressDepth.value }],
  }));

  const setButtonPressed = useCallback(
    (pressed: boolean) => {
      buttonScale.value = withTiming(pressed ? 0.995 : 1, {
        duration: pressed ? 80 : 150,
        easing: Easing.out(Easing.cubic),
      });
      buttonPressDepth.value = withTiming(pressed ? ctaDepth : 0, {
        duration: pressed ? 80 : 150,
        easing: Easing.out(Easing.cubic),
      });
    },
    [buttonPressDepth, buttonScale, ctaDepth],
  );

  const goNext = useCallback(() => {
    router.replace(nextRoute);
  }, [nextRoute]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER} />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + (compact ? 18 : 24),
            paddingBottom: Math.max(insets.bottom, 10) + 10,
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <View style={styles.headingWrap}>
          <Text
            style={[styles.heading, { fontSize: headingSize, lineHeight: headingLineHeight }]}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {typedHeading.map((segment, index) => (
              <Text key={index} style={segment.accent ? styles.headingAccent : undefined}>
                {segment.text}
              </Text>
            ))}
          </Text>
        </View>

        <Animated.View style={[styles.visualSlot, { width: stageWidth, height: stageHeight }, assetStyle]}>
          {assetRounded ? (
            <View
              style={[
                styles.roundedAssetFrame,
                {
                  width: roundedAssetSize,
                  height: roundedAssetSize,
                  borderRadius: roundedAssetSize * 0.16,
                },
              ]}
            >
              <Image
                source={asset}
                style={styles.roundedAssetImage}
                fadeDuration={0}
                resizeMode="cover"
                accessibilityLabel={assetLabel}
              />
            </View>
          ) : (
            <Image
              source={asset}
              style={[
                styles.visualImage,
                {
                  width: stageWidth * assetScale,
                  height: stageHeight * assetScale,
                },
              ]}
              fadeDuration={0}
              resizeMode="contain"
              accessibilityLabel={assetLabel}
            />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,252,247,0)", "rgba(255,252,247,0.9)", PAPER]}
            locations={[0, 0.58, 1]}
            style={[styles.edgeFade, { height: stageHeight * 0.16 }]}
          />
        </Animated.View>

        <Animated.View style={[styles.footer, buttonStyle]}>
          <View style={[styles.ctaShell, { paddingBottom: ctaDepth }]}>
            <View style={[styles.ctaDepth, { top: ctaDepth }]} />
            <Animated.View style={[styles.ctaFaceMotion, buttonFaceStyle]}>
              <Pressable
                onPress={goNext}
                onPressIn={() => setButtonPressed(true)}
                onPressOut={() => setButtonPressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Continue"
                style={[styles.cta, { minHeight: ctaHeight }]}
              >
                <Text style={styles.ctaText}>continue</Text>
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
  headingWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    minHeight: 154,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  heading: {
    color: TEXT,
    fontFamily: HEADING_FONT,
    letterSpacing: 0,
    textAlign: "left",
  },
  headingAccent: {
    color: ORANGE,
  },
  visualSlot: {
    flex: 1,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  visualImage: {
    alignSelf: "center",
  },
  roundedAssetFrame: {
    overflow: "hidden",
    backgroundColor: "#F5F1E9",
    shadowColor: "#2A1A10",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  roundedAssetImage: {
    width: "100%",
    height: "100%",
  },
  edgeFade: {
    position: "absolute",
    left: -4,
    right: -4,
    bottom: -1,
    zIndex: 2,
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
    backgroundColor: CTA_DEPTH,
  },
  ctaFaceMotion: {
    width: "100%",
  },
  cta: {
    width: "100%",
    borderRadius: 23,
    backgroundColor: CTA_FACE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7A2F00",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: HEADING_FONT,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: 0,
  },
});
