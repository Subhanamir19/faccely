import React from "react";
import { Pressable, View, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";

type Kind = "ghost" | "solid";

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  kind?: Kind;
  loading?: boolean;
};

export default function PillNavButton({
  label,
  icon,
  onPress,
  disabled,
  kind = "ghost",
  loading,
}: Props) {
  const isSolid = kind === "solid";
  const bg = isSolid ? COLORS.accent : "rgba(255,255,255,0.08)";
  const border = isSolid ? "transparent" : COLORS.cardBorder;
  const textColor = isSolid ? "#0B0B0B" : COLORS.text;

  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ flex: 1 }}>
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            { backgroundColor: bg, borderColor: border },
            pressed && !disabled ? styles.pressed : null,
            disabled ? styles.disabled : null,
          ]}
        >
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={textColor}
              style={{ marginRight: SP[2] }}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
    gap: SP[1],
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
  },
});
