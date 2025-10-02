// components/ui/T.tsx
import React from "react";
import { Text as RNText, TextProps } from "react-native";

/**
 * Default Text component for the app.
 * Applies Poppins-SemiBold to everything by default,
 * while still letting you pass style/className/numberOfLines/etc.
 */
export default function T({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ fontFamily: "Poppins-SemiBold" }, style]} />;
}
