// components/ui/T.tsx
import React from "react";
import { Text as RNText, TextProps, TextStyle } from "react-native";
import { TYPE, TypeVariant, COLORS } from "@/lib/tokens";

type Props = TextProps & {
  text?: string;
  variant?: TypeVariant;
  color?: keyof typeof COLORS | string;
  align?: TextStyle["textAlign"];
};

/**
 * Unified Text component for the app.
 *
 * @example
 * // Default (bodySemiBold)
 * <T>Hello</T>
 *
 * // With variant
 * <T variant="h1">Big Title</T>
 * <T variant="caption" color="sub">Small muted text</T>
 *
 * // With custom color
 * <T variant="body" color="accent">Lime colored text</T>
 * <T variant="body" color="#FF0000">Red text</T>
 */
export default function T({
  style,
  text,
  children,
  variant = "bodySemiBold",
  color,
  align,
  ...rest
}: Props) {
  const content = text !== undefined ? text : children;
  const typeStyle = TYPE[variant];

  // Resolve color - check if it's a COLORS key or a raw color value
  const resolvedColor = color
    ? (COLORS[color as keyof typeof COLORS] ?? color)
    : undefined;

  return (
    <RNText
      {...rest}
      style={[
        typeStyle,
        resolvedColor && { color: resolvedColor },
        align && { textAlign: align },
        style,
      ]}
    >
      {content}
    </RNText>
  );
}

// Named exports for convenience
export { T };
