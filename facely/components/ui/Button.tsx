// components/ui/Button.tsx
// Unified button component with 3D chunky Duolingo-style press effect
import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
  ViewStyle,
  PressableProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import T from "@/components/ui/T";
import { COLORS, RADII, SHADOWS, ELEVATION, SP } from "@/lib/tokens";
import { hapticLight, hapticMedium } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = "primary" | "secondary" | "ghost" | "text";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
} & Omit<PressableProps, "onPress" | "disabled" | "style">;

const SIZE_CONFIG = {
  sm: { height: 44, paddingHorizontal: SP[4], borderRadius: RADII.lg, fontSize: "buttonSmall" as const },
  md: { height: 56, paddingHorizontal: SP[6], borderRadius: RADII.pill, fontSize: "button" as const },
  lg: { height: 64, paddingHorizontal: SP[8], borderRadius: RADII.circle, fontSize: "button" as const },
};

// 3D chunky depth — thicker for larger buttons
const DEPTH_CONFIG = { sm: 4, md: 5, lg: 6 };

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = true,
  haptic = true,
  style,
  ...rest
}: ButtonProps) {
  const pressed = useSharedValue(0); // 0 = up, 1 = sunk
  const sizeConfig = SIZE_CONFIG[size];
  const depth = DEPTH_CONFIG[size];

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, {
      duration: 60,
      easing: Easing.out(Easing.cubic),
    });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, {
      damping: 14,
      stiffness: 260,
      mass: 0.6,
    });
  }, [pressed]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic) {
      variant === "primary" ? hapticMedium() : hapticLight();
    }
    onPress();
  }, [disabled, loading, haptic, variant, onPress]);

  // Animate only translateY — the face sinks into the base
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (depth - 1) }],
  }));

  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";
  const isText = variant === "text";
  const isDisabled = disabled || loading;

  // Button face color
  const getBgColor = () => {
    if (isDisabled) {
      if (isPrimary || isSecondary) return COLORS.btnDisabledBg;
      return "transparent";
    }
    if (isPrimary) return COLORS.accent;
    if (isSecondary) return COLORS.card;
    return "transparent";
  };

  const getTextColor = () => {
    if (isDisabled) return COLORS.btnDisabledText;
    if (isPrimary) return COLORS.bgBottom;
    return COLORS.text;
  };

  const getBorderColor = () => {
    if (isGhost) return isDisabled ? COLORS.track : COLORS.btnGhostBorder;
    if (isSecondary) return COLORS.cardBorder;
    return "transparent";
  };

  // 3D base color — the dark "shadow" visible beneath the button face
  const getBaseColor = () => {
    if (isDisabled || isText) return "transparent";
    if (isPrimary) return "#6B9A1E"; // dark olive-lime
    if (isSecondary) return "#0A0A0A";
    if (isGhost) return "#1A1A1A";
    return "transparent";
  };

  const getShadowStyle = (): ViewStyle => {
    if (isDisabled || isText) return {};
    if (isPrimary) {
      return Platform.OS === "android"
        ? { elevation: ELEVATION.primaryBtnAndroid }
        : SHADOWS.primaryBtn;
    }
    return {};
  };

  const iconColor = getTextColor();
  const iconSize = size === "sm" ? 16 : 18;
  const has3D = !isDisabled && !isText;

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={isPrimary ? COLORS.bgBottom : COLORS.text}
        />
      );
    }

    return (
      <View style={styles.contentRow}>
        {icon && iconPosition === "left" && (
          <Ionicons
            name={icon}
            size={iconSize}
            color={iconColor}
            style={styles.iconLeft}
          />
        )}
        <T
          variant={sizeConfig.fontSize}
          color={getTextColor()}
        >
          {label}
        </T>
        {icon && iconPosition === "right" && (
          <Ionicons
            name={icon}
            size={iconSize}
            color={iconColor}
            style={styles.iconRight}
          />
        )}
      </View>
    );
  };

  // Outer base = dark 3D shadow, inner = the actual button face
  return (
    <View
      style={[
        {
          borderRadius: sizeConfig.borderRadius,
          backgroundColor: getBaseColor(),
          paddingBottom: has3D ? depth : 0,
          alignSelf: fullWidth ? "stretch" : "center",
        },
        getShadowStyle(),
        style,
      ]}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        android_ripple={null}
        focusable={false}
        style={[
          styles.base,
          {
            height: sizeConfig.height,
            paddingHorizontal: sizeConfig.paddingHorizontal,
            borderRadius: sizeConfig.borderRadius,
            backgroundColor: getBgColor(),
            borderWidth: isGhost || isSecondary ? 2 : 0,
            borderColor: getBorderColor(),
          },
          animatedStyle,
        ]}
        {...rest}
      >
        {renderContent()}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLeft: {
    marginRight: SP[2],
  },
  iconRight: {
    marginLeft: SP[2],
  },
});

// Also export as named for flexibility
export { Button };
