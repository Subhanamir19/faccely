// components/ui/DidYouKnowModal.tsx
// Shown randomly, at most once every 2 days, with a fitness/looksmaxxing fact.
// Entrance: card fades in • image floats down from above • label pulses • fact box reveals • float loop

import React, { useEffect } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
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
import { Lightbulb, X } from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";

const { width: SW } = Dimensions.get("window");
const CARD_W = Math.min(SW - SP[4] * 2, 380);

type Props = {
  visible: boolean;
  fact: string;
  onClose: () => void;
};

export default function DidYouKnowModal({ visible, fact, onClose }: Props) {
  const reducedMotion = useReducedMotion();

  // ── Card ──────────────────────────────────────────────────────────────────
  const cardOpacity = useSharedValue(0);
  const cardScale   = useSharedValue(0.88);

  // ── Image: floats down from above ─────────────────────────────────────────
  const imageY       = useSharedValue(-28);
  const imageOpacity = useSharedValue(0);
  const imageFloat   = useSharedValue(0);

  // ── Label ─────────────────────────────────────────────────────────────────
  const labelOpacity = useSharedValue(0);
  const labelScale   = useSharedValue(0.88);

  // ── Fact box ──────────────────────────────────────────────────────────────
  const factOpacity = useSharedValue(0);
  const factY       = useSharedValue(10);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        cardOpacity.value  = withTiming(1, { duration: 200 });
        cardScale.value    = 1;
        imageOpacity.value = withDelay(80,  withTiming(1, { duration: 200 }));
        imageY.value       = 0;
        labelOpacity.value = withDelay(160, withTiming(1, { duration: 180 }));
        labelScale.value   = 1;
        factOpacity.value  = withDelay(220, withTiming(1, { duration: 180 }));
        factY.value        = 0;
        btnOpacity.value   = withDelay(280, withTiming(1, { duration: 180 }));
      } else {
        // Card
        cardOpacity.value = withTiming(1, { duration: 250 });
        cardScale.value   = withTiming(1, {
          duration: 340,
          easing: Easing.out(Easing.back(1.05)),
        });

        // Image drops from above with spring
        imageOpacity.value = withDelay(80, withTiming(1, { duration: 260 }));
        imageY.value       = withDelay(80, withSpring(0, { damping: 13, stiffness: 150 }));
        // Float loop after entrance
        imageFloat.value   = withDelay(600, withRepeat(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ));

        // Label pops in with a little scale pulse
        labelOpacity.value = withDelay(240, withTiming(1, { duration: 200 }));
        labelScale.value   = withDelay(240, withSequence(
          withSpring(1.08, { damping: 8, stiffness: 220 }),
          withSpring(1.0,  { damping: 12, stiffness: 200 }),
        ));

        // Fact box fades + rises up
        factOpacity.value = withDelay(360, withTiming(1, { duration: 280 }));
        factY.value       = withDelay(360, withSpring(0, { damping: 16, stiffness: 190 }));

        btnOpacity.value  = withDelay(520, withTiming(1, { duration: 220 }));
      }
    } else {
      cancelAnimation(imageFloat);
      cardOpacity.value  = 0;
      cardScale.value    = 0.88;
      imageY.value       = -28;
      imageOpacity.value = 0;
      imageFloat.value   = 0;
      labelOpacity.value = 0;
      labelScale.value   = 0.88;
      factOpacity.value  = 0;
      factY.value        = 10;
      btnOpacity.value   = 0;
    }
  }, [visible, reducedMotion]);

  const cardStyle  = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageY.value + imageFloat.value * -6 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  const factStyle  = useAnimatedStyle(() => ({
    opacity: factOpacity.value,
    transform: [{ translateY: factY.value }],
  }));

  const btnStyle   = useAnimatedStyle(() => ({ opacity: btnOpacity.value }));

  if (!visible) return null;

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
                source={require("../../routine-poses/did-u-know.png")}
                style={styles.poseImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Label */}
            <Animated.View style={[styles.labelRow, labelStyle]}>
              <Lightbulb size={14} color={COLORS.accent} />
              <Text style={styles.label}>Did You Know?</Text>
            </Animated.View>

            {/* Fact box */}
            <Animated.View style={[styles.factBox, factStyle]}>
              <Text style={styles.factText}>{fact}</Text>
            </Animated.View>

            {/* Dismiss */}
            <Animated.View style={btnStyle}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissBtnPressed]}
              >
                <Text style={styles.dismissText}>Got it</Text>
              </Pressable>
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
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP[4],
  },
  poseImage: {
    width: "100%",
    height: "100%",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  label: {
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.accent,
    letterSpacing: 0.4,
  },
  factBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
  },
  factText: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: COLORS.dim,
    lineHeight: 22,
    textAlign: "center",
  },
  dismissBtn: {
    paddingVertical: SP[2],
    paddingHorizontal: SP[5],
  },
  dismissBtnPressed: {
    opacity: 0.5,
  },
  dismissText: {
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.sub,
  },
});
