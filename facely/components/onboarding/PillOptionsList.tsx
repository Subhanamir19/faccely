// components/onboarding/PillOptionsList.tsx
// Flat dark pill-style options with a leading lucide icon.
// Micro-interactions:
//   • Press-in: subtle scale + depth squish (spring)
//   • Selection: icon bounce + animated color/border transition
//   • Active: a checkmark that scales+fades in on the right
//   • Idle: staggered fade-in-up on mount
import React, { useEffect } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
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
import { Check } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { hapticSelection } from "@/lib/haptics";

export type PillOption = {
  key: string;
  label: string;
  Icon: LucideIcon;
  description?: string;
};

type SingleProps = {
  options: PillOption[];
  selected: string | null | undefined;
  onSelect: (key: string) => void;
  multiSelect?: false;
};

type MultiProps = {
  options: PillOption[];
  multiSelect: true;
  selectedKeys: string[];
  onToggle: (keys: string[]) => void;
};

type Props = SingleProps | MultiProps;

export default function PillOptionsList(props: Props) {
  const { options } = props;

  const isActive = (key: string): boolean =>
    props.multiSelect
      ? props.selectedKeys.includes(key)
      : props.selected === key;

  const handlePress = (key: string) => {
    hapticSelection();
    if (props.multiSelect) {
      const next = props.selectedKeys.includes(key)
        ? props.selectedKeys.filter((k) => k !== key)
        : [...props.selectedKeys, key];
      props.onToggle(next);
    } else {
      props.onSelect(key);
    }
  };

  return (
    <View style={styles.list}>
      {options.map((opt, idx) => (
        <Animated.View
          key={opt.key}
          entering={FadeInDown.delay(idx * 50)
            .duration(300)
            .easing(Easing.out(Easing.cubic))}
        >
          <PillRow
            option={opt}
            isActive={isActive(opt.key)}
            multi={!!props.multiSelect}
            onPress={() => handlePress(opt.key)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function PillRow({
  option,
  isActive,
  multi,
  onPress,
}: {
  option: PillOption;
  isActive: boolean;
  multi: boolean;
  onPress: () => void;
}) {
  const { Icon, label, description } = option;

  const press = useSharedValue(0);
  const active = useSharedValue(isActive ? 1 : 0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    active.value = withTiming(isActive ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    if (isActive) {
      iconScale.value = withSequence(
        withSpring(1.25, { damping: 8, stiffness: 260 }),
        withSpring(1, { damping: 10, stiffness: 200 }),
      );
    }
  }, [isActive, active, iconScale]);

  const containerStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      active.value,
      [0, 1],
      [COLORS.optionBg, COLORS.optionBgActive],
    );
    const border = interpolateColor(
      active.value,
      [0, 1],
      ["rgba(255,255,255,0)", COLORS.accentBorder],
    );
    const scale = 1 - press.value * 0.02;
    return {
      backgroundColor: bg,
      borderColor: border,
      transform: [
        { scale },
        { translateY: press.value * 1.5 },
      ],
    };
  });

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.6 + active.value * 0.4 }],
  }));

  const handlePressIn = () => {
    press.value = withSpring(1, { damping: 18, stiffness: 320 });
  };
  const handlePressOut = () => {
    press.value = withSpring(0, { damping: 14, stiffness: 260 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.pill,
          description ? styles.pillCard : styles.pillRound,
          containerStyle,
        ]}
      >
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Icon
            size={22}
            color={isActive ? COLORS.accent : COLORS.sub}
            strokeWidth={2}
          />
        </Animated.View>

        <View style={styles.textCol}>
          <T
            variant="bodySemiBold"
            color={isActive ? "text" : "optionText"}
          >
            {label}
          </T>
          {description && (
            <T variant="small" color="sub" style={styles.description}>
              {description}
            </T>
          )}
        </View>

        <Animated.View style={[styles.check, checkStyle]}>
          <Check size={14} color={COLORS.bgTop} strokeWidth={3.5} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const CHECK_SIZE = 22;

const styles = StyleSheet.create({
  list: { gap: SP[3] },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    minHeight: 60,
    paddingHorizontal: SP[5],
    paddingVertical: SP[3],
    borderWidth: 1,
  },
  pillRound: { borderRadius: RADII.circle },
  pillCard: { borderRadius: RADII.xl },

  iconWrap: { width: 24, alignItems: "center", justifyContent: "center" },
  textCol: { flex: 1 },
  description: { marginTop: 2 },

  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});

export { PillOptionsList };
