// components/program/SpeechBubble.tsx
// Floating speech-bubble annotation with typewriter entrance + gentle idle float.
// Shared between the workout card on the daily tab list view and the new
// WorkoutPreview screen so animation timing stays identical across surfaces.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { sw, sh, ms } from "@/lib/responsive";

export default function SpeechBubble({
  text,
  top,
  right,
  left,
  delay = 240,
  floatPhase = 0,
  Icon,
}: {
  text: string;
  top: string | number;
  right?: number;
  left?: number;
  delay?: number;
  floatPhase?: number;  // ms offset so bubbles float out of sync
  Icon?: LucideIcon;
}) {
  const [displayed, setDisplayed] = useState("");
  const floatY = useSharedValue(0);

  // Typewriter
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 52);
    }, delay + 160);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, delay]);

  // Float — starts after entrance, limited to ±3.5px, phase-offset per bubble
  useEffect(() => {
    const t = setTimeout(() => {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-3.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming( 3.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, delay + floatPhase + 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(380).springify().damping(18).stiffness(160)}
      style={[
        styles.bubbleWrap,
        { top: top as any, ...(right !== undefined ? { right } : { left }) },
        floatStyle,
      ]}
      accessibilityLabel={text}
    >
      {Icon ? (
        <View style={styles.iconChip}>
          <Icon size={ms(12)} color="#58BF19" strokeWidth={2.3} />
        </View>
      ) : null}
      <Text style={styles.bubbleText}>{displayed}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: sw(6),
    paddingHorizontal: sw(6),
    paddingVertical: sh(4),
    minWidth: sw(64),
    maxWidth: sw(88),
    minHeight: sh(24),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: sh(1.5) },
    shadowOpacity: 0.16,
    shadowRadius: sw(4),
    elevation: 4,
  },
  iconChip: {
    width: ms(18),
    height: ms(18),
    borderRadius: ms(6),
    backgroundColor: "#EFFAE9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sh(2),
  },
  bubbleText: {
    fontSize: ms(8),
    fontFamily: "Poppins-SemiBold",
    color: "#0D0D0D",
    letterSpacing: 0.1,
    lineHeight: ms(11.5),
    textAlign: "left",
  },
});
