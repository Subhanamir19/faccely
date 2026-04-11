// app/program/session.tsx
// Continuous session player — plays all pending exercises one by one.
// Flow: exercise (video+ring timer) → rest overlay (3s) → next exercise → ... → session complete

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
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useExerciseSettings } from "@/store/exerciseSettings";
import { getExerciseVideo } from "@/lib/exerciseVideos";
import { getExerciseDetail } from "@/lib/exerciseDetails";
import { useTasksStore, type DailyTask } from "@/store/tasks";
import { EXERCISE_CATALOG } from "@/lib/taskSelection";

// ---------------------------------------------------------------------------
// Exercises that use image pair animation instead of video
// ---------------------------------------------------------------------------

const EXERCISE_IMAGE_PAIRS: Record<string, [any, any]> = {
  "hunter-eyes-1": [
    require("../../aligned_exercises/Hunter eyes 1-Pose1.jpeg"),
    require("../../aligned_exercises/Hunter eyes 1-Pose2.jpeg"),
  ],
  "chin-tucks": [
    require("../../aligned_exercises/Chin tucks-Pose1.jpeg"),
    require("../../aligned_exercises/Chin tucks-Pose2.jpeg"),
  ],
  "lowerface-exercise": [
    require("../../excercise-videos/lowerface-pose1.jpeg"),
    require("../../excercise-videos/lowerface-pose2.jpeg"),
  ],
};

// Content position for image-pair exercises — controls which part of the image
// fills the circular crop. Side-profile images need "left" to show the face.
const EXERCISE_IMAGE_POSITION: Record<string, string> = {
  "chin-tucks":        "left center",
  "lowerface-exercise":"left center",
  "hunter-eyes-1":     "center",
};

// ---------------------------------------------------------------------------
// Exercises that use a single static image with a looping zoom animation
// ---------------------------------------------------------------------------

const EXERCISE_ZOOM_IMAGES: Record<string, any> = {
  "midface-exercise": require("../../excercise-videos/midface-exercise.jpeg"),
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RING_STROKE = 10;
const PREP_SECONDS = 3;

// ---------------------------------------------------------------------------
// Module-level flag — program.tsx reads this on re-focus to show DayComplete
// ---------------------------------------------------------------------------

export let sessionDidCompleteExercises = false;
export function consumeSessionFlag(): boolean {
  const v = sessionDidCompleteExercises;
  sessionDidCompleteExercises = false;
  return v;
}

// ---------------------------------------------------------------------------
// CircleFrame — video inside circular mask with progress ring wrapping it
// ---------------------------------------------------------------------------

function CircleFrame({
  videoSrc,
  imagePair,
  imagePairPosition,
  zoomImage,
  isPaused,
  progress,
  timeLeft,
  size,
  exerciseKey,
  prepCountdown,
}: {
  videoSrc: any;
  imagePair?: [any, any];
  imagePairPosition?: string;
  zoomImage?: any;
  isPaused: boolean;
  progress: number;
  timeLeft: number;
  size: number;
  exerciseKey: string;
  prepCountdown: number;
}) {
  const [poseIndex, setPoseIndex] = useState(0);
  const zoomScale = useSharedValue(1);

  useEffect(() => {
    if (!imagePair || prepCountdown > 0 || isPaused) return;
    const id = setInterval(() => {
      setPoseIndex((i) => (i === 0 ? 1 : 0));
    }, 1500);
    return () => clearInterval(id);
  }, [imagePair, prepCountdown, isPaused, exerciseKey]);

  // Looping zoom in/out for single-image exercises
  useEffect(() => {
    if (!zoomImage || prepCountdown > 0 || isPaused) {
      cancelAnimation(zoomScale);
      zoomScale.value = 1;
      return;
    }
    zoomScale.value = withRepeat(
      withSequence(
        withTiming(1.10, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.00, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [zoomImage, prepCountdown, isPaused, exerciseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  // Reset pose on exercise change
  useEffect(() => {
    setPoseIndex(0);
  }, [exerciseKey]);

  const innerSize = size - RING_STROKE * 2 - 4;
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  // Keep a stable ref to timeLeft so the sweep effect can read it without
  // being a dependency (we don't want to restart the animation every second)
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Single continuous sweep: animates from current position → 1.0 over the
  // exact remaining seconds. Only restarts on pause/unpause, prep end, or
  // new exercise — never on each 1-second tick, so it's perfectly smooth.
  const ringProgress = useSharedValue(0);
  useEffect(() => {
    if (isPaused || prepCountdown > 0) {
      cancelAnimation(ringProgress);
      return;
    }
    ringProgress.value = withTiming(1.0, {
      duration: timeLeftRef.current * 1000,
      easing: Easing.linear,
    });
  }, [isPaused, prepCountdown, exerciseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, ringProgress.value))),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Progress ring */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.accent}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          animatedProps={animatedRingProps}
        />
      </Svg>

      {/* Inner circle: prep countdown or exercise video */}
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: "hidden",
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {prepCountdown > 0 ? (
          // 3-second black countdown inside the circle before exercise starts
          <Animated.Text
            key={prepCountdown}
            entering={ZoomIn.duration(280).springify()}
            style={{
              color: COLORS.accent,
              fontSize: Math.round(innerSize * 0.42),
              fontFamily: "Poppins-SemiBold",
              lineHeight: Math.round(innerSize * 0.50),
            }}
          >
            {prepCountdown}
          </Animated.Text>
        ) : zoomImage ? (
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            <Image
              source={zoomImage}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </Animated.View>
        ) : imagePair ? (
          <ExpoImage
            key={`${exerciseKey}-${poseIndex}`}
            source={imagePair[poseIndex]}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            contentPosition={imagePairPosition ?? "center"}
          />
        ) : videoSrc ? (
          <Video
            key={exerciseKey}
            source={videoSrc}
            style={{ width: "100%", height: "100%" }}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#1C1C1C", width: "100%" }} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// HowTo bottom sheet
// ---------------------------------------------------------------------------

function HowToSheet({
  visible,
  exerciseId,
  onClose,
}: {
  visible: boolean;
  exerciseId: string;
  onClose: () => void;
}) {
  const detail = getExerciseDetail(exerciseId);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.howToBackdrop} onPress={onClose}>
        <View style={styles.howToSheet}>
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <View style={styles.howToHandle} />
            <View style={styles.howToHeader}>
              <Text style={styles.howToTitle}>How to Perform</Text>
              <Pressable onPress={onClose} style={styles.howToCloseBtn}>
                <Text style={styles.howToCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.howToScroll}>
              {detail ? (
                <>
                  <Text style={styles.howToSectionLabel}>BENEFITS</Text>
                  <View style={styles.benefitBox}>
                    <Text style={styles.benefitText}>{detail.benefits}</Text>
                  </View>
                  <Text style={[styles.howToSectionLabel, { marginTop: SP[5] }]}>HOW TO DO IT</Text>
                  {detail.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                  <Text style={[styles.howToSectionLabel, { marginTop: SP[5] }]}>REPS / DURATION</Text>
                  <Text style={styles.repsText}>{detail.reps}</Text>
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
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type Phase = "exercise" | "complete";

export default function SessionScreen() {
  const { width } = useWindowDimensions();
  const circleSize = Math.min(width - SP[6] * 2, 300);

  const { today, completeTask, skipTask } = useTasksStore();
  const getEffectiveDuration = useExerciseSettings((s) => s.getDuration);
  const params = useLocalSearchParams<{ previewExerciseIds?: string }>();

  // Snapshot pending tasks at session start — never re-read from store during session.
  // Dev preview mode: if previewExerciseIds param is provided, build fake tasks for those IDs.
  const [exercises] = useState<DailyTask[]>(() => {
    const previewIds = params.previewExerciseIds?.split(",").filter(Boolean) ?? [];
    if (previewIds.length > 0) {
      return previewIds.map((id) => {
        const entry = EXERCISE_CATALOG.find((e) => e.id === id);
        return {
          exerciseId: id,
          name: entry?.name ?? id,
          reason: "Dev preview",
          targets: entry?.targets ?? ["all"],
          intensity: entry?.intensity ?? "medium",
          protocolType: "facial_exercise" as const,
          overloadTier: 0,
          overloadLabel: "Base",
          status: "pending" as const,
        };
      });
    }
    return (today?.tasks ?? []).filter((t) => t.status === "pending");
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  // Initialize with the real duration of the first exercise so timeLeft is never
  // 0 on mount. The auto-complete effect fires when timeLeft === 0, so starting
  // at 0 would incorrectly credit the first exercise before the user does anything.
  const [timeLeft, setTimeLeft] = useState(() =>
    exercises.length > 0 ? getEffectiveDuration(exercises[0].exerciseId) : 0
  );
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("exercise");
  // prepCountdown: 3→2→1→0 — shown inside the circle before exercise starts.
  // 0 means exercise is live (video playing, timer ticking).
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [isRedo, setIsRedo] = useState(false);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  // Track per-session completions/skips for progress dots & complete screen
  const [doneInSession, setDoneInSession] = useState<string[]>([]);
  const [skippedInSession, setSkippedInSession] = useState<string[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation shared values
  const timerY = useSharedValue(0);
  const timerOpacity = useSharedValue(1);
  const playScale = useSharedValue(1);

  // Stable refs so interval callbacks always see fresh values
  const currentIndexRef = useRef(currentIndex);
  const exercisesRef    = useRef(exercises);
  const phaseRef        = useRef<Phase>("exercise");
  const completeTaskRef = useRef(completeTask);
  const skipTaskRef     = useRef(skipTask);
  const timeLeftRef     = useRef(exercises.length > 0 ? getEffectiveDuration(exercises[0].exerciseId) : 0);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { completeTaskRef.current = completeTask; }, [completeTask]);
  useEffect(() => { skipTaskRef.current = skipTask; }, [skipTask]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Timer tick: subtle slide-in on each second, no bounce
  useEffect(() => {
    timerY.value = -8;
    timerOpacity.value = 0;
    timerY.value = withTiming(0, { duration: 200 });
    timerOpacity.value = withTiming(1, { duration: 180 });
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always-fresh helpers used by interval callbacks and event handlers
  const markCompleteRef = useRef<(id: string) => void>(() => {});
  markCompleteRef.current = (id: string) => {
    completeTaskRef.current(id);
    sessionDidCompleteExercises = true;
    setDoneInSession((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markSkippedRef = useRef<(id: string) => void>(() => {});
  markSkippedRef.current = (id: string) => {
    skipTaskRef.current(id);
    setSkippedInSession((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const current    = exercises[currentIndex];
  const duration   = current ? getEffectiveDuration(current.exerciseId) : 30;
  const videoSrc   = current ? getExerciseVideo(current.exerciseId) : null;
  const imagePair         = current ? (EXERCISE_IMAGE_PAIRS[current.exerciseId] ?? undefined) : undefined;
  const imagePairPosition = current ? (EXERCISE_IMAGE_POSITION[current.exerciseId] ?? "center") : "center";
  const zoomImage         = current ? (EXERCISE_ZOOM_IMAGES[current.exerciseId] ?? undefined) : undefined;
  const total      = exercises.length;

  // ---------------------------------------------------------------------------
  // Init — redirect if no pending tasks
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (exercises.length === 0) {
      router.back();
      return;
    }
    setTimeLeft(getEffectiveDuration(exercises[0].exerciseId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset timer when currentIndex changes (new exercise)
  useEffect(() => {
    if (exercises.length === 0) return;
    const ex = exercises[currentIndex];
    if (ex) setTimeLeft(getEffectiveDuration(ex.exerciseId));
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Pause on screen blur
  // ---------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      setIsPaused(false);
      return () => {
        setIsPaused(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [])
  );

  // ---------------------------------------------------------------------------
  // Android hardware back
  // ---------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (phaseRef.current !== "complete") {
          setIsPaused(true);
          setShowLeaveModal(true);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  // ---------------------------------------------------------------------------
  // Prep countdown — ticks 3→2→1→0 inside the circle before exercise starts.
  // Uses setTimeout per tick so pausing is trivially handled via deps.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (prepCountdown <= 0 || isPaused) return;
    const id = setTimeout(() => {
      setPrepCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [prepCountdown, isPaused]);

  // ---------------------------------------------------------------------------
  // Exercise countdown — only runs when prep is done (prepCountdown === 0)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "exercise" || isPaused || timeLeft <= 0 || prepCountdown > 0) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, isPaused, currentIndex, prepCountdown]); // re-run when prep finishes

  // Detect timer hitting 0 → mark complete, advance or finish session.
  // Guard: if the user already initiated a leave (showLeaveModal=true), the
  // timer may have raced to 0 at the same tick — do NOT credit the exercise.
  // This prevents a completed exercise being recorded when the user was
  // walking away at the exact moment the timer expired.
  useEffect(() => {
    if (phase !== "exercise" || timeLeft !== 0) return;
    if (exercises.length === 0) return;
    if (showLeaveModal) return; // leave was initiated — discard this completion

    const cur = exercises[currentIndexRef.current];
    if (cur) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      markCompleteRef.current(cur.exerciseId);
    }

    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx >= exercisesRef.current.length) {
      setPhase("complete");
    } else {
      // Advance immediately — show next exercise with in-circle prep countdown
      setSlideDir("right");
      setCurrentIndex(nextIdx);
      setPrepCountdown(PREP_SECONDS);
    }
  }, [timeLeft, phase, showLeaveModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Complete phase — auto navigate back after showing completion
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "complete") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => router.back(), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  const handlePause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playScale.value = withSequence(
      withSpring(0.86, { damping: 15, stiffness: 420 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    setIsPaused((p) => !p);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    // During prep countdown: skip prep, start exercise immediately
    if (prepCountdown > 0) {
      setPrepCountdown(0);
      return;
    }
    // Timer already done (at 0) — advance already fired, nothing to do
    if (timeLeft === 0) return;

    // Active exercise with time remaining → pause + show confirmation modal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
    setShowSkipModal(true);
  }, [prepCountdown, timeLeft]);

  // Skip modal: user chose "Done ✓" — marks complete, advances with prep
  const handleSkipModalDone = useCallback(() => {
    setShowSkipModal(false);
    const cur = exercises[currentIndexRef.current];
    if (cur) markCompleteRef.current(cur.exerciseId);
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx >= exercisesRef.current.length) {
      setPhase("complete");
    } else {
      setSlideDir("right");
      setCurrentIndex(nextIdx);
      setPrepCountdown(PREP_SECONDS);
      setIsRedo(false);
      setIsPaused(false);
    }
  }, [exercises]);

  // Skip modal: user chose "Skip" — marks skipped, advances with prep
  const handleSkipModalSkip = useCallback(() => {
    setShowSkipModal(false);
    const cur = exercises[currentIndexRef.current];
    if (cur) markSkippedRef.current(cur.exerciseId);
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx >= exercisesRef.current.length) {
      setPhase("complete");
    } else {
      setSlideDir("right");
      setCurrentIndex(nextIdx);
      setPrepCountdown(PREP_SECONDS);
      setIsRedo(false);
      setIsPaused(false);
    }
  }, [exercises]);

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Clear any active prep countdown — going back starts the exercise immediately
    setPrepCountdown(0);

    // 50% rule: if ≥ 50% of current exercise was completed, mark it done on the way back
    // (skip this check during prep — no time has elapsed yet)
    if (phase === "exercise" && prepCountdown === 0 && timeLeft > 0) {
      const cur = exercises[currentIndexRef.current];
      const elapsed = duration - timeLeft;
      const pct = duration > 0 ? elapsed / duration : 0;
      if (cur && pct >= 0.5 && !doneInSession.includes(cur.exerciseId)) {
        markCompleteRef.current(cur.exerciseId);
      }
    }

    const prevIdx = currentIndex - 1;
    setSlideDir("left");
    setCurrentIndex(prevIdx);
    setPhase("exercise");

    // Detect if going back to an already-completed exercise → start paused for redo.
    // Use session-local doneInSession (the snapshot source of truth) rather than
    // reading the live store, which keeps the session fully self-contained and
    // avoids split-state between the snapshot and the live store.
    const prevExId = exercises[prevIdx]?.exerciseId;
    if (prevExId && doneInSession.includes(prevExId)) {
      setIsPaused(true);
      setIsRedo(true);
    } else {
      setIsPaused(false);
      setIsRedo(false);
    }
  }, [currentIndex, phase, prepCountdown, timeLeft, duration, doneInSession, exercises]);

  const handleExit = useCallback(() => {
    setIsPaused(true);
    setShowLeaveModal(true);
  }, []);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveModal(false);
    router.back();
  }, []);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveModal(false);
    setIsPaused(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Animated styles
  // ---------------------------------------------------------------------------
  const timerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timerY.value }],
    opacity: timerOpacity.value,
  }));
  const playBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------
  const progress = duration > 0 ? (duration - timeLeft) / duration : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeDisplay = `${mins}:${String(secs).padStart(2, "0")}`;

  // (banner removed — header variables no longer needed)

  // ---------------------------------------------------------------------------
  // Session complete — navigate to completion screen (via effect, not during render)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "complete") return;
    // Replace so back-press from complete goes to list, not session
    router.replace({
      pathname: "/program/complete",
      params: { doneCount: String(doneInSession.length), total: String(total) },
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "complete") {
    // Blank screen while navigation is deferred
    return <SafeAreaView style={styles.safe} />;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Clean top bar: exit · dots · counter + info ── */}
      <View style={styles.topBar}>

        {/* Exit button */}
        <Pressable onPress={handleExit} style={styles.topBarIconBtn} hitSlop={12}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path
              d="M1.5 1.5 L12.5 12.5 M12.5 1.5 L1.5 12.5"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>

        {/* Progress dots — centered */}
        <View style={styles.progressDots}>
          {exercises.map((ex, idx) => (
            <View
              key={ex.exerciseId}
              style={[
                styles.progressDot,
                doneInSession.includes(ex.exerciseId) && styles.progressDotDone,
                skippedInSession.includes(ex.exerciseId) && styles.progressDotSkipped,
                idx === currentIndex &&
                  !doneInSession.includes(ex.exerciseId) &&
                  !skippedInSession.includes(ex.exerciseId) &&
                  styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>

        {/* Counter + info button */}
        <View style={styles.topBarRight}>
          <Text style={styles.topBarCount}>
            {currentIndex + 1}<Text style={styles.topBarCountOf}> / {total}</Text>
          </Text>
          <Pressable
            onPress={() => { setIsPaused(true); setShowHowTo(true); }}
            style={styles.topBarIconBtn}
            hitSlop={12}
          >
            <Svg width={18} height={5} viewBox="0 0 18 5" fill="none">
              <Path
                d="M2.5 2.5 A0.5 0.5 0 1 1 2.5 2.4999 M9 2.5 A0.5 0.5 0 1 1 9 2.4999 M15.5 2.5 A0.5 0.5 0 1 1 15.5 2.4999"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

      </View>

      {/* ── Main content ── */}
      <View style={styles.main}>

        {/* Redo banner — shown when navigating back to an already-completed exercise */}
        {isRedo && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.redoBanner}>
            <Text style={styles.redoBannerText}>Already done — tap ▶ to redo</Text>
          </Animated.View>
        )}

        {/* Circle video frame with progress ring (shows prep countdown when transitioning) */}
        <Animated.View
          key={`circle-${currentIndex}`}
          entering={slideDir === "right"
            ? FadeInRight.duration(320).springify()
            : FadeInLeft.duration(320).springify()}
        >
          <CircleFrame
            videoSrc={videoSrc}
            imagePair={imagePair}
            imagePairPosition={imagePairPosition}
            zoomImage={zoomImage}
            isPaused={isPaused}
            progress={progress}
            timeLeft={timeLeft}
            size={circleSize}
            exerciseKey={current?.exerciseId ?? ""}
            prepCountdown={prepCountdown}
          />
        </Animated.View>

        {/* Exercise name + target + timer — slides with exercise transitions */}
        <Animated.View
          key={`info-${currentIndex}`}
          entering={slideDir === "right"
            ? FadeInRight.duration(320).springify()
            : FadeInLeft.duration(320).springify()}
          style={{ alignItems: "center", gap: SP[2] }}
        >

        {/* Exercise name + info button */}
        <View style={styles.nameRow}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {current?.name ?? ""}
          </Text>
          <Pressable
            onPress={() => { setIsPaused(true); setShowHowTo(true); }}
            style={styles.infoBtn}
            hitSlop={10}
          >
            <Text style={styles.infoBtnText}>ⓘ</Text>
          </Pressable>
        </View>

        {/* Target area */}
        <Text style={styles.targetLabel}>
          {current?.targets.map((t) => (t === "all" ? "Full Face" : t)).join(" · ") ?? ""}
        </Text>

        {/* Big countdown timer */}
        <Animated.Text style={[styles.timerText, timerAnimStyle]}>{timeDisplay}</Animated.Text>

        </Animated.View>
      </View>

      {/* ── Media controls: ⏮ ▶/⏸ ⏭ ── */}
      <View style={styles.controls}>

        {/* Previous */}
        <Pressable
          onPress={handlePrev}
          disabled={currentIndex === 0}
          style={[styles.controlBtn, currentIndex === 0 && styles.controlBtnDisabled]}
          hitSlop={10}
        >
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Rect x="4" y="4" width="3" height="16" rx="1.5" fill="#9A9A9A" />
            <Path d="M19 4 L8 12 L19 20 Z" fill="#9A9A9A" />
          </Svg>
        </Pressable>

        {/* Play / Pause — animated spring wrapper */}
        <Animated.View style={playBtnAnimStyle}>
          <Pressable onPress={handlePause} style={[styles.controlBtn, styles.controlBtnCenter]} hitSlop={10}>
            {isPaused ? (
              <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
                <Path d="M7 4.5 L20 12 L7 19.5 Z" fill="#B0B0B0" />
              </Svg>
            ) : (
              <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
                <Rect x="5" y="4" width="5" height="16" rx="2" fill="#B0B0B0" />
                <Rect x="14" y="4" width="5" height="16" rx="2" fill="#B0B0B0" />
              </Svg>
            )}
          </Pressable>
        </Animated.View>

        {/* Skip forward */}
        <Pressable onPress={handleSkip} style={styles.controlBtn} hitSlop={10}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M5 4 L16 12 L5 20 Z" fill="#9A9A9A" />
            <Rect x="17" y="4" width="3" height="16" rx="1.5" fill="#9A9A9A" />
          </Svg>
        </Pressable>

      </View>

      {/* ── Leave session modal ── */}
      <Modal
        transparent
        visible={showLeaveModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleLeaveCancel}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleLeaveCancel}>
          <Animated.View entering={FadeInUp.duration(220).springify()} style={styles.modalCard}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <Text style={styles.modalEmoji}>⏱️</Text>
              <Text style={styles.modalTitle}>Leave session?</Text>
              <Text style={styles.modalBody}>
                Completed exercises are already saved to your progress.
              </Text>
              <View style={styles.modalBtns}>
                <View style={styles.modalBtnDepth}>
                  <Pressable
                    onPress={handleLeaveCancel}
                    style={({ pressed }) => [
                      styles.modalBtnPressable,
                      { transform: [{ translateY: pressed ? 5 : 0 }] },
                    ]}
                  >
                    <LinearGradient
                      colors={["#CCFF6B", "#B4F34D"]}
                      locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
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

      {/* ── Skip forward confirmation modal ── */}
      <Modal
        transparent
        visible={showSkipModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setShowSkipModal(false); setIsPaused(false); }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => { setShowSkipModal(false); setIsPaused(false); }}
        >
          <Animated.View entering={FadeInUp.duration(220).springify()} style={styles.modalCard}>
            <Pressable onPress={() => {}} style={{ width: "100%" }}>
              <Text style={styles.modalEmoji}>{progress >= 0.5 ? "✅" : "⏭️"}</Text>
              <Text style={styles.modalTitle}>
                {progress >= 0.5 ? "Looking good!" : "Move on?"}
              </Text>
              <Text style={styles.modalBody}>
                {progress >= 0.5
                  ? "You've done over half — count it as done or skip to the next."
                  : "Less than half done. Mark it complete anyway, or skip it for now."}
              </Text>
              <View style={styles.modalBtns}>
                {/* Primary: Done — mark complete */}
                <View style={styles.modalBtnDepth}>
                  <Pressable
                    onPress={handleSkipModalDone}
                    style={({ pressed }) => [
                      styles.modalBtnPressable,
                      { transform: [{ translateY: pressed ? 5 : 0 }] },
                    ]}
                  >
                    <LinearGradient
                      colors={["#CCFF6B", "#B4F34D"]}
                      locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.modalBtnGradient}
                    >
                      <Text style={styles.modalBtnPrimaryText}>Done ✓</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
                {/* Secondary: Skip — mark skipped */}
                <Pressable style={styles.modalBtnGhost} onPress={handleSkipModalSkip}>
                  <Text style={styles.modalBtnGhostText}>Skip this one</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── How to perform bottom sheet ── */}
      {current && (
        <HowToSheet
          visible={showHowTo}
          exerciseId={current.exerciseId}
          onClose={() => {
            setShowHowTo(false);
            setIsPaused(false);
          }}
        />
      )}

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
  },

  // ── Face banner header ──────────────────────────────────────────────────────

  // ── Clean top bar ────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    gap: SP[3],
  },
  topBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  topBarCount: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.2,
  },
  topBarCountOf: {
    color: COLORS.sub,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
  },

  // ── Progress dots ─────────────────────────────────────────────────────────────
  progressDots: {
    flex: 1,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressDotDone: {
    backgroundColor: COLORS.accent,
  },
  progressDotSkipped: {
    backgroundColor: "#EF4444",
  },
  progressDotCurrent: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.text,
  },

  // Redo banner
  redoBanner: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    paddingVertical: SP[2],
    paddingHorizontal: SP[4],
    alignSelf: "stretch",
    marginHorizontal: SP[2],
  },
  redoBannerText: {
    color: "#F59E0B",
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },

  // Main content area
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[6],
  },

  // Exercise name + info
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnText: {
    color: COLORS.sub,
    fontSize: 15,
  },

  // Target area label
  targetLabel: {
    color: COLORS.sub,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },

  // Timer
  timerText: {
    color: COLORS.text,
    fontSize: 56,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: -2,
    lineHeight: 62,
    marginTop: SP[2],
  },

  // Controls
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[6],
    paddingBottom: SP[10],
    paddingTop: SP[3],
  },
  controlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnCenter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#2A2A2A",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  controlBtnDisabled: {
    opacity: 0.28,
  },
  controlIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
  },
  controlIconCenter: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 30,
  },

  // Session complete
  completeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    paddingHorizontal: SP[6],
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: SP[2],
  },
  completeTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  completeSub: {
    color: COLORS.sub,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  completeStreakPill: {
    marginTop: SP[2],
    paddingHorizontal: SP[5],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(180,243,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.25)",
  },
  completeStreakText: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },

  // Leave modal
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
  modalBtns: {
    width: "100%",
    gap: SP[2],
  },
  modalBtnDepth: {
    width: "100%",
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: 5,
    shadowColor: COLORS.accent,
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

  // How to sheet
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
  howToCloseBtn: {
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
