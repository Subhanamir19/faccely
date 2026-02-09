import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { SP } from "@/lib/tokens";
import { sw, sh, ms } from "@/lib/responsive";
import { useMetricSizing, type MetricSizing } from "./useMetricSizing";

type Props = {
  children: React.ReactNode | ((cardWidth: number, innerWidth: number) => React.ReactNode);
  withOuterPadding?: boolean;
  renderSurface?: boolean;
  sizing?: MetricSizing;
  style?: ViewStyle;
};

const SHELL_RADIUS = ms(22);
const SHELL_PAD = sw(10);

export default function MetricCardShell({
  children,
  withOuterPadding = true,
  renderSurface = true,
  sizing,
  style,
}: Props) {
  const derived = useMetricSizing();
  const { cardWidth, usableWidth } = sizing ?? derived;
  const GUTTER_X = sw(16);

  const content =
    typeof children === "function" ? children(usableWidth, cardWidth) : children;

  return (
    <View
      style={[
        withOuterPadding ? styles.outerPad : null,
        { paddingHorizontal: withOuterPadding ? GUTTER_X : 0 },
        style,
      ]}
    >
      <View style={renderSurface ? [styles.card, { width: cardWidth, borderRadius: SHELL_RADIUS, padding: SHELL_PAD }] : { width: cardWidth, alignSelf: "center" }}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerPad: {
    paddingTop: sh(8),
    paddingBottom: sh(8),
  },
  card: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});
