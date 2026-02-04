// components/ui/BackButton.tsx
// Unified back navigation button with consistent styling across all screens

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Text from "./T";
import { COLORS, SP } from "@/lib/tokens";

type BackButtonProps = {
  label?: string;
  onPress?: () => void;
  showIcon?: boolean;
};

export default function BackButton({
  label = "Back",
  onPress,
  showIcon = true,
}: BackButtonProps) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {showIcon && (
        <Ionicons name="chevron-back" size={18} color={COLORS.text} />
      )}
      <Text variant="captionMedium" color="text">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SP[1],
    paddingVertical: SP[1],
    paddingRight: SP[2],
  },
  pressed: {
    opacity: 0.7,
  },
});
