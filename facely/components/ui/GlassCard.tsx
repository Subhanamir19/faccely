import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { ms, sh } from "@/lib/responsive";

const RADIUS = ms(22);

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
      style={[
        s.base,
        { borderRadius: RADIUS },
        isScore ? s.scoreOuter : s.defaultOuter,
        style,
      ]}
    >
      {isScore && <View style={[s.scoreOverlay, { borderRadius: RADIUS }]} pointerEvents="none" />}
      {children}
    </BlurView>
  );
}

const s = StyleSheet.create({
  base: { overflow: "hidden" },

  defaultOuter: {
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: sh(10),
    paddingBottom: sh(10),
  },

  scoreOuter: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingTop: sh(8),
    paddingBottom: sh(16),
  },

  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
