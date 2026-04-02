// components/ui/HalfwayHypeModal.tsx
// Shown once per day when user completes 50% of their daily exercises.
// Entrance: card pops • image jumps up with spring • pill slides from left • button scales in

import React, { useEffect } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import LimeButton from "./LimeButton";

const { width: SW } = Dimensions.get("window");
const CARD_W = Math.min(SW - SP[4] * 2, 380);

type Props = {
  visible: boolean;
  completedCount: number;
  totalCount: number;
  onClose: () => void;
};

export default function HalfwayHypeModal({
  visible,
  completedCount,
  totalCount,
  onClose,
}: Props) {
  const reducedMotion = useReducedMotion();

  // ── Card ──────────────────────────────────────────────────────────────────
  const cardOpacity = useSharedValue(0);
  const cardScale   = useSharedValue(0.82);

  // ── Image ─────────────────────────────────────────────────────────────────
  const imageY       = useSharedValue(36);
  const imageOpacity = useSharedValue(0);
  const imageFloat   = useSharedValue(0);

  // ── Progress pill ─────────────────────────────────────────────────────────
  const pillX       = useSharedValue(-24);
  const pillOpacity = useSharedValue(0);

  // ── Text / button ─────────────────────────────────────────────────────────
  const titleOpacity = useSharedValue(0);
  const titleY       = useSharedValue(10);
  const bodyOpacity  = useSharedValue(0);
  const btnOpacity   = useSharedValue(0);
  const btnScale     = useSharedValue(0.82);

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        cardOpacity.value  = withTiming(1, { duration: 200 });
        cardScale.value    = 1;
        imageOpacity.value = withDelay(80,  withTiming(1, { duration: 200 }));
        imageY.value       = 0;
        pillOpacity.value  = withDelay(160, withTiming(1, { duration: 180 }));
        pillX.value        = 0;
        titleOpacity.value = withDelay(220, withTiming(1, { duration: 180 }));
        titleY.value       = 0;
        bodyOpacity.value  = withDelay(280, withTiming(1, { duration: 180 }));
        btnOpacity.value   = withDelay(320, withTiming(1, { duration: 180 }));
        btnScale.value     = 1;
      } else {
        // Card pops in
        cardOpacity.value = withTiming(1, { duration: 240 });
        cardScale.value   = withSpring(1, { damping: 10, stiffness: 150 });

        // Image jumps up
        imageOpacity.value = withDelay(100, withTiming(1, { duration: 240 }));
        imageY.value       = withDelay(100, withSpring(0, { damping: 9, stiffness: 140 }));
        imageFloat.value   = withDelay(640, withRepeat(
          withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ));

        // Pill slides in from left
        pillOpacity.value = withDelay(260, withTiming(1, { duration: 220 }));
        pillX.value       = withDelay(260, withSpring(0, { damping: 14, stiffness: 180 }));

        // Stagger text
        titleOpacity.value = withDelay(340, withTiming(1, { duration: 220 }));
        titleY.value       = withDelay(340, withSpring(0, { damping: 16, stiffness: 200 }));
        bodyOpacity.value  = withDelay(420, withTiming(1, { duration: 220 }));
        btnOpacity.value   = withDelay(500, withTiming(1, { duration: 200 }));
        btnScale.value     = withDelay(500, withSpring(1, { damping: 11, stiffness: 170 }));
      }
    } else {
      cancelAnimation(imageFloat);
      cardOpacity.value  = 0;
      cardScale.value    = 0.82;
      imageY.value       = 36;
      imageOpacity.value = 0;
      imageFloat.value   = 0;
      pillX.value        = -24;
      pillOpacity.value  = 0;
      titleOpacity.value = 0;
      titleY.value       = 10;
      bodyOpacity.value  = 0;
      btnOpacity.value   = 0;
      btnScale.value     = 0.82;
    }
  }, [visible, reducedMotion]);

  const cardStyle  = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageY.value + imageFloat.value * -7 }],
  }));

  const pillStyle  = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateX: pillX.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const bodyStyle  = useAnimatedStyle(() => ({ opacity: bodyOpacity.value }));
  const btnStyle   = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ scale: btnScale.value }],
  }));

  if (!visible) return null;

  const remaining = totalCount - completedCount;
  const remWord   = remaining === 1 ? "exercise" : "exercises";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable onPress={() => undefined}>
          <Animated.View style={[styles.card, cardStyle]}>

            {/* Close */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <X size={16} color={COLORS.sub} />
            </Pressable>

            {/* Pose image */}
            <Animated.View style={[styles.imageWrap, imageStyle]}>
              <Image
                source={require("../../routine-poses/halfway-hype.png")}
                style={styles.poseImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Progress pill — slides from left */}
            <Animated.View style={[styles.progressPill, pillStyle]}>
              <Text style={styles.progressPillText}>
                {completedCount} / {totalCount} done ✓
              </Text>
            </Animated.View>

            {/* Title */}
            <Animated.Text style={[styles.title, titleStyle]}>
              Halfway there!
            </Animated.Text>

            {/* Body */}
            <Animated.Text style={[styles.body, bodyStyle]}>
              {remaining} more {remWord} left. Finish it.
            </Animated.Text>

            {/* CTA */}
            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <LimeButton label="Let's finish it" onPress={onClose} />
            </Animated.View>

          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[5],
    paddingTop: SP[5],
    paddingBottom: SP[5],
    alignItems: "center",
    gap: SP[3],
  },
  closeBtn: {
    position: "absolute",
    top: SP[3],
    right: SP[3],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  imageWrap: {
    width: CARD_W - SP[5] * 2,
    height: 230,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP[4],
  },
  poseImage: {
    width: "100%",
    height: "100%",
  },
  progressPill: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  progressPillText: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.accent,
  },
  title: {
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: 22,
  },
  btnWrap: {
    width: "100%",
    marginTop: SP[1],
  },
});
