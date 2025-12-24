import React, { useEffect, useCallback, useState } from "react";
import { StyleSheet, Text, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { COLORS } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Sizing - responsive but capped for larger devices
const VIDEO_SIZE = Math.min(SCREEN_WIDTH * 0.56, 220);
const VIDEO_RADIUS = VIDEO_SIZE / 2;

// Progress ring sits just outside the video
const RING_PADDING = 14;
const RING_SIZE = VIDEO_SIZE + RING_PADDING * 2;
const RING_RADIUS = RING_SIZE / 2;
const RING_STROKE_WIDTH = 4;
const RING_CENTER = RING_SIZE / 2;
const RING_PATH_RADIUS = RING_RADIUS - RING_STROKE_WIDTH / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_PATH_RADIUS;

// Design tokens
const ACCENT = COLORS?.accent ?? "#B4F34D";
const TRACK_COLOR = "rgba(255,255,255,0.12)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "rgba(255,255,255,0.5)";

// Loading messages - shuffled for engagement
const LOADING_MESSAGES = [
  "Loading scoring pipelines",
  "Initializing algorithms",
  "Loading Sigma",
  "Preparing analysis engine",
  "Calibrating metrics",
  "Loading facial models",
  "Syncing protocols",
];

const VIDEO_SOURCE = require("@/assets/loading/loading-video.mp4");

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type VideoSplashProps = {
  visible?: boolean;
};

const VideoSplash: React.FC<VideoSplashProps> = ({ visible = true }) => {
  // Progress ring animation - continuous rotation
  const ringProgress = useSharedValue(0);
  const ringRotation = useSharedValue(-90); // Start from top

  // Text shuffle state
  const [messageIndex, setMessageIndex] = useState(0);
  const textOpacity = useSharedValue(1);

  // Shuffle to next message
  const shuffleMessage = useCallback(() => {
    setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
  }, []);

  useEffect(() => {
    if (visible) {
      // Progress ring: fills from 0 to ~75% repeatedly with rotation
      ringProgress.value = 0;
      ringProgress.value = withRepeat(
        withTiming(0.72, {
          duration: 1800,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        true // reverse
      );

      // Ring rotation: continuous slow spin
      ringRotation.value = -90;
      ringRotation.value = withRepeat(
        withTiming(270, {
          duration: 2400,
          easing: Easing.linear,
        }),
        -1,
        false
      );

      // Text fade cycle for message shuffle
      textOpacity.value = 1;
      textOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 180, easing: Easing.in(Easing.cubic) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(ringProgress);
      cancelAnimation(ringRotation);
      cancelAnimation(textOpacity);
    }

    return () => {
      cancelAnimation(ringProgress);
      cancelAnimation(ringRotation);
      cancelAnimation(textOpacity);
    };
  }, [visible, ringProgress, ringRotation, textOpacity]);

  // Message shuffle interval
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      shuffleMessage();
    }, 2000);

    return () => clearInterval(interval);
  }, [visible, shuffleMessage]);

  // Animated props for progress arc
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  // Ring container rotation
  const ringContainerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  // Text fade style
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  return (
    <LinearGradient
      colors={["#020202", "#090909", "#020202"]}
      style={styles.gradient}
    >
      <View style={styles.content}>
        {/* Main visual stack */}
        <View style={styles.visualStack}>
          {/* Progress ring container - rotates */}
          <Animated.View style={[styles.ringContainer, ringContainerStyle]}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Track (background circle) */}
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_PATH_RADIUS}
                stroke={TRACK_COLOR}
                strokeWidth={RING_STROKE_WIDTH}
                fill="none"
              />
              {/* Progress arc */}
              <AnimatedCircle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_PATH_RADIUS}
                stroke={ACCENT}
                strokeWidth={RING_STROKE_WIDTH}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                animatedProps={animatedCircleProps}
              />
            </Svg>
          </Animated.View>

          {/* Video container - centered within ring */}
          <View style={styles.videoContainer}>
            <View style={styles.videoMask}>
              <Video
                source={VIDEO_SOURCE}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted
                shouldPlay={visible}
              />
            </View>
            {/* Subtle inner border for polish */}
            <View style={styles.videoInnerBorder} />
          </View>
        </View>

        {/* Brand text */}
        <Text style={styles.brandText}>SIGMA MAX</Text>

        {/* Shuffling loading message */}
        <Animated.Text style={[styles.loadingText, textStyle]}>
          {LOADING_MESSAGES[messageIndex]}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
};

export default VideoSplash;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60, // Visual balance
  },
  visualStack: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringContainer: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
  },
  videoContainer: {
    width: VIDEO_SIZE,
    height: VIDEO_SIZE,
    borderRadius: VIDEO_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    // Outer glow effect
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  videoMask: {
    width: VIDEO_SIZE,
    height: VIDEO_SIZE,
    borderRadius: VIDEO_RADIUS,
    overflow: "hidden",
    backgroundColor: "#050505",
  },
  video: {
    width: VIDEO_SIZE,
    height: VIDEO_SIZE,
  },
  videoInnerBorder: {
    position: "absolute",
    width: VIDEO_SIZE,
    height: VIDEO_SIZE,
    borderRadius: VIDEO_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  brandText: {
    marginTop: 48,
    fontSize: 22,
    color: TEXT_PRIMARY,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 8,
    textAlign: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
