// app/history/photos.tsx
// Uploaded-photo archive with a quiet crossfade between scans.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { fetchHistoryPhotoArchive, type HistoryPhotoItem } from "@/lib/historyArchive";

const FONT = "DINNextRounded-Regular";
const BG = "#FEF5E4";
const SAGE = "#3F7A2A";
const SAGE_SOFT = "#E2F1D8";

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.1,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 5,
} as const;

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function IconButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={ms(22)}
        color={disabled ? COLORS.lightSub : "#FFFFFF"}
      />
    </Pressable>
  );
}

export default function HistoryPhotosScreen() {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<HistoryPhotoItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const archive = await fetchHistoryPhotoArchive(30);
      setPhotos(archive);
      setIndex(0);
    } catch (err: any) {
      setError(err?.message || "Failed to load uploaded photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = photos[index] ?? null;
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= photos.length || nextIndex === index) return;
      Haptics.selectionAsync();
      setIndex(nextIndex);
    },
    [index, photos.length]
  );

  const goPrevious = useCallback(() => goToIndex(index - 1), [goToIndex, index]);
  const goNext = useCallback(() => goToIndex(index + 1), [goToIndex, index]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -40) goNext();
          if (gesture.dx > 40) goPrevious();
        },
      }),
    [goNext, goPrevious]
  );

  const progressDots = useMemo(() => {
    const maxDots = Math.min(photos.length, 8);
    if (maxDots <= 0) return [];
    return Array.from({ length: maxDots }, (_, dotIndex) => {
      const mappedIndex =
        photos.length <= maxDots
          ? dotIndex
          : Math.round((dotIndex / (maxDots - 1)) * (photos.length - 1));
      return { dotIndex, active: mappedIndex === index };
    });
  }, [index, photos.length]);

  const goBack = () => router.back();
  const goToResults = () => {
    if (!current) return;
    router.push(`/history/score-card?scanId=${encodeURIComponent(current.id)}`);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.container, { paddingTop: insets.top + SP[3], paddingBottom: insets.bottom + SP[5] }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="chevron-back" size={ms(20)} color={COLORS.lightText} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(340)} style={styles.header}>
          <Text style={styles.title}>Uploaded Photos</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading your photos" : photos.length ? `${index + 1} of ${photos.length}` : "No uploads yet"}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={COLORS.lightText} size="large" />
            <Text style={styles.stateText}>Loading photos...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Ionicons name="alert-circle-outline" size={ms(38)} color={COLORS.declineRed} />
            <Text style={[styles.stateText, { color: COLORS.declineRed }]}>{error}</Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>RETRY</Text>
            </Pressable>
          </View>
        ) : !current ? (
          <View style={styles.centerState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="images-outline" size={ms(34)} color={SAGE} />
            </View>
            <Text style={styles.emptyTitle}>No uploaded photos</Text>
            <Text style={styles.stateText}>
              Run a scan to start building your visual archive.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.stage} {...panResponder.panHandlers}>
              <Animated.View
                key={current.id}
                entering={FadeIn.duration(280)}
                exiting={FadeOut.duration(180)}
                style={styles.imageShell}
              >
                <ExpoImage
                  source={{ uri: current.frontImageUrl }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              </Animated.View>
            </View>

            <Animated.View entering={FadeInDown.duration(320).delay(90)} style={styles.metaBlock}>
              <View>
                <Text style={styles.photoTitle}>Scan {photos.length - index}</Text>
                <Text style={styles.photoDate}>{formatDate(current.createdAt)}</Text>
              </View>
              {current.overallScore !== null && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValue}>{current.overallScore}</Text>
                  <Text style={styles.scoreDenom}>100</Text>
                </View>
              )}
            </Animated.View>

            {current.hasSideImage && (
              <View style={styles.sideCue}>
                <Ionicons name="scan-outline" size={ms(12)} color={SAGE} />
                <Text style={styles.sideCueText}>Side scan saved with this upload</Text>
              </View>
            )}

            <View style={styles.dotsRow}>
              {progressDots.map((dot) => (
                <View
                  key={dot.dotIndex}
                  style={[styles.dot, dot.active && styles.dotActive]}
                />
              ))}
            </View>

            <View style={styles.controls}>
              <IconButton
                icon="chevron-back"
                label="Previous photo"
                onPress={goPrevious}
                disabled={!hasPrevious}
              />
              <Pressable
                onPress={goToResults}
                accessibilityRole="button"
                accessibilityLabel="View scan results for this photo"
                style={({ pressed }) => [styles.resultsBtn, pressed && styles.pressed]}
              >
                <Text style={styles.resultsText}>VIEW RESULTS</Text>
              </Pressable>
              <IconButton
                icon="chevron-forward"
                label="Next photo"
                onPress={goNext}
                disabled={!hasNext}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    paddingHorizontal: SP[5],
  },
  topBar: {
    minHeight: sh(36),
    justifyContent: "center",
  },
  backBtn: {
    alignSelf: "flex-start",
    minHeight: sh(36),
    flexDirection: "row",
    alignItems: "center",
    gap: sw(2),
    paddingRight: SP[2],
  },
  backText: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
  },
  header: {
    marginTop: sh(8),
    marginBottom: sh(18),
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(30),
    lineHeight: ms(34),
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    lineHeight: ms(18),
    color: COLORS.lightSub,
    marginTop: sh(4),
  },
  stage: {
    flex: 1,
    minHeight: sh(390),
    justifyContent: "center",
  },
  imageShell: {
    width: "100%",
    aspectRatio: 0.78,
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: COLORS.lightSurfaceAlt,
    ...SOFT_SHADOW,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  metaBlock: {
    minHeight: sh(66),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
    marginTop: SP[4],
  },
  photoTitle: {
    fontFamily: FONT,
    fontSize: ms(21),
    lineHeight: ms(25),
    color: COLORS.lightText,
    letterSpacing: -0.25,
  },
  photoDate: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(3),
  },
  scoreBadge: {
    width: sw(62),
    height: sw(62),
    borderRadius: sw(31),
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: BG,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  scoreValue: {
    fontFamily: FONT,
    fontSize: ms(23),
    lineHeight: ms(24),
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  scoreDenom: {
    fontFamily: FONT,
    fontSize: ms(9),
    lineHeight: ms(10),
    color: "rgba(255,255,255,0.62)",
    marginTop: -1,
  },
  sideCue: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    borderRadius: RADII.circle,
    backgroundColor: SAGE_SOFT,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    marginBottom: SP[3],
  },
  sideCueText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: SAGE,
  },
  dotsRow: {
    height: sh(18),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[1],
    marginBottom: SP[3],
  },
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
    backgroundColor: "rgba(11,11,11,0.18)",
  },
  dotActive: {
    width: sw(18),
    backgroundColor: COLORS.lightText,
  },
  controls: {
    minHeight: sh(58),
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  iconButton: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDisabled: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  resultsBtn: {
    flex: 1,
    minHeight: sh(52),
    borderRadius: RADII.circle,
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: "rgba(11,11,11,0.07)",
    alignItems: "center",
    justifyContent: "center",
    ...SOFT_SHADOW,
  },
  resultsText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    paddingHorizontal: SP[4],
  },
  stateText: {
    fontFamily: FONT,
    fontSize: ms(13),
    lineHeight: ms(19),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  retryBtn: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    marginTop: SP[1],
  },
  retryText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  emptyIcon: {
    width: sw(84),
    height: sw(84),
    borderRadius: sw(42),
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: ms(21),
    color: COLORS.lightText,
    textAlign: "center",
  },
});
