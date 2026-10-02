// components/onboarding/ScreenBackground.tsx
// The onboarding background layer. Every onboarding screen should get its
// surface from here rather than setting its own backgroundColor, so the flow
// reads as one continuous surface whose tint tracks the mood of each beat.
//
// Two shapes, both backed by the same tokens:
//
//   // as the base layer inside a screen that already has a root View
//   <ScreenBackground mood="mint" />
//
//   // as the root itself
//   <ScreenBackground mood="mint" style={styles.root}>{...}</ScreenBackground>
//
// `neutral` renders a flat shell — the gradient collapses to one colour — so
// question screens can use the same component without a special case.
import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { BG_MOODS, BG_MOOD_GRADIENT, type BgMood } from "@/lib/tokens";

type Props = {
  mood?: BgMood;
  /** Present: the component is the screen root. Absent: it is an absolute layer. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Screens that manage their own StatusBar (camera, reveals) pass false. */
  statusBar?: boolean;
};

export default function ScreenBackground({
  mood = "neutral",
  children,
  style,
  statusBar = true,
}: Props) {
  const tint = BG_MOODS[mood];

  const layer = (
    <>
      {statusBar ? (
        <StatusBar barStyle="dark-content" backgroundColor={tint.top} />
      ) : null}
      <LinearGradient
        colors={[tint.top, tint.mid, tint.bottom] as const}
        locations={BG_MOOD_GRADIENT.locations}
        start={BG_MOOD_GRADIENT.start}
        end={BG_MOOD_GRADIENT.end}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </>
  );

  if (children === undefined) return layer;

  return (
    <View style={[styles.root, { backgroundColor: tint.bottom }, style]}>
      {layer}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
