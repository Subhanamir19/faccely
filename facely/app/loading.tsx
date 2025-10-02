// app/loading.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import T from "@/components/ui/T";
import { useOnboarding } from "@/store/onboarding";

// ===== Tokens =====
const LIME = "#8FA31E";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_DIM = "rgba(255,255,255,0.65)";
const CARD_BORDER = "rgba(255,255,255,0.12)";
const CARD_TINT = "rgba(15,15,15,0.72)";
const PURPLE = "#B77CFF";        // progress ring
const PURPLE_END = "#8A63FF";    // ring head
const TRACK = "rgba(255,255,255,0.08)";

const SIZE = 240;        // outer diameter of ring container
const RING = 210;        // circle diameter for SVG math
const STROKE = 12;

export default function LoadingScreen() {
  const { completed } = useOnboarding();

  // progress 0..100
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!completed) {
      // nice try deep-linking; go finish onboarding
      router.replace("/(onboarding)/age");
      return;
    }

    // Simulated bootstrap; replace with real warmups later
    const run = () => {
      Animated.timing(prog, {
        toValue: 100,
        duration: 2200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) router.replace("/(tabs)/take-picture");
      });
    };
    run();
  }, [completed, prog]);

  // Derived values for ring + percent
  const pct = prog.interpolate({ inputRange: [0, 100], outputRange: [0, 100] });
  const pctText = prog.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 100],
  });

  // ring math
  const CIRC = Math.PI * (RING - STROKE);
  const dashOffset = prog.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRC, 0],
  });

  return (
    <LinearGradient
      colors={["#0B0911", "#0B0911"]} // base black; purple halo via overlay below
      style={styles.screen}
    >
      {/* purple radial glow */}
      <LinearGradient
        colors={["rgba(151, 91, 255,0.35)", "rgba(0,0,0,0)"]}
        style={styles.radialGlow}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.centerWrap}>
        {/* Glass card so it matches your onboarding aesthetic */}
        <BlurView intensity={50} tint="dark" style={styles.card}>
          <View style={styles.cardOverlay} />

          {/* Ring + Avatar */}
          <View style={styles.ringWrap}>
            {/* Track */}
            <Animated.View
              style={[
                styles.svgWrap,
                { transform: [{ rotate: "-90deg" }] }, // start at top
              ]}
            >
              {/* We use two circles by stacking Views with borders to avoid SVG perf jank */}
              <View
                style={[
                  styles.circleBase,
                  {
                    borderColor: TRACK,
                    width: RING,
                    height: RING,
                    borderWidth: STROKE,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.circleProg,
                  {
                    width: RING,
                    height: RING,
                    borderWidth: STROKE,
                    borderColor: PURPLE,
                    // Stroke dash emulation by masking with clip ring + rotating a half-gradient head
                    // Use a sweep gradient via background and mask for smooth head
                  },
                ]}
              />
            </Animated.View>

            {/* Actual sweep progress using native Animated.View */}
            <Animated.View
              style={[
                styles.sweep,
                {
                  width: RING,
                  height: RING,
                  borderRadius: RING / 2,
                  transform: [{ rotate: prog.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0deg", "360deg"],
                  }) }],
                },
              ]}
            >
              <LinearGradient
                colors={[PURPLE, PURPLE_END]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.sweepHead}
              />
            </Animated.View>

            {/* Inner avatar */}
            <View style={styles.avatarWrap}>
            <Image
  source={require("../assets/loading/face-loader.jpg")}
  style={styles.avatar}
  resizeMode="cover"
/>

            </View>

            {/* Mask the ring to show only the traced arc using dash offset math */}
            <Animated.View
              style={[
                styles.mask,
                {
                  borderWidth: STROKE,
                  width: RING,
                  height: RING,
                  borderRadius: RING / 2,
                  // emulate stroke-dashoffset by clipping a sector with larger black cover
                  // we fake with a rotating cover that shrinks as progress grows
                  transform: [
                    {
                      rotate: prog.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* Headline */}
          <T style={styles.headline}>Max your Looks</T>

          {/* Subline */}
          <T style={styles.subline}>Preparing analysis algorithm</T>

          {/* Percent pill */}
          <View style={styles.pill}>
            <T style={styles.pillText}>
              {/** show integer percent */}
              {Math.round((prog as any)._value ?? 0)}%
            </T>
          </View>
        </BlurView>
      </View>

      {/* Grassy bottom image like your other screens */}
      <ImageBackground
        source={require("../assets/bg/score-bg.jpg")}
        style={styles.bottomBg}
        imageStyle={{ resizeMode: "cover" }}
      />
    </LinearGradient>
  );
}

const R = 28;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  radialGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },

  bottomBg: {
    position: "absolute",
    bottom: -10,
    left: 0,
    right: 0,
    height: 200,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  card: {
    width: "92%",
    borderRadius: R,
    overflow: "hidden",
    paddingTop: 26,
    paddingBottom: 28,
    alignItems: "center",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD_TINT,
    borderRadius: R,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  svgWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  circleBase: {
    position: "absolute",
    borderRadius: RING / 2,
    opacity: 0.5,
  },
  circleProg: {
    position: "absolute",
    borderRadius: RING / 2,
    opacity: 0.2,
  },
  sweep: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  sweepHead: {
    position: "absolute",
    right: -STROKE / 2,
    width: STROKE + 8,
    height: STROKE + 8,
    borderRadius: (STROKE + 8) / 2,
  },

  avatarWrap: {
    width: SIZE - 54,
    height: SIZE - 54,
    borderRadius: (SIZE - 54) / 2,
    overflow: "hidden",
    borderWidth: 6,
    borderColor: "rgba(0,0,0,0.65)",
    backgroundColor: "#111",
  },
  avatar: { width: "100%", height: "100%" },

  mask: {
    position: "absolute",
    borderColor: "transparent",
    // This element exists only to stabilize layout on some Androids
  },

  headline: {
    marginTop: 22,
    fontSize: 28,
    lineHeight: 32,
    color: LIME,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  subline: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_DIM,
    fontFamily: Platform.select({
      ios: "Poppins-Regular",
      android: "Poppins-Regular",
      default: "Poppins-Regular",
    }),
  },

  pill: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillText: {
    fontSize: 14,
    color: TEXT,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
