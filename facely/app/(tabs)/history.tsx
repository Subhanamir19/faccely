// app/(tabs)/history.tsx
// History list — light system, matches the new visual language.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import Text from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const goToScan = () => router.push("/(tabs)/take-picture");

const FONT = "ProximaNova-Bold";
const SAGE = "#3F7A2A";
const SAGE_SOFT = "#E2F1D8";

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

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
  if (score <= 39) return COLORS.declineRed;
  if (score <= 59) return "#D97706";
  if (score <= 79) return "#B5891A";
  return SAGE;
}

function getScoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Sharp";
  if (score >= 50) return "Average";
  return "Needs Work";
}

// ── Compare discovery banner ───────────────────────────────────────────────

function CompareDiscoveryBanner({ onCompare }: { onCompare: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={bannerStyles.wrapper}>
      <View style={bannerStyles.inner}>
        <View style={bannerStyles.iconWrap}>
          <Ionicons name="git-compare-outline" size={20} color={SAGE} />
        </View>
        <View style={bannerStyles.textBlock}>
          <Text style={bannerStyles.title}>Compare scans side by side</Text>
          <Text style={bannerStyles.sub}>Track your progress over time</Text>
        </View>
        <Pressable
          onPress={onCompare}
          style={({ pressed }) => [bannerStyles.cta, pressed && { opacity: 0.85 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={bannerStyles.ctaText}>Try it</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    marginBottom: SP[2],
    ...SOFT_SHADOW,
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
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 2 },
  title: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  sub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(11),
    color: COLORS.lightSub,
  },
  cta: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
  },
  ctaText: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});

// ── History card ───────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scoreColor = hasScore ? getScoreColor(score) : COLORS.lightSub;
  const band = hasScore ? getScoreBand(score) : null;

  const hasDelta = hasScore && typeof prevScore === "number";
  const delta = hasDelta ? score - prevScore! : 0;

  const handlePress = () => {
    if (compareMode) onToggleSelect(item.id);
  };

  const handleViewResults = () => {
    router.push(`/history/score-card?scanId=${encodeURIComponent(item.id)}`);
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 70).duration(380)}
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={handlePress}
    >
      <View style={styles.cardInner}>
        {/* Main row */}
        <View style={styles.mainRow}>
          {/* Thumb */}
          <View style={styles.thumbWrapper}>
            {item.frontImageUrl ? (
              <ExpoImage
                source={{ uri: item.frontImageUrl }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={250}
              />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Ionicons name="person-outline" size={22} color={SAGE} />
              </View>
            )}
            <View style={styles.liveDot} />
          </View>

          {/* Meta */}
          <View style={styles.metaBlock}>
            <Text style={styles.dateText}>{date}</Text>
            <Text style={styles.timeText}>{time}</Text>
            {item.hasSideImage && (
              <View style={styles.sideBadge}>
                <Ionicons name="scan-outline" size={10} color={SAGE} />
                <Text style={styles.sideBadgeText}>Side</Text>
              </View>
            )}
          </View>

          {/* Score / select circle / scan badge */}
          {compareMode ? (
            <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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
                        color={delta >= 0 ? SAGE : COLORS.declineRed}
                      />
                      <Text
                        style={[
                          styles.deltaText,
                          { color: delta >= 0 ? SAGE : COLORS.declineRed },
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

        {compareMode && (
          <Text style={styles.compareTap}>
            {isSelected ? "Selected for comparison" : "Tap to select"}
          </Text>
        )}

        {!compareMode && (
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
            onPress={handleViewResults}
          >
            <Text style={styles.primaryBtnText}>VIEW RESULTS</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </AnimatedPressable>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Animated.View entering={FadeIn.delay(200)} style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        <Ionicons name="stats-chart-outline" size={36} color={SAGE} />
      </View>
      <Text style={emptyStyles.title}>No scans yet</Text>
      <Text style={emptyStyles.sub}>
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
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2],
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(18),
    color: COLORS.lightText,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
    lineHeight: 20,
  },
});

// ── Light header — inline so the dark ScreenHeader doesn't bleed through ──

function LightHeader({
  subtitle,
  rightAction,
}: {
  subtitle: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={headerStyles.wrap}>
      <Pressable
        onPress={goToScan}
        hitSlop={12}
        style={({ pressed }) => [
          headerStyles.back,
          pressed && { opacity: 0.65 },
        ]}
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.lightText} />
        <Text style={headerStyles.backText}>Back</Text>
      </Pressable>

      <View style={headerStyles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={headerStyles.title}>History</Text>
          <Text style={headerStyles.subtitle}>{subtitle}</Text>
        </View>
        {rightAction && <View style={headerStyles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[2],
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    paddingVertical: SP[1],
    paddingRight: SP[2],
  },
  backText: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: COLORS.lightText,
    letterSpacing: 0.1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(28),
    color: COLORS.lightText,
    letterSpacing: -0.5,
    lineHeight: ms(32),
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },
  rightAction: {
    marginLeft: SP[3],
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

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
    !compareMode && !compareBannerDismissed && scans.length >= 3;

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={COLORS.lightText} size="large" />
          <Text style={{ fontFamily: FONT, color: COLORS.lightSub, marginTop: SP[3] }}>
            Loading history...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.declineRed} />
          <Text
            style={{
              fontFamily: FONT,
              color: COLORS.declineRed,
              textAlign: "center",
              marginTop: SP[2],
            }}
          >
            {error}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
            onPress={load}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
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
            tintColor={COLORS.lightText}
            colors={[COLORS.lightText]}
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LightHeader
          subtitle={subtitle}
          rightAction={scans.length > 1 ? compareToggleBtn : undefined}
        />
        {renderContent()}
      </View>

      {/* Floating compare CTA */}
      {compareMode && selectedIds.length === 2 && (
        <View style={[styles.floatingCta, { bottom: insets.bottom + SP[4] }]}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaFace,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
            onPress={handleCompare}
          >
            <Ionicons name="git-compare-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>COMPARE 2 SCANS</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FEF5E4",
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
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[6],
    paddingVertical: SP[3],
    borderRadius: 999,
    marginTop: SP[2],
  },
  retryBtnText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  // Header right action
  headerBtn: {
    paddingVertical: SP[1],
    paddingHorizontal: SP[2],
  },
  headerBtnText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    letterSpacing: 0.4,
  },
  headerBtnTextActive: {
    color: SAGE,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    ...SOFT_SHADOW,
  },
  cardSelected: {
    backgroundColor: SAGE_SOFT,
  },
  cardInner: {
    padding: SP[4],
    gap: SP[3],
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },

  // Thumb
  thumbWrapper: {
    position: "relative",
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: COLORS.lightBorder,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SAGE_SOFT,
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
    backgroundColor: SAGE,
    borderWidth: 2,
    borderColor: COLORS.lightCard,
  },

  // Meta
  metaBlock: {
    flex: 1,
    gap: 2,
  },
  dateText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  timeText: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(11),
    color: COLORS.lightSub,
  },
  sideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: SAGE_SOFT,
    paddingHorizontal: SP[2],
    paddingVertical: 2,
    borderRadius: 999,
  },
  sideBadgeText: {
    fontFamily: FONT,
    fontSize: 10,
    color: SAGE,
    letterSpacing: 0.4,
  },

  // Score block
  scoreBlock: {
    alignItems: "flex-end",
    gap: 2,
    minWidth: 52,
  },
  scoreNum: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FONT,
  },
  scoreBand: {
    fontFamily: FONT,
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
    fontFamily: FONT,
    fontSize: 11,
  },
  scanBadge: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: 999,
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  scanBadgeText: {
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.3,
  },

  // Compare
  compareTap: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(12),
    color: COLORS.lightSub,
    textAlign: "center",
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleActive: {
    borderColor: SAGE,
    backgroundColor: SAGE,
  },

  // Single primary CTA on each card
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.ctaBlack,
  },
  primaryBtnText: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },

  // Floating compare CTA
  floatingCta: {
    position: "absolute",
    left: SP[4],
    right: SP[4],
  },
  ctaFace: {
    borderRadius: 999,
    paddingVertical: SP[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[2],
    backgroundColor: COLORS.ctaBlack,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaText: {
    fontFamily: FONT,
    fontSize: ms(15),
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
});
