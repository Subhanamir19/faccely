import React, { useMemo } from "react";
import { Animated, Image, ImageSourcePropType, SafeAreaView, StyleSheet, View } from "react-native";

import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import T from "@/components/ui/T";

const FACE_SOURCE = require("@/assets/loading/face-loader.jpg");

const RADIUS = 110;
const STROKE = 10;
const SIZE = 240;
const DIAMETER = RADIUS * 2;
const PROGRESS_CANVAS = DIAMETER + STROKE;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  progress: Animated.Value;
  title: string;
  subtitle: string;
  badgeText: string;
  faceSource?: ImageSourcePropType;
};

export default function CinematicLoader({
  progress,
  title,
  subtitle,
  badgeText,
  faceSource = FACE_SOURCE,
}: Props) {
  const dashOffset = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 100],
        outputRange: [CIRCUMFERENCE, 0],
      }),
    [progress]
  );

  return (
    <LinearGradient colors={["#000000", "#0B0B0B"]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" translucent backgroundColor="transparent" />

        <View style={styles.container}>
          <View style={styles.loaderSection}>
            <View style={styles.circleWrapper}>
              <Svg width={SIZE} height={SIZE} style={styles.glowLayer}>
                <Defs>
                  <RadialGradient id="loader-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="rgba(180,243,77,0.12)" />
                    <Stop offset="65%" stopColor="rgba(180,243,77,0.05)" />
                    <Stop offset="100%" stopColor="rgba(180,243,77,0)" />
                  </RadialGradient>
                </Defs>
                <Rect width={SIZE} height={SIZE} fill="url(#loader-glow)" />
              </Svg>

              <View style={styles.progressWrapper}>
                <Svg
                  width={PROGRESS_CANVAS}
                  height={PROGRESS_CANVAS}
                  viewBox={`0 0 ${PROGRESS_CANVAS} ${PROGRESS_CANVAS}`}
                  style={styles.progressSvg}
                >
                  <Circle
                    cx={PROGRESS_CANVAS / 2}
                    cy={PROGRESS_CANVAS / 2}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={STROKE}
                    fill="transparent"
                  />
                  <AnimatedCircle
                    cx={PROGRESS_CANVAS / 2}
                    cy={PROGRESS_CANVAS / 2}
                    r={RADIUS}
                    stroke="#B4F34D"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={dashOffset}
                    originX={PROGRESS_CANVAS / 2}
                    originY={PROGRESS_CANVAS / 2}
                    rotation={-90}
                  />
                </Svg>

                <View style={styles.avatarWrapper}>
                  <Image source={faceSource} style={styles.avatar} resizeMode="cover" />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.textSection}>
            <T style={styles.title}>{title}</T>
            <T style={styles.subtitle}>{subtitle}</T>

            <View style={styles.progressBadge}>
              <T style={styles.progressText}>{badgeText}</T>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loaderSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  circleWrapper: {
    position: "relative",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#B4F34D",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  glowLayer: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
  },
  progressWrapper: {
    width: PROGRESS_CANVAS,
    height: PROGRESS_CANVAS,
    justifyContent: "center",
    alignItems: "center",
  },
  progressSvg: {
    position: "absolute",
  },
  avatarWrapper: {
    width: DIAMETER - 12,
    height: DIAMETER - 12,
    borderRadius: (DIAMETER - 12) / 2,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(0,0,0,0.65)",
    backgroundColor: "#070707",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  textSection: {
    alignItems: "center",
  },
  title: {
    color: "#B4F34D",
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "rgba(160,160,160,0.85)",
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    textAlign: "center",
    marginBottom: 20,
  },
  progressBadge: {
    borderWidth: 1,
    borderColor: "#B4F34D",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,

  },
  progressText: {
    color: "#B4F34D",
    fontFamily: "Poppins-SemiBold",

    fontSize: 14,
    letterSpacing: 0.3,
  },
});