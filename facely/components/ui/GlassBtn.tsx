// components/ui/GlassBtn.tsx
import React from "react";
import { Pressable, StyleSheet, View, Platform } from "react-native";
import T from "@/components/ui/T";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/lib/tokens";

type Variant = "glass" | "primary";

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

  // Wrapper shadow: lime glow for primary, neutral soft for glass
  const shadowStyle =
    isPrimary && !disabled
      ? styles.shadowPrimary
      : styles.shadowGlass;

  const wrapStyle = [
    styles.shadowWrap,
    shadowStyle,
    isPrimary ? styles.shadowWrapPrimary : styles.shadowWrapGlass,
  ];

  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.pressable}>
      {({ pressed }) => (
        <View style={wrapStyle}>
          {isPrimary ? (
            disabled ? (
              // Disabled primary: flat slate pill, no gradient, no glow
              <View
                style={[
                  styles.primaryDisabledBase,
                  { height },
                  pressed && styles.pressed,
                ]}
              >
                <T style={styles.primaryDisabledText}>{label}</T>
                {icon ? (
                  <Ionicons
                    name={icon as any}
                    size={18}
                    color="#7A7A7A"
                    style={styles.iconLeftDisabled}
                  />
                ) : null}
              </View>
            ) : (
              // Active primary: solid accent pill with glow
              <View
                style={[styles.primaryBase, { height }, pressed && styles.pressed]}
              >
                <T style={styles.primaryText}>{label}</T>
                {icon ? (
                  <Ionicons
                    name={icon as any}
                    size={18}
                    color="#0B0B0B"
                    style={styles.iconLeftPrimary}
                  />
                ) : null}
              </View>
            )
          ) : (
            // Glass variant for "Skip": transparent fill, 2px outline, no blur
            <View
              style={[
                styles.glassBase,
                { height },
                disabled && styles.glassDisabled,
                pressed && styles.pressed,
              ]}
            >
              {icon ? (
                <Ionicons
                  name={icon as any}
                  size={18}
                  color="#EDEDED"
                  style={styles.iconLeftGlass}
                />
              ) : null}
              <T style={styles.glassText}>{label}</T>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const R = 28;
const ACCENT = COLORS.accent;

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignSelf: "stretch",
  },
  shadowWrap: {
    borderRadius: R,
    marginHorizontal: 6,
  },
  shadowWrapPrimary: {
    overflow: "visible",
  },
  shadowWrapGlass: {
    overflow: "hidden",
  },

  // Spec: 0 8 24 rgba(180,243,77,0.18)
  shadowPrimary: {
    ...(Platform.OS === "android"
      ? {
          elevation: 12,
        }
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
        }),
  },

  // Neutral soft shadow under glass buttons (very subtle)
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

  // Primary (active)
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
  iconLeftPrimary: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -9,
  },

  // Primary (disabled)
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
  iconLeftDisabled: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -9,
  },

  // Glass (transparent outline button)
  glassBase: {
    borderRadius: R,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
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
  iconLeftGlass: { position: "absolute", left: 16 },

  // Pressed state
  pressed: { transform: [{ translateY: 1 }] },
});
