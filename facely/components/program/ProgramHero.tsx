// components/program/ProgramHero.tsx
// Hero header for the exercise/program screen.
// Dark bg · teal aura circle · bust portrait · speech-bubble zone callouts.

import React, { useEffect } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeInLeft,
  FadeInRight,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import T from "@/components/ui/T";
import { COLORS } from "@/lib/tokens";

const { width: SW } = Dimensions.get("window");

/* ─── Layout ─────────────────────────────────────────────────────────────── */

const HERO_H = 310;
const BUST_W = Math.round(SW * 0.76);           // bust image width
const BUST_L = Math.round((SW - BUST_W) / 2);   // centered
const BUST_T = -15;                              // push up so head reaches top

const AURA_D = 260;                              // teal circle diameter
const AURA_L = Math.round((SW - AURA_D) / 2);
const AURA_T = 60;                               // sits behind shoulder/chest area

/* ─── Zone callout config ─────────────────────────────────────────────────── */
// side: which side of the face the bubble appears on
// top:  vertical position within the hero

const CALLOUT: Record<string, { label: string; side: "left" | "right"; top: number }> = {
  jawline:    { label: "fixing the\nlower face",   side: "left",  top: 158 },
  cheekbones: { label: "fixing the\nmidface",       side: "left",  top: 102 },
  eyes:       { label: "fixing the\norbital area",  side: "right", top: 68  },
  nose:       { label: "fixing the\nnose area",     side: "right", top: 118 },
  skin:       { label: "improving\nskin quality",   side: "left",  top: 72  },
};

/* ─── Speech bubble ───────────────────────────────────────────────────────── */

function Callout({ zone, delay = 0 }: { zone: string; delay?: number }) {
  const cfg = CALLOUT[zone];
  if (!cfg) return null;

  const isLeft = cfg.side === "left";
  const posStyle = isLeft ? { left: 12, top: cfg.top } : { right: 12, top: cfg.top };
  const entering = isLeft
    ? FadeInLeft.delay(delay).springify().damping(18)
    : FadeInRight.delay(delay).springify().damping(18);

  return (
    <Animated.View
      entering={entering}
      style={[s.calloutRow, posStyle, !isLeft && s.calloutRowRev]}
    >
      <View style={s.bubble}>
        <T style={s.bubbleText}>{cfg.label}</T>
      </View>
      {/* Triangle tail pointing toward face */}
      <View style={isLeft ? s.tailRight : s.tailLeft} />
    </Animated.View>
  );
}

/* ─── Emotion veil (separate component to avoid hook-in-JSX) ─────────────── */

function EmotionVeil({ sharedVal }: { sharedVal: Animated.SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: sharedVal.value,
  }));
  return <Animated.View style={[StyleSheet.absoluteFillObject, s.veil, style]} />;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */

export interface ProgramHeroProps {
  userName?:       string | null;
  streak?:         number;
  activeZones?:    string[];
  completedTasks?: number;
  totalTasks?:     number;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function ProgramHero({
  userName,
  streak         = 0,
  activeZones    = ["jawline", "eyes"],
  completedTasks = 0,
  totalTasks     = 0,
}: ProgramHeroProps) {
  const breathScale  = useSharedValue(1);
  const emotionScale = useSharedValue(1);
  const emotionVeil  = useSharedValue(0);

  useEffect(() => {
    // Slow breathing
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.014, { duration: 2200 }),
        withTiming(0.986, { duration: 2200 }),
      ), -1, true,
    );

    // Subtle smile flash every ~8s
    const timer = setInterval(() => {
      emotionScale.value = withSequence(
        withSpring(1.04, { damping: 6, stiffness: 180 }),
        withSpring(1,    { damping: 12 }),
      );
      emotionVeil.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 700 }),
      );
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  const bustStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value * emotionScale.value }],
  }));

  // Max 2 callouts — one per side
  const leftZone  = activeZones.find(z => CALLOUT[z]?.side === "left");
  const rightZone = activeZones.find(z => CALLOUT[z]?.side === "right");

  return (
    <View style={s.root}>

      {/* ── Background ─────────────────────────────────────────── */}
      <View style={s.bg} />

      {/* ── Teal aura — sits behind character at chest/shoulder ── */}
      {/* Outer soft bloom */}
      <View style={s.auraBloom} />
      {/* Main aura circle */}
      <View style={s.aura} />

      {/* ── Bust portrait ──────────────────────────────────────── */}
      <Animated.View style={[s.bust, bustStyle]}>
        <Image
          source={require("../../assets/hero/mascot-bust.png")}
          style={s.bustImg}
          resizeMode="contain"
        />
        <EmotionVeil sharedVal={emotionVeil} />
      </Animated.View>

      {/* ── Callout bubbles ────────────────────────────────────── */}
      {leftZone  && <Callout zone={leftZone}  delay={400} />}
      {rightZone && <Callout zone={rightZone} delay={600} />}

      {/* ── Greeting strip ─────────────────────────────────────── */}
      <View style={s.topBar}>
        <T style={s.greeting}>
          {userName ? `Good morning, ${userName}` : "Good morning"}
        </T>
        {streak > 0 && <T style={s.streak}>🔥 {streak}</T>}
      </View>

      {/* ── Bottom fade into screen ─────────────────────────────── */}
      <LinearGradient
        colors={["transparent", COLORS.bgBottom]}
        style={s.bottomFade}
        pointerEvents="none"
      />

    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: {
    height:   HERO_H,
    width:    "100%",
    overflow: "hidden",
  },

  // Background
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07080A",
  },

  // Aura
  auraBloom: {
    position:        "absolute",
    width:           AURA_D + 80,
    height:          AURA_D + 80,
    borderRadius:    (AURA_D + 80) / 2,
    left:            AURA_L - 40,
    top:             AURA_T - 40,
    backgroundColor: "rgba(45,210,160,0.07)",
  },
  aura: {
    position:        "absolute",
    width:           AURA_D,
    height:          AURA_D,
    borderRadius:    AURA_D / 2,
    left:            AURA_L,
    top:             AURA_T,
    backgroundColor: "rgba(45,210,160,0.22)",
  },

  // Bust
  bust: {
    position: "absolute",
    width:    BUST_W,
    height:   BUST_W,
    left:     BUST_L,
    top:      BUST_T,
  },
  bustImg: {
    width:  "100%",
    height: "100%",
  },
  veil: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius:    BUST_W / 2,
  },

  // Callout bubbles
  calloutRow: {
    position:       "absolute",
    flexDirection:  "row",
    alignItems:     "center",
  },
  calloutRowRev: {
    flexDirection: "row-reverse",
  },
  bubble: {
    backgroundColor:  "#FFFFFF",
    borderRadius:     7,
    paddingHorizontal: 8,
    paddingVertical:  5,
    maxWidth:         88,
    shadowColor:      "#000",
    shadowOpacity:    0.18,
    shadowRadius:     6,
    shadowOffset:     { width: 0, height: 2 },
    elevation:        3,
  },
  bubbleText: {
    fontSize:      10,
    color:         "#111111",
    fontFamily:    "Poppins-SemiBold",
    lineHeight:    13,
    letterSpacing: 0.1,
  },

  // CSS triangle tails
  tailRight: {
    width:             0,
    height:            0,
    borderTopWidth:    5,
    borderBottomWidth: 5,
    borderLeftWidth:   7,
    borderTopColor:    "transparent",
    borderBottomColor: "transparent",
    borderLeftColor:   "#FFFFFF",
  },
  tailLeft: {
    width:             0,
    height:            0,
    borderTopWidth:    5,
    borderBottomWidth: 5,
    borderRightWidth:  7,
    borderTopColor:    "transparent",
    borderBottomColor: "transparent",
    borderRightColor:  "#FFFFFF",
  },

  // Greeting bar
  topBar: {
    position:       "absolute",
    top:            16,
    left:           0,
    right:          0,
    flexDirection:  "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize:  13,
    color:     "rgba(255,255,255,0.50)",
    letterSpacing: 0.1,
  },
  streak: {
    fontSize: 13,
    color:    "rgba(255,255,255,0.50)",
  },

  // Bottom fade
  bottomFade: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   60,
  },
});
