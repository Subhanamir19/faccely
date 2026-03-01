// app/(tabs)/history.tsx
// History list screen — redesigned to match app design language.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import Text from "@/components/ui/T";
import ScreenHeader from "@/components/layout/ScreenHeader";
import StateView from "@/components/layout/StateView";
import { COLORS, SP, RADII, TYPE } from "@/lib/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 3D depth button constants — matches take-picture.tsx / score-teaser.tsx
const DEPTH = 4;

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
};

function HistoryCard({
  item,
  index,
  totalCount,
  compareMode,
  isSelected,
  onToggleSelect,
}: HistoryCardProps) {
  const { date, time } = formatDate(item.createdAt);
  // Newest scan is highest number (scan #N, #N-1, …, #1)
  const scanNumber = totalCount - index;

  const handleViewScores = () => {
    router.push(`/history/score-card?scanId=${encodeURIComponent(item.id)}`);
  };

  const handleViewAnalysis = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(item.id)}`);
  };

  const handlePress = () => {
    if (compareMode) onToggleSelect(item.id);
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
        {/* Glass overlay + border */}
        <View style={[styles.cardOverlay, isSelected && styles.cardOverlaySelected]} />
        {/* Lime top hairline */}
        <View style={styles.cardTopLine} />

        <View style={styles.cardInner}>
          {/* ── Header row: date + scan badge ─────────────────── */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.scanDotWrapper}>
                <View style={styles.scanDot} />
              </View>
              <View>
                <Text style={styles.dateText}>{date}</Text>
                <Text style={styles.timeText}>{time}</Text>
              </View>
            </View>

            {/* Scan number or selection circle */}
            {compareMode ? (
              <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            ) : (
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>#{scanNumber}</Text>
              </View>
            )}
          </View>

          {/* ── Badges ─────────────────────────────────────────── */}
          {item.hasSideImage && (
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Side Profile</Text>
              </View>
            </View>
          )}

          {/* ── Compare hint ───────────────────────────────────── */}
          {compareMode && (
            <Text style={styles.compareTap}>
              {isSelected ? "Selected for comparison" : "Tap to select"}
            </Text>
          )}

          {/* ── Action buttons ─────────────────────────────────── */}
          {!compareMode && (
            <View style={styles.actionRow}>
              {/* Ghost scores button */}
              <Pressable
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleViewScores}
              >
                <Text style={styles.ghostBtnText}>Scores</Text>
              </Pressable>

              {/* 3D depth primary button */}
              <View style={styles.primaryDepth}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryFace,
                    { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
                  ]}
                  onPress={handleViewAnalysis}
                >
                  <Text style={styles.primaryBtnText}>View Analysis</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </AnimatedPressable>
  );
}

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

  useEffect(() => { load(); }, [load]);

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

  const renderItem = useCallback(
    ({ item, index }: { item: ScanHistoryItem; index: number }) => (
      <HistoryCard
        item={item}
        index={index}
        totalCount={scans.length}
        compareMode={compareMode}
        isSelected={selectedIds.includes(item.id)}
        onToggleSelect={handleToggleSelect}
      />
    ),
    [compareMode, selectedIds, handleToggleSelect, scans.length]
  );

  // Compare / Cancel toggle button for header
  const compareToggleBtn = (
    <Pressable
      onPress={toggleCompareMode}
      style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.headerBtnText, compareMode && styles.headerBtnTextActive]}>
        {compareMode ? "Cancel" : "Compare"}
      </Text>
    </Pressable>
  );

  const renderContent = () => {
    if (loading) return <StateView loading loadingText="Loading history..." />;
    if (error) return <StateView error={error} onRetry={load} />;
    if (scans.length === 0) {
      return (
        <StateView
          empty
          emptyIcon="📊"
          emptyTitle="No scans yet"
          emptySubtitle="Run your first scan to see your history here"
        />
      );
    }

    return (
      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
      {/* Background */}
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
          rightAction={scans.length > 1 ? compareToggleBtn : undefined}
        />
        {renderContent()}
      </View>

      {/* Floating compare CTA — 3D depth style */}
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
              <Text style={styles.ctaText}>Compare 2 Scans →</Text>
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
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 8 }),
  },
  cardWrapperSelected: {
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.18,
          shadowRadius: 18,
        }
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
  // Thin lime accent line at the top of each card
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

  // ── Card header ─────────────────────────────────────────────────────────
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    flex: 1,
  },
  scanDotWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  scanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  dateText: {
    ...TYPE.captionSemiBold,
    color: COLORS.text,
  },
  timeText: {
    ...TYPE.small,
    color: COLORS.sub,
    marginTop: 1,
  },

  // Scan number badge
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

  // ── Badges ──────────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: "row",
  },
  badge: {
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  badgeText: {
    ...TYPE.smallSemiBold,
    color: COLORS.accent,
  },

  // ── Compare hint ────────────────────────────────────────────────────────
  compareTap: {
    ...TYPE.caption,
    color: COLORS.sub,
    textAlign: "center",
  },

  // ── Action buttons ───────────────────────────────────────────────────────
  actionRow: {
    flexDirection: "row",
    gap: SP[2],
    alignItems: "center",
  },

  // Ghost "Scores" button
  ghostBtn: {
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    ...TYPE.captionSemiBold,
    color: COLORS.dim,
  },

  // 3D depth "View Analysis" button
  primaryDepth: {
    flex: 1,
    borderRadius: RADII.md,
    backgroundColor: "#6B9A1E",
    paddingBottom: DEPTH,
  },
  primaryFace: {
    borderRadius: RADII.md,
    paddingVertical: SP[3],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  primaryBtnText: {
    ...TYPE.captionSemiBold,
    color: "#0B0B0B",
  },

  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // ── Selection (compare mode) ─────────────────────────────────────────────
  selectCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  checkmark: {
    ...TYPE.smallSemiBold,
    color: COLORS.bgTop,
    lineHeight: 16,
  },

  // ── Floating compare CTA ─────────────────────────────────────────────────
  floatingCta: {
    position: "absolute",
    left: SP[4],
    right: SP[4],
  },
  ctaDepth: {
    borderRadius: RADII.pill,
    backgroundColor: "#6B9A1E",
    paddingBottom: DEPTH,
  },
  ctaFace: {
    borderRadius: RADII.pill,
    paddingVertical: SP[4],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
        }
      : { elevation: 12 }),
  },
  ctaText: {
    ...TYPE.bodySemiBold,
    color: "#0B0B0B",
  },
});
