import React from "react";
import { Pressable, View, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

  if (isSolid) {
    return (
      <View style={[styles.depthWrap, disabled && styles.disabled]}>
        <Pressable
          onPress={disabled ? undefined : onPress}
          style={({ pressed }) => [
            styles.solidPressable,
            { transform: [{ translateY: pressed && !disabled ? 5 : 0 }] },
          ]}
        >
          <LinearGradient
            colors={["#CCFF6B", "#B4F34D"]}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.solidGradient}
          >
            {icon ? (
              <Ionicons name={icon} size={18} color="#0B0B0B" style={{ marginRight: SP[2] }} />
            ) : null}
            {loading ? (
              <ActivityIndicator color="#0B0B0B" />
            ) : (
              <Text style={styles.solidLabel} numberOfLines={1}>{label}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ flex: 1 }}>
      {({ pressed }) => (
        <View
          style={[
            styles.ghostBase,
            pressed && !disabled ? styles.pressed : null,
            disabled ? styles.disabled : null,
          ]}
        >
          {icon ? (
            <Ionicons name={icon} size={18} color={COLORS.text} style={{ marginRight: SP[2] }} />
          ) : null}
          {loading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.ghostLabel} numberOfLines={1}>{label}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Solid — lime 3D depth button
  depthWrap: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  solidPressable: {
    height: 56,
    borderRadius: 30,
    overflow: "hidden",
  },
  solidGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    paddingHorizontal: SP[3],
    gap: SP[1],
  },
  solidLabel: {
    color: "#0B0B0B",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },

  // Ghost
  ghostBase: {
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.08)",
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
  ghostLabel: {
    color: COLORS.text,
    fontSize: 16,
  },
});
