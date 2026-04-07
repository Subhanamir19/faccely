// app/(tabs)/history.tsx
// History list screen — redesigned per UX audit.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import Text from "@/components/ui/T";
import ScreenHeader from "@/components/layout/ScreenHeader";
import { COLORS, SP, RADII, TYPE } from "@/lib/tokens";

const goToScan = () => router.push("/(tabs)/take-picture");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 3D depth button constants
const DEPTH = 4;

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(value: string): { date: string; time: string } {
  try {
    const d = new Date(value);
    const date = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { date, time };
  } catch {
    return { date: value, time: "" };
  }
}

function getScoreColor(score: number): string {
  if (score <= 39) return COLORS.error;
  if (score <= 59) return COLORS.errorLight;
  if (score <= 79) return COLORS.warning;
  return COLORS.success;
}

function getScoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 50) return "Average";
  return "Needs Work";
}

// ---------------------------------------------------------------------------
// Compare Discovery Banner — shown when ≥3 scans and not yet dismissed
// ---------------------------------------------------------------------------
function CompareDiscoveryBanner({ onCompare }: { onCompare: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={bannerStyles.wrapper}>
      <BlurView
        intensity={Platform.OS === "android" ? 20 : 35}
        tint="dark"
        style={bannerStyles.blur}
      >
        <View style={bannerStyles.overlay} />
        <View style={bannerStyles.inner}>
          <View style={bannerStyles.iconWrap}>
            <Ionicons name="git-compare-outline" size={20} color={COLORS.accent} />
          </View>
          <View style={bannerStyles.textBlock}>
            <Text style={bannerStyles.title}>Compare scans side by side</Text>
            <Text style={bannerStyles.sub}>Track your progress over time</Text>
          </View>
          <Pressable
            onPress={onCompare}
            style={({ pressed }) => [bannerStyles.cta, pressed && { opacity: 0.75 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={bannerStyles.ctaText}>Try it</Text>
          </Pressable>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    marginBottom: SP[1],
    ...(Platform.OS === "ios"
      ? { shadowColor: COLORS.accent, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 4 }),
  },
  blur: { borderRadius: RADII.xl, overflow: "hidden" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(180,243,77,0.04)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: RADII.xl,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    gap: SP[3],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 2 },
  title: { ...TYPE.captionSemiBold, color: COLORS.text },
  sub: { ...TYPE.small, color: COLORS.sub },
  cta: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
  },
  ctaText: { ...TYPE.smallSemiBold, color: COLORS.accent },
});

// ---------------------------------------------------------------------------
// HistoryCard
// ---------------------------------------------------------------------------
type HistoryCardProps = {
  item: ScanHistoryItem;
  index: number;
  totalCount: number;
  compareMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  prevScore?: number;
};

function HistoryCard({
  item,
  index,
  totalCount,
  compareMode,
  isSelected,
  onToggleSelect,
  prevScore,
}: HistoryCardProps) {
  const { date, time } = formatDate(item.createdAt);
  const scanNumber = totalCount - index;

  const hasScore = typeof item.overallScore === "number";
  const score = item.overallScore ?? 0;
  const scoreColor = hasScore ? getScoreColor(score) : COLORS.sub;
  const band = hasScore ? getScoreBand(score) : null;

  // Delta vs previous scan (positive = improved)
  const hasDelta =
    hasScore &&
    typeof prevScore === "number";
  const delta = hasDelta ? score - prevScore! : 0;

  const handlePress = () => {
    if (compareMode) onToggleSelect(item.id);
  };

  const handleViewResults = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(item.id)}`);
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 70).duration(380)}
      style={[styles.cardWrapper, isSelected && styles.cardWrapperSelected]}
      onPress={handlePress}
    >
      <BlurView
        intensity={Platform.OS === "android" ? 20 : 40}
        tint="dark"
        style={styles.cardBlur}
      >
        <View style={[styles.cardOverlay, isSelected && styles.cardOverlaySelected]} />
        <View style={styles.cardTopLine} />

        <View style={styles.cardInner}>
          {/* ── Main info row ─────────────────────────────── */}
          <View style={styles.mainRow}>
            {/* Thumbnail */}
            <View style={styles.thumbWrapper}>
              {item.frontImageUrl ? (
                <Image
                  source={{ uri: item.frontImageUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="person-outline" size={22} color={COLORS.accent} />
                </View>
              )}
              {/* Live indicator dot */}
              <View style={styles.liveDot} />
            </View>

            {/* Date / badges */}
            <View style={styles.metaBlock}>
              <Text style={styles.dateText}>{date}</Text>
              <Text style={styles.timeText}>{time}</Text>
              {item.hasSideImage && (
                <View style={styles.sideBadge}>
                  <Ionicons name="scan-outline" size={10} color={COLORS.accent} />
                  <Text style={styles.sideBadgeText}>Side</Text>
                </View>
              )}
            </View>

            {/* Score / badge area */}
            {compareMode ? (
              <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color={COLORS.bgTop} />
                )}
              </View>
            ) : (
              <View style={styles.scoreBlock}>
                {hasScore ? (
                  <>
                    <Text style={[styles.scoreNum, { color: scoreColor }]}>
                      {Math.round(score)}
                    </Text>
                    <Text style={[styles.scoreBand, { color: scoreColor }]}>{band}</Text>
                    {hasDelta && (
                      <View style={styles.deltaRow}>
                        <Ionicons
                          name={delta >= 0 ? "arrow-up" : "arrow-down"}
                          size={10}
                          color={delta >= 0 ? COLORS.success : COLORS.error}
                        />
                        <Text
                          style={[
                            styles.deltaText,
                            { color: delta >= 0 ? COLORS.success : COLORS.error },
                          ]}
                        >
                          {delta >= 0 ? "+" : ""}
                          {Math.round(delta)}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.scanBadge}>
                    <Text style={styles.scanBadgeText}>#{scanNumber}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Compare hint ──────────────────────────────── */}
          {compareMode && (
            <Text style={styles.compareTap}>
              {isSelected ? "Selected for comparison" : "Tap to select"}
            </Text>
          )}

          {/* ── Single CTA ────────────────────────────────── */}
          {!compareMode && (
            <View style={styles.primaryDepth}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryFace,
                  { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
                ]}
                onPress={handleViewResults}
              >
                <Text style={styles.primaryBtnText}>View Results</Text>
                <Ionicons name="arrow-forward" size={14} color="#0B0B0B" />
              </Pressable>
            </View>
          )}
        </View>
      </BlurView>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Empty state (inline — no emoji)
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <Animated.View entering={FadeIn.delay(200)} style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        <Ionicons name="stats-chart-outline" size={36} color={COLORS.accent} />
      </View>
      <Text variant="h4" color="text" style={emptyStyles.title}>
        No scans yet
      </Text>
      <Text variant="caption" color="sub" style={emptyStyles.sub}>
        Run your first scan to see your history here
      </Text>
    </Animated.View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[8],
    gap: SP[3],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  title: { textAlign: "center" },
  sub: { textAlign: "center", lineHeight: 20 },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareBannerDismissed, setCompareBannerDismissed] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchScanHistory();
      setScans(data);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((m) => !m);
    setSelectedIds([]);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedIds.length !== 2) return;
    router.push(
      `/history/compare?scanId1=${encodeURIComponent(selectedIds[0])}&scanId2=${encodeURIComponent(selectedIds[1])}`
    );
  }, [selectedIds]);

  const handleDiscoverCompare = useCallback(() => {
    setCompareBannerDismissed(true);
    toggleCompareMode();
  }, [toggleCompareMode]);

  const renderItem = useCallback(
    ({ item, index }: { item: ScanHistoryItem; index: number }) => {
      // Previous scan score (the scan that came before this one, i.e. index+1 since newest first)
      const prev = scans[index + 1];
      const prevScore =
        typeof prev?.overallScore === "number" ? prev.overallScore : undefined;

      return (
        <HistoryCard
          item={item}
          index={index}
          totalCount={scans.length}
          compareMode={compareMode}
          isSelected={selectedIds.includes(item.id)}
          onToggleSelect={handleToggleSelect}
          prevScore={prevScore}
        />
      );
    },
    [compareMode, selectedIds, handleToggleSelect, scans]
  );

  const compareToggleBtn = (
    <Pressable
      onPress={toggleCompareMode}
      style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text
        style={[styles.headerBtnText, compareMode && styles.headerBtnTextActive]}
      >
        {compareMode ? "Cancel" : "Compare"}
      </Text>
    </Pressable>
  );

  const showDiscoverBanner =
    !compareMode &&
    !compareBannerDismissed &&
    scans.length >= 3;

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text variant="captionMedium" color="sub" style={{ marginTop: SP[3] }}>
            Loading history...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
          <Text variant="captionMedium" style={{ color: COLORS.error, textAlign: "center", marginTop: SP[2] }}>
            {error}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
            onPress={load}
          >
            <Text variant="captionSemiBold" style={{ color: COLORS.bgTop }}>
              Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    if (scans.length === 0) {
      return <EmptyState />;
    }

    return (
      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          showDiscoverBanner ? (
            <CompareDiscoveryBanner onCompare={handleDiscoverCompare} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const subtitle = loading
    ? "Your scan results"
    : compareMode
    ? "Select 2 scans to compare"
    : scans.length > 0
    ? `${scans.length} scan${scans.length !== 1 ? "s" : ""}`
    : "Your scan results";

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[COLORS.bgTop, COLORS.bgBottom]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <LinearGradient
        colors={[COLORS.accentGlow, "transparent"]}
        style={styles.topGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="History"
          subtitle={subtitle}
          showBack
          onBack={goToScan}
          rightAction={scans.length > 1 ? compareToggleBtn : undefined}
        />
        {renderContent()}
      </View>

      {/* Floating compare CTA */}
      {compareMode && selectedIds.length === 2 && (
        <View style={[styles.floatingCta, { bottom: insets.bottom + SP[4] }]}>
          <View style={styles.ctaDepth}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaFace,
                { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
              ]}
              onPress={handleCompare}
            >
              <Ionicons name="git-compare-outline" size={18} color="#0B0B0B" />
              <Text style={styles.ctaText}>Compare 2 Scans</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    gap: SP[3],
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[8],
    gap: SP[3],
  },
  retryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    marginTop: SP[2],
  },

  // Header button
  headerBtn: {
    paddingVertical: SP[1],
    paddingHorizontal: SP[2],
  },
  headerBtnText: {
    ...TYPE.captionSemiBold,
    color: COLORS.sub,
  },
  headerBtnTextActive: {
    color: COLORS.accent,
  },

  // ── Card ────────────────────────────────────────────────────────────────
  cardWrapper: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } }
      : { elevation: 8 }),
  },
  cardWrapperSelected: {
    ...(Platform.OS === "ios"
      ? { shadowColor: COLORS.accent, shadowOpacity: 0.18, shadowRadius: 18 }
      : {}),
  },
  cardBlur: {
    borderRadius: RADII.xl,
    overflow: "hidden",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.xl,
  },
  cardOverlaySelected: {
    borderColor: COLORS.accentBorder,
    backgroundColor: "rgba(180,243,77,0.05)",
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: COLORS.accentBorder,
    borderRadius: 1,
  },
  cardInner: {
    padding: SP[4],
    gap: SP[3],
  },

  // ── Main info row ────────────────────────────────────────────────────────
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },

  // Thumbnail
  thumbWrapper: {
    position: "relative",
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.bgTop,
  },

  // Meta (date/time/badges)
  metaBlock: {
    flex: 1,
    gap: 2,
  },
  dateText: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  timeText: {
    ...TYPE.small,
    color: COLORS.sub,
  },
  sideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  sideBadgeText: {
    ...TYPE.smallSemiBold,
    color: COLORS.accent,
    fontSize: 10,
  },

  // Score block (right side)
  scoreBlock: {
    alignItems: "flex-end",
    gap: 2,
    minWidth: 52,
  },
  scoreNum: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Poppins-SemiBold",
  },
  scoreBand: {
    ...TYPE.smallSemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  deltaText: {
    ...TYPE.smallSemiBold,
    fontSize: 11,
  },
  scanBadge: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  scanBadgeText: {
    ...TYPE.smallSemiBold,
    color: COLORS.muted,
    letterSpacing: 0.3,
  },

  // Compare
  compareTap: {
    ...TYPE.caption,
    color: COLORS.sub,
    textAlign: "center",
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },

  // Single primary CTA
  primaryDepth: {
    borderRadius: RADII.md,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: DEPTH,
  },
  primaryFace: {
    borderRadius: RADII.md,
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.accent,
  },
  primaryBtnText: {
    ...TYPE.captionSemiBold,
    color: "#0B0B0B",
  },

  // Floating compare CTA
  floatingCta: {
    position: "absolute",
    left: SP[4],
    right: SP[4],
  },
  ctaDepth: {
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accentDepth,
    paddingBottom: DEPTH,
  },
  ctaFace: {
    borderRadius: RADII.pill,
    paddingVertical: SP[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.accent,
    ...(Platform.OS === "ios"
      ? { shadowColor: COLORS.accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } }
      : { elevation: 12 }),
  },
  ctaText: {
    ...TYPE.bodySemiBold,
    color: "#0B0B0B",
  },
});
