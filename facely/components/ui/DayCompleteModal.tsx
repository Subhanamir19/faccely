import React, { useEffect } from "react";
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
import { COLORS, RADII, SP, TYPE } from "@/lib/tokens";
import Button from "@/components/ui/Button";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Video sizing
const VIDEO_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);
const VIDEO_HEIGHT = VIDEO_WIDTH * 0.75; // 4:3 aspect ratio, adjust if needed

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


const DayCompleteModal: React.FC<DayCompleteModalProps> = ({
  visible,
  dayNumber,
  streak,
  onClose,
  autoDismissMs = 0,
  dismissOnBackdropPress = false,
  particles = true,
}) => {
  const modalScale = useSharedValue(0.9);
  const modalOpacity = useSharedValue(0);
  const videoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    let autoDismissTimeout: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      modalOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.1)),
      });
      videoOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
      buttonOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));

      if (autoDismissMs > 0) {
        autoDismissTimeout = setTimeout(() => onClose(), autoDismissMs);
      }
    } else {
      modalOpacity.value = 0;
      modalScale.value = 0.9;
      videoOpacity.value = 0;
      titleOpacity.value = 0;
      buttonOpacity.value = 0;
    }

    return () => {
      if (autoDismissTimeout) clearTimeout(autoDismissTimeout);
    };
  }, [visible, autoDismissMs, onClose]);

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
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {streak ?? 0} day streak</Text>
            </View>
          </Animated.View>

          {/* Continue button */}
          <Animated.View style={[styles.buttonContainer, buttonStyle]}>
            <Button label="Continue" onPress={onClose} variant="primary" size="md" />
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
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[6],
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
  videoContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: "#050505",
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
    ...TYPE.h2,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  streakBadge: {
    marginTop: SP[1],
    paddingHorizontal: SP[4],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    backgroundColor: "rgba(255,170,50,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,170,50,0.30)",
  },
  streakText: {
    ...TYPE.captionSemiBold,
    color: "#FFAA32",
  },
  buttonContainer: {
    width: "100%",
    paddingTop: SP[2],
  },
});
