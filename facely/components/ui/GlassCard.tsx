import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

export default function GlassCard({
  children,
  variant = "default",
  style,
}: {
  children: React.ReactNode;
  variant?: "default" | "score";
  style?: any;
}) {
  const isScore = variant === "score";
  return (
    <BlurView
      intensity={isScore ? 60 : 45}
      tint="dark"
      style={[s.base, isScore ? s.scoreOuter : s.defaultOuter, style]}
    >
      {isScore && <View style={s.scoreOverlay} pointerEvents="none" />}
      {children}
    </BlurView>
  );
}

const s = StyleSheet.create({
  base: { borderRadius: 24, overflow: "hidden" },

  defaultOuter: {
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    paddingBottom: 12,
  },

  scoreOuter: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingTop: 10,
    paddingBottom: 18,
  },

  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
