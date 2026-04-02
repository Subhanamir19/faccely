// components/ui/StreakCelebrationModal.tsx
// Shown on day 3 and day 7 streak milestones.
// Entrance: explosive spring pop • particles • image bounces up • badge pops • border pulses

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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Flame, X } from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import LimeButton from "./LimeButton";

const { width: SW } = Dimensions.get("window");
const CARD_W = Math.min(SW - SP[4] * 2, 380);
const IMG_W  = CARD_W - SP[5] * 2;

// ─── Particle ──────────────────────────────────────────────────────────────

function Particle({
  size, left, top, delayMs, durationMs, maxRise, color,
}: {
  size: number; left: number; top: number;
  delayMs: number; durationMs: number; maxRise: number; color: string;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const p   = progress.value;
    const y   = -maxRise * p;
    const op  = 0.08 + 0.55 * (1 - Math.abs(p - 0.5) * 2);
    const sc  = 0.7 + 0.5 * p;
    return { opacity: op, transform: [{ translateY: y }, { scale: sc }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { width: size, height: size, borderRadius: size / 2, left, top, backgroundColor: color },
        style,
      ]}
    />
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

const MILESTONE_COPY: Record<number, { headline: string; tagline: string }> = {
  3: {
    headline: "3 Day Streak!",
    tagline: "The habit is forming.",
  },
  7: {
    headline: "7 Day Streak!",
    tagline: "One full week. You're locked in.",
  },
};

type Props = {
  visible: boolean;
  streakDays: number;
  onClose: () => void;
};

export default function StreakCelebrationModal({ visible, streakDays, onClose }: Props) {
  const reducedMotion = useReducedMotion();

  // ── Card ────────────────────────────────────────────────────────────────
  const cardOpacity = useSharedValue(0);
  const cardScale   = useSharedValue(0.72);
  const borderGlow  = useSharedValue(0);

  // ── Image ───────────────────────────────────────────────────────────────
  const imageY       = useSharedValue(40);
  const imageOpacity = useSharedValue(0);
  const imageFloat   = useSharedValue(0);

  // ── Badge ───────────────────────────────────────────────────────────────
  const badgeScale   = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);

  // ── Text / button ────────────────────────────────────────────────────────
  const titleOpacity = useSharedValue(0);
  const titleY       = useSharedValue(12);
  const bodyOpacity  = useSharedValue(0);
  const btnOpacity   = useSharedValue(0);
  const btnScale     = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        // Simple fades — no spring, no float, no particles
        cardOpacity.value  = withTiming(1, { duration: 200 });
        cardScale.value    = 1;
        imageOpacity.value = withDelay(80,  withTiming(1, { duration: 200 }));
        imageY.value       = 0;
        badgeOpacity.value = withDelay(160, withTiming(1, { duration: 180 }));
        badgeScale.value   = 1;
        titleOpacity.value = withDelay(220, withTiming(1, { duration: 180 }));
        titleY.value       = 0;
        bodyOpacity.value  = withDelay(280, withTiming(1, { duration: 180 }));
        btnOpacity.value   = withDelay(320, withTiming(1, { duration: 180 }));
        btnScale.value     = 1;
      } else {
        // Card: explosive spring pop
        cardOpacity.value = withTiming(1, { duration: 220 });
        cardScale.value   = withSpring(1, { damping: 7, stiffness: 120 });

        // Border pulse (starts after entrance)
        borderGlow.value = withDelay(500, withRepeat(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ));

        // Image bounces up
        imageOpacity.value = withDelay(120, withTiming(1, { duration: 220 }));
        imageY.value       = withDelay(120, withSpring(0, { damping: 9, stiffness: 130 }));
        // Float starts after bounce settles
        imageFloat.value   = withDelay(680, withRepeat(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ));

        // Badge pops with big back spring
        badgeOpacity.value = withDelay(300, withTiming(1, { duration: 180 }));
        badgeScale.value   = withDelay(300, withSpring(1, { damping: 6, stiffness: 200 }));

        // Stagger text
        titleOpacity.value = withDelay(380, withTiming(1, { duration: 220 }));
        titleY.value       = withDelay(380, withSpring(0, { damping: 16, stiffness: 200 }));
        bodyOpacity.value  = withDelay(460, withTiming(1, { duration: 220 }));
        btnOpacity.value   = withDelay(540, withTiming(1, { duration: 200 }));
        btnScale.value     = withDelay(540, withSpring(1, { damping: 10, stiffness: 180 }));
      }
    } else {
      cancelAnimation(borderGlow);
      cancelAnimation(imageFloat);
      cardOpacity.value  = 0;
      cardScale.value    = 0.72;
      borderGlow.value   = 0;
      imageY.value       = 40;
      imageOpacity.value = 0;
      imageFloat.value   = 0;
      badgeScale.value   = 0;
      badgeOpacity.value = 0;
      titleOpacity.value = 0;
      titleY.value       = 12;
      bodyOpacity.value  = 0;
      btnOpacity.value   = 0;
      btnScale.value     = 0.8;
    }
  }, [visible, reducedMotion]);

  const cardStyle   = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
    borderColor: `rgba(180,243,77,${0.18 + borderGlow.value * 0.52})`,
  }));

  const imageStyle  = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [
      { translateY: imageY.value + imageFloat.value * -8 },
    ],
  }));

  const badgeStyle  = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const titleStyle  = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const bodyStyle   = useAnimatedStyle(() => ({ opacity: bodyOpacity.value }));
  const btnStyle    = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ scale: btnScale.value }],
  }));

  if (!visible) return null;

  const copy = MILESTONE_COPY[streakDays] ?? {
    headline: `${streakDays} Day Streak!`,
    tagline: "Keep showing up.",
  };

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

            {/* Image + particles layer */}
            <View style={styles.imageContainer}>
              {/* Particles behind the image — skip when reduced motion */}
              {!reducedMotion && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Particle size={6}  left={IMG_W * 0.08} top={160} delayMs={0}    durationMs={2100} maxRise={55} color="rgba(180,243,77,0.85)" />
                  <Particle size={4}  left={IMG_W * 0.25} top={175} delayMs={240}  durationMs={2350} maxRise={60} color="rgba(180,243,77,0.65)" />
                  <Particle size={5}  left={IMG_W * 0.52} top={168} delayMs={500}  durationMs={2500} maxRise={65} color="rgba(180,243,77,0.80)" />
                  <Particle size={3}  left={IMG_W * 0.78} top={172} delayMs={700}  durationMs={2200} maxRise={50} color="rgba(180,243,77,0.60)" />
                  <Particle size={7}  left={IMG_W * 0.14} top={148} delayMs={900}  durationMs={2700} maxRise={72} color="rgba(180,243,77,0.50)" />
                  <Particle size={4}  left={IMG_W * 0.68} top={158} delayMs={1150} durationMs={2400} maxRise={58} color="rgba(180,243,77,0.70)" />
                  <Particle size={5}  left={IMG_W * 0.40} top={155} delayMs={350}  durationMs={2600} maxRise={68} color="rgba(180,243,77,0.55)" />
                </View>
              )}

              <Animated.View style={imageStyle}>
                <Image
                  source={require("../../routine-poses/celeb.png")}
                  style={styles.poseImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>

            {/* Streak badge */}
            <Animated.View style={[styles.streakBadge, badgeStyle]}>
              <Flame size={14} color={COLORS.accent} />
              <Text style={styles.streakBadgeText}>{streakDays} days strong</Text>
            </Animated.View>

            {/* Title */}
            <Animated.Text style={[styles.title, titleStyle]}>
              {copy.headline}
            </Animated.Text>

            {/* Body */}
            <Animated.Text style={[styles.body, bodyStyle]}>
              {copy.tagline}
            </Animated.Text>

            {/* CTA */}
            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <LimeButton label="Keep going" onPress={onClose} />
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
    borderWidth: 1.5,
    borderColor: COLORS.accentBorder,
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
  imageContainer: {
    width: IMG_W,
    height: 230,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP[4],
    overflow: "hidden",
  },
  poseImage: {
    width: IMG_W,
    height: 230,
  },
  particle: {
    position: "absolute",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    paddingHorizontal: SP[5],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(180,243,77,0.12)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  streakBadgeText: {
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
