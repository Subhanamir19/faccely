// app/program/timer/[exerciseId].tsx
// Full-screen exercise timer.
// Flow: icon + name → countdown ring → Mark Done → next exercise prompt → auto-advance

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
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
import { getExerciseVideo } from "@/lib/exerciseVideos";
import { getExerciseDetail } from "@/lib/exerciseDetails";
import { useTasksStore } from "@/store/tasks";

// ---------------------------------------------------------------------------
// Ring timer constants
// ---------------------------------------------------------------------------

const STROKE_W = 14;

// ---------------------------------------------------------------------------
// Ring component
// ---------------------------------------------------------------------------

function TimerRing({
  progress,
  timeLeft,
  size,
}: {
  progress: number;
  timeLeft: number;
  size: number;
}) {
  const radius        = (size - STROKE_W) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const mins    = Math.floor(timeLeft / 60);
  const secs    = timeLeft % 60;
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}`;
  const timeFontSize = Math.max(48, Math.round(size * 0.3));

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE_W} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={COLORS.accent} strokeWidth={STROKE_W} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringTime, { fontSize: timeFontSize, lineHeight: timeFontSize + 4 }]}>{display}</Text>
        <Text style={styles.ringLabel}>{mins > 0 ? "min" : "sec"}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TimerScreen() {
  const { height } = useWindowDimensions();
  // Scale video and ring proportionally; cap at original design sizes on large screens
  const videoHeight = Math.min(Math.round(height * 0.31), 260);
  const ringSize    = Math.min(Math.round(height * 0.28), 240);

  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { today, completeTask } = useTasksStore();

  const duration = getExerciseDuration(exerciseId ?? "");
  const icon     = getExerciseIcon(exerciseId ?? "");
  const videoSrc = getExerciseVideo(exerciseId ?? "");
  const detail   = getExerciseDetail(exerciseId ?? "");
  const task     = today?.tasks.find((t) => t.exerciseId === exerciseId);
  const name     = task?.name ?? exerciseId ?? "";

  const [timeLeft,  setTimeLeft]  = useState(duration);
  const [isPaused,  setIsPaused]  = useState(false);
  const [isDone,    setIsDone]    = useState(false);

  // Modal states
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showNextPrompt,   setShowNextPrompt]   = useState(false);
  const [showHowTo,        setShowHowTo]        = useState(false);
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
  // How to Perform — bottom sheet
  // ---------------------------------------------------------------------------
  const handleHowToPerform = useCallback(() => {
    setIsPaused(true);
    setShowHowTo(true);
  }, []);

  const handleCloseHowTo = useCallback(() => {
    setShowHowTo(false);
    if (!isDone) setIsPaused(false);
  }, [isDone]);

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

      {/* ── Video + name overlay ── */}
      <Animated.View entering={FadeInDown.duration(350)} style={[styles.videoSection, { height: videoHeight }]}>
        {videoSrc ? (
          <Video
            source={videoSrc}
            style={styles.videoPlayer}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted
          />
        ) : (
          <View style={styles.videoFallback}>
            <Image source={icon} style={styles.videoFallbackIcon} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.88)"]}
          style={styles.videoOverlay}
        >
          <Text style={styles.exerciseName}>{name}</Text>
          <Text style={styles.exerciseTargets}>
            {task?.targets.map((t) => (t === "all" ? "full face" : t)).join(" · ") ?? ""}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* ── Ring timer ── */}
      <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.ringSection}>
        <TimerRing progress={progress} timeLeft={timeLeft} size={ringSize} />
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
                <View style={styles.doneBtnGradient}>
                  <Text style={styles.doneBtnText}>Mark Done</Text>
                </View>
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

      {/* ── How to Perform bottom sheet ── */}
      <Modal
        transparent
        visible={showHowTo}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseHowTo}
      >
        <Pressable style={styles.howToBackdrop} onPress={handleCloseHowTo}>
          <View style={styles.howToSheet}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <View style={styles.howToHandle} />
              <View style={styles.howToHeader}>
                <Text style={styles.howToTitle}>How to Perform</Text>
                <Pressable onPress={handleCloseHowTo} style={styles.howToClose}>
                  <Text style={styles.howToCloseText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.howToScroll}>
                {detail ? (
                  <>
                    {/* Benefits */}
                    <Text style={styles.howToSectionLabel}>BENEFITS</Text>
                    <View style={styles.benefitBox}>
                      <Text style={styles.benefitText}>{detail.benefits}</Text>
                    </View>

                    {/* Steps */}
                    <Text style={[styles.howToSectionLabel, { marginTop: SP[5] }]}>HOW TO DO IT</Text>
                    {detail.steps.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}

                    {/* Reps */}
                    <Text style={[styles.howToSectionLabel, { marginTop: SP[5] }]}>REPS / DURATION</Text>
                    <Text style={styles.repsText}>{detail.reps}</Text>

                    {/* Pro Tip */}
                    <Text style={[styles.howToSectionLabel, { marginTop: SP[5] }]}>PRO TIP</Text>
                    <View style={styles.tipBox}>
                      <Text style={styles.tipText}>{detail.tip}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.repsText}>No details available.</Text>
                )}
              </ScrollView>
            </Pressable>
          </View>
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

  // Video section — height is set inline via useWindowDimensions
  videoSection: {
    width: "100%",
    borderRadius: RADII.xl,
    overflow: "hidden",
    marginTop: SP[2],
    marginBottom: SP[3],
    backgroundColor: COLORS.bgBottom,
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  videoFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  videoFallbackIcon: {
    width: 110,
    height: 110,
    resizeMode: "cover",
    borderRadius: 20,
  },
  videoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingTop: SP[8],
    paddingBottom: SP[3],
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: "Poppins-SemiBold",
  },
  exerciseTargets: {
    color: COLORS.sub,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    textTransform: "capitalize",
    marginTop: 2,
  },

  // Ring
  ringSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[4],
  },
  // ringWrap width/height set inline via ringSize prop
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: { position: "absolute" },
  ringCenter: { alignItems: "center", justifyContent: "center" },
  // fontSize/lineHeight set inline in TimerRing via ringSize
  ringTime: {
    color: COLORS.text,
    fontFamily: "Poppins-SemiBold",
  },
  ringLabel: {
    color: COLORS.sub,
    fontSize: 16,
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
    backgroundColor: "#6B9A1E",
    paddingBottom: 4,
  },
  howBtn: {
    height: 56,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  howBtnText: {
    color: "#0B0B0B",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  doneBtnDepth: {
    width: "100%",
    borderRadius: RADII.pill,
    backgroundColor: "#999999",
    paddingBottom: 5,
    shadowColor: "#ffffff",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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
    backgroundColor: "#FFFFFF",
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
    color: "#111111",
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

  // How To Perform bottom sheet
  howToBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "flex-end",
  },
  howToSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.cardBorder,
    maxHeight: "78%",
    paddingHorizontal: SP[5],
    paddingBottom: SP[6],
  },
  howToHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginTop: SP[3],
    marginBottom: SP[2],
  },
  howToHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SP[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    marginBottom: SP[4],
  },
  howToTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
  },
  howToClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  howToCloseText: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
  howToScroll: {
    paddingBottom: SP[4],
  },
  howToSectionLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1.2,
    marginBottom: SP[2],
  },
  benefitBox: {
    backgroundColor: "rgba(180,243,77,0.08)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.20)",
    padding: SP[4],
  },
  benefitText: {
    color: COLORS.textHigh,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[3],
    marginBottom: SP[3],
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    color: "#0B0B0B",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  stepText: {
    flex: 1,
    color: COLORS.textHigh,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
  repsText: {
    color: COLORS.textHigh,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    padding: SP[4],
  },
  tipText: {
    color: COLORS.textHigh,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },
});
