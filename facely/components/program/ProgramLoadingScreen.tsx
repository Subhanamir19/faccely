import React, { useEffect } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { SP } from "@/lib/tokens";
import { ms, sw } from "@/lib/responsive";

export const PROGRAM_LOADING_BG = "#FEF5E4";

const INK = "#111111";
const SUB = "#777066";

function SignalBar({ index, height }: { index: number; height: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      index * 90,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, pulse]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + pulse.value * 0.66,
    transform: [{ scaleY: 0.58 + pulse.value * 0.42 }],
  }));

  return <Animated.View style={[styles.signalBar, { height }, barStyle]} />;
}

function LoadingSignal() {
  const heights = [20, 29, 39, 50, 40, 30, 21];

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.signalBars} accessibilityLabel="Loading workout">
      {heights.map((height, index) => (
        <SignalBar key={`${height}-${index}`} index={index} height={height} />
      ))}
    </Animated.View>
  );
}

function LoadingProgressBar() {
  const progress = useSharedValue(0.08);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(0.36, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withTiming(0.72, { duration: 760, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.94, { duration: 620, easing: Easing.out(Easing.cubic) }),
        withTiming(0.08, { duration: 1 }),
      ),
      -1,
      false,
    );
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0.08, Math.min(0.96, progress.value)) * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

export default function ProgramLoadingScreen({ phrase }: { phrase: string }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={PROGRAM_LOADING_BG} />
      <View style={styles.center}>
        <LoadingSignal />
        <View style={styles.copy}>
          <LoadingProgressBar />
          <Animated.Text
            key={phrase}
            entering={FadeIn.duration(220)}
            style={styles.subtitle}
          >
            {phrase}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PROGRAM_LOADING_BG,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  },
  signalBars: {
    height: ms(56),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(4),
  },
  signalBar: {
    width: sw(4),
    borderRadius: 999,
    backgroundColor: INK,
  },
  copy: {
    width: "100%",
    maxWidth: sw(286),
    alignItems: "center",
    marginTop: ms(42),
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    minWidth: ms(20),
    borderRadius: 999,
    backgroundColor: INK,
  },
  subtitle: {
    marginTop: ms(20),
    fontFamily: "DINNextRounded-Regular",
    fontSize: ms(13),
    lineHeight: ms(20),
    color: SUB,
    textAlign: "center",
  },
});
