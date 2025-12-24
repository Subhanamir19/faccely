import React, { useEffect, useMemo, useState, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import Svg, { Circle, Path } from "react-native-svg";

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { COLORS } from "@/lib/tokens";

const PORTRAIT_SIZE = 240;
const PORTRAIT_RADIUS = PORTRAIT_SIZE / 2;
const ORBIT_RADIUS = 120;
const ORBIT_STROKE_WIDTH = 12;

const ORBIT_SIZE = ORBIT_RADIUS * 2 + ORBIT_STROKE_WIDTH;
const ARC_SWEEP_DEGREES = 220;

const ARC_OFFSET_DEGREES = -90;

const VIDEO_SOURCE = require("@/assets/loading/loading-video.mp4");

const ACCENT = COLORS?.accent ?? "#B4F34D";
const TRACK = "rgba(255,255,255,0.18)";
const TEXT_COLOR = "#F5F5F5";
const TEXT_SECONDARY = "rgba(255,255,255,0.5)";

// Loading messages - shuffled for engagement during analysis
const LOADING_MESSAGES = [
  "Analyzing facial structure",
  "Processing metrics",
  "Calculating scores",
  "Evaluating symmetry",
  "Measuring proportions",
  "Generating insights",
  "Finalizing analysis",
];

export type CinematicLoaderProps = {
  loading?: boolean;
};

function polarToCartesian(radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: ORBIT_SIZE / 2 + radius * Math.cos(angleInRadians),
    y: ORBIT_SIZE / 2 + radius * Math.sin(angleInRadians),
  };
}

function buildArcPath(radius: number, sweep: number, offset: number) {
  const startAngle = offset - sweep / 2;
  const endAngle = offset + sweep / 2;
  const start = polarToCartesian(radius, endAngle);
  const end = polarToCartesian(radius, startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const OrbitArc = React.memo(function OrbitArc() {
  const arcPath = useMemo(
    () => buildArcPath(ORBIT_RADIUS, ARC_SWEEP_DEGREES, ARC_OFFSET_DEGREES),
    []
  );

  return (
    <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
      <Path
        d={arcPath}
        stroke={ACCENT}
        strokeWidth={ORBIT_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
});

const OrbitTrack = React.memo(function OrbitTrack() {
  return (
    <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
      <Circle
        cx={ORBIT_SIZE / 2}
        cy={ORBIT_SIZE / 2}
        r={ORBIT_RADIUS}
        stroke={TRACK}
        strokeWidth={ORBIT_STROKE_WIDTH}
        fill="none"
      />
    </Svg>
  );
});

const CinematicLoader: React.FC<CinematicLoaderProps> = ({ loading = true }) => {
  const rotation = useSharedValue(0);

  // Text shuffle state
  const [messageIndex, setMessageIndex] = useState(0);
  const textOpacity = useSharedValue(1);

  // Shuffle to next message
  const shuffleMessage = useCallback(() => {
    setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
  }, []);

  useEffect(() => {
    if (loading) {
      // Orbit rotation
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1600,
          easing: Easing.inOut(Easing.cubic),
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
      cancelAnimation(rotation);
      cancelAnimation(textOpacity);
    }

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(textOpacity);
    };
  }, [loading, rotation, textOpacity]);

  // Message shuffle interval
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      shuffleMessage();
    }, 2000);

    return () => clearInterval(interval);
  }, [loading, shuffleMessage]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Text fade style
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <LinearGradient
      colors={["#020202", "#090909", "#020202"]}
      style={styles.gradient}
    >
      <View style={styles.content}>
        <View style={styles.loaderStack}>
          {/* Video container - replaces static image */}
          <View style={styles.portraitWrapper}>
            <Video
              source={VIDEO_SOURCE}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              isLooping
              isMuted
              shouldPlay={loading}
            />
            {/* Subtle inner border for polish */}
            <View style={styles.videoInnerBorder} />
          </View>

          {/* Orbit track (background circle) */}
          <View style={styles.orbitTrack}>
            <OrbitTrack />
          </View>

          {/* Animated orbit arc */}
          <Animated.View style={[styles.orbitArc, orbitStyle]}>
            <OrbitArc />
          </Animated.View>
        </View>

        {/* Brand text */}
        <Text style={styles.brand}>SIGMA MAX</Text>

        {/* Shuffling loading message */}
        <Animated.Text style={[styles.loadingText, textStyle]}>
          {LOADING_MESSAGES[messageIndex]}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
};

export default CinematicLoader;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  loaderStack: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    transform: [{ translateY: -32 }],
  },
  portraitWrapper: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    overflow: "hidden",
    backgroundColor: "#050505",
    // Outer glow effect
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  video: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
  },
  videoInnerBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  orbitTrack: {
    position: "absolute",
    top: -(ORBIT_STROKE_WIDTH / 2),
    left: -(ORBIT_STROKE_WIDTH / 2),
  },
  orbitArc: {
    position: "absolute",
    top: -(ORBIT_STROKE_WIDTH / 2),
    left: -(ORBIT_STROKE_WIDTH / 2),
  },
  brand: {
    marginTop: 54,
    fontSize: 20,
    color: TEXT_COLOR,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 6,
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
