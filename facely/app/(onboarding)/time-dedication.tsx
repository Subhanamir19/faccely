// app/(onboarding)/time-dedication.tsx
// Asks how much time per day the user can dedicate to their routine.
// 2×2 grid of square cards mirroring the goals screen — single-select.
import React, { useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Check, Zap, Target, Dumbbell, Flame, type LucideIcon } from "lucide-react-native";
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
import { OnboardingScreenV2 } from "@/components/onboarding";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticSelection } from "@/lib/haptics";
import { useOnboarding } from "@/store/onboarding";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";
const SAGE = "#3F7A2A";
const SAGE_SOFT = "#ECFCCB";
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: ms(14),
  shadowOffset: { width: 0, height: ms(4) },
  elevation: 2,
} as const;

type TimeCard = {
  key: string;
  label: string;
  caption: string;
  Icon: LucideIcon;
};

const CARDS: TimeCard[] = [
  { key: "5min",  label: "5 min",     caption: "Quick habit",     Icon: Zap },
  { key: "10min", label: "10 min",    caption: "Balanced",        Icon: Target },
  { key: "15min", label: "15 min",    caption: "Dedicated",       Icon: Dumbbell },
  { key: "20min", label: "20+ min",   caption: "Full protocol",   Icon: Flame },
];

export default function TimeDedicationScreen() {
  const setField = useOnboarding((s) => s.setField);
  const saved = useOnboarding((s) => s.data.timeDedication);

  const handleSelect = useCallback(
    (key: string) => {
      hapticSelection();
      setField("timeDedication", key);
    },
    [setField],
  );

  const handleNext = useCallback(() => {
    if (!saved) return;
    router.push("/(onboarding)/routine-animation");
  }, [saved]);

  return (
    <OnboardingScreenV2
      stepKey="time-dedication"
      title="How much time can you commit?"
      subtitle="We'll build a routine that fits your schedule"
      onPrimary={handleNext}
      primaryDisabled={!saved}
    >
      <TimeGrid
        cards={CARDS}
        selected={saved ?? null}
        onSelect={handleSelect}
      />
    </OnboardingScreenV2>
  );
}

// ─── Grid ──────────────────────────────────────────────────────────────────

function TimeGrid({
  cards,
  selected,
  onSelect,
}: {
  cards: TimeCard[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const { width: winW } = useWindowDimensions();
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
          <TimeCardView
            card={c}
            width={cardWidth}
            isActive={selected === c.key}
            onPress={() => onSelect(c.key)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function TimeCardView({
  card,
  width,
  isActive,
  onPress,
}: {
  card: TimeCard;
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

  const Icon = card.Icon;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 260 });
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${card.label} — ${card.caption}`}
    >
      <Animated.View
        style={[
          styles.card,
          { width, height: width * 1.05 },
          !isActive && SOFT_SHADOW,
          containerStyle,
        ]}
      >
        <View style={styles.iconTile}>
          <Icon size={ms(28)} color={SAGE} strokeWidth={2.2} />
        </View>

        <T style={styles.label} numberOfLines={1}>
          {card.label}
        </T>
        <T style={styles.caption} numberOfLines={1}>
          {card.caption}
        </T>

        <Animated.View style={[styles.check, checkStyle]}>
          <Check size={ms(13)} color={COLORS.lightText} strokeWidth={3.5} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const CHECK_SIZE = ms(22);
const ICON_TILE = ms(56);

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    borderRadius: RADII.lg,
    borderWidth: 1.5,
    paddingVertical: SP[3],
    paddingHorizontal: SP[3],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: ICON_TILE / 2,
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[3],
  },
  label: {
    fontFamily: FONT_BOLD,
    fontSize: ms(17),
    color: COLORS.lightText,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  caption: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(12),
    color: COLORS.lightSub,
    textAlign: "center",
    marginTop: sh(2),
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
