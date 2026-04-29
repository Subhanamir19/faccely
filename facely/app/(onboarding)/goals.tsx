// app/(onboarding)/goals.tsx
// Multi-select goals — 2×3 grid of image cards. Each card maps to a face
// area whose visual comes from the shared scoring images so the choice
// previews exactly what gets scored later in the app.
import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import T from "@/components/ui/T";
import { OnboardingScreenV2 } from "@/components/onboarding";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — active border, check chip
const SAGE_SOFT = "#ECFCCB";   // pale lime — active card bg
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: ms(14),
  shadowOffset: { width: 0, height: ms(4) },
  elevation: 2,
} as const;

// Order maps to grid reading order (left→right, top→bottom). Existing store
// keys are preserved so callers reading `data.goals` keep working.
type GoalCard = {
  key: string;
  label: string;
  image: any;
};

const GOAL_CARDS: GoalCard[] = [
  { key: "jawline",    label: "Jawline",      image: require("@/assets/scoring-images/jawline.png") },
  { key: "cheekbones", label: "Cheekbones",   image: require("@/assets/scoring-images/cheekbones.png") },
  { key: "overall",    label: "Full Face",    image: require("@/assets/scoring-images/fullface-vector.png") },
  { key: "eyes",       label: "Eye Area",     image: require("@/assets/scoring-images/eyearea-vector.png") },
  { key: "symmetry",   label: "Symmetry",     image: require("@/assets/scoring-images/symmetry.png") },
  { key: "skin",       label: "Face Muscles", image: require("@/assets/scoring-images/skin-quality.png") },
];

export default function GoalsScreen() {
  const setField    = useOnboarding((s) => s.setField);
  const savedGoals  = useOnboarding((s) => s.data.goals);
  const [selected, setSelected] = useState<string[]>(savedGoals ?? []);

  const toggle = useCallback((key: string) => {
    hapticSelection();
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const handleNext = useCallback(() => {
    if (selected.length === 0) return;
    setField("goals", selected);
    router.push("/(onboarding)/gender");
  }, [selected, setField]);

  return (
    <OnboardingScreenV2
      stepKey="goals"
      title="What do you want to improve?"
      subtitle="Select all that apply — we'll personalize your plan around them"
      onPrimary={handleNext}
      primaryDisabled={selected.length === 0}
    >
      <GoalGrid
        cards={GOAL_CARDS}
        selected={selected}
        onToggle={toggle}
      />
    </OnboardingScreenV2>
  );
}

// ─── Grid ──────────────────────────────────────────────────────────────────

function GoalGrid({
  cards,
  selected,
  onToggle,
}: {
  cards: GoalCard[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const { width: winW } = useWindowDimensions();
  // OnboardingScreenV2 applies SP[5] horizontal padding; subtract twice + gap
  // to compute card width that fills the row exactly.
  const HORIZONTAL_PAD = SP[5];
  const GAP            = sw(12);
  const cardWidth      = (winW - HORIZONTAL_PAD * 2 - GAP) / 2;

  return (
    <View style={[styles.grid, { gap: GAP }]}>
      {cards.map((c, idx) => (
        <Animated.View
          key={c.key}
          entering={FadeInDown.delay(idx * 60)
            .duration(320)
            .easing(Easing.out(Easing.cubic))}
        >
          <GoalCardView
            card={c}
            width={cardWidth}
            isActive={selected.includes(c.key)}
            onPress={() => onToggle(c.key)}
          />
        </Animated.View>
      ))}
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
  const press  = useSharedValue(0);
  const active = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(isActive ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, active]);

  const containerStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      active.value,
      [0, 1],
      [COLORS.lightCard, SAGE_SOFT],
    );
    const border = interpolateColor(
      active.value,
      [0, 1],
      [COLORS.lightHairline, LIME],
    );
    const scale = 1 - press.value * 0.025;
    return {
      backgroundColor: bg,
      borderColor: border,
      transform: [{ scale }, { translateY: press.value * 1.5 }],
    };
  });

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
      accessibilityState={{ selected: isActive }}
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
          <Image
            source={card.image}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <T style={styles.label} numberOfLines={1}>
          {card.label}
        </T>

        <Animated.View style={[styles.check, checkStyle]}>
          <Check size={ms(13)} color={COLORS.lightText} strokeWidth={3.5} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const CHECK_SIZE = ms(22);

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    borderRadius: RADII.lg,
    borderWidth: 1.5,
    paddingTop: SP[3],
    paddingBottom: SP[3],
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
    color: COLORS.lightText,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  check: {
    position: "absolute",
    top: SP[2],
    right: SP[2],
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
  },
});
