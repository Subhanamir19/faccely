import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export const APP_SCREEN_BG = "#FFF8EC";

type AppGradientBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppGradientBackground({
  children,
  style,
}: AppGradientBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_SCREEN_BG,
  },
});
