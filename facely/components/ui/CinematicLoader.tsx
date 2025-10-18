import React, { useEffect, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/lib/tokens";

const PORTRAIT_SIZE = 240;
const PORTRAIT_RADIUS = PORTRAIT_SIZE / 2;
const ORBIT_RADIUS = 120;
const ORBIT_STROKE_WIDTH = 10;
const ORBIT_SIZE = ORBIT_RADIUS * 2 + ORBIT_STROKE_WIDTH;
const ARC_SWEEP_DEGREES = 230;
const ARC_OFFSET_DEGREES = -90;
const HALO_SIZE = 300;
const FACE_IMAGE = require("@/assets/loading/face-loader.jpg");

const ACCENT = COLORS?.accent ?? "#B4F34D";
const TRACK = "rgba(255,255,255,0.08)";
const TEXT_DIM = (COLORS as any)?.textDim ?? "rgba(160,160,160,0.85)";

export type CinematicLoaderProps = {
  title: string;
  subtitle?: string;
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
    [],
  );

  return (
    <Path
      d={arcPath}
      stroke={ACCENT}
      strokeWidth={ORBIT_STROKE_WIDTH}
      strokeLinecap="round"
      fill="none"
    />
  );
});

const OrbitLoader: React.FC<CinematicLoaderProps> = ({
  title,
  subtitle,
  loading = true,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loading) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [loading, rotation]);

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <LinearGradient colors={["#000000", "#0B0B0B"]} style={styles.gradient}>
      <View style={styles.content}>
        <View style={styles.loaderStack}>
          <View style={styles.halo} />
          <View style={styles.portraitWrapper}>
            <Image source={FACE_IMAGE} style={styles.portraitImage} />
          </View>
          <View style={styles.orbitTrack}>
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
          </View>
          <Animated.View style={[styles.orbitArc, orbitStyle]}>
            <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
              <OrbitArc />
            </Svg>
          </Animated.View>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
};

export default OrbitLoader;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderStack: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    transform: [{ translateY: -36 }],
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: "rgba(180,243,77,0.12)",
  },
  portraitWrapper: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  portraitImage: {
    width: "100%",
    height: "100%",
    borderRadius: PORTRAIT_RADIUS,
    resizeMode: "cover",
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
  title: {
    marginTop: 48,
    fontSize: 22,
    color: ACCENT,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: TEXT_DIM,
    fontFamily: "Poppins-Medium",
    fontWeight: "500",
    textAlign: "center",
  },
});
