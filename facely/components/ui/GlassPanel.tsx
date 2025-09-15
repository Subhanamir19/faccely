import React, { ReactNode } from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  children: ReactNode;
  style?: object;
};

export function GlassPanel({ children, style }: Props) {
  return (
    <View
      style={[
        {
          borderRadius: 40,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 16 },
        },
        style,
      ]}
    >
      {/* Base blur */}
      <BlurView
        intensity={65}
        tint="light"
        style={{
          borderRadius: 40,
          backgroundColor: "rgba(255,255,255,0.15)",
        }}
      >
        {/* Inner glow layer */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.25)",
            "rgba(255,255,255,0.05)",
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />

        {/* Subtle border to define edges */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 40,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.35)",
          }}
        />

        {/* Actual content */}
        <View style={{ padding: 28 }}>{children}</View>
      </BlurView>
    </View>
  );
}
