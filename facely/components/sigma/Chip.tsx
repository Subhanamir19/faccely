import React, { useCallback, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { COLORS } from "../../lib/tokens";
import T from "../ui/T";

type Props = {
  label: string;
  onPress: (label: string) => void;
};

const AnimatedGlowView = Animated.createAnimatedComponent(View);
const AnimatedScaleView = Animated.createAnimatedComponent(View);

export default function Chip({ label, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (nextScale: number, nextGlow: number) => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: nextScale,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: nextGlow,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [glow, scale]
  );

  const handlePressIn = useCallback(() => {
    animateTo(0.96, 1);
  }, [animateTo]);

  const handlePressOut = useCallback(() => {
    animateTo(1, 0);
  }, [animateTo]);

  const glowStyle = useMemo(
    () => ({
      shadowOpacity: glow.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.33],
      }),
    }),
    [glow]
  );

  const scaleStyle = useMemo(
    () => ({
      transform: [{ scale }],
    }),
    [scale]
  );

  const handlePress = useCallback(() => {
    onPress(label);
  }, [label, onPress]);

  return (
    <AnimatedGlowView style={[styles.glowWrapper, glowStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.pressable}
      >
        <AnimatedScaleView style={[styles.chip, scaleStyle]}>
          <T
            style={styles.text}
            accessibilityRole="text"
            numberOfLines={1}
          >
            {label}
          </T>
        </AnimatedScaleView>
      </Pressable>
    </AnimatedGlowView>
  );
}

const styles = StyleSheet.create({
  glowWrapper: {
    alignSelf: "flex-start",
    borderRadius: 18,
    shadowColor: COLORS.sigmaLime,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0,
  },
  pressable: {
    borderRadius: 18,
    overflow: "hidden",
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.sigmaLime,
    justifyContent: "center",
    elevation: 4,
  },
  text: {
    fontFamily: "Poppins-Medium",
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.sigmaBg,
    textAlignVertical: "center",
  },
});
