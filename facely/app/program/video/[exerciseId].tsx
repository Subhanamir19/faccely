// app/program/video/[exerciseId].tsx
// Full-screen video player for "How to Perform" — pauses the timer behind it.

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { getExerciseVideo } from "@/lib/exerciseVideos";
import { getExerciseDetail } from "@/lib/exerciseDetails";
import { useTasksStore } from "@/store/tasks";

export default function ExerciseVideoScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const insets   = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const task   = useTasksStore((s) => s.today?.tasks.find((t) => t.exerciseId === exerciseId));
  const name   = task?.name ?? exerciseId ?? "";
  const source = getExerciseVideo(exerciseId ?? "");
  const detail = getExerciseDetail(exerciseId ?? "");

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsLoading(false);
    setIsPlaying(status.isPlaying);
  };

  const handleTogglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  if (!source) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { top: insets.top + SP[2] }]}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.centerFallback}>
          <Text style={styles.fallbackText}>No video available yet.</Text>
          <Pressable onPress={() => router.back()} style={styles.fallbackBtn}>
            <Text style={styles.fallbackBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Video section ── */}
      <View style={styles.videoSection}>
        {/* Close button */}
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Close video"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Exercise name overlay */}
        <View style={styles.nameOverlay}>
          <Text style={styles.nameText}>{name}</Text>
        </View>

        {/* Video */}
        <Pressable style={styles.videoTouchable} onPress={handleTogglePlay}>
          <Video
            ref={videoRef}
            source={source}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            onPlaybackStatusUpdate={handlePlaybackStatus}
          />

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          )}

          {!isPlaying && !isLoading && (
            <View style={styles.pausedOverlay}>
              <View style={styles.playBtn}>
                <Text style={styles.playBtnIcon}>▶</Text>
              </View>
            </View>
          )}
        </Pressable>

        <Text style={styles.hint}>Tap to pause · Loops automatically · Timer paused</Text>
      </View>

      {/* ── Instructions panel ── */}
      <View style={styles.panel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.panelScroll}
        >
          {detail ? (
            <>
              {/* Benefits */}
              <View style={styles.benefitsRow}>
                <View style={styles.benefitsDot} />
                <Text style={styles.benefitsText}>{detail.benefits}</Text>
              </View>

              {/* Steps */}
              <Text style={styles.sectionLabel}>HOW TO PERFORM</Text>
              {detail.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumWrap}>
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              {/* Reps */}
              <View style={styles.repsRow}>
                <Text style={styles.repsLabel}>REPS / DURATION</Text>
                <Text style={styles.repsValue}>{detail.reps}</Text>
              </View>

              {/* Tip */}
              <View style={styles.tipCard}>
                <Text style={styles.tipLabel}>PRO TIP</Text>
                <Text style={styles.tipText}>{detail.tip}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDetailText}>Instructions coming soon.</Text>
          )}
        </ScrollView>

        {/* Back to Timer — pinned */}
        <View style={[styles.btnWrap, { paddingBottom: insets.bottom + SP[3] }]}>
          <View style={styles.backToTimerDepth}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backToTimerPressable,
                { transform: [{ translateY: pressed ? 5 : 0 }] },
              ]}
            >
              <LinearGradient
                colors={["#CCFF6B", "#B4F34D"]}
                locations={[0, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.backToTimerGradient}
              >
                <Text style={styles.backToTimerText}>Back to Timer</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0B0B",
  },

  // ── Video section
  videoSection: {
    height: "46%",
    backgroundColor: "#000000",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    right: SP[4],
    top: SP[2],
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
  },
  nameOverlay: {
    position: "absolute",
    left: SP[4],
    right: 60,
    top: SP[2],
    zIndex: 20,
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  videoTouchable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnIcon: {
    color: "#FFFFFF",
    fontSize: 24,
    marginLeft: 3,
  },
  hint: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    paddingVertical: SP[2],
    backgroundColor: "#000000",
  },

  // ── Instructions panel
  panel: {
    flex: 1,
    backgroundColor: "#0B0B0B",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  panelScroll: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[3],
    gap: SP[4],
  },

  // Benefits
  benefitsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
    backgroundColor: "rgba(180,243,77,0.06)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.14)",
    padding: SP[3],
  },
  benefitsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 5,
    flexShrink: 0,
  },
  benefitsText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 20,
  },

  // Steps
  sectionLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
    marginBottom: -SP[2],
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[3],
  },
  stepNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNum: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
  stepText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 22,
  },

  // Reps
  repsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
  },
  repsLabel: {
    color: COLORS.sub,
    fontSize: 11,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.8,
  },
  repsValue: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    textAlign: "right",
    flex: 1,
    marginLeft: SP[3],
  },

  // Tip
  tipCard: {
    backgroundColor: "rgba(255,170,50,0.07)",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(255,170,50,0.18)",
    padding: SP[3],
    gap: SP[1],
    marginBottom: SP[2],
  },
  tipLabel: {
    color: "#FFAA32",
    fontSize: 10,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
  },
  tipText: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: "Poppins-SemiBold",
    lineHeight: 20,
  },

  noDetailText: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginTop: SP[5],
  },

  // Back to Timer button
  btnWrap: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0B0B0B",
  },
  backToTimerDepth: {
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: 5,
    shadowColor: "#B4F34D",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  backToTimerPressable: {
    height: 52,
    borderRadius: RADII.pill,
    overflow: "hidden",
  },
  backToTimerGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.pill,
  },
  backToTimerText: {
    color: "#0B0B0B",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },

  // Fallback
  centerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[4],
  },
  fallbackText: {
    color: COLORS.sub,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  fallbackBtn: {
    paddingHorizontal: SP[5],
    paddingVertical: SP[3],
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  fallbackBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
});
