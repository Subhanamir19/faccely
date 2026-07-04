// app/(onboarding)/goals.tsx
// Multi-select goals - 2x3 grid of image cards. Each card maps to a face area.
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { hapticSelection } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";
import { useOnboarding } from "@/store/onboarding";
import OrangeOnboardingLayout, {
  ORANGE_ONBOARDING,
} from "@/components/onboarding/OrangeOnboardingLayout";

const FONT_BOLD = ORANGE_ONBOARDING.fontBold;
const ORANGE = ORANGE_ONBOARDING.orange;
const ORANGE_SOFT = ORANGE_ONBOARDING.orangeSoft;
const GAP = sw(12);
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: ms(14),
  shadowOffset: { width: 0, height: ms(4) },
  elevation: 2,
} as const;

type GoalCard = {
  key: string;
  label: string;
  image: any;
};

const GOAL_CARDS: GoalCard[] = [
  { key: "jawline", label: "Jawline", image: require("@/assets/scoring-images/jawline.png") },
  { key: "cheekbones", label: "Cheekbones", image: require("@/assets/scoring-images/cheekbones.png") },
  { key: "overall", label: "Full Face", image: require("@/assets/scoring-images/fullface-vector.png") },
  { key: "eyes", label: "Eye Area", image: require("@/assets/scoring-images/eyearea-vector.png") },
  { key: "symmetry", label: "Symmetry", image: require("@/assets/scoring-images/symmetry.png") },
  { key: "skin", label: "Face Muscles", image: require("@/assets/scoring-images/skin-quality.png") },
];

export default function GoalsScreen() {
  const setField = useOnboarding((state) => state.setField);
  const savedGoals = useOnboarding((state) => state.data.goals);
  const [selected, setSelected] = useState<string[]>(savedGoals ?? []);

  const toggle = useCallback((key: string) => {
    hapticSelection();
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const handleNext = useCallback(() => {
    if (selected.length === 0) return;
    setField("goals", selected);
    router.push("/(onboarding)/gender");
  }, [selected, setField]);

  return (
    <OrangeOnboardingLayout
      presentation="sequence"
      stepKey="goals"
      title="What do you want to improve?"
      subtitle="Select all that apply - we'll personalize your plan around them"
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
      sheetContentStyle={styles.screenContent}
    >
      <GoalGrid cards={GOAL_CARDS} selected={selected} onToggle={toggle} />
    </OrangeOnboardingLayout>
  );
}

function GoalGrid({
  cards,
  selected,
  onToggle,
}: {
  cards: GoalCard[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP) / 2) : 0;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    setGridWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  return (
    <View onLayout={handleLayout} style={[styles.grid, { columnGap: GAP, rowGap: GAP }]}>
      {cardWidth > 0
        ? cards.map((card, index) => (
            <Animated.View
              key={card.key}
              entering={FadeInDown.delay(index * 35)
                .duration(200)
                .easing(Easing.out(Easing.cubic))}
              style={{ width: cardWidth }}
            >
              <GoalCardView
                card={card}
                width={cardWidth}
                isActive={selected.includes(card.key)}
                onPress={() => onToggle(card.key)}
              />
            </Animated.View>
          ))
        : null}
    </View>
  );
}

function GoalCardView({
  card,
  width,
  isActive,
  onPress,
}: {
  card: GoalCard;
  width: number;
  isActive: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(0);
  const active = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(isActive ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.value, [0, 1], [COLORS.lightCard, ORANGE_SOFT]),
    borderColor: interpolateColor(active.value, [0, 1], [COLORS.lightHairline, ORANGE]),
    transform: [{ scale: 1 - press.value * 0.025 }, { translateY: press.value * 1.5 }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.6 + active.value * 0.4 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 260 });
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isActive }}
      accessibilityLabel={card.label}
    >
      <Animated.View
        style={[
          styles.card,
          { width, height: width * 1.05 },
          !isActive && SOFT_SHADOW,
          containerStyle,
        ]}
      >
        <View style={styles.imageWrap}>
          <Image source={card.image} style={styles.image} resizeMode="contain" />
        </View>

        <T style={styles.label} numberOfLines={1}>
          {card.label}
        </T>

        <Animated.View style={[styles.check, checkStyle]}>
          <Check size={ms(13)} color="#FFFFFF" strokeWidth={3.5} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const CHECK_SIZE = ms(22);

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "flex-start",
    paddingTop: SP[3],
    paddingBottom: SP[6],
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  card: {
    borderRadius: RADII.md,
    borderWidth: 1.5,
    paddingTop: SP[2],
    paddingBottom: SP[2],
    paddingHorizontal: SP[3],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  image: {
    width: "82%",
    height: "82%",
  },
  label: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13),
    lineHeight: ms(17),
    color: ORANGE_ONBOARDING.text,
    textAlign: "center",
    letterSpacing: 0,
  },
  check: {
    position: "absolute",
    top: SP[2],
    right: SP[2],
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
});
