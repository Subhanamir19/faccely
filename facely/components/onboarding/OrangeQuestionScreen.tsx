import React, { useEffect } from "react";
import {
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";

import T from "@/components/ui/T";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  OrangeScreenTitle,
  ORANGE_ONBOARDING,
} from "./OrangeOnboardingLayout";
import { SP } from "@/lib/tokens";
import { ms, sh, useResponsiveScale } from "@/lib/responsive";

const FONT_ROUNDED = ORANGE_ONBOARDING.font;
const ORANGE = ORANGE_ONBOARDING.orange;
const ORANGE_DARK = ORANGE_ONBOARDING.orangeDark;
const ORANGE_SOFT = ORANGE_ONBOARDING.orangeSoft;
const TEXT = ORANGE_ONBOARDING.text;
const MUTED = ORANGE_ONBOARDING.muted;
const BORDER = ORANGE_ONBOARDING.border;

type Props = {
  heroImage: ImageSourcePropType;
  stepKey?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueDisabled?: boolean;
  contentTall?: boolean;
};

export default function OrangeQuestionScreen({
  heroImage,
  stepKey,
  title,
  subtitle,
  children,
  onContinue,
  continueDisabled = false,
  contentTall = false,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <OrangeOnboardingLayout
      presentation="sequence"
      stepKey={stepKey}
      headerImage={heroImage}
      headerImageMode="cover"
      footer={
        <OrangePrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={continueDisabled}
          tone="ink"
          uppercase={false}
        />
      }
      sheetContentStyle={contentTall ? styles.contentTall : styles.content}
    >
      <OrangeScreenTitle title={title} subtitle={subtitle} />
      <View style={styles.optionList}>
        {React.Children.toArray(children).map((child, index) => (
          <Animated.View
            key={index}
            entering={
              reduceMotion
                ? undefined
                : FadeInDown.delay(60 + index * 35).duration(200)
            }
          >
            {child}
          </Animated.View>
        ))}
      </View>
    </OrangeOnboardingLayout>
  );
}

export type OrangeOption = {
  key: string;
  label: string;
  caption?: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  emoji?: string;
};

function useOptionMotion(selected: boolean) {
  const reduceMotion = useReducedMotion();
  const selectedProgress = useSharedValue(selected ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    selectedProgress.value = reduceMotion
      ? (selected ? 1 : 0)
      : withTiming(selected ? 1 : 0, {
          duration: 160,
          easing: Easing.out(Easing.cubic),
        });
  }, [reduceMotion, selected, selectedProgress]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(selectedProgress.value, [0, 1], [BORDER, ORANGE]),
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      ["#FFFFFF", ORANGE_SOFT],
    ),
    transform: [{ scale: pressScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      ["rgba(255,122,0,0)", "rgba(255,122,0,0.12)"],
    ),
    transform: [{ scale: 1 + selectedProgress.value * 0.06 }],
  }));

  const setPressed = (pressed: boolean) => {
    if (reduceMotion) return;
    pressScale.value = withSpring(pressed ? 0.98 : 1, {
      damping: 18,
      stiffness: 360,
      mass: 0.4,
    });
  };

  return { cardStyle, iconStyle, reduceMotion, setPressed };
}

export function OrangeOptionRow({
  option,
  selected,
  onPress,
}: {
  option: OrangeOption;
  selected: boolean;
  onPress: () => void;
}) {
  const Icon = option.Icon;
  const responsive = useResponsiveScale();
  const { cardStyle, iconStyle, reduceMotion, setPressed } = useOptionMotion(selected);

  return (
    <Animated.View
      style={[
        styles.optionRow,
        { minHeight: responsive.clamp(64, 58, 72) },
        cardStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={option.caption ? `${option.label}, ${option.caption}` : option.label}
        style={({ pressed }) => [
          styles.optionRowPressable,
          pressed && styles.optionPressed,
        ]}
      >
        {option.emoji ? (
          <Animated.View style={[styles.iconBubble, styles.emojiBubble, iconStyle]}>
            <T style={styles.optionEmoji}>{option.emoji}</T>
          </Animated.View>
        ) : Icon ? (
          <Animated.View style={[styles.iconBubble, iconStyle]}>
            <Icon size={ms(27)} color={selected ? ORANGE_DARK : "#30343B"} strokeWidth={2.15} />
          </Animated.View>
        ) : null}
        <View style={styles.optionCopy}>
          <T style={styles.optionLabel}>{option.label}</T>
          {option.caption ? <T style={styles.optionCaption}>{option.caption}</T> : null}
        </View>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? (
            <Animated.View
              entering={reduceMotion ? undefined : ZoomIn.springify().damping(14).stiffness(280)}
              style={styles.radioInner}
            />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function OrangeOptionGrid({
  options,
  selectedKey,
  onSelect,
}: {
  options: OrangeOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {options.map((option, index) => {
        const selected = option.key === selectedKey;
        return (
          <AnimatedGridOption
            key={option.key}
            option={option}
            selected={selected}
            index={index}
            onPress={() => onSelect(option.key)}
          />
        );
      })}
    </View>
  );
}

function AnimatedGridOption({
  option,
  selected,
  index,
  onPress,
}: {
  option: OrangeOption;
  selected: boolean;
  index: number;
  onPress: () => void;
}) {
  const Icon = option.Icon;
  const responsive = useResponsiveScale();
  const { cardStyle, iconStyle, reduceMotion, setPressed } = useOptionMotion(selected);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(70 + index * 35).duration(200)}
      style={[
        styles.gridCard,
        { height: responsive.clamp(116, 108, 124) },
        cardStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${option.label}, ${option.caption ?? ""}`}
        style={({ pressed }) => [
          styles.gridCardPressable,
          pressed && styles.optionPressed,
        ]}
      >
        {option.emoji ? (
          <Animated.View style={[styles.gridIconBubble, styles.emojiBubble, iconStyle]}>
            <T style={styles.optionEmoji}>{option.emoji}</T>
          </Animated.View>
        ) : Icon ? (
          <Animated.View style={[styles.gridIconBubble, iconStyle]}>
            <Icon size={ms(27)} color={selected ? ORANGE_DARK : "#30343B"} strokeWidth={2.2} />
          </Animated.View>
        ) : null}
        <View style={styles.gridText}>
          <T style={styles.gridLabel}>{option.label}</T>
          {option.caption ? <T style={styles.optionCaption}>{option.caption}</T> : null}
        </View>
        {selected ? (
          <Animated.View
            entering={reduceMotion ? undefined : ZoomIn.springify().damping(14).stiffness(280)}
            style={styles.gridCheck}
          >
            <Check size={ms(13)} color="#FFFFFF" strokeWidth={3.5} />
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export const ORANGE_QUESTION_COLORS = {
  orange: ORANGE,
  orangeSoft: ORANGE_SOFT,
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 0,
  },
  contentTall: {
    paddingTop: 0,
  },
  optionList: {
    gap: SP[2],
  },
  optionRow: {
    minHeight: sh(58),
    borderRadius: ms(14),
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.045,
    shadowRadius: ms(12),
    shadowOffset: { width: 0, height: ms(5) },
    elevation: 2,
  },
  optionRowPressable: {
    flex: 1,
    minHeight: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    gap: SP[3],
  },
  optionPressed: {
    backgroundColor: "rgba(255,121,0,0.06)",
  },
  optionSelected: {
    borderColor: ORANGE,
    backgroundColor: ORANGE_SOFT,
  },
  iconBubble: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleSelected: {
    backgroundColor: "rgba(255,122,0,0.12)",
  },
  emojiBubble: {
    backgroundColor: "#FFF6EE",
  },
  optionEmoji: {
    fontSize: ms(22),
    lineHeight: ms(28),
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONT_ROUNDED,
    fontSize: ms(16, 0.18),
    lineHeight: ms(20, 0.18),
    color: TEXT,
    letterSpacing: -0.2,
  },
  radioOuter: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    borderWidth: 2,
    borderColor: "#C9C5C0",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: ORANGE,
  },
  radioInner: {
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
    backgroundColor: ORANGE,
  },
  optionCaption: {
    fontFamily: FONT_ROUNDED,
    fontSize: ms(13, 0.18),
    lineHeight: ms(17, 0.18),
    color: MUTED,
    marginTop: sh(4),
  },
  checkCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
    justifyContent: "space-between",
    alignItems: "flex-start",
    alignContent: "flex-start",
  },
  gridCard: {
    width: "48.6%",
    borderRadius: ms(16),
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.045,
    shadowRadius: ms(12),
    shadowOffset: { width: 0, height: ms(5) },
    elevation: 2,
  },
  gridCardPressable: {
    width: "100%",
    height: "100%",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    justifyContent: "center",
    alignItems: "flex-start",
    gap: SP[2],
  },
  gridIconBubble: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  gridText: {
    width: "100%",
  },
  gridLabel: {
    fontFamily: FONT_ROUNDED,
    fontSize: ms(16, 0.18),
    lineHeight: ms(20, 0.18),
    color: TEXT,
    letterSpacing: -0.2,
  },
  gridCheck: {
    position: "absolute",
    right: SP[2],
    top: SP[2],
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
});
