import React, { useCallback } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import T from "@/components/ui/T";
import { getProgressForStep, SP } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";

const FONT_BOLD = "DINNextRounded-Bold";
const FONT_REGULAR = "DINNextRounded-Regular";
const PAPER = "#FFFCF7";
const TEXT = "#050505";
const MUTED = "#3E454B";
const ORANGE = "#F26A13";

type Props = {
  stepKey: string;
  title: string;
  subtitle?: string;
  heroImage?: ImageSourcePropType;
  heroHeight?: number;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  centered?: boolean;
};

export default function OnboardingScreenV2({
  stepKey,
  title,
  subtitle,
  heroImage,
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
  const progress = getProgressForStep(stepKey);

  const handleBack = useCallback(() => {
    hapticLight();
    if (onBack) onBack();
    else router.back();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <ChevronLeft size={ms(24)} color={TEXT} strokeWidth={2.5} />
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
          {heroImage ? (
            <Animated.View
              entering={FadeIn.duration(240).easing(Easing.out(Easing.cubic))}
              style={styles.identityAccent}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.identityAccentFill} />
            </Animated.View>
          ) : null}

          <T style={styles.title}>{title}</T>
          {subtitle ? <T style={styles.subtitle}>{subtitle}</T> : null}
          <View style={styles.content}>{children}</View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}>
          <Pressable
            onPress={primaryDisabled || primaryLoading ? undefined : onPrimary}
            disabled={primaryDisabled || primaryLoading}
            onPressIn={() => {
              if (!primaryDisabled && !primaryLoading) hapticLight();
            }}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            accessibilityState={{ disabled: primaryDisabled || primaryLoading }}
            style={({ pressed }) => [
              styles.cta,
              primaryDisabled && styles.ctaDisabled,
              pressed && !primaryDisabled && styles.ctaPressed,
            ]}
          >
            <T style={[styles.ctaText, primaryDisabled && styles.ctaTextDisabled]}>
              {primaryLoading ? "..." : primaryLabel}
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
      duration: 300,
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
  screen: {
    flex: 1,
    backgroundColor: PAPER,
  },
  flex: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(12),
    paddingHorizontal: SP[5],
    paddingBottom: SP[2],
  },
  backBtn: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(23),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(5,5,5,0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2A1A10",
    shadowOpacity: 0.07,
    shadowRadius: ms(12),
    shadowOffset: { width: 0, height: ms(5) },
    elevation: 3,
  },
  pressed: {
    opacity: 0.82,
  },
  progressTrack: {
    flex: 1,
    height: sh(6),
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
  },
  scrollContentCentered: {
    justifyContent: "center",
  },
  identityAccent: {
    alignSelf: "center",
    width: ms(54),
    height: sh(6),
    borderRadius: 999,
    backgroundColor: "rgba(242,106,19,0.13)",
    marginBottom: SP[4],
    overflow: "hidden",
  },
  identityAccentFill: {
    width: "58%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  title: {
    fontFamily: FONT_BOLD,
    color: TEXT,
    fontSize: ms(31, 0.12),
    lineHeight: ms(36, 0.12),
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: sh(8),
  },
  subtitle: {
    color: MUTED,
    fontFamily: FONT_REGULAR,
    fontSize: ms(15, 0.18),
    lineHeight: ms(22, 0.18),
    letterSpacing: 0,
    textAlign: "center",
    marginBottom: SP[5],
  },
  content: {},
  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[2],
  },
  cta: {
    minHeight: sh(56),
    borderRadius: ms(23),
    backgroundColor: "#151515",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
    paddingHorizontal: SP[5],
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: ms(18),
    shadowOffset: { width: 0, height: ms(8) },
    elevation: 8,
  },
  ctaPressed: {
    backgroundColor: "#050505",
  },
  ctaDisabled: {
    backgroundColor: "#E7E3DF",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(24, 0.16),
    lineHeight: ms(29, 0.16),
    color: "#FFFFFF",
    letterSpacing: 0,
  },
  ctaTextDisabled: {
    color: "#AAA49E",
  },
});

export { OnboardingScreenV2 };
