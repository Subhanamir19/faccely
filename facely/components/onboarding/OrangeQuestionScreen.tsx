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
import { Image, type ImageSource } from "expo-image";

import T from "@/components/ui/T";
import OrangeOnboardingLayout, {
  OrangePrimaryButton,
  OrangeScreenTitle,
  ORANGE_ONBOARDING,
} from "./OrangeOnboardingLayout";
import { SP } from "@/lib/tokens";
import { ms, sh, useResponsiveScale } from "@/lib/responsive";

const FONT_REGULAR = ORANGE_ONBOARDING.fontRegular;
const FONT_SEMIBOLD = ORANGE_ONBOARDING.fontSemibold;
const ORANGE = ORANGE_ONBOARDING.orange;
const ORANGE_DARK = ORANGE_ONBOARDING.orangeDark;
const ORANGE_SOFT = ORANGE_ONBOARDING.orangeSoft;
const TEXT = ORANGE_ONBOARDING.text;
const MUTED = ORANGE_ONBOARDING.muted;
const BORDER = ORANGE_ONBOARDING.border;

// ---------------------------------------------------------------------------
// Option row geometry
// ---------------------------------------------------------------------------
// Measured from the reference onboarding recording at 384x832 and converted to
// this app's 393x852 baseline (factor 1.023). The rules that matter and are
// easy to lose in a later edit:
//   - rows carry no border and no shadow when unselected; selection is the only
//     thing that draws an edge, so the list reads as one surface with cut-outs
//     rather than a stack of floating cards
//   - the border is always 2px and only changes colour, so selecting a row
//     never reflows its contents
//   - the icon does not tint or scale on selection. Fill + border + indicator
//     carry the whole state change.
const ROW_RADIUS = 24;
const ROW_PAD_LEFT = 24;
const ROW_PAD_RIGHT = 26;
const ROW_GAP = 8;
// The reference measures a 40pt icon slot, but its options are glyph-style
// marks that fill their box. These illustrations carry internal whitespace and
// read small at 40, so the slot is 56 and the label offset lands at 96 rather
// than the reference's 80. Applied to every row variant so the label column
// stays in the same place across screens.
const ICON_SLOT = 56;
const ICON_GAP = 16;
const INDICATOR = 16;
const ROW_FILL = "#FDFDFD";

// `wide` pulls 8pt out of the sheet gutter on each side, matching the reference's
// 24pt gutter for three-short-option screens against 32pt everywhere else.
const WIDE_BLEED = 8;

export type OrangeRowVariant = "wide" | "compact" | "multi" | "descriptive";

const ROW_VARIANTS: Record<
  OrangeRowVariant,
  { height: number; indicator: boolean; bleed: number }
> = {
  wide: { height: 80, indicator: true, bleed: WIDE_BLEED },
  compact: { height: 76, indicator: false, bleed: 0 },
  multi: { height: 80, indicator: true, bleed: 0 },
  descriptive: { height: 96, indicator: false, bleed: 0 },
};

type Props = {
  heroImage: ImageSourcePropType;
  stepKey?: string;
  title: string;
  /** Optional by design: the reference flow carries no subtitles. Prefer a
   *  per-row description, or the footer label, over reintroducing one. */
  subtitle?: string;
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
      {/* The title pins to the top of the sheet; the option group centres in
          whatever is left. Once the group outgrows that space the slot stops
          centring and the list simply scrolls from the top gap — which is the
          reference's behaviour on its long screens. */}
      <View style={styles.optionSlot}>
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
      </View>
    </OrangeOnboardingLayout>
  );
}

export type OrangeOption = {
  key: string;
  label: string;
  caption?: string;
  image?: ImageSource | number;
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

  // The unselected border is the row's own fill, not a visible edge: the width
  // stays at 2 so selecting a row never reflows it, and only the colour moves.
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(selectedProgress.value, [0, 1], [ROW_FILL, ORANGE]),
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [ROW_FILL, ORANGE_SOFT],
    ),
    transform: [{ scale: pressScale.value }],
  }));

  // Grid cards keep the tinted icon bubble; rows deliberately do not use this.
  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      ["rgba(255,122,0,0)", "rgba(255,122,0,0.12)"],
    ),
    transform: [{ scale: 1 + selectedProgress.value * 0.06 }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      ["#E5E4E7", ORANGE],
    ),
  }));

  const setPressed = (pressed: boolean) => {
    if (reduceMotion) return;
    pressScale.value = withSpring(pressed ? 0.98 : 1, {
      damping: 18,
      stiffness: 360,
      mass: 0.4,
    });
  };

  return { cardStyle, iconStyle, indicatorStyle, reduceMotion, setPressed };
}

export function OrangeOptionRow({
  option,
  selected,
  onPress,
  variant = "compact",
}: {
  option: OrangeOption;
  selected: boolean;
  onPress: () => void;
  variant?: OrangeRowVariant;
}) {
  const Icon = option.Icon;
  const spec = ROW_VARIANTS[variant];
  const { cardStyle, indicatorStyle, reduceMotion, setPressed } =
    useOptionMotion(selected);

  return (
    <Animated.View
      style={[
        styles.optionRow,
        {
          height: sh(spec.height),
          marginHorizontal: -spec.bleed,
        },
        cardStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole={variant === "multi" ? "checkbox" : "radio"}
        aria-checked={selected}
        accessibilityState={{ selected }}
        accessibilityLabel={option.caption ? `${option.label}, ${option.caption}` : option.label}
        style={styles.optionRowPressable}
      >
        {option.image ? (
          <Image
            source={option.image}
            contentFit="contain"
            transition={0}
            accessible={false}
            style={styles.optionIcon}
          />
        ) : option.emoji ? (
          <View style={styles.optionIcon}>
            <T style={styles.optionEmoji}>{option.emoji}</T>
          </View>
        ) : Icon ? (
          <View style={styles.optionIcon}>
            <Icon size={ms(34)} color="#30343B" strokeWidth={2.15} />
          </View>
        ) : null}
        <View style={styles.optionCopy}>
          <T style={styles.optionLabel} numberOfLines={variant === "multi" ? 2 : 1}>
            {option.label}
          </T>
          {option.caption && variant === "descriptive" ? (
            <T style={styles.optionCaption} numberOfLines={2}>
              {option.caption}
            </T>
          ) : null}
        </View>
        {spec.indicator ? (
          <Animated.View style={[styles.indicator, indicatorStyle]}>
            {selected ? (
              <Animated.View
                entering={reduceMotion ? undefined : ZoomIn.springify().damping(14).stiffness(280)}
              >
                <Check size={ms(11)} color="#FFFFFF" strokeWidth={3.4} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
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
        {
          height: option.image
            ? responsive.clamp(136, 132, 148)
            : responsive.clamp(116, 108, 124),
        },
        cardStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        aria-checked={selected}
        accessibilityState={{ selected }}
        accessibilityLabel={`${option.label}, ${option.caption ?? ""}`}
        style={({ pressed }) => [
          styles.gridCardPressable,
          pressed && styles.optionPressed,
        ]}
      >
        {option.image ? (
          <Image
            source={option.image}
            contentFit="contain"
            transition={0}
            accessible={false}
            style={{
              flexShrink: 0,
              width: responsive.clamp(40, 36, 44),
              height: responsive.clamp(40, 36, 44),
            }}
          />
        ) : option.emoji ? (
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
    justifyContent: "flex-start",
  },
  contentTall: {
    paddingTop: 0,
    justifyContent: "flex-start",
  },
  optionSlot: {
    flexGrow: 1,
    justifyContent: "center",
    // OrangeScreenTitle already contributes 16 below itself, so this lands the
    // minimum title-to-first-row gap on the reference's 32.
    paddingTop: sh(16),
  },
  optionList: {
    gap: ROW_GAP,
  },
  optionRow: {
    borderRadius: ms(ROW_RADIUS),
    borderWidth: 2,
    borderColor: ROW_FILL,
    backgroundColor: ROW_FILL,
    overflow: "hidden",
  },
  optionRowPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: ROW_PAD_LEFT - 2,
    paddingRight: ROW_PAD_RIGHT - 2,
    gap: ICON_GAP,
  },
  optionIcon: {
    width: ms(ICON_SLOT),
    height: ms(ICON_SLOT),
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  indicator: {
    width: ms(INDICATOR),
    height: ms(INDICATOR),
    borderRadius: ms(INDICATOR) / 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    fontSize: ms(30),
    lineHeight: ms(36),
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: ms(18, 0.18),
    lineHeight: ms(23, 0.18),
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
    fontFamily: FONT_REGULAR,
    fontSize: ms(12, 0.18),
    lineHeight: ms(16, 0.18),
    color: MUTED,
    marginTop: sh(3),
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
    fontFamily: FONT_SEMIBOLD,
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
