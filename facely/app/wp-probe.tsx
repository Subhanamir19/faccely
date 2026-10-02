// app/wp-probe.tsx
// Minimal isolation probes for the "Know your weak points" iOS crash.
// Each probe adds exactly one layer over the previous one.
//   a = View + Text only
//   b = a + the face Image
//   c = b + Reanimated timing/spring animation
//   d = c + LinearGradient + OrangePrimaryButton

import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";

const FACE = require("../advanced-analysis-icons/newer-version/skin-quality.png");

export default function WeakPointsProbeRoute() {
  const { probe } = useLocalSearchParams<{ probe?: string }>();
  const level = (probe ?? "a").toLowerCase();
  console.log("[WP-PROBE] mounted, level =", level);

  const p = useSharedValue(0);

  useEffect(() => {
    console.log("[WP-PROBE] effect start");
    if (level >= "c") {
      p.value = withTiming(1, { duration: 1200 });
    }
    console.log("[WP-PROBE] effect done");
  }, [level, p]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * p.value,
    transform: [{ translateY: (1 - p.value) * 20 }],
  }));

  return (
    <View style={s.root}>
      <Text style={s.label}>probe {level}</Text>

      {level >= "b" && (
        <View style={s.frame}>
          <Image source={FACE} style={s.face} resizeMode="contain" />
        </View>
      )}

      {level >= "c" && (
        <Animated.View style={[s.box, animStyle]}>
          <Text style={s.label}>reanimated</Text>
        </Animated.View>
      )}

      {level >= "d" && (
        <>
          <LinearGradient
            colors={["rgba(242,106,19,0)", "rgba(242,106,19,0.2)"]}
            style={s.grad}
          />
          <View style={s.cta}>
            <OrangePrimaryButton label="Got it" onPress={() => {}} />
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFCF7", padding: 24, gap: 16 },
  label: { fontSize: 16, color: "#050505" },
  frame: { height: 320, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF" },
  face: { width: "100%", height: "100%", transform: [{ scale: 1.16 }] },
  box: { padding: 16, borderRadius: 16, backgroundColor: "#FFF1E7" },
  grad: { height: 60, borderRadius: 12 },
  cta: { width: "100%" },
});
