import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import Text from "@/components/ui/T";
import { COLORS, RADII } from "@/lib/tokens";

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

function HistoryCard({ item, index }: { item: ScanHistoryItem; index: number }) {
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
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>

          {item.hasSideImage ? (
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Side Profile</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.ghostBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={() => router.push(`/history/score-card?scanId=${encodeURIComponent(item.id)}`)}
            >
              <Text style={[styles.actionText, styles.ghostText]}>View scores</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.primaryBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={() => router.push(`/history/analysis-card?scanId=${encodeURIComponent(item.id)}`)}
            >
              <Text style={styles.actionText}>View analysis</Text>
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

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.delay(200)} style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>📊</Text>
      </View>
      <Text style={styles.emptyTitle}>No scans yet</Text>
      <Text style={styles.emptySubtitle}>
        Run your first scan to see your history here
      </Text>
    </Animated.View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.stateText}>Loading history...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <Pressable
            style={({ pressed }) => [styles.retry, pressed && styles.btnPressed]}
            onPress={load}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
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
          scans.length ? styles.listContent : styles.listContentEmpty,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={renderEmpty}
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
        colors={["rgba(180,243,77,0.03)", "transparent"]}
        style={styles.topGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>History</Text>
          <Text style={styles.headerSubtitle}>Your scan results</Text>
        </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.text,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.sub,
    marginTop: 4,
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  listContentEmpty: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  stateText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.sub,
    textAlign: "center",
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
  },
  errorText: {
    fontSize: 15,
    color: "#FF6B6B",
    textAlign: "center",
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
  },

  // Card styles
  cardWrapper: {
    borderRadius: RADII.xl,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
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
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cardInner: {
    padding: 18,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(180,243,77,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  date: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  badge: {
    backgroundColor: "rgba(180,243,77,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderColor: "rgba(180,243,77,0.3)",
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    borderRadius: RADII.md,
    paddingVertical: 14,
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
  actionText: {
    color: COLORS.bgBottom,
    fontSize: 14,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  ghostText: {
    color: COLORS.text,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(180,243,77,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    color: COLORS.text,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: "Poppins-Medium",
      android: "Poppins-Medium",
      default: "Poppins-Medium",
    }),
  },

  // Retry button
  retry: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADII.md,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: COLORS.accent,
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 6 }),
  },
  retryText: {
    color: COLORS.bgBottom,
    fontSize: 15,
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
  },
});
