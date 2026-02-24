// app/(onboarding)/hook.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Platform,
  Dimensions,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import LimeButton from "@/components/ui/LimeButton";
import { COLORS } from "@/lib/tokens";

const { width: W, height: H } = Dimensions.get("window");
const VIDEO_H = H * 0.62;
const BG = "#0B0B0B";
const ACCENT = COLORS.accent;

export default function HookScreen() {
  const headOpacity   = useSharedValue(0);
  const headTranslate = useSharedValue(22);
  const sub1Opacity   = useSharedValue(0);
  const sub2Opacity   = useSharedValue(0);
  const ctaOpacity    = useSharedValue(0);
  const ctaTranslate  = useSharedValue(16);

  useEffect(() => {
    headOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
    headTranslate.value = withDelay(
      600,
      withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
    sub1Opacity.value = withDelay(
      940,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    sub2Opacity.value = withDelay(
      1160,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    ctaOpacity.value = withDelay(
      1400,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    ctaTranslate.value = withDelay(
      1400,
      withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const headStyle = useAnimatedStyle(() => ({
    opacity: headOpacity.value,
    transform: [{ translateY: headTranslate.value }],
  }));
  const sub1Style = useAnimatedStyle(() => ({ opacity: sub1Opacity.value }));
  const sub2Style = useAnimatedStyle(() => ({ opacity: sub2Opacity.value }));
  const ctaStyle  = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Video hero */}
      <View style={styles.videoWrap}>
        <Video
          source={require("@/assets/first screen onboarding.mp4")}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted
          shouldPlay
        />
        <LinearGradient
          colors={["transparent", BG]}
          style={styles.videoGradient}
        />
      </View>

      {/* Text + CTA */}
      <SafeAreaView style={styles.bottom}>
        <Animated.View style={headStyle}>
          <Text style={styles.headline}>
            Your potential face{"\n"}already exists.
          </Text>
        </Animated.View>

        <Animated.View style={sub1Style}>
          <Text style={styles.sub}>Most people never find their way to it.</Text>
        </Animated.View>

        <Animated.View style={[styles.sub2Wrap, sub2Style]}>
          <Text style={styles.sub}>
            <Text style={styles.brand}>Sigma Max</Text>
            {" "}shows you the path.
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <LimeButton
            label="Let's Go"
            onPress={() => router.replace("/(onboarding)/intro")}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  videoWrap: {
    width: W,
    height: VIDEO_H,
  },
  video: {
    width: W,
    height: VIDEO_H,
  },
  videoGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: VIDEO_H * 0.48,
  },

  bottom: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 8,
  },
  spacer: {
    flex: 1,
  },
  headline: {
    color: "#FFFFFF",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  sub: {
    color: COLORS.sub,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
    fontSize: 17,
    lineHeight: 24,
  },
  sub2Wrap: {
    marginTop: 4,
    marginBottom: 0,
  },
  brand: {
    color: ACCENT,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
    textShadowColor: "rgba(180,243,77,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ctaWrap: {
    marginBottom: 52,
  },
});
