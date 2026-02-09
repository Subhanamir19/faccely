// components/ui/MoodCheckModal.tsx
// Post-routine mood check shown after the day-complete celebration.

import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { COLORS, RADII, SP } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type MoodOption = {
  key: string;
  emoji: string;
  label: string;
};

const DEFAULT_OPTIONS: MoodOption[] = [
  { key: "great", emoji: "💪", label: "Feeling great" },
  { key: "good", emoji: "👍", label: "Pretty good" },
  { key: "tired", emoji: "😮‍💨", label: "Exhausted" },
];

type Props = {
  visible: boolean;
  dayNumber: number;
  options?: MoodOption[];
  onSelect: (key: string) => void;
  onSkip: () => void;
};

export default function MoodCheckModal({
  visible,
  dayNumber,
  options = DEFAULT_OPTIONS,
  onSelect,
  onSkip,
}: Props) {
  const containerOpacity = useSharedValue(0);
  const containerScale = useSharedValue(0.92);
  const optionsOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      containerOpacity.value = withTiming(1, { duration: 280 });
      containerScale.value = withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.back(1.05)),
      });
      optionsOpacity.value = withDelay(250, withTiming(1, { duration: 280 }));
    } else {
      containerOpacity.value = 0;
      containerScale.value = 0.92;
      optionsOpacity.value = 0;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const optStyle = useAnimatedStyle(() => ({
    opacity: optionsOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onSkip}>
      <Pressable style={styles.overlay} onPress={onSkip}>
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable onPress={() => undefined}>
          <Animated.View style={[styles.card, containerStyle]}>
            {/* Header */}
            <Text style={styles.title}>How are you feeling?</Text>
            <Text style={styles.subtitle}>After Day {dayNumber}'s routine</Text>

            {/* Mood options */}
            <Animated.View style={[styles.optionsContainer, optStyle]}>
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => onSelect(opt.key)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    pressed && styles.optionBtnPressed,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </Animated.View>

            {/* Skip */}
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && styles.skipBtnPressed,
              ]}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: SCREEN_WIDTH - SP[4] * 2,
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[5],
    alignItems: "center",
    gap: SP[2],
  },
  title: {
    fontSize: 22,
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.sub,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: SP[3],
  },
  optionsContainer: {
    width: "100%",
    gap: SP[2],
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    width: "100%",
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  optionBtnPressed: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.accentBorder,
    transform: [{ scale: 0.98 }],
  },
  optionEmoji: {
    fontSize: 26,
  },
  optionLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
  },
  skipBtn: {
    marginTop: SP[2],
    paddingVertical: SP[2],
    paddingHorizontal: SP[4],
  },
  skipBtnPressed: {
    opacity: 0.6,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.sub,
    fontFamily: "Poppins-SemiBold",
  },
});
