// app/program/timer/[exerciseId].tsx
// Full-screen exercise timer.
// Flow: icon + name → countdown ring → Mark Done → next exercise prompt → auto-advance

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { getExerciseIcon } from "@/lib/exerciseIcons";
import { getExerciseDuration } from "@/lib/exerciseDurations";
import { useTasksStore } from "@/store/tasks";

// ---------------------------------------------------------------------------
// Ring timer constants
// ---------------------------------------------------------------------------

const RING_SIZE     = 220;
const STROKE_W      = 12;
const RADIUS        = (RING_SIZE - STROKE_W) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ---------------------------------------------------------------------------
// Ring component
// ---------------------------------------------------------------------------

function TimerRing({
  progress,
  timeLeft,
}: {
  progress: number;
  timeLeft: number;
}) {
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const mins    = Math.floor(timeLeft / 60);
  const secs    = timeLeft % 60;
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}`;

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE_W} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          stroke={COLORS.accent} strokeWidth={STROKE_W} fill="none"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringTime}>{display}</Text>
        <Text style={styles.ringLabel}>{mins > 0 ? "min" : "sec"}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TimerScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { today, completeTask } = useTasksStore();

  const duration = getExerciseDuration(exerciseId ?? "");
  const icon     = getExerciseIcon(exerciseId ?? "");
  const task     = today?.tasks.find((t) => t.exerciseId === exerciseId);
  const name     = task?.name ?? exerciseId ?? "";

  const [timeLeft,  setTimeLeft]  = useState(duration);
  const [isPaused,  setIsPaused]  = useState(false);
  const [isDone,    setIsDone]    = useState(false);

  // Modal states
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showNextPrompt,   setShowNextPrompt]   = useState(false);
  const [nextTask, setNextTask] = useState<{ exerciseId: string; name: string } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Pause/resume on focus
  // ---------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      setIsPaused(false);
      return () => {
        setIsPaused(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, []),
  );

  // ---------------------------------------------------------------------------
  // Android hardware back — intercept while timer is running
  // ---------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!isDone) {
          setIsPaused(true);
          setShowLeaveWarning(true);
          return true; // consume the event
        }
        return false;
      });
      return () => sub.remove();
    }, [isDone]),
  );

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isPaused || isDone) return;
    if (timeLeft <= 0) {
      setIsDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          setIsDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, isDone]);

  // ---------------------------------------------------------------------------
  // Back button press (UI — iOS + Android)
  // ---------------------------------------------------------------------------
  const handleBackPress = useCallback(() => {
    if (!isDone) {
      setIsPaused(true);
      setShowLeaveWarning(true);
    } else {
      router.back();
    }
  }, [isDone]);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveWarning(false);
    router.back();
  }, []);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveWarning(false);
    setIsPaused(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Mark Done → show next exercise prompt
  // ---------------------------------------------------------------------------
  const handleMarkDone = useCallback(() => {
    if (!exerciseId || !today) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    completeTask(exerciseId);

    const next = today.tasks.find(
      (t) => t.exerciseId !== exerciseId && t.status === "pending",
    );

    if (next) {
      setNextTask({ exerciseId: next.exerciseId, name: next.name });
      setShowNextPrompt(true);
    } else {
      router.back();
    }
  }, [exerciseId, today, completeTask]);

  const handleStartNext = useCallback(() => {
    if (!nextTask) return;
    setShowNextPrompt(false);
    router.replace({
      pathname: "/program/timer/[exerciseId]",
      params: { exerciseId: nextTask.exerciseId },
    });
  }, [nextTask]);

  const handleSkipNext = useCallback(() => {
    setShowNextPrompt(false);
    router.back();
  }, []);

  // ---------------------------------------------------------------------------
  // How to Perform
  // ---------------------------------------------------------------------------
  const handleHowToPerform = useCallback(() => {
    router.push({
      pathname: "/program/video/[exerciseId]",
      params: { exerciseId: exerciseId ?? "" },
    });
  }, [exerciseId]);

  const progress  = duration > 0 ? (duration - timeLeft) / duration : 0;
  const btnScale  = useSharedValue(1);
  const btnStyle  = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const handleBtnIn  = () => { if (isDone) btnScale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); };
  const handleBtnOut = () => { btnScale.value = withSpring(1, { damping: 12, stiffness: 200 }); };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Back button ── */}
      <Pressable onPress={handleBackPress} style={styles.backBtn} accessibilityLabel="Go back">
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      {/* ── Exercise icon + name ── */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <View style={styles.exerciseIconWrap}>
          <Image source={icon} style={styles.exerciseIcon} />
        </View>
        <Text style={styles.exerciseName}>{name}</Text>
        <Text style={styles.exerciseTargets}>
          {task?.targets.map((t) => (t === "all" ? "full face" : t)).join(" · ") ?? ""}
        </Text>
      </Animated.View>

      {/* ── Ring timer ── */}
      <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.ringSection}>
        <TimerRing progress={progress} timeLeft={timeLeft} />
        {isDone && (
          <Animated.Text entering={FadeInUp.duration(300)} style={styles.doneLabel}>
            Time's up!
          </Animated.Text>
        )}
      </Animated.View>

      {/* ── Bottom actions ── */}
      <Animated.View entering={FadeInUp.duration(350).delay(150)} style={styles.actions}>

        {/* How to Perform */}
        <View style={styles.howBtnDepth}>
          <Pressable
            onPress={handleHowToPerform}
            style={({ pressed }) => [styles.howBtn, { transform: [{ translateY: pressed ? 3 : 0 }] }]}
          >
            <Text style={styles.howBtnText}>▶  How to Perform</Text>
          </Pressable>
        </View>

        {/* Mark Done / countdown */}
        <Animated.View style={[btnStyle, { width: "100%" }]}>
          {isDone ? (
            <View style={styles.doneBtnDepth}>
              <Pressable
                onPress={handleMarkDone}
                onPressIn={handleBtnIn}
                onPressOut={handleBtnOut}
                style={({ pressed }) => [styles.doneBtnPressable, { transform: [{ translateY: pressed ? 5 : 0 }] }]}
              >
                <LinearGradient
                  colors={["#CCFF6B", "#B4F34D"]} locations={[0, 1]}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={styles.doneBtnGradient}
                >
                  <Text style={styles.doneBtnText}>Mark Done</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <View style={styles.doneBtnDisabled}>
              <Text style={styles.doneBtnTextDisabled}>{timeLeft}s remaining…</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      {/* ── Leave warning modal ── */}
      <Modal transparent visible={showLeaveWarning} animationType="fade" statusBarTranslucent onRequestClose={handleLeaveCancel}>
        <Pressable style={styles.modalBackdrop} onPress={handleLeaveCancel}>
          <Animated.View entering={FadeInUp.duration(220).springify()} style={styles.modalCard}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <Text style={styles.modalEmoji}>⏱️</Text>
              <Text style={styles.modalTitle}>You're mid-exercise</Text>
              <Text style={styles.modalBody}>
                Your timer is still running. Leaving now will not count this exercise as done.
              </Text>
              <View style={styles.modalBtns}>
                <View style={styles.modalBtnDepth}>
                  <Pressable
                    onPress={handleLeaveCancel}
                    style={({ pressed }) => [styles.modalBtnPressable, { transform: [{ translateY: pressed ? 5 : 0 }] }]}
                  >
                    <LinearGradient
                      colors={["#CCFF6B", "#B4F34D"]} locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                      style={styles.modalBtnGradient}
                    >
                      <Text style={styles.modalBtnPrimaryText}>Keep Going</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                <Pressable style={styles.modalBtnGhost} onPress={handleLeaveConfirm}>
                  <Text style={styles.modalBtnGhostText}>Leave</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Next exercise prompt modal ── */}
      <Modal transparent visible={showNextPrompt} animationType="fade" statusBarTranslucent onRequestClose={handleSkipNext}>
        <Pressable style={styles.modalBackdrop} onPress={() => {}}>
          <Animated.View entering={FadeInUp.duration(220).springify()} style={styles.modalCard}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <Text style={styles.modalEmoji}>✅</Text>
              <Text style={styles.modalTitle}>Exercise done!</Text>
              <Text style={styles.modalNextLabel}>NEXT UP</Text>
              <Text style={styles.modalNextName}>{nextTask?.name ?? ""}</Text>
              <View style={styles.modalBtns}>
                <View style={styles.modalBtnDepth}>
                  <Pressable
                    onPress={handleStartNext}
                    style={({ pressed }) => [styles.modalBtnPressable, { transform: [{ translateY: pressed ? 5 : 0 }] }]}
                  >
                    <LinearGradient
                      colors={["#CCFF6B", "#B4F34D"]} locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                      style={styles.modalBtnGradient}
                    >
                      <Text style={styles.modalBtnPrimaryText}>Start Next</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                <Pressable style={styles.modalBtnGhost} onPress={handleSkipNext}>
                  <Text style={styles.modalBtnGhostText}>Later</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
    alignItems: "center",
    paddingHorizontal: SP[4],
  },

  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: SP[3],
    paddingRight: SP[4],
  },
  backIcon: {
    color: COLORS.text,
    fontSize: 32,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 36,
  },

  // Header
  header: {
    alignItems: "center",
    gap: SP[2],
    marginTop: SP[4],
    marginBottom: SP[5],
  },
  exerciseIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  exerciseIcon: { width: 80, height: 80, resizeMode: "cover" },
  exerciseName: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginTop: SP[2],
  },
  exerciseTargets: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textTransform: "capitalize",
    textAlign: "center",
  },

  // Ring
  ringSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[4],
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { position: "absolute" },
  ringCenter: { alignItems: "center", justifyContent: "center" },
  ringTime: {
    color: COLORS.text,
    fontSize: 56,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 60,
  },
  ringLabel: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    marginTop: 2,
  },
  doneLabel: {
    color: COLORS.accent,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
  },

  // Actions
  actions: {
    width: "100%",
    gap: SP[3],
    paddingBottom: SP[5],
  },
  howBtnDepth: {
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingBottom: 3,
  },
  howBtn: {
    height: 48,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  howBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  doneBtnDepth: {
    width: "100%",
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  doneBtnPressable: {
    height: 56,
    borderRadius: RADII.pill,
    overflow: "hidden",
  },
  doneBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
  },
  doneBtnDisabled: {
    height: 56,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  doneBtnText: {
    color: "#0B0B0B",
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
  },
  doneBtnTextDisabled: {
    color: COLORS.sub,
    fontSize: 17,
    fontFamily: "Poppins-SemiBold",
  },

  // Modals (shared)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: SP[4],
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SP[5],
    alignItems: "center",
  },
  modalEmoji: {
    fontSize: 32,
    textAlign: "center",
    marginBottom: SP[2],
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: SP[2],
  },
  modalBody: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SP[5],
  },
  modalNextLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: SP[1],
  },
  modalNextName: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginBottom: SP[5],
  },
  modalBtns: {
    width: "100%",
    gap: SP[2],
  },
  modalBtnDepth: {
    width: "100%",
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalBtnPressable: {
    height: 52,
    borderRadius: RADII.pill,
    overflow: "hidden",
  },
  modalBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
  },
  modalBtnPrimaryText: {
    color: "#0B0B0B",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  modalBtnGhost: {
    height: 48,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnGhostText: {
    color: COLORS.sub,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
});
