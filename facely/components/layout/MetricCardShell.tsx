import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { SP } from "@/lib/tokens";
import { useMetricSizing, type MetricSizing } from "./useMetricSizing";

type Props = {
  children: React.ReactNode | ((cardWidth: number, innerWidth: number) => React.ReactNode);
  /**
   * When true (default), applies outer horizontal padding so the shell
   * aligns with Screen padding. Disable for horizontally scrolling lists
   * that handle their own gutters.
   */
  withOuterPadding?: boolean;
  /**
   * When false, only provides sizing (no card surface). Useful when the child
   * renders its own card surface to avoid stacked slabs.
   */
  renderSurface?: boolean;
  sizing?: MetricSizing;
  style?: ViewStyle;
};

export default function MetricCardShell({
  children,
  withOuterPadding = true,
  renderSurface = true,
  sizing,
  style,
}: Props) {
  const derived = useMetricSizing();
  const { cardWidth, usableWidth } = sizing ?? derived;
  const GUTTER_X = SP[4];

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
      <View style={renderSurface ? [styles.card, { width: cardWidth }] : { width: cardWidth, alignSelf: "center" }}>
        {renderSurface ? content : content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerPad: {
    paddingTop: SP[3],
    paddingBottom: SP[3],
  },
  card: {
    alignSelf: "center",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: SP[3],
  },
});
