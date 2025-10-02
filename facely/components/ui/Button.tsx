import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  variant?: "primary" | "ghost";
  size?: "sm" | "md"; // optional; defaults to md
};

const PINK = "#FF90ED";
const PINK_EDGE = "#B84AA6";
const TXT_DARK = "#1C0720";

export default function Button({
  title,
  onPress,
  style,
  variant = "primary",
  size = "md",
}: Props) {
  const height = size === "sm" ? 40 : 52;
  const radius = size === "sm" ? 18 : 24;
  const padH = size === "sm" ? 18 : 22;

  // Base pressable with bevel + depth
  const content = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: padH,
          backgroundColor: variant === "primary" ? PINK : "transparent",
          borderWidth: 2,
          borderColor: variant === "primary" ? PINK_EDGE : PINK,
          // 3D depth
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
        style,
      ]}
    >
      {/* Bevel highlight */}
      {variant === "primary" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(6, Math.floor(height * 0.28)),
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />
      ) : null}

      <Text
        style={{
          color: variant === "primary" ? TXT_DARK : PINK,
          fontSize: size === "sm" ? 14 : 16,
          fontWeight: "900",
          letterSpacing: 0.5,
          textTransform: "none",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );

  // Slab-style offset shadow behind the primary button
  if (variant === "primary") {
    return (
      <View style={{ position: "relative" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 8,
            right: -4,
            top: 8,
            bottom: -8,
            backgroundColor: "#000",
            opacity: 0.25,
            borderRadius: radius,
          }}
        />
        {content}
      </View>
    );
  }

  return content;
}
