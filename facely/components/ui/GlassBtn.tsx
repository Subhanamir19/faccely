// components/ui/GlassBtn.tsx
import React from "react";
import { Pressable, StyleSheet, View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import T from "@/components/ui/T";
import { Ionicons } from "@expo/vector-icons";

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

  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1 }}>
      {({ pressed }) => (
        <View style={[styles.shadowWrap, shadowStyle]}>
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
              // Active primary: lime gradient with subtle top highlight
              <View
                style={[styles.primaryBase, { height }, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={["#D7FF83", "#B4F34D"]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <T style={styles.primaryText}>{label}</T>
                {icon ? (
                  <Ionicons
                    name={icon as any}
                    size={18}
                    color="#0A0A0A"
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

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: R,
    overflow: "hidden",
    marginHorizontal: 6,
  },

  // Spec: 0 8 24 rgba(180,243,77,0.18)
  shadowPrimary: {
    ...(Platform.OS === "android"
      ? {
          // Android elevation can't tint; keep minimal to avoid black blob
          elevation: 0,
        }
      : {
          shadowColor: "rgba(180,243,77,1)",
          shadowOpacity: 0.18,
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
    backgroundColor: "#B4F34D",
  },
  primaryText: {
    fontSize: 18,
    color: "#0A0A0A",
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
