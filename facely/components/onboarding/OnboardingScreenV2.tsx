// components/onboarding/OnboardingScreenV2.tsx
// Foundation layout for the onboarding quiz screens — light system.
// Top: light back chip + sage progress bar.
// Center: hero illustration (responsive height), bold title, supporting subtitle.
// Bottom: pinned black-pill CTA.
//
// Screens that consume this (goals, gender, age, ethnicity, etc.) get the new
// visual language for free.
import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ImageSourcePropType,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticLight } from "@/lib/haptics";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";

type Props = {
  stepKey: string;
  title: string;
  subtitle?: string;
  heroImage?: ImageSourcePropType;
  /** Override responsive height. Otherwise scales to ~26 % of viewport, clamped 200–300 pt. */
  heroHeight?: number;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  /** Vertically center the title + children between the top bar and the CTA,
   *  and center-align the title/subtitle. Useful for sparse screens (e.g.
   *  no hero illustration). */
  centered?: boolean;
};

export default function OnboardingScreenV2({
  stepKey,
  title,
  subtitle,
  heroImage,
  heroHeight,
  children,
  onPrimary,
  primaryLabel = "Continue",
  primaryDisabled = false,
  primaryLoading = false,
  showBack = true,
  onBack,
  centered = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const progress = getProgressForStep(stepKey);

  const resolvedHeroHeight =
    heroHeight ?? Math.round(Math.min(sh(300), Math.max(sh(200), winH * 0.26)));

  const handleBack = useCallback(() => {
    hapticLight();
    if (onBack) onBack();
    else router.back();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top row: light back chip + progress */}
        <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <ChevronLeft size={ms(20)} color={COLORS.lightText} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <ProgressBar progress={progress} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            centered && styles.scrollContentCentered,
            { paddingBottom: insets.bottom + SP[4] },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {heroImage && (
            <Animated.View
              entering={FadeIn.duration(420)}
              style={[styles.heroWrap, { height: resolvedHeroHeight }]}
            >
              <Image
                source={heroImage}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </Animated.View>
          )}

          <T
            variant="h1"
            color="lightText"
            style={[styles.title, centered && styles.titleCentered]}
          >
            {title}
          </T>

          {subtitle && (
            <T
              variant="body"
              color="lightSub"
              style={[styles.subtitle, centered && styles.subtitleCentered]}
            >
              {subtitle}
            </T>
          )}

          <View style={styles.content}>{children}</View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + SP[3] },
          ]}
        >
          <Pressable
            onPress={primaryDisabled || primaryLoading ? undefined : onPrimary}
            disabled={primaryDisabled || primaryLoading}
            style={({ pressed }) => [
              styles.cta,
              primaryDisabled && styles.ctaDisabled,
              pressed && !primaryDisabled && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
          >
            <T
              style={[
                styles.ctaText,
                primaryDisabled && { color: COLORS.lightSub },
              ]}
            >
              {primaryLoading ? "…" : primaryLabel.toUpperCase()}
            </T>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);
  React.useEffect(() => {
    width.value = withTiming(progress * 100, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.lightBg },
  flex: { flex: 1 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    paddingHorizontal: SP[5],
    paddingBottom: SP[3],
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: COLORS.lightSurfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: sh(6),
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    flexGrow: 1,
  },
  scrollContentCentered: {
    justifyContent: "center",
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[5],
  },
  heroImage: { width: "100%", height: "100%" },

  title: {
    fontFamily: FONT_BOLD,
    color: COLORS.lightText,
    fontSize: ms(28),
    lineHeight: ms(34),
    letterSpacing: -0.5,
    textAlign: "left",
    marginBottom: sh(8),
  },
  titleCentered: {
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.lightSub,
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(20),
    textAlign: "left",
    marginBottom: SP[5],
  },
  subtitleCentered: {
    textAlign: "center",
  },
  content: {},

  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
    paddingHorizontal: SP[5],
  },
  ctaDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});

export { OnboardingScreenV2 };
