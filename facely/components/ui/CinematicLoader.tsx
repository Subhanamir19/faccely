import React, { useEffect, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";
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
const ORBIT_STROKE_WIDTH = 12;

const ORBIT_SIZE = ORBIT_RADIUS * 2 + ORBIT_STROKE_WIDTH;
const ARC_SWEEP_DEGREES = 220;

const ARC_OFFSET_DEGREES = -90;
const HALO_SIZE = 300;
const FACE_IMAGE = require("@/assets/loading/face-loader.jpg");

const ACCENT = COLORS?.accent ?? "#B4F34D";
const TRACK = "rgba(255,255,255,0.08)";
const EDGE_HIGHLIGHT = "rgba(255,255,255,0.55)";
const EDGE_SHADOW = "rgba(14,14,14,0.95)";
const INNER_GLOW = "rgba(180,243,77,0.18)";
const OUTER_GLOW = "rgba(12,12,12,0.92)";

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
    [],
  );

  return (
    <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
    <Defs>
      <SvgLinearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={EDGE_HIGHLIGHT} stopOpacity={0.9} />
        <Stop offset="50%" stopColor={ACCENT} stopOpacity={1} />
        <Stop offset="100%" stopColor={EDGE_SHADOW} stopOpacity={0.9} />
      </SvgLinearGradient>
    </Defs>
    <Path
      d={arcPath}
      stroke="url(#arcGradient)"
      strokeWidth={ORBIT_STROKE_WIDTH}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
  );
});

const BevelTrack = React.memo(function BevelTrack() {
  return (
    <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
      <Defs>
        <SvgLinearGradient
          id="bevelBase"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <Stop offset="0%" stopColor={EDGE_HIGHLIGHT} stopOpacity={0.35} />
          <Stop offset="45%" stopColor={TRACK} stopOpacity={1} />
          <Stop offset="100%" stopColor={EDGE_SHADOW} stopOpacity={0.65} />
        </SvgLinearGradient>
        <SvgLinearGradient
          id="bevelInner"
          x1="100%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <Stop offset="0%" stopColor={EDGE_HIGHLIGHT} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={OUTER_GLOW} stopOpacity={0.8} />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={ORBIT_SIZE / 2}
        cy={ORBIT_SIZE / 2}
        r={ORBIT_RADIUS}
        stroke="url(#bevelBase)"
        strokeWidth={ORBIT_STROKE_WIDTH}
        fill="none"
      />
      <Circle
        cx={ORBIT_SIZE / 2}
        cy={ORBIT_SIZE / 2}
        r={ORBIT_RADIUS - ORBIT_STROKE_WIDTH / 2}
        stroke="url(#bevelInner)"
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
});

const CinematicLoader: React.FC<CinematicLoaderProps> = ({ loading = true }) => {

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loading) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1600,
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
    <LinearGradient colors={["#020202", "#090909", "#020202"]} style={styles.gradient}>

      <View style={styles.content}>
        <View style={styles.loaderStack}>
          <View style={styles.halo} />
          <View style={styles.portraitWrapper}>
            <Image source={FACE_IMAGE} style={styles.portraitImage} />
            <LinearGradient
              colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0)"]}
              style={styles.portraitOverlay}
            />
          </View>
          <View style={styles.orbitTrack}>
          <BevelTrack />

          </View>
          <Animated.View style={[styles.orbitArc, orbitStyle]}>
          <OrbitArc />

          </Animated.View>
        </View>
        <Text style={styles.brand}>SIGMA MAX APP</Text>

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
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: INNER_GLOW,
    shadowColor: ACCENT,
    shadowOpacity: 0.5,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  portraitWrapper: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,8,8,0.85)",
    shadowColor: EDGE_SHADOW,
    shadowOpacity: 0.6,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 30,
  },
  portraitImage: {
    width: "100%",
    height: "100%",
    borderRadius: PORTRAIT_RADIUS,
    resizeMode: "cover",
  },

  portraitOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },

  orbitTrack: {
    position: "absolute",
    top: -(ORBIT_STROKE_WIDTH / 2),
    left: -(ORBIT_STROKE_WIDTH / 2),
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },

  
  orbitArc: {
    position: "absolute",
    top: -(ORBIT_STROKE_WIDTH / 2),
    left: -(ORBIT_STROKE_WIDTH / 2),
  },
  brand: {
    marginTop: 54,
    fontSize: 20,
    color: EDGE_HIGHLIGHT,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 6,

    textAlign: "center",
  },
});
