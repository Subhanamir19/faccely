// app/(tabs)/history.tsx
// Calm archive hub for scan history.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Text from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { fetchHistoryPhotoArchive, type HistoryPhotoItem } from "@/lib/historyArchive";
import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";

const FONT = "DINNextRounded-Bold";
const DETAIL_FONT = "DINNextRounded-Regular";
const SAGE = "#3F7A2A";
const SAGE_SOFT = "#E2F1D8";
const CARD_BORDER = "#E1E1DE";

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.11,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 5 },
  elevation: 4,
} as const;

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function ArchiveButton({
  icon,
  title,
  subtitle,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.actionDepth,
        primary ? styles.actionPrimaryDepth : styles.actionSecondaryDepth,
        pressed && styles.actionDepthPressed,
      ]}
    >
      <View style={[styles.actionIcon, primary && styles.actionIconPrimary]}>
        <Ionicons name={icon} size={ms(20)} color={primary ? "#FFFFFF" : COLORS.lightText} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>
          {title}
        </Text>
        <Text style={[styles.actionSubtitle, primary && styles.actionSubtitlePrimary]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={ms(18)}
        color={primary ? "#FFFFFF" : COLORS.lightSub}
      />
    </Pressable>
  );
}

function EmptyArchive({ onScan }: { onScan: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="images-outline" size={ms(34)} color={SAGE} />
      </View>
      <Text style={styles.emptyTitle}>No saved scans yet</Text>
      <Text style={styles.emptyBody}>
        Your uploaded photos and scan results will appear here after your first scan.
      </Text>
      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Start a scan"
        style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
      >
        <Text style={styles.emptyCtaText}>START A SCAN</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function HistoryHubScreen() {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<HistoryPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const archive = await fetchHistoryPhotoArchive(30);
      setPhotos(archive);
    } catch (err: any) {
      setError(err?.message || "Failed to load history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const latest = photos[0] ?? null;
  const older = photos.slice(1, 4);

  const goToScan = () => router.push("/(tabs)/take-picture");
  const goToPhotos = () => router.push("/history/photos");
  const goToResults = () => router.push("/history/results");

  return (
    <AppGradientBackground style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SP[3], paddingBottom: Math.max(insets.bottom + 120, FLOATING_TAB_BAR.contentClearance + SP[3]) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.lightText}
            colors={[COLORS.lightText]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={goToScan}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to scan"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="chevron-back" size={ms(20)} color={COLORS.lightText} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {loading
              ? "Opening your archive"
              : photos.length
              ? `${photos.length} saved scan${photos.length === 1 ? "" : "s"}`
              : "Your personal scan archive"}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={COLORS.lightText} size="large" />
            <Text style={styles.stateText}>Loading archive...</Text>
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
        ) : !latest ? (
          <EmptyArchive onScan={goToScan} />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.latestPanel}>
              <View style={styles.photoFrame}>
                <ExpoImage
                  source={{ uri: latest.frontImageUrl }}
                  style={styles.latestImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={260}
                />
                <View style={styles.imageScrim} />
                <View style={styles.imageMeta}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>LATEST</Text>
                  </View>
                  {latest.overallScore !== null && (
                    <View style={styles.scorePill}>
                      <Text style={styles.scoreText}>{latest.overallScore}</Text>
                      <Text style={styles.scoreDenom}>/100</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.latestCopy}>
                <Text style={styles.latestTitle}>Latest upload</Text>
                <Text style={styles.latestDate}>{formatDate(latest.createdAt)}</Text>
                {latest.hasSideImage && (
                  <View style={styles.sideCue}>
                    <Ionicons name="scan-outline" size={ms(12)} color={SAGE} />
                    <Text style={styles.sideCueText}>Side scan saved</Text>
                  </View>
                )}
              </View>

              {older.length > 0 && (
                <View style={styles.thumbRow}>
                  {older.map((item, index) => (
                    <ExpoImage
                      key={item.id}
                      source={{ uri: item.frontImageUrl }}
                      style={[styles.thumb, { opacity: 0.9 - index * 0.12 }]}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={180}
                    />
                  ))}
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(420).delay(160)} style={styles.actions}>
              <ArchiveButton
                primary
                icon="images-outline"
                title="View Uploaded Photos"
                subtitle="Browse every frontal upload as a quiet visual archive."
                onPress={goToPhotos}
              />
              <ArchiveButton
                icon="list-outline"
                title="View Scan Results"
                subtitle="Open the existing score list, details, and comparison tools."
                onPress={goToResults}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>
    </AppGradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SP[5],
  },
  topBar: {
    minHeight: sh(34),
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
    fontSize: ms(32),
    lineHeight: ms(36),
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    lineHeight: ms(18),
    color: COLORS.lightSub,
    marginTop: sh(4),
  },
  latestPanel: {
    borderRadius: 20,
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderColor: CARD_BORDER,
    padding: SP[3],
    ...SOFT_SHADOW,
  },
  photoFrame: {
    width: "100%",
    aspectRatio: 1.02,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  latestImage: {
    width: "100%",
    height: "100%",
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  imageMeta: {
    position: "absolute",
    left: SP[3],
    right: SP[3],
    bottom: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaPill: {
    borderRadius: RADII.circle,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  metaPillText: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: COLORS.lightText,
    letterSpacing: 0.8,
  },
  scorePill: {
    minHeight: sh(34),
    flexDirection: "row",
    alignItems: "baseline",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
  },
  scoreText: {
    fontFamily: FONT,
    fontSize: ms(18),
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  scoreDenom: {
    fontFamily: FONT,
    fontSize: ms(10),
    color: "rgba(255,255,255,0.58)",
    marginLeft: 1,
  },
  latestCopy: {
    paddingHorizontal: SP[1],
    paddingTop: SP[4],
  },
  latestTitle: {
    fontFamily: FONT,
    fontSize: ms(21),
    lineHeight: ms(25),
    color: COLORS.lightText,
    letterSpacing: -0.25,
  },
  latestDate: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(4),
  },
  sideCue: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[1],
    borderRadius: RADII.circle,
    backgroundColor: SAGE_SOFT,
    paddingHorizontal: SP[2],
    paddingVertical: 3,
    marginTop: SP[2],
  },
  sideCueText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: SAGE,
  },
  thumbRow: {
    flexDirection: "row",
    gap: SP[2],
    paddingHorizontal: SP[1],
    paddingTop: SP[4],
  },
  thumb: {
    width: sw(54),
    height: sw(54),
    borderRadius: sw(27),
    borderWidth: 2,
    borderColor: COLORS.lightCard,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  actions: {
    gap: SP[3],
    marginTop: SP[5],
  },
  actionDepth: {
    minHeight: sh(78),
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderBottomWidth: 5,
  },
  actionPrimaryDepth: {
    backgroundColor: COLORS.ctaBlack,
    borderBottomColor: "#000000",
  },
  actionSecondaryDepth: {
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: CARD_BORDER,
    borderBottomColor: "#CFCFCC",
    ...SOFT_SHADOW,
  },
  actionDepthPressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 2,
  },
  actionIcon: {
    width: sw(42),
    height: sw(42),
    borderRadius: sw(21),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  actionIconPrimary: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionTitle: {
    fontFamily: FONT,
    fontSize: ms(16),
    lineHeight: ms(20),
    color: COLORS.lightText,
  },
  actionTitlePrimary: {
    color: "#FFFFFF",
  },
  actionSubtitle: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(12),
    lineHeight: ms(17),
    color: COLORS.lightSub,
  },
  actionSubtitlePrimary: {
    color: "rgba(255,255,255,0.62)",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  centerState: {
    minHeight: sh(380),
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    paddingHorizontal: SP[4],
  },
  stateText: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  retryBtn: {
    borderRadius: 16,
    backgroundColor: COLORS.ctaBlack,
    borderBottomWidth: 5,
    borderBottomColor: "#000000",
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
  emptyWrap: {
    minHeight: sh(420),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
    gap: SP[3],
  },
  emptyIcon: {
    width: sw(84),
    height: sw(84),
    borderRadius: sw(42),
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[1],
  },
  emptyTitle: {
    fontFamily: FONT,
    fontSize: ms(21),
    color: COLORS.lightText,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: DETAIL_FONT,
    fontSize: ms(13),
    lineHeight: ms(19),
    color: COLORS.lightSub,
    textAlign: "center",
    maxWidth: sw(300),
  },
  emptyCta: {
    minHeight: sh(54),
    borderRadius: 16,
    backgroundColor: COLORS.ctaBlack,
    borderBottomWidth: 5,
    borderBottomColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[7],
    marginTop: SP[3],
  },
  emptyCtaText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
