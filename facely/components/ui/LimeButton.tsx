// components/ui/LimeButton.tsx
// 3D press-to-sink button with LinearGradient face — matches take-picture.tsx style
import React from "react";
import { View, Text, Pressable, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/lib/tokens";

const ACCENT       = COLORS.accent;       // #B4F34D
const ACCENT_LIGHT = "#CCFF6B";
const BASE         = "#6B9A1E";           // dark-olive shadow base
const BG_DARK      = "#0B0B0B";
const DEPTH        = 5;

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function LimeButton({ label, onPress, disabled, loading }: Props) {
  const inactive = disabled || loading;

  if (inactive) {
    return (
      <View
        style={{
          borderRadius: 28,
          backgroundColor: COLORS.btnDisabledBg,
          paddingBottom: DEPTH,
        }}
      >
        <View
          style={{
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.btnDisabledBg,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.btnDisabledText} />
          ) : (
            <Text
              style={{
                color: COLORS.btnDisabledText,
                fontFamily: Platform.select({
                  ios: "Poppins-SemiBold",
                  android: "Poppins-SemiBold",
                  default: "Poppins-SemiBold",
                }),
                fontSize: 18,
                lineHeight: 22,
              }}
            >
              {label}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 28,
        backgroundColor: BASE,
        paddingBottom: DEPTH,
        shadowColor: ACCENT,
        shadowOpacity: 0.45,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        android_ripple={null}
        style={({ pressed }) => ({
          height: 56,
          borderRadius: 28,
          overflow: "hidden",
          transform: [{ translateY: pressed ? DEPTH - 1 : 0 }],
        })}
      >
        <LinearGradient
          colors={[ACCENT_LIGHT, ACCENT]}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 28,
          }}
        >
          <Text
            style={{
              color: BG_DARK,
              fontFamily: Platform.select({
                ios: "Poppins-SemiBold",
                android: "Poppins-SemiBold",
                default: "Poppins-SemiBold",
              }),
              fontSize: 18,
              lineHeight: 22,
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
