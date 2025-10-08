import React, { useCallback, useState } from "react";
import { View, ImageBackground, StyleSheet, SafeAreaView } from "react-native";
import { router } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnUI,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

import T from "@/components/ui/T";
import Button from "@/components/ui/Button";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";

// -----------------------------------------------------------------------------
// Animated bar
// -----------------------------------------------------------------------------
type BarProps = {
  labelTop: string;
  labelBottom?: string;
  percent: number;
  fillColor: string;
  trackColor?: string;
  delay?: number;
};

const VerticalStatBar: React.FC<BarProps> = ({
  labelTop,
  labelBottom,
  percent,
  fillColor,
  trackColor = "rgba(255,255,255,0.06)",
  delay = 0,
}) => {
  const [trackH, setTrackH] = useState(0);
  const progress = useSharedValue(0);

  const onTrackLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    setTrackH(h);
    runOnUI(() => {
      "worklet";
      progress.value = withDelay(
        delay,
        withTiming(percent / 100, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        })
      );
    })();
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    height: trackH * progress.value,
    transform: [{ translateY: (1 - progress.value) * trackH }],
  }));

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 }],
    opacity: withTiming(progress.value > 0 ? 1 : 0, { duration: 300 }),
  }));

  return (
    <View style={styles.barCol}>
      <T style={styles.barLabelTop}>{labelTop}</T>
      {labelBottom ? <T style={styles.barLabelBottom}>{labelBottom}</T> : null}

      <View style={styles.trackOuter}>
        <View style={styles.neoOuter} />

        <View
          style={[styles.track, { backgroundColor: trackColor }]}
          onLayout={onTrackLayout}
        >
          <View style={styles.trackHighlightTop} />
          <View style={styles.trackHighlightBottom} />

          <Animated.View
            style={[styles.fill, { backgroundColor: fillColor }, fillStyle]}
          >
            <View style={styles.fillGloss} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.percentChipWrap, chipStyle]}>
          <View style={styles.percentChipShadow} />
          <View style={styles.percentChip}>
            <T style={styles.percentText}>{`${percent}%`}</T>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------
export default function EdgeScreen() {
  const finishOnboarding = useOnboarding((s: any) => s.finish);

  const onContinue = useCallback(() => {
    try {
      finishOnboarding?.();
    } catch {
      /* don’t brick onboarding if storage is offline */
    }
    router.replace("/(tabs)");
}, []);

  return (
    <ImageBackground
      source={require("../../assets/bg/score-bg.jpg")}
      resizeMode="cover"
      style={{ flex: 1, backgroundColor: COLORS.bg }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Title */}
          <View style={styles.headerWrap}>
            <T style={styles.header}>You might already be</T>
            <T style={styles.header}>losing your edge…</T>
          </View>

          {/* Card with bars */}
          <View style={styles.cardWrap}>
            <BlurView intensity={20} tint="dark" style={styles.blur}>
              <View style={styles.cardInner}>
                <VerticalStatBar
                  labelTop="Lifestyle"
                  labelBottom="Impact"
                  percent={30}
                  fillColor="rgba(255,255,255,0.10)"
                  delay={80}
                />
                <VerticalStatBar
                  labelTop="Genetic"
                  labelBottom="Blueprint"
                  percent={70}
                  fillColor={COLORS.accent}
                  delay={240}
                />
              </View>

              <T style={styles.caption}>
                Sigma Max gives you a precision-based plan to unlock your
                aesthetic potential.
              </T>
            </BlurView>
          </View>

          {/* CTA */}
          <View style={styles.ctaWrap}>
            <Button title="Continue" onPress={onContinue} />
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const CARD_RADIUS = (RADII as any)?.xl ?? 24;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: (SP as any)?.xl ?? 20,
    paddingTop: (SP as any)?.lg ?? 16,
    paddingBottom: (SP as any)?.xl ?? 24,
    justifyContent: "space-between",
  },
  headerWrap: { marginTop: (SP as any)?.xl ?? 24 },
  header: { fontSize: 28, lineHeight: 34, color: COLORS.text },

  cardWrap: {
    marginTop: (SP as any)?.md ?? 12,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  blur: { padding: (SP as any)?.xl ?? 20 },
  cardInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: (SP as any)?.lg ?? 16,
  },

  // Bars
  barCol: { flex: 1, alignItems: "center" },
  barLabelTop: {
    color: COLORS.text,
    opacity: 0.9,
    fontSize: 14,
    marginBottom: 2,
  },
  barLabelBottom: {
    color: COLORS.text,
    opacity: 0.9,
    fontSize: 14,
    marginBottom: 10,
  },
  trackOuter: { width: "100%", alignItems: "center" },
  neoOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 6,
    bottom: -6,
    borderRadius: CARD_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  track: {
    width: "64%",
    height: 220,
    borderRadius: (RADII as any)?.lg ?? 18,
    overflow: "hidden",
    alignItems: "stretch",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trackHighlightTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  trackHighlightBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  fill: {
    width: "100%",
    borderTopLeftRadius: (RADII as any)?.lg ?? 18,
    borderTopRightRadius: (RADII as any)?.lg ?? 18,
  },
  fillGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  // Percent chip
  percentChipWrap: {
    position: "absolute",
    bottom: -26,
    alignItems: "center",
    width: "100%",
  },
  percentChipShadow: {
    position: "absolute",
    width: 110,
    height: 36,
    borderRadius: 20,
    backgroundColor: "#000",
    opacity: 0.22,
  },
  percentChip: {
    minWidth: 96,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  percentText: { fontSize: 16, color: COLORS.text },

  caption: {
    textAlign: "center",
    color: "rgba(239,239,239,0.8)",
    fontSize: 14,
    marginTop: (SP as any)?.lg ?? 16,
    paddingHorizontal: (SP as any)?.xl ?? 20,
  },

  ctaWrap: { marginTop: (SP as any)?.xl ?? 20 },
});
