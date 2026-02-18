// components/ui/GlassBtn.tsx
import React from "react";
import { Pressable, StyleSheet, View, Platform } from "react-native";
import T from "@/components/ui/T";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/lib/tokens";

type Variant = "glass" | "primary";

const R = 28;
const ACCENT = COLORS.accent;
const DEPTH = 5;

export default function GlassBtn({
  label,
  icon,
  onPress,
  disabled,
  variant = "glass",
  height = 56,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap | null;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  height?: number;
}) {
  const isPrimary = variant === "primary";

  if (disabled && isPrimary) {
    // Disabled primary: flat, no 3D
    return (
      <View style={[styles.pressable, { marginHorizontal: 6 }]}>
        <View style={[styles.primaryDisabledBase, { height }]}>
          <T style={styles.primaryDisabledText}>{label}</T>
          {icon ? <Ionicons name={icon as any} size={18} color="#7A7A7A" style={styles.iconLeft} /> : null}
        </View>
      </View>
    );
  }

  const baseColor = isPrimary ? "#6B9A1E" : "#1A1A1A";

  return (
    <View style={[styles.pressable, { marginHorizontal: 6 }]}>
      {/* 3D base — dark shadow layer */}
      <View
        style={[
          {
            borderRadius: R,
            backgroundColor: baseColor,
            paddingBottom: DEPTH,
          },
          isPrimary && !disabled ? styles.shadowPrimary : styles.shadowGlass,
        ]}
      >
        <Pressable onPress={onPress} disabled={disabled}>
          {({ pressed }) => (
            <View
              style={[
                isPrimary ? styles.primaryBase : styles.glassBase,
                {
                  height,
                  transform: [{ translateY: pressed ? DEPTH - 1 : 0 }],
                },
                disabled && styles.glassDisabled,
              ]}
            >
              {icon ? (
                <Ionicons
                  name={icon as any}
                  size={18}
                  color={isPrimary ? "#0B0B0B" : "#EDEDED"}
                  style={styles.iconLeft}
                />
              ) : null}
              <T style={isPrimary ? styles.primaryText : styles.glassText}>{label}</T>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignSelf: "stretch",
  },

  shadowPrimary: {
    ...(Platform.OS === "android"
      ? { elevation: 12 }
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }),
  },
  shadowGlass: {
    ...(Platform.OS === "android"
      ? { elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }),
  },

  primaryBase: {
    borderRadius: R,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  primaryText: {
    fontSize: 18,
    color: "#0B0B0B",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  primaryDisabledBase: {
    borderRadius: R,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2A2A",
  },
  primaryDisabledText: {
    fontSize: 18,
    color: "#7A7A7A",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  glassBase: {
    borderRadius: R,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#2D2D2D",
  },
  glassDisabled: { opacity: 0.6 },
  glassText: {
    fontSize: 18,
    color: "#EDEDED",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },

  iconLeft: { position: "absolute", left: 16 },
});
