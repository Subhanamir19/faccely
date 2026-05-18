import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react-native";
import {
  getNewExerciseInstruction,
  getNewExerciseMeta,
  getNewExerciseTimingLabel,
  getNewExerciseTitle,
  NEW_EXERCISE_VIDEO_PREVIEWS,
} from "@/lib/newExerciseVideoPreviews";

const FONT = "ProximaNova-Bold";
const BODY_FONT = "Poppins-Regular";
const TEXT = "#000000";
const SUB_TEXT = "#737780";
const SURFACE = "#F3F4F6";
const TRACK = "#E5E7EB";

const MEDIA_FRAMES: Record<string, { scale: number; translateX: number; translateY: number }> = {
  "chin-tucks-v2": {
    scale: 1.45,
    translateX: 0.1,
    translateY: 0,
  },
  "fish-face-v2": {
    scale: 1.18,
    translateX: 0,
    translateY: 0.04,
  },
};

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatMillis(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function NewExercisesPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const videoRef = useRef<Video>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sequenceFrameIndex, setSequenceFrameIndex] = useState(0);

  const exercises = NEW_EXERCISE_VIDEO_PREVIEWS;
  const current = exercises[currentIndex];
  const title = useMemo(() => getNewExerciseTitle(current), [current]);
  const instruction = useMemo(() => getNewExerciseInstruction(current), [current]);
  const sourceMeta = useMemo(() => getNewExerciseMeta(current), [current]);
  const timingLabel = useMemo(() => getNewExerciseTimingLabel(current), [current]);
  const isStaticImage = current.mediaType === "image";
  const isImageSequence = current.mediaType === "imageSequence";
  const isImageMedia = isStaticImage || isImageSequence;
  const sequenceSources = Array.isArray(current.source) ? current.source : [current.source];
  const imageSource = sequenceSources[sequenceFrameIndex % sequenceSources.length];
  const mediaFrame = MEDIA_FRAMES[current.id];
  const videoProgress = isImageMedia ? 1 : durationMillis > 0 ? positionMillis / durationMillis : 0;
  const catalogProgress = exercises.length > 0 ? (currentIndex + 1) / exercises.length : 0;
  const mediaHeight = Math.min(Math.max(height * 0.48, 290), 430);

  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(true);
    setPositionMillis(0);
    setDurationMillis(0);
    setSequenceFrameIndex(0);
  }, [currentIndex]);

  useEffect(() => {
    if (!isImageSequence || !isPlaying || sequenceSources.length < 2) return;

    const timer = setInterval(() => {
      setSequenceFrameIndex((index) => (index + 1) % sequenceSources.length);
    }, 760);

    return () => clearInterval(timer);
  }, [isImageSequence, isPlaying, sequenceSources.length]);

  const goToIndex = (nextIndex: number) => {
    if (exercises.length === 0) return;
    const wrapped = (nextIndex + exercises.length) % exercises.length;
    setCurrentIndex(wrapped);
  };

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis ?? 0);
    setDurationMillis(status.durationMillis ?? 0);
  };

  const togglePlayback = async () => {
    if (isStaticImage) {
      setPickerVisible(true);
      return;
    }

    if (isImageSequence) {
      setIsPlaying((playing) => !playing);
      return;
    }

    const player = videoRef.current;
    if (!player) return;

    if (isPlaying) {
      await player.pauseAsync();
    } else {
      await player.playAsync();
    }
  };

  if (!__DEV__) {
    return (
      <View style={styles.lockedRoot}>
        <Text style={styles.lockedText}>This preview is only available in development builds.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to developer tools"
        >
          <ChevronLeft color={TEXT} size={31} strokeWidth={3.4} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
          {title.toUpperCase()}
        </Text>

        <Pressable
          onPress={() => setPickerVisible(true)}
          style={styles.counterPill}
          accessibilityRole="button"
          accessibilityLabel="Choose exercise preview"
        >
          <Text style={styles.counterText}>
            {currentIndex + 1}/{exercises.length}
          </Text>
          <View style={styles.counterTrack}>
            <View style={[styles.counterFill, { width: `${catalogProgress * 100}%` }]} />
          </View>
        </Pressable>
      </View>

      <View style={[styles.mediaStage, { height: mediaHeight }]}>
        {isImageMedia ? (
          <View
            style={[
              styles.framedMedia,
              mediaFrame
                ? {
                    transform: [
                      { translateX: width * mediaFrame.translateX },
                      { translateY: mediaHeight * mediaFrame.translateY },
                      { scale: mediaFrame.scale },
                    ],
                  }
                : null,
            ]}
          >
            <Image
              key={`${current.id}-${sequenceFrameIndex}`}
              source={imageSource}
              style={[styles.video, { width }]}
              resizeMode="contain"
              onLoadEnd={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </View>
        ) : (
          <Video
            key={current.id}
            ref={videoRef}
            source={current.source}
            style={[styles.video, { width }]}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isLooping
            isMuted
            onPlaybackStatusUpdate={handlePlaybackStatus}
          />
        )}

        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={TEXT} />
          </View>
        ) : null}
      </View>

      <View style={styles.details}>
        <Text
          style={[styles.timerText, isImageMedia && styles.staticTimingText]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
        >
          {isImageMedia ? timingLabel : durationMillis > 0 ? formatMillis(durationMillis - positionMillis) : "00:00"}
        </Text>

        <View style={styles.videoTrack}>
          <View style={[styles.videoFill, { width: `${clampProgress(videoProgress) * 100}%` }]} />
        </View>

        <Text style={styles.instructionText}>{instruction}</Text>
        <Text style={styles.sourceText} numberOfLines={1}>{sourceMeta}</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => goToIndex(currentIndex - 1)}
          style={styles.sideControl}
          accessibilityRole="button"
          accessibilityLabel="Previous exercise"
        >
          <SkipBack color="#8A8A8E" size={26} strokeWidth={2.8} />
        </Pressable>

        <Pressable
          onPress={togglePlayback}
          style={styles.playControl}
          accessibilityRole="button"
          accessibilityLabel={
            isStaticImage
              ? "Choose exercise preview"
              : isPlaying
                ? "Pause exercise preview"
                : "Play exercise preview"
          }
        >
          {isStaticImage ? (
            <ListVideo color="#FFFFFF" size={34} strokeWidth={2.8} />
          ) : isPlaying ? (
            <Pause color="#FFFFFF" size={36} fill="#FFFFFF" />
          ) : (
            <Play color="#FFFFFF" size={36} fill="#FFFFFF" style={{ marginLeft: 4 }} />
          )}
        </Pressable>

        <Pressable
          onPress={() => goToIndex(currentIndex + 1)}
          style={styles.sideControl}
          accessibilityRole="button"
          accessibilityLabel="Next exercise"
        >
          <SkipForward color="#8A8A8E" size={26} strokeWidth={2.8} />
        </Pressable>
      </View>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.sheetScrim} onPress={() => setPickerVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable onPress={() => {}} style={styles.sheetInner}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Exercise Previews</Text>
                  <Text style={styles.sheetSubtitle}>{exercises.length} bundled previews</Text>
                </View>
                <Pressable
                  onPress={() => setPickerVisible(false)}
                  style={styles.sheetClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close exercise picker"
                >
                  <X color={TEXT} size={22} strokeWidth={2.8} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
                {exercises.map((exercise, index) => {
                  const isSelected = index === currentIndex;
                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() => {
                        setCurrentIndex(index);
                        setPickerVisible(false);
                      }}
                      style={[styles.sheetRow, isSelected && styles.sheetRowActive]}
                      accessibilityRole="button"
                      accessibilityState={isSelected ? { selected: true } : undefined}
                      accessibilityLabel={`Preview ${getNewExerciseTitle(exercise)}`}
                    >
                      <View style={[styles.sheetRowIcon, isSelected && styles.sheetRowIconActive]}>
                        {isSelected ? (
                          <ChevronRight color="#FFFFFF" size={18} strokeWidth={3} />
                        ) : (
                          <ListVideo color="#767A83" size={18} strokeWidth={2.6} />
                        )}
                      </View>
                      <View style={styles.sheetRowTextWrap}>
                        <Text style={styles.sheetRowTitle} numberOfLines={1}>
                          {getNewExerciseTitle(exercise)}
                        </Text>
                        <Text style={styles.sheetRowMeta} numberOfLines={1}>
                          {getNewExerciseMeta(exercise)}
                        </Text>
                      </View>
                      <Text style={styles.sheetRowCount}>{index + 1}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  lockedRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },
  lockedText: {
    fontFamily: BODY_FONT,
    color: SUB_TEXT,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  header: {
    height: 86,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  headerTitle: {
    maxWidth: "48%",
    fontFamily: FONT,
    color: TEXT,
    fontSize: 24,
    lineHeight: 29,
    textAlign: "center",
  },
  counterPill: {
    position: "absolute",
    right: 20,
    width: 92,
    height: 48,
    borderRadius: 24,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  counterText: {
    fontFamily: FONT,
    color: TEXT,
    fontSize: 20,
    lineHeight: 22,
  },
  counterTrack: {
    width: 58,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E1E3E7",
    overflow: "hidden",
  },
  counterFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: TEXT,
  },
  mediaStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  video: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  framedMedia: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  details: {
    alignItems: "center",
    paddingHorizontal: 38,
    paddingTop: 18,
    gap: 14,
  },
  timerText: {
    fontFamily: FONT,
    color: TEXT,
    fontSize: 48,
    lineHeight: 54,
    textAlign: "center",
  },
  staticTimingText: {
    alignSelf: "stretch",
    fontSize: 32,
    lineHeight: 38,
  },
  videoTrack: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: "hidden",
  },
  videoFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: TEXT,
  },
  instructionText: {
    fontFamily: BODY_FONT,
    color: SUB_TEXT,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
  },
  sourceText: {
    alignSelf: "stretch",
    fontFamily: BODY_FONT,
    color: "#A1A4AA",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  controls: {
    marginTop: "auto",
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 34,
    backgroundColor: "#FFFFFF",
  },
  sideControl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  playControl: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: TEXT,
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  sheetScrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  sheet: {
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetInner: {
    width: "100%",
    paddingHorizontal: 20,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D7D9DE",
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONT,
    color: TEXT,
    fontSize: 24,
    lineHeight: 29,
  },
  sheetSubtitle: {
    fontFamily: BODY_FONT,
    color: SUB_TEXT,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetList: {
    gap: 10,
    paddingBottom: 20,
  },
  sheetRow: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#ECEEF1",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  sheetRowActive: {
    backgroundColor: "#EFEFEF",
    borderColor: "#D5D7DC",
  },
  sheetRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowIconActive: {
    backgroundColor: TEXT,
  },
  sheetRowTextWrap: {
    flex: 1,
  },
  sheetRowTitle: {
    fontFamily: FONT,
    color: TEXT,
    fontSize: 15,
    lineHeight: 19,
  },
  sheetRowMeta: {
    fontFamily: BODY_FONT,
    color: SUB_TEXT,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  sheetRowCount: {
    fontFamily: FONT,
    color: "#9A9DA4",
    fontSize: 13,
    minWidth: 22,
    textAlign: "right",
  },
});
