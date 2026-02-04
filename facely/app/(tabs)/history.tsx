// app/(tabs)/history.tsx
// History list screen - displays all historical scan results

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
import { COLORS, SP, RADII } from "@/lib/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

type HistoryCardProps = {
  item: ScanHistoryItem;
  index: number;
};

function HistoryCard({ item, index }: HistoryCardProps) {
  const handleViewScores = () => {
    router.push(`/history/score-card?scanId=${encodeURIComponent(item.id)}`);
  };

  const handleViewAnalysis = () => {
    router.push(`/history/analysis-card?scanId=${encodeURIComponent(item.id)}`);
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 80).duration(400)}
      style={styles.cardWrapper}
    >
      <BlurView
        intensity={Platform.OS === "android" ? 20 : 40}
        tint="dark"
        style={styles.cardBlur}
      >
        <View style={styles.cardOverlay} />
        <View style={styles.cardHairline} />

        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.dateDotOuter}>
              <View style={styles.dateDot} />
            </View>
            <Text variant="bodySemiBold" color="text">
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {item.hasSideImage && (
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text variant="smallSemiBold" style={styles.badgeText}>
                  Side Profile
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.ghostBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleViewScores}
            >
              <Text variant="captionSemiBold" color="text">
                View scores
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.primaryBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleViewAnalysis}
            >
              <Text variant="captionSemiBold" color="bgBottom">
                View analysis
              </Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </AnimatedPressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const renderItem = useCallback(
    ({ item, index }: { item: ScanHistoryItem; index: number }) => (
      <HistoryCard item={item} index={index} />
    ),
    []
  );

  const renderContent = () => {
    if (loading) {
      return <StateView loading loadingText="Loading history..." />;
    }

    if (error) {
      return <StateView error={error} onRetry={load} />;
    }

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
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

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
        <ScreenHeader title="History" subtitle="Your scan results" />
        {renderContent()}
      </View>
    </View>
  );
}

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
    height: 200,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SP[4],
    gap: SP[3],
  },

  // Card styles
  cardWrapper: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.shadow,
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        }
      : { elevation: 8 }),
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
  cardHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.whiteGlass,
  },
  cardInner: {
    padding: SP[4],
    gap: SP[3],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  dateDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  badge: {
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SP[3],
    paddingVertical: SP[1],
    borderRadius: RADII.circle,
    borderColor: COLORS.accentBorder,
    borderWidth: 1,
  },
  badgeText: {
    color: COLORS.accent,
  },
  actionRow: {
    flexDirection: "row",
    gap: SP[2],
    marginTop: SP[1],
  },
  actionBtn: {
    flex: 1,
    borderRadius: RADII.md,
    paddingVertical: SP[3],
    alignItems: "center",
    borderWidth: 1,
  },
  ghostBtn: {
    backgroundColor: COLORS.whiteGlass,
    borderColor: COLORS.cardBorder,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }
      : {}),
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
