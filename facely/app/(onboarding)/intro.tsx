// app/(onboarding)/intro.tsx
// "Here's how this works" — 3 steps, each a clean white card with a sage
// chip housing a lucide icon and step copy. Steps reveal in sequence; the
// connector between them draws on after each card. CTA is a black pill,
// matching the rest of the system.

import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Pressable,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — connector line
const SAGE = "#3F7A2A";        // dark readable — text & icon strokes on lime-soft
const SAGE_SOFT = "#ECFCCB";   // pale lime — chip backgrounds

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: ms(14),
  shadowOffset: { width: 0, height: ms(4) },
  elevation: 2,
} as const;

// Animation timing
const FADE_DUR  = 280;
const SLIDE_DUR = 320;
const DRAW_DUR  = 320;

const D = {
  header: 0,
  step1:  220,
  conn1:  430,
  step2:  520,
  conn2:  730,
  step3:  820,
  badge:  1020,
  button: 1120,
} as const;

function useFadeSlide(delayMs: number) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: FADE_DUR, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: SLIDE_DUR, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function Connector({ delayMs }: { delayMs: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: DRAW_DUR, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: progress.value }],
    opacity: progress.value,
    transformOrigin: "top",
  }));

  return (
    <View style={styles.connectorWrap}>
      <Animated.View style={[styles.connectorLine, lineStyle]} />
    </View>
  );
}

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
        <View style={styles.iconChip}>{icon}</View>
        <View style={styles.stepText}>
          <T style={styles.stepLabel}>{label}</T>
          <T style={styles.stepDescription}>{description}</T>
          <T style={styles.stepSubtitle}>{subtitle}</T>
        </View>
      </Animated.View>

      {!isLast && (
        <View style={styles.connectorAlign}>
          <Connector delayMs={delayMs + 200} />
        </View>
      )}
    </View>
  );
}

export default function IntroScreen() {
  const headerStyle = useFadeSlide(D.header);
  const badgeStyle  = useFadeSlide(D.badge);

  // Button springs up
  const btnOpacity   = useSharedValue(0);
  const btnTranslate = useSharedValue(22);
  useEffect(() => {
    btnOpacity.value   = withDelay(D.button, withTiming(1, { duration: FADE_DUR }));
    btnTranslate.value = withDelay(D.button, withSpring(0, { damping: 14, stiffness: 200, mass: 0.7 }));
  }, []);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <T style={styles.title}>Let's personalize{"\n"}your glowup</T>
          <T style={styles.subtitle}>
            A few quick questions to design your custom plan
          </T>
        </Animated.View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          <StepRow
            icon={<MaterialCommunityIcons name="comment-question-outline" size={ms(28)} color={SAGE} />}
            label="STEP 1"
            description="Quick questions"
            subtitle="Tell us about your goals & lifestyle"
            delayMs={D.step1}
            isLast={false}
          />
          <StepRow
            icon={<MaterialCommunityIcons name="face-recognition" size={ms(28)} color={SAGE} />}
            label="STEP 2"
            description="Face analysis"
            subtitle="AI maps your unique facial features"
            delayMs={D.step2}
            isLast={false}
          />
          <StepRow
            icon={<MaterialCommunityIcons name="auto-fix" size={ms(28)} color={SAGE} />}
            label="STEP 3"
            description="Your custom plan"
            subtitle="A precision plan built just for you"
            delayMs={D.step3}
            isLast={true}
          />
        </View>

        {/* Trust badge */}
        <Animated.View style={[styles.badgeRow, badgeStyle]}>
          <Ionicons name="time-outline" size={ms(14)} color={SAGE} style={{ marginRight: 6 }} />
          <T style={styles.badgeText}>Takes 60 seconds</T>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.footer, btnStyle]}>
          <Pressable
            onPress={() => router.replace("/(onboarding)/goals")}
            style={({ pressed }) => [
              styles.cta,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
          >
            <T style={styles.ctaText}>LET'S GO</T>
          </Pressable>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

const ICON_CHIP = ms(56);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBg },
  safeArea:  { flex: 1, paddingHorizontal: SP[6] },

  header: { marginTop: sh(28), marginBottom: sh(28) },
  title: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: -0.5,
    marginBottom: sh(8),
  },
  subtitle: {
    color: COLORS.lightSub,
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(20),
  },

  stepsContainer: { flex: 1, justifyContent: "center" },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(16),
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    paddingVertical: SP[4],
    paddingHorizontal: SP[4],
    ...SOFT_SHADOW,
  },
  iconChip: {
    width: ICON_CHIP,
    height: ICON_CHIP,
    borderRadius: ICON_CHIP / 2,
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  stepText: { flex: 1 },
  stepLabel: {
    color: SAGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(11),
    lineHeight: ms(14),
    letterSpacing: 1.2,
    marginBottom: sh(3),
  },
  stepDescription: {
    color: COLORS.lightText,
    fontFamily: FONT_BOLD,
    fontSize: ms(18),
    lineHeight: ms(24),
    letterSpacing: -0.2,
    marginBottom: sh(4),
  },
  stepSubtitle: {
    color: COLORS.lightSub,
    fontFamily: "Poppins-Regular",
    fontSize: ms(13),
    lineHeight: ms(18),
  },

  // Connector — short vertical line, indented to align with the icon chip
  connectorAlign: {
    paddingLeft: SP[4] + ICON_CHIP / 2 - 1, // card padding + half chip - half line
    paddingVertical: sh(4),
  },
  connectorWrap: { alignItems: "flex-start" },
  connectorLine: {
    width: 2,
    height: sh(20),
    backgroundColor: LIME,
    opacity: 0.55,
    transformOrigin: "top",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: SAGE_SOFT,
    borderRadius: 999,
    paddingHorizontal: SP[4],
    paddingVertical: sh(8),
    marginTop: SP[3],
    marginBottom: SP[5],
  },
  badgeText: {
    color: SAGE,
    fontFamily: FONT_BOLD,
    fontSize: ms(12),
    lineHeight: ms(16),
    letterSpacing: 0.4,
  },

  footer: { paddingBottom: sh(8) },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
