import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Modal,
  Pressable,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withRepeat,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { COLORS, RADII, SP } from "@/lib/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Video sizing
const VIDEO_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);
const VIDEO_HEIGHT = VIDEO_WIDTH * 0.75; // 4:3 aspect ratio, adjust if needed

// Motivational messages - rotates based on day number
const COMPLETION_MESSAGES = [
  { primary: "You did a great job today!", secondary: "Keep the momentum going!" },
  { primary: "Another day conquered!", secondary: "Your consistency is inspiring." },
  { primary: "You're on fire!", secondary: "Tomorrow awaits your greatness." },
  { primary: "Day complete!", secondary: "Small steps lead to big changes." },
  { primary: "Incredible dedication!", secondary: "You're building a better you." },
  { primary: "Workout crushed!", secondary: "Rest well, champion." },
];

const VIDEO_SOURCE = require("@/assets/tasks-complete.mp4");

type DayCompleteModalProps = {
  visible: boolean;
  dayNumber: number;
  streak?: number;
  onClose: () => void;
  autoDismissMs?: number;
  dismissOnBackdropPress?: boolean;
  particles?: boolean;
};

function Particle({
  size,
  left,
  top,
  delayMs,
  durationMs,
  maxRise,
  color,
}: {
  size: number;
  left: number;
  top: number;
  delayMs: number;
  durationMs: number;
  maxRise: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
  }, [delayMs, durationMs]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const y = -maxRise * p;
    const opacity = 0.05 + 0.35 * (1 - Math.abs(p - 0.5) * 2);
    const scale = 0.85 + 0.35 * p;
    return {
      opacity,
      transform: [{ translateY: y }, { scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left,
          top,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// Typewriter text component
function TypewriterText({
  text,
  style,
  delay = 0,
  speed = 30,
  onComplete,
}: {
  text: string;
  style?: any;
  delay?: number;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setStarted(false);

    const startTimeout = setTimeout(() => {
      setStarted(true);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  useEffect(() => {
    if (!started) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [started, text, speed, onComplete]);

  return <Text style={style}>{displayedText}</Text>;
}

const DayCompleteModal: React.FC<DayCompleteModalProps> = ({
  visible,
  dayNumber,
  streak,
  onClose,
  autoDismissMs = 0,
  dismissOnBackdropPress = false,
  particles = true,
}) => {
  // Get message based on day number (cycles through messages)
  const messageIndex = (dayNumber - 1) % COMPLETION_MESSAGES.length;
  const message = COMPLETION_MESSAGES[messageIndex];

  // Animation values
  const modalScale = useSharedValue(0.9);
  const modalOpacity = useSharedValue(0);
  const videoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  const [showPrimaryText, setShowPrimaryText] = useState(false);
  const [showSecondaryText, setShowSecondaryText] = useState(false);

  useEffect(() => {
    let startTextTimeout: ReturnType<typeof setTimeout> | undefined;
    let autoDismissTimeout: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      // Reset states
      setShowPrimaryText(false);
      setShowSecondaryText(false);

      // Animate modal entrance
      modalOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.1)),
      });

      // Fade in video
      videoOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

      // Show title after video appears
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));

      // Start typewriter after title
      startTextTimeout = setTimeout(() => setShowPrimaryText(true), 750);

      // Button appears last
      buttonOpacity.value = withDelay(2200, withTiming(1, { duration: 300 }));

      if (autoDismissMs > 0) {
        autoDismissTimeout = setTimeout(() => onClose(), autoDismissMs);
      }
    } else {
      modalOpacity.value = 0;
      modalScale.value = 0.9;
      videoOpacity.value = 0;
      titleOpacity.value = 0;
      buttonOpacity.value = 0;
      setShowPrimaryText(false);
      setShowSecondaryText(false);
    }

    return () => {
      if (startTextTimeout) clearTimeout(startTextTimeout);
      if (autoDismissTimeout) clearTimeout(autoDismissTimeout);
    };
  }, [visible, autoDismissMs, onClose]);

  const handlePrimaryComplete = useCallback(() => {
    setShowSecondaryText(true);
  }, []);

  const modalContainerStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  const videoStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdropPress ? onClose : undefined}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable onPress={() => undefined}>
          <Animated.View style={[styles.modalContainer, modalContainerStyle]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.closeButton, pressed ? styles.closeButtonPressed : null]}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>

          {/* Video container with glow */}
          <Animated.View style={[styles.videoWrapper, videoStyle]}>
            {particles ? (
              <View pointerEvents="none" style={styles.particlesLayer}>
                <Particle
                  size={6}
                  left={20}
                  top={VIDEO_HEIGHT * 0.7}
                  delayMs={0}
                  durationMs={2200}
                  maxRise={50}
                  color="rgba(180,243,77,0.9)"
                />
                <Particle
                  size={4}
                  left={VIDEO_WIDTH * 0.25}
                  top={VIDEO_HEIGHT * 0.8}
                  delayMs={250}
                  durationMs={2400}
                  maxRise={55}
                  color="rgba(180,243,77,0.7)"
                />
                <Particle
                  size={5}
                  left={VIDEO_WIDTH * 0.55}
                  top={VIDEO_HEIGHT * 0.78}
                  delayMs={500}
                  durationMs={2600}
                  maxRise={60}
                  color="rgba(180,243,77,0.85)"
                />
                <Particle
                  size={3}
                  left={VIDEO_WIDTH * 0.82}
                  top={VIDEO_HEIGHT * 0.72}
                  delayMs={700}
                  durationMs={2300}
                  maxRise={48}
                  color="rgba(180,243,77,0.65)"
                />
                <Particle
                  size={7}
                  left={VIDEO_WIDTH * 0.12}
                  top={VIDEO_HEIGHT * 0.6}
                  delayMs={900}
                  durationMs={2800}
                  maxRise={70}
                  color="rgba(180,243,77,0.55)"
                />
                <Particle
                  size={4}
                  left={VIDEO_WIDTH * 0.7}
                  top={VIDEO_HEIGHT * 0.66}
                  delayMs={1200}
                  durationMs={2500}
                  maxRise={58}
                  color="rgba(180,243,77,0.6)"
                />
              </View>
            ) : null}
            <View style={styles.videoGlow} />
            <View style={styles.videoContainer}>
              <Video
                source={VIDEO_SOURCE}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted
                shouldPlay={visible}
              />
            </View>
          </Animated.View>

          {/* Day complete title */}
          <Animated.View style={[styles.titleContainer, titleStyle]}>
            <Text style={styles.titleText}>All Tasks Complete!</Text>
            {streak != null && streak > 1 ? (
              <Text style={styles.streakText}>🔥 {streak} day streak!</Text>
            ) : null}
          </Animated.View>

          {/* Typewriter motivational text */}
          <View style={styles.messageContainer}>
            {showPrimaryText && (
              <TypewriterText
                text={message.primary}
                style={styles.primaryText}
                speed={22}
                onComplete={handlePrimaryComplete}
              />
            )}
            {showSecondaryText && (
              <TypewriterText
                text={message.secondary}
                style={styles.secondaryText}
                delay={120}
                speed={18}
              />
            )}
          </View>

          {/* Continue button */}
          <Animated.View style={[styles.buttonContainer, buttonStyle]}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.continueButtonPressed,
              ]}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default DayCompleteModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH - SP[4] * 2,
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[4],
    alignItems: "center",
    gap: SP[4],
  },
  closeButton: {
    position: "absolute",
    top: SP[3],
    right: SP[3],
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 18,
  },
  videoWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  particlesLayer: {
    position: "absolute",
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    zIndex: 0,
  },
  particle: {
    position: "absolute",
  },
  videoGlow: {
    position: "absolute",
    width: VIDEO_WIDTH + 40,
    height: VIDEO_HEIGHT + 40,
    borderRadius: RADII.lg + 10,
    backgroundColor: COLORS.accent,
    opacity: 0.15,
    // Blur effect for glow
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  videoContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.3)",
  },
  video: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
  },
  titleContainer: {
    alignItems: "center",
    gap: 2,
  },
  titleText: {
    fontSize: 28,
    color: COLORS.accent,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
  },
  streakText: {
    fontSize: 18,
    color: "#FFAA32",
    fontFamily: "Poppins-SemiBold",
    marginTop: 4,
  },
  messageContainer: {
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[2],
  },
  primaryText: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    lineHeight: 26,
  },
  secondaryText: {
    fontSize: 15,
    color: COLORS.sub,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginTop: SP[1],
  },
  buttonContainer: {
    width: "100%",
    paddingTop: SP[2],
  },
  continueButton: {
    width: "100%",
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  continueButtonText: {
    fontSize: 16,
    color: "#0B0B0B",
    fontFamily: "Poppins-SemiBold",
    fontWeight: "700",
  },
});
