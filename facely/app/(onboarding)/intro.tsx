// app/(onboarding)/intro.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import LimeButton from "@/components/ui/LimeButton";
import { COLORS } from "@/lib/tokens";

const ACCENT = COLORS.accent;
const BG = "#0B0B0B";
const CIRCLE = 78;

/* ─── timing constants ─────────────────────────────────────── */
const FADE_DUR = 260;
const SLIDE_DUR = 300;
const DRAW_DUR  = 340;
const PULSE_DUR = 1800;

// delay ladder (ms)
const D = {
  header:  0,
  step1:   220,
  conn1:   430,
  step2:   520,
  conn2:   730,
  step3:   820,
  badge:   1020,
  button:  1120,
};

/* ─── reusable fade + slide-up hook ────────────────────────── */
function useFadeSlide(delayMs: number) {
  const opacity   = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: FADE_DUR, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: SLIDE_DUR, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

/* ─── connector: height draws from 0 ───────────────────────── */
function AnimatedConnector({ delayMs }: { delayMs: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: DRAW_DUR, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
    opacity: progress.value,
    transformOrigin: "top",
  }));

  // dots fade in together with the line
  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.connectorWrap}>
      <Animated.View style={[styles.connectorDot, dotStyle]} />
      <Animated.View style={[styles.connectorDot, dotStyle]} />
      <Animated.View style={[styles.connectorLine, lineStyle]} />
      <Animated.View style={[styles.connectorDot, dotStyle]} />
      <Animated.View style={[styles.connectorDot, dotStyle]} />
    </View>
  );
}

/* ─── icon circle with breathing glow ──────────────────────── */
function PulsingCircle({
  children,
  delayMs,
}: {
  children: React.ReactNode;
  delayMs: number;
}) {
  const glow = useSharedValue(0);

  useEffect(() => {
    // start pulsing after the circle has appeared
    glow.value = withDelay(
      delayMs + 400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: PULSE_DUR, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: PULSE_DUR, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glow.value, [0, 1], [0.18, 0.55]),
    shadowRadius:  interpolate(glow.value, [0, 1], [12, 24]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.04]) }],
  }));

  return (
    <Animated.View style={[styles.iconCircleShadow, glowStyle]}>
      <LinearGradient
        colors={["rgba(180,243,77,0.16)", "rgba(180,243,77,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

/* ─── single step row ──────────────────────────────────────── */
function StepRow({
  icon,
  label,
  description,
  subtitle,
  delayMs,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  subtitle: string;
  delayMs: number;
  isLast: boolean;
}) {
  const rowStyle = useFadeSlide(delayMs);

  return (
    <View>
      <Animated.View style={[styles.stepRow, rowStyle]}>
        <View style={styles.leftCol}>
          <PulsingCircle delayMs={delayMs}>{icon}</PulsingCircle>
        </View>
        <View style={styles.stepText}>
          <Text style={styles.stepLabel}>{label}</Text>
          <Text style={styles.stepDescription}>{description}</Text>
          <Text style={styles.stepSubtitle}>{subtitle}</Text>
        </View>
      </Animated.View>

      {!isLast && (
        <View style={styles.leftCol}>
          <AnimatedConnector delayMs={delayMs + 200} />
        </View>
      )}
    </View>
  );
}

/* ─── screen ───────────────────────────────────────────────── */
export default function IntroScreen() {
  const headerStyle = useFadeSlide(D.header);
  const badgeStyle  = useFadeSlide(D.badge);

  // button springs up
  const btnOpacity   = useSharedValue(0);
  const btnTranslate = useSharedValue(22);
  useEffect(() => {
    btnOpacity.value = withDelay(
      D.button,
      withTiming(1, { duration: FADE_DUR })
    );
    btnTranslate.value = withDelay(
      D.button,
      withSpring(0, { damping: 14, stiffness: 200, mass: 0.7 })
    );
  }, []);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Text style={styles.title}>Let's Personalize{"\n"}Your Ascension</Text>
          <Text style={styles.subtitle}>
            A few quick questions to design your custom ascension plan
          </Text>
        </Animated.View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          <StepRow
            icon={<MaterialCommunityIcons name="comment-question-outline" size={40} color={ACCENT} />}
            label="Step 1"
            description="Quick questions"
            subtitle="Tell us about your goals & lifestyle"
            delayMs={D.step1}
            isLast={false}
          />
          <StepRow
            icon={<MaterialCommunityIcons name="face-recognition" size={38} color={ACCENT} />}
            label="Step 2"
            description="3D face scan"
            subtitle="AI maps your unique facial features"
            delayMs={D.step2}
            isLast={false}
          />
          <StepRow
            icon={<MaterialCommunityIcons name="auto-fix" size={40} color={ACCENT} />}
            label="Step 3"
            description="Your custom plan"
            subtitle="A precision plan built just for you"
            delayMs={D.step3}
            isLast={true}
          />
        </View>

        {/* Badge */}
        <Animated.View style={[styles.badgeRow, badgeStyle]}>
          <Ionicons name="time-outline" size={15} color={ACCENT} style={{ marginRight: 6 }} />
          <Text style={styles.badgeText}>Takes 60 seconds</Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.footer, btnStyle]}>
          <LimeButton
            label="Let's Go"
            onPress={() => router.replace("/(onboarding)/transformation")}
          />
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safeArea:  { flex: 1, paddingHorizontal: 26 },

  // header
  header:   { marginTop: 44, marginBottom: 40 },
  title: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.sub,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 15,
    lineHeight: 22,
  },

  // steps
  stepsContainer: { flex: 1, justifyContent: "center" },
  stepRow:        { flexDirection: "row", alignItems: "center" },
  leftCol:        { width: CIRCLE, alignItems: "center" },

  // circle — shadow lives on the outer Animated.View so it can animate
  iconCircleShadow: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    shadowColor: ACCENT,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  iconCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(180,243,77,0.28)",
  },

  // text
  stepText: { marginLeft: 20, flex: 1 },
  stepLabel: {
    color: ACCENT,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  stepDescription: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  stepSubtitle: {
    color: COLORS.sub,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 13,
    lineHeight: 18,
  },

  // connector
  connectorWrap: { alignItems: "center", paddingVertical: 6, gap: 4 },
  connectorDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(180,243,77,0.45)" },
  connectorLine: { width: 1.5, height: 28, backgroundColor: "rgba(180,243,77,0.25)", transformOrigin: "top" },

  // badge
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(180,243,77,0.07)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.18)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 8,
    marginBottom: 32,
  },
  badgeText: {
    color: ACCENT,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 13,
    lineHeight: 18,
  },

  // footer
  footer: { paddingBottom: 24 },
});
