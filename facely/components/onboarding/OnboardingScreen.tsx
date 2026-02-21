// components/onboarding/OnboardingScreen.tsx
// Full screen layout for onboarding with gradient, progress bar, back button, and CTAs
import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  DimensionValue,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import Button from "@/components/ui/Button";
import LimeButton from "@/components/ui/LimeButton";
import OnboardingCard, { ONBOARDING_CARD_WIDTH } from "./OnboardingCard";
import { COLORS, SP, RADII, getProgressForStep } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";

type OnboardingScreenProps = {
  /** Current step key for progress calculation */
  stepKey: string;
  /** Main content to render inside the card */
  children: React.ReactNode;
  /** Card title */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Show back button (default: true, except for first screen) */
  showBack?: boolean;
  /** Custom back handler */
  onBack?: () => void;
  /** Primary button label (default: "Next") */
  primaryLabel?: string;
  /** Primary button press handler */
  onPrimary: () => void;
  /** Primary button disabled state */
  primaryDisabled?: boolean;
  /** Primary button loading state */
  primaryLoading?: boolean;
  /** Show secondary/skip button (default: false) */
  showSecondary?: boolean;
  /** Secondary button label (default: "Skip") */
  secondaryLabel?: string;
  /** Secondary button press handler */
  onSecondary?: () => void;
  /** Card max height (for scrollable content) */
  cardMaxHeight?: DimensionValue;
  /** Whether to scroll the card content */
  scrollable?: boolean;
  /** Whether to wrap content in card (default: true) */
  useCard?: boolean;
};

export default function OnboardingScreen({
  stepKey,
  children,
  title,
  subtitle,
  showBack = true,
  onBack,
  primaryLabel = "Next",
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  showSecondary = false,
  secondaryLabel = "Skip",
  onSecondary,
  cardMaxHeight,
  scrollable = false,
  useCard = true,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const progress = getProgressForStep(stepKey);

  const handleBack = useCallback(() => {
    hapticLight();
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack]);

  const handleSecondary = useCallback(() => {
    hapticLight();
    onSecondary?.();
  }, [onSecondary]);

  const renderContent = () => (
    <>
      {/* Progress bar inside card */}
      <ProgressBar progress={progress} />

      {/* Back button */}
      {showBack && progress > 0 && (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backButton}
        >
          <ChevronLeft size={18} color={COLORS.sub} strokeWidth={2.5} />
          <T variant="captionMedium" color="sub">
            Back
          </T>
        </Pressable>
      )}

      {/* Title */}
      <T variant="h3" color="text" style={styles.title}>
        {title}
      </T>

      {/* Subtitle */}
      {subtitle && (
        <T variant="caption" color="sub" style={styles.subtitle}>
          {subtitle}
        </T>
      )}

      {/* Main content */}
      {scrollable ? (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}

      {/* CTAs */}
      <View style={styles.ctaContainer}>
        <LimeButton
          label={primaryLabel}
          onPress={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
        />
        {showSecondary && onSecondary && (
          <Button
            label={secondaryLabel}
            onPress={handleSecondary}
            variant="ghost"
            size="md"
            style={styles.secondaryButton}
          />
        )}
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Diagonal reflection */}
      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "transparent"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.diagonalReflection}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.centerWrap,
            {
              paddingTop: insets.top + SP[4],
              paddingBottom: insets.bottom + SP[4],
            },
          ]}
        >
          {useCard ? (
            <Animated.View entering={FadeInDown.duration(350).easing(Easing.out(Easing.cubic))}>
              <OnboardingCard
                maxHeight={cardMaxHeight}
                contentStyle={scrollable ? styles.scrollCardContent : undefined}
              >
                {renderContent()}
              </OnboardingCard>
            </Animated.View>
          ) : (
            <View style={styles.noCardContent}>{renderContent()}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Progress bar component
function ProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = withTiming(progress * 100, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  flex: {
    flex: 1,
  },
  diagonalReflection: {
    position: "absolute",
    left: -50,
    right: -50,
    top: -80,
    height: 260,
    transform: [{ rotate: "12deg" }],
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SP[4],
  },
  noCardContent: {
    width: ONBOARDING_CARD_WIDTH,
  },

  // Progress bar
  progressTrack: {
    height: 8,
    width: "100%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: RADII.circle,
  },

  // Back button
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: SP[3],
    marginLeft: -SP[1],
    paddingVertical: SP[1],
    paddingRight: SP[2],
    gap: 2,
  },

  // Title & subtitle
  title: {
    textAlign: "left",
    marginBottom: SP[2],
  },
  subtitle: {
    textAlign: "left",
    marginBottom: SP[5],
  },

  // Content
  content: {
    marginTop: SP[2],
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingTop: SP[2],
    paddingBottom: SP[1],
  },
  scrollCardContent: {
    flex: 1,
    maxHeight: undefined,
  },

  // CTAs
  ctaContainer: {
    marginTop: SP[6],
    gap: SP[3],
  },
  secondaryButton: {
    marginTop: 0,
  },
});

export { OnboardingScreen };
