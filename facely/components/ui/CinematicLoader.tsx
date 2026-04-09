import React, { useEffect, useState, useCallback } from "react";
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
  withSequence,
} from "react-native-reanimated";

import { COLORS } from "@/lib/tokens";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORTRAIT_SIZE    = 240;
const PORTRAIT_RADIUS  = PORTRAIT_SIZE / 2;
const ORBIT_RADIUS     = 132;
const ORBIT_STROKE_W   = 10;
const ORBIT_SIZE       = ORBIT_RADIUS * 2 + ORBIT_STROKE_W;
const ARC_SWEEP        = 220;
const ARC_OFFSET       = -90;
const BADGE_R          = 162; // radius at which data badges sit
const BADGE_CONTAINER  = PORTRAIT_SIZE + (BADGE_R - PORTRAIT_RADIUS + 40) * 2;

const ACCENT        = COLORS?.accent ?? "#B4F34D";
const ACCENT_DIM    = "rgba(180,243,77,0.18)";
const TRACK         = "rgba(255,255,255,0.10)";
const TEXT_COLOR    = "#F5F5F5";
const TEXT_SUB      = "rgba(255,255,255,0.45)";

const LOGO_SOURCE = require("@/assets/sigmamax-real-updatred-logo.jpeg");

const SCAN_STEPS = [
  "Scanning facial structure",
  "Measuring symmetry",
  "Analyzing jawline",
  "Evaluating eye area",
  "Calculating proportions",
  "Generating scores",
];

// Data badges shown around the orbit ring
const BADGES = [
  { label: "SYM",  angle: 335 },
  { label: "JAW",  angle: 25  },
  { label: "EYES", angle: 95  },
  { label: "SKIN", angle: 155 },
  { label: "NOSE", angle: 205 },
  { label: "MASC", angle: 275 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    left: cx + radius * Math.cos(rad),
    top:  cy + radius * Math.sin(rad),
  };
}

function buildArcPath(radius: number, sweep: number, offset: number) {
  const size = radius * 2 + ORBIT_STROKE_W;
  const cx   = size / 2;
  const cy   = size / 2;
  function pt(deg: number) {
    const r = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(r), y: cy + radius * Math.sin(r) };
  }
  const start = pt(offset + sweep / 2);
  const end   = pt(offset - sweep / 2);
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 0 ${end.x} ${end.y}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const OrbitTrack = React.memo(() => (
  <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
    <Circle
      cx={ORBIT_SIZE / 2} cy={ORBIT_SIZE / 2} r={ORBIT_RADIUS}
      stroke={TRACK} strokeWidth={ORBIT_STROKE_W} fill="none"
    />
  </Svg>
));

const OrbitArc = React.memo(() => {
  const path = buildArcPath(ORBIT_RADIUS, ARC_SWEEP, ARC_OFFSET);
  return (
    <Svg width={ORBIT_SIZE} height={ORBIT_SIZE}>
      <Path d={path} stroke={ACCENT} strokeWidth={ORBIT_STROKE_W} strokeLinecap="round" fill="none" />
    </Svg>
  );
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CinematicLoaderProps = {
  loading?:    boolean;
  messages?:   string[];
  brandLabel?: string;
  photoUri?:   string; // user's frontal photo — triggers scan mode
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CinematicLoader: React.FC<CinematicLoaderProps> = ({
  loading    = true,
  messages,
  brandLabel = "SIGMA MAX",
  photoUri,
}) => {
  const isScanMode = !!photoUri;

  // Orbit rotation
  const rotation   = useSharedValue(0);
  // Scan line Y position (within portrait circle, -PORTRAIT_RADIUS → +PORTRAIT_RADIUS)
  const scanLineY  = useSharedValue(-PORTRAIT_RADIUS);
  // Text opacity for cycling
  const textOpacity = useSharedValue(1);

  // Step text
  const STEPS = messages ?? SCAN_STEPS;
  const [stepIndex,    setStepIndex]    = useState(0);
  // Active badge (flickers through)
  const [activeBadge,  setActiveBadge]  = useState(0);
  // Elapsed timer
  const [elapsed,      setElapsed]      = useState(0);

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!loading) {
      cancelAnimation(rotation);
      cancelAnimation(scanLineY);
      cancelAnimation(textOpacity);
      return;
    }

    // Orbit arc spin
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
      -1, false,
    );

    if (isScanMode) {
      // Scan line sweeps top → bottom, repeating
      scanLineY.value = -PORTRAIT_RADIUS;
      scanLineY.value = withRepeat(
        withTiming(PORTRAIT_RADIUS, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1, false,
      );
    }

    // Text fade for step cycling
    textOpacity.value = 1;
    textOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200, easing: Easing.in(Easing.cubic) }),
      ),
      -1, false,
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scanLineY);
      cancelAnimation(textOpacity);
    };
  }, [loading, isScanMode]);

  // Step text cycling
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStepIndex((i) => (i + 1) % STEPS.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  // Badge flicker cycling
  useEffect(() => {
    if (!loading || !isScanMode) return;
    const t = setInterval(() => setActiveBadge((i) => (i + 1) % BADGES.length), 600);
    return () => clearInterval(t);
  }, [loading, isScanMode]);

  // Elapsed timer
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  // ---------------------------------------------------------------------------
  // Animated styles
  // ---------------------------------------------------------------------------
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const cx = BADGE_CONTAINER / 2;
  const cy = BADGE_CONTAINER / 2;

  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <LinearGradient colors={["#020202", "#090909", "#020202"]} style={styles.gradient}>
      <View style={styles.content}>

        {/* ── Badge container (wider than portrait to allow ring labels) ── */}
        <View style={[styles.badgeContainer, { width: BADGE_CONTAINER, height: BADGE_CONTAINER }]}>

          {/* Data badges around the ring (scan mode only) */}
          {isScanMode && BADGES.map((badge, i) => {
            const pos = polarToXY(badge.angle, BADGE_R, cx, cy);
            const isActive = activeBadge === i;
            return (
              <View
                key={badge.label}
                style={[
                  styles.badge,
                  {
                    left: pos.left - 24,
                    top:  pos.top  - 12,
                    opacity: isActive ? 1 : 0.28,
                    borderColor: isActive ? ACCENT : "rgba(255,255,255,0.12)",
                    backgroundColor: isActive ? "rgba(180,243,77,0.10)" : "rgba(255,255,255,0.04)",
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: isActive ? ACCENT : TEXT_SUB }]}>
                  {badge.label}
                </Text>
              </View>
            );
          })}

          {/* ── Portrait stack (orbit ring + photo/video) ── */}
          <View style={styles.portraitStack}>

            {/* Orbit track */}
            <View style={styles.orbitLayer}>
              <OrbitTrack />
            </View>

            {/* Animated orbit arc */}
            <Animated.View style={[styles.orbitLayer, orbitStyle]}>
              <OrbitArc />
            </Animated.View>

            {/* Portrait circle */}
            <View style={styles.portraitWrapper}>
              {isScanMode ? (
                <>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.portrait}
                    resizeMode="cover"
                  />
                  {/* Scan line — clipped to circle by parent overflow:hidden */}
                  <Animated.View style={[styles.scanLine, scanLineStyle]}>
                    <LinearGradient
                      colors={["transparent", ACCENT, "transparent"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  {/* Subtle scan overlay tint */}
                  <View style={styles.scanOverlay} />
                </>
              ) : (
                <Image
                  source={LOGO_SOURCE}
                  style={styles.portrait}
                  resizeMode="cover"
                />
              )}
              <View style={styles.portraitInnerBorder} />
            </View>

          </View>
        </View>

        {/* ── Text section ── */}
        {isScanMode ? (
          <View style={styles.textSection}>
            <Text style={styles.scanTitle}>Analyzing your face</Text>
            <Text style={styles.elapsedTimer}>{elapsedStr}</Text>
            <Animated.Text style={[styles.stepText, textStyle]}>
              {STEPS[stepIndex]}
            </Animated.Text>
          </View>
        ) : (
          <View style={styles.textSection}>
            <Text style={styles.brand}>{brandLabel}</Text>
            <Animated.Text style={[styles.stepText, textStyle]}>
              {STEPS[stepIndex]}
            </Animated.Text>
          </View>
        )}

      </View>
    </LinearGradient>
  );
};

export default CinematicLoader;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ORBIT_OFFSET = -(ORBIT_STROKE_W / 2);

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  // Badge container — large transparent layer holding portrait + outer badges
  badgeContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  // Data badge chips
  badge: {
    position: "absolute",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.8,
  },

  // Portrait + orbit centered within badge container
  portraitStack: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitLayer: {
    position: "absolute",
    top: ORBIT_OFFSET - (ORBIT_RADIUS - PORTRAIT_RADIUS),
    left: ORBIT_OFFSET - (ORBIT_RADIUS - PORTRAIT_RADIUS),
  },
  portraitWrapper: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: PORTRAIT_RADIUS,
    overflow: "hidden",
    backgroundColor: "#050505",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  portrait: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
  },
  portraitInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PORTRAIT_RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
  },

  // Scanning line
  scanLine: {
    position: "absolute",
    left: 0,
    width: PORTRAIT_SIZE,
    height: 3,
    top: PORTRAIT_RADIUS, // centered, translateY shifts it
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(180,243,77,0.04)",
  },

  // Text
  textSection: {
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  scanTitle: {
    fontSize: 22,
    color: TEXT_COLOR,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  elapsedTimer: {
    fontSize: 42,
    color: ACCENT,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 48,
    letterSpacing: 2,
  },
  stepText: {
    fontSize: 12,
    color: TEXT_SUB,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  brand: {
    fontSize: 20,
    color: TEXT_COLOR,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: 4,
  },
});
