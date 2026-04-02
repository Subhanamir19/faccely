// components/ui/ComebackModal.tsx
// Shown when user has been absent for 2+ days and opens the app.
// Entrance: card slides up • image rocks in from right • elements stagger in • persistent float loop

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
  withSequence,
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
  missedDays: number;
  onClose: () => void;
};

export default function ComebackModal({ visible, missedDays, onClose }: Props) {
  const reducedMotion = useReducedMotion();

  // ── Card entrance ──────────────────────────────────────────────────────────
  const cardOpacity  = useSharedValue(0);
  const cardY        = useSharedValue(48);

  // ── Image entrance + float loop ────────────────────────────────────────────
  const imageX       = useSharedValue(30);
  const imageOpacity = useSharedValue(0);
  const imageRotate  = useSharedValue(0);
  const imageFloat   = useSharedValue(0);

  // ── Text elements ──────────────────────────────────────────────────────────
  const titleOpacity = useSharedValue(0);
  const titleY       = useSharedValue(10);
  const bodyOpacity  = useSharedValue(0);
  const btnOpacity   = useSharedValue(0);
  const btnScale     = useSharedValue(0.85);

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        cardOpacity.value  = withTiming(1, { duration: 200 });
        cardY.value        = 0;
        imageOpacity.value = withDelay(80,  withTiming(1, { duration: 200 }));
        imageX.value       = 0;
        titleOpacity.value = withDelay(160, withTiming(1, { duration: 180 }));
        titleY.value       = 0;
        bodyOpacity.value  = withDelay(220, withTiming(1, { duration: 180 }));
        btnOpacity.value   = withDelay(280, withTiming(1, { duration: 180 }));
        btnScale.value     = 1;
      } else {
        // Card slides up
        cardOpacity.value = withTiming(1, { duration: 260 });
        cardY.value       = withSpring(0, { damping: 18, stiffness: 160 });

        // Image slides in from right then rocks
        imageOpacity.value = withDelay(80,  withTiming(1, { duration: 250 }));
        imageX.value       = withDelay(80,  withSpring(0, { damping: 14, stiffness: 140 }));
        imageRotate.value  = withDelay(380, withSequence(
          withTiming(-5,  { duration: 110, easing: Easing.out(Easing.ease) }),
          withTiming( 4,  { duration: 120, easing: Easing.inOut(Easing.ease) }),
          withTiming(-2,  { duration: 100 }),
          withTiming( 0,  { duration: 120, easing: Easing.out(Easing.ease) }),
        ));
        // Float loop starts after image settles
        imageFloat.value = withDelay(700, withRepeat(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ));

        // Stagger text
        titleOpacity.value = withDelay(260, withTiming(1, { duration: 240 }));
        titleY.value       = withDelay(260, withSpring(0, { damping: 16, stiffness: 200 }));
        bodyOpacity.value  = withDelay(360, withTiming(1, { duration: 240 }));
        btnOpacity.value   = withDelay(460, withTiming(1, { duration: 220 }));
        btnScale.value     = withDelay(460, withSpring(1, { damping: 12, stiffness: 180 }));
      }
    } else {
      cancelAnimation(imageFloat);
      cardOpacity.value  = 0;
      cardY.value        = 48;
      imageX.value       = 30;
      imageOpacity.value = 0;
      imageRotate.value  = 0;
      imageFloat.value   = 0;
      titleOpacity.value = 0;
      titleY.value       = 10;
      bodyOpacity.value  = 0;
      btnOpacity.value   = 0;
      btnScale.value     = 0.85;
    }
  }, [visible, reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [
      { translateX: imageX.value },
      { translateY: imageFloat.value * -7 },
      { rotate: `${imageRotate.value}deg` },
    ],
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

  const dayWord = missedDays === 1 ? "day" : "days";

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
                source={require("../../routine-poses/awkaward-pose.png")}
                style={styles.poseImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Title */}
            <Animated.Text style={[styles.title, titleStyle]}>
              Oh hey, stranger.
            </Animated.Text>

            {/* Body */}
            <Animated.Text style={[styles.body, bodyStyle]}>
              {missedDays} {dayWord} gone. Time to fix that.
            </Animated.Text>

            {/* CTA */}
            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <LimeButton label="Let's go" onPress={onClose} />
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
