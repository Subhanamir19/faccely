// components/onboarding/OnboardingScreenV2.tsx
// Full-bleed onboarding layout: top progress + circular back, centered hero
// illustration, left-aligned title/subtitle, bottom-pinned primary CTA.
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
import LimeButton from "@/components/ui/LimeButton";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";

type Props = {
  stepKey: string;
  title: string;
  subtitle?: string;
  heroImage?: ImageSourcePropType;
  // When omitted, hero scales to ~26% of viewport height (clamped 200–300pt)
  // so the image doesn't dominate compact devices like iPhone 11/SE.
  // Pass an explicit number to opt out of responsive sizing.
  heroHeight?: number;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  showBack?: boolean;
  onBack?: () => void;
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const progress = getProgressForStep(stepKey);

  const resolvedHeroHeight =
    heroHeight ?? Math.round(Math.min(300, Math.max(200, winH * 0.26)));

  const handleBack = useCallback(() => {
    hapticLight();
    if (onBack) onBack();
    else router.back();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top row: circular back + progress */}
        <View style={[styles.topRow, { paddingTop: insets.top + SP[2] }]}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={styles.backBtn}
            >
              <ChevronLeft size={20} color={COLORS.text} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <ProgressBar progress={progress} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + SP[4] },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {heroImage && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[styles.heroWrap, { height: resolvedHeroHeight }]}
            >
              <Image
                source={heroImage}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </Animated.View>
          )}

          <T variant="h1" color="text" style={styles.title}>
            {title}
          </T>

          {subtitle && (
            <T variant="body" color="sub" style={styles.subtitle}>
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
          <LimeButton
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);
  React.useEffect(() => {
    width.value = withTiming(progress * 100, {
      duration: 500,
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

const BACK_SIZE = 40;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bgTop },
  flex: { flex: 1 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[5],
    paddingBottom: SP[3],
  },
  backBtn: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.text,
    borderRadius: RADII.circle,
  },

  scrollContent: {
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    flexGrow: 1,
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[5],
  },
  heroImage: { width: "100%", height: "100%" },

  title: {
    textAlign: "left",
    marginBottom: SP[2],
  },
  subtitle: {
    textAlign: "left",
    marginBottom: SP[5],
  },
  content: { flex: 1 },

  footer: {
    paddingHorizontal: SP[5],
    paddingTop: SP[3],
  },
});

export { OnboardingScreenV2 };
