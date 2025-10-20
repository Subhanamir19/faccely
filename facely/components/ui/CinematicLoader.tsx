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
const ORBIT_STROKE_WIDTH = 12;

const ORBIT_SIZE = ORBIT_RADIUS * 2 + ORBIT_STROKE_WIDTH;
const ARC_SWEEP_DEGREES = 220;

const ARC_OFFSET_DEGREES = -90;

const FACE_IMAGE = require("@/assets/loading/face-loader.jpg");

const ACCENT = COLORS?.accent ?? "#B4F34D";
const TRACK = "rgba(255,255,255,0.18)";
const TEXT_COLOR = "#F5F5F5";

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

          <View style={styles.portraitWrapper}>
            <Image source={FACE_IMAGE} style={styles.portraitImage} />
         
          </View>
          <View style={styles.orbitTrack}>
          <OrbitTrack />


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
  
  portraitWrapper: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#050505",

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
  brand: {
    marginTop: 54,
    fontSize: 20,
    color: TEXT_COLOR,

    fontFamily: "Poppins-SemiBold",
    letterSpacing: 6,

    textAlign: "center",
  },
});
