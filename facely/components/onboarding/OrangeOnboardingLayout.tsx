import React, { useEffect, useState } from "react";
import {
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import T from "@/components/ui/T";
import { hapticLight } from "@/lib/haptics";
import { getProgressForStep, SP } from "@/lib/tokens";
import { ms, sh, useResponsiveScale } from "@/lib/responsive";

export const ORANGE_ONBOARDING = {
  font: "DINNextRounded-Regular",
  fontBold: "DINNextRounded-Bold",
  orange: "#F26A13",
  orangeDark: "#D85609",
  orangeSoft: "#FFF1E7",
  paper: "#FFFCF7",
  text: "#050505",
  muted: "#3E454B",
  border: "#E9E6E2",
  surface: "#FFFFFF",
} as const;

type Props = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLabel?: string;
  stepKey?: string;
  headerImage?: ImageSourcePropType;
  headerImageMode?: "cover" | "contain";
  headerContent?: React.ReactNode;
  headerHeight?: number;
  showHeader?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  scrollable?: boolean;
  stickyFooter?: boolean;
  sheetContentStyle?: ViewStyle;
  statusBarStyle?: "dark-content" | "light-content";
  presentation?: "sheet" | "sequence";
};

export default function OrangeOnboardingLayout({
  children,
  footer,
  title,
  subtitle,
  onPrimary,
  primaryDisabled = false,
  primaryLabel = "Continue",
  headerImage,
  headerImageMode = "contain",
  headerContent,
  headerHeight,
  showHeader = true,
  showBack = true,
  onBack,
  scrollable = true,
  stickyFooter = false,
  sheetContentStyle,
  statusBarStyle = "dark-content",
  presentation = "sheet",
  stepKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveScale();
  const [footerHeight, setFooterHeight] = useState(0);
  const reduceMotion = useReducedMotion();
  const resolvedHeaderHeight = headerHeight ?? responsive.clampHeight(0.2, 120, 220);
  const backSize = responsive.clamp(46, 44, 52);

  const artworkEntrance = reduceMotion
    ? undefined
    : headerImageMode === "contain"
      ? FadeIn.duration(180)
          .easing(Easing.out(Easing.cubic))
          .withInitialValues({
            opacity: 0,
            transform: [{ translateY: sh(8) }, { scale: 0.94 }],
          })
      : FadeIn.duration(150).easing(Easing.out(Easing.cubic));
  const sheetEntrance = reduceMotion
    ? undefined
    : FadeInUp.duration(150)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: sh(16) }] });

  const handleBack = () => {
    hapticLight();
    if (onBack) onBack();
    else router.back();
  };

  const bodyContent = (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInUp.duration(140).easing(Easing.out(Easing.cubic))
      }
      style={!scrollable ? styles.staticBody : undefined}
    >
      {title ? <OrangeScreenTitle title={title} subtitle={subtitle} /> : null}
      {children}
    </Animated.View>
  );
  const resolvedFooter = footer ?? (onPrimary ? (
    <OrangePrimaryButton
      label={primaryLabel}
      onPress={onPrimary}
      disabled={primaryDisabled}
      tone={presentation === "sequence" ? "ink" : "orange"}
      uppercase={presentation !== "sequence"}
    />
  ) : null);

  if (presentation === "sequence") {
    const sequenceContent = scrollable ? (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.sequenceContent, sheetContentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {bodyContent}
      </ScrollView>
    ) : (
      <View style={[styles.sequenceStaticContent, sheetContentStyle]}>{bodyContent}</View>
    );

    return (
      <View style={styles.sequenceScreen}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={ORANGE_ONBOARDING.paper} />

        <View
          style={[
            styles.sequenceNav,
            {
              paddingTop: insets.top + responsive.clamp(8, 6, 12),
              paddingHorizontal: responsive.clamp(24, 20, 38),
            },
          ]}
        >
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={({ pressed }) => [
                styles.sequenceBackButton,
                {
                  width: backSize,
                  height: backSize,
                  borderRadius: backSize / 2,
                },
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft size={ms(24)} color={ORANGE_ONBOARDING.text} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <View style={{ width: backSize, height: backSize }} />
          )}

          {stepKey ? <SequenceProgressBar stepKey={stepKey} /> : null}
        </View>

        <Animated.View
          entering={sheetEntrance}
          style={[
            styles.sequenceBody,
            {
              paddingHorizontal: responsive.clamp(24, 20, 38),
              paddingBottom: insets.bottom + SP[3],
            },
          ]}
        >
          <View
            style={[
              styles.sequenceBodySlot,
              stickyFooter && resolvedFooter
                ? { marginBottom: footerHeight + SP[2] }
                : null,
            ]}
          >
            {sequenceContent}
          </View>
          {resolvedFooter ? (
            <View
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              style={[
                styles.sequenceFooter,
                stickyFooter && [
                  styles.stickyFooter,
                  { bottom: insets.bottom + SP[3] },
                ],
              ]}
            >
              {resolvedFooter}
            </View>
          ) : null}
        </Animated.View>
      </View>
    );
  }

  const sheetBody = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.sheetContent, sheetContentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {bodyContent}
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, sheetContentStyle]}>{bodyContent}</View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

      {showHeader ? (
        <LinearGradient
          colors={["#FFA640", ORANGE_ONBOARDING.orange]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
          style={[styles.header, { height: resolvedHeaderHeight }]}
        >
          {headerImage ? (
            <Animated.Image
              source={headerImage}
              resizeMode={headerImageMode}
              entering={artworkEntrance}
              style={headerImageMode === "cover" ? styles.coverArtwork : styles.containArtwork}
            />
          ) : null}

          {headerContent ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(140)}
              style={styles.headerContent}
            >
              {headerContent}
            </Animated.View>
          ) : null}

          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={({ pressed }) => [
                styles.backButton,
                {
                  top: insets.top + responsive.clamp(8, 6, 12),
                  width: backSize,
                  height: backSize,
                  borderRadius: backSize / 2,
                },
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft size={ms(24)} color={ORANGE_ONBOARDING.text} strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </LinearGradient>
      ) : (
        <View style={[styles.plainNavigation, { paddingTop: insets.top }]}> 
          {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            style={({ pressed }) => [styles.plainBackButton, pressed && styles.pressed]}
          >
            <ChevronLeft size={ms(25)} color={ORANGE_ONBOARDING.text} strokeWidth={2.5} />
          </Pressable>
          ) : null}
        </View>
      )}

      <Animated.View
        entering={sheetEntrance}
        style={[
          styles.sheet,
          !showHeader && styles.headerlessSheet,
          { paddingBottom: insets.bottom + SP[3] },
        ]}
      >
        {showHeader ? <View style={styles.handle} /> : null}
        <View
          style={[
            styles.bodySlot,
            stickyFooter && resolvedFooter
              ? { marginBottom: footerHeight + SP[2] }
              : null,
          ]}
        >
          {sheetBody}
        </View>
        {resolvedFooter ? (
          <View
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            style={[
              styles.footer,
              stickyFooter && [
                styles.stickyFooter,
                { bottom: insets.bottom + SP[3] },
              ],
            ]}
          >
            {resolvedFooter}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function OrangePrimaryButton({
  label,
  onPress,
  disabled = false,
  tone = "orange",
  uppercase = true,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "orange" | "ink";
  uppercase?: boolean;
}) {
  const responsive = useResponsiveScale();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pressDepth = useSharedValue(0);
  const buttonDepth = responsive.clamp(7, 6, 9);
  const isInk = tone === "ink";

  useEffect(() => {
    if (disabled) {
      scale.value = 1;
      pressDepth.value = 0;
    }
  }, [disabled, pressDepth, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressDepth.value }],
  }));

  const setPressed = (pressed: boolean) => {
    if (disabled) return;
    if (pressed) hapticLight();
    if (reduceMotion) return;
    scale.value = withSpring(pressed ? 0.995 : 1, {
      damping: 24,
      stiffness: 420,
      mass: 0.38,
    });
    pressDepth.value = withSpring(pressed ? buttonDepth : 0, {
      damping: 20,
      stiffness: 520,
      mass: 0.35,
    });
  };

  return (
    <Animated.View
      style={[
        styles.primaryButtonMotion,
        { paddingBottom: buttonDepth },
        disabled && styles.primaryButtonMotionDisabled,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.primaryButtonDepth,
          isInk && styles.primaryButtonDepthInk,
          disabled && styles.primaryButtonDepthDisabled,
        ]}
      />
      <Animated.View style={[styles.primaryButtonFaceMotion, faceStyle]}>
        <Pressable
          onPress={disabled ? undefined : onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={[
            styles.primaryButton,
            { minHeight: responsive.clamp(56, 48, 62) },
            isInk && styles.primaryButtonInk,
            disabled && styles.primaryButtonDisabled,
          ]}
        >
          <T
            style={[
              styles.primaryButtonText,
              isInk && styles.primaryButtonTextInk,
              disabled && styles.primaryButtonTextDisabled,
            ]}
          >
            {uppercase ? label.toUpperCase() : label}
          </T>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function SequenceProgressBar({ stepKey }: { stepKey: string }) {
  const progress = getProgressForStep(stepKey);
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = withTiming(progress * 100, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.sequenceProgressTrack}>
      <Animated.View style={[styles.sequenceProgressFill, fillStyle]} />
    </View>
  );
}

export function OrangeScreenTitle({
  title,
  subtitle,
  align = "center",
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  const responsive = useResponsiveScale();

  return (
    <View style={styles.titleBlock}>
      <T
        style={[
          styles.title,
          {
            textAlign: align,
            fontSize: responsive.clamp(31, 27, 38, 0.12),
            lineHeight: responsive.clamp(36, 32, 44, 0.12),
          },
        ]}
      >
        {title}
      </T>
      {subtitle ? (
        <T
          style={[
            styles.subtitle,
            {
              textAlign: align,
              fontSize: responsive.clamp(15, 14, 18, 0.18),
              lineHeight: responsive.clamp(22, 20, 27, 0.18),
            },
          ]}
        >
          {subtitle}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ORANGE_ONBOARDING.paper,
  },
  sequenceScreen: {
    flex: 1,
    backgroundColor: ORANGE_ONBOARDING.paper,
  },
  sequenceNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingBottom: SP[2],
  },
  sequenceBackButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(5,5,5,0.08)",
    shadowColor: "#2A1A10",
    shadowOpacity: 0.07,
    shadowRadius: ms(12),
    shadowOffset: { width: 0, height: ms(5) },
    elevation: 3,
  },
  sequenceProgressTrack: {
    flex: 1,
    height: sh(6),
    borderRadius: 999,
    backgroundColor: "rgba(5,5,5,0.08)",
    overflow: "hidden",
  },
  sequenceProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ORANGE_ONBOARDING.orange,
  },
  sequenceBody: {
    flex: 1,
  },
  sequenceBodySlot: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  sequenceContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: SP[2],
    paddingBottom: SP[4],
  },
  sequenceStaticContent: {
    flex: 1,
    justifyContent: "center",
  },
  sequenceFooter: {
    paddingTop: SP[2],
    flexShrink: 0,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  header: {
    width: "100%",
    overflow: "hidden",
  },
  coverArtwork: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  containArtwork: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "82%",
  },
  headerContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: sh(34),
    paddingHorizontal: SP[6],
  },
  backButton: {
    position: "absolute",
    left: SP[5],
    width: ms(46),
    height: ms(46),
    borderRadius: ms(23),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: ms(14),
    shadowOffset: { width: 0, height: ms(5) },
    elevation: 5,
    zIndex: 2,
  },
  pressed: {
    opacity: 0.82,
  },
  plainNavigation: {
    minHeight: sh(58),
    justifyContent: "center",
    paddingHorizontal: SP[4],
    backgroundColor: ORANGE_ONBOARDING.paper,
  },
  plainBackButton: {
    width: ms(44),
    height: ms(44),
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    marginTop: -sh(22),
    borderTopLeftRadius: ms(34),
    borderTopRightRadius: ms(34),
    backgroundColor: ORANGE_ONBOARDING.surface,
    paddingTop: sh(16),
    paddingHorizontal: SP[5],
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: ms(22),
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  headerlessSheet: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: SP[2],
    shadowOpacity: 0,
    elevation: 0,
  },
  handle: {
    alignSelf: "center",
    width: ms(48),
    height: sh(5),
    borderRadius: 999,
    backgroundColor: "#D1D1D1",
    marginBottom: sh(16),
  },
  scroll: {
    flex: 1,
  },
  bodySlot: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  sheetContent: {
    paddingBottom: SP[3],
  },
  staticContent: {
    flex: 1,
  },
  staticBody: {
    flex: 1,
  },
  footer: {
    paddingTop: SP[2],
    flexShrink: 0,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  stickyFooter: {
    position: "absolute",
    left: SP[5],
    right: SP[5],
    zIndex: 10,
  },
  titleBlock: {
    marginBottom: SP[4],
  },
  title: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: ms(31, 0.12),
    lineHeight: ms(36, 0.12),
    color: ORANGE_ONBOARDING.text,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: ORANGE_ONBOARDING.font,
    fontSize: ms(15, 0.18),
    lineHeight: ms(22, 0.18),
    color: ORANGE_ONBOARDING.muted,
    marginTop: sh(8),
    letterSpacing: 0,
  },
  primaryButton: {
    width: "100%",
    minHeight: sh(56),
    borderRadius: ms(17),
    backgroundColor: ORANGE_ONBOARDING.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    shadowColor: ORANGE_ONBOARDING.orange,
    shadowOpacity: 0.2,
    shadowRadius: ms(16),
    shadowOffset: { width: 0, height: ms(7) },
    elevation: 4,
  },
  primaryButtonMotion: {
    width: "100%",
    position: "relative",
  },
  primaryButtonMotionDisabled: {
    opacity: 0.78,
  },
  primaryButtonDepth: {
    position: "absolute",
    left: 0,
    right: 0,
    top: sh(7),
    bottom: 0,
    borderRadius: ms(17),
    backgroundColor: "#C75300",
  },
  primaryButtonDepthInk: {
    borderRadius: ms(23),
    backgroundColor: "#050505",
  },
  primaryButtonFaceMotion: {
    width: "100%",
  },
  primaryButtonInk: {
    borderRadius: ms(23),
    backgroundColor: "#151515",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: ms(18),
    shadowOffset: { width: 0, height: ms(8) },
    elevation: 8,
  },
  primaryButtonDepthDisabled: {
    backgroundColor: "#CFC8C1",
  },
  primaryButtonDisabled: {
    backgroundColor: "#E7E3DF",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: ms(17, 0.18),
    lineHeight: ms(22, 0.18),
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  primaryButtonTextInk: {
    fontSize: ms(24, 0.16),
    lineHeight: ms(29, 0.16),
    letterSpacing: 0,
  },
  primaryButtonTextDisabled: {
    color: "#AAA49E",
  },
});


