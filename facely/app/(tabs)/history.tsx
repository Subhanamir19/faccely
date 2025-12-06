import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { fetchScanHistory, type ScanHistoryItem } from "@/lib/api/history";
import Text from "@/components/ui/T";

const BG = "#02040A";
const CARD = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(255,255,255,0.14)";
const TEXT = "#F7F9FB";
const SUBTLE = "rgba(255,255,255,0.72)";
const ACCENT = "#B4F34D";
const BTN_BORDER = "rgba(255,255,255,0.18)";

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

export default function HistoryScreen() {
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

  const renderItem = ({ item }: { item: ScanHistoryItem }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateDot} />
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.metaRow}>
          {item.hasSideImage ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Side</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.ghostBtn]}
            onPress={() => router.push(`/history/score-card?scanId=${encodeURIComponent(item.id)}`)}
          >
            <Text style={[styles.actionText, styles.ghostText]}>View scores</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => router.push(`/history/analysis-card?scanId=${encodeURIComponent(item.id)}`)}
          >
            <Text style={styles.actionText}>View analysis</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.center}>
      <Text style={styles.stateText}>No scans yet. Run a scan to see history here.</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.stateText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.stateText}>Error: {error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          contentContainerStyle={scans.length ? styles.listContent : styles.listContentEmpty}
          ListEmptyComponent={renderEmpty}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
    paddingHorizontal: 24,
    gap: 12,
  },
  stateText: {
    marginTop: 4,
    fontSize: 16,
    color: TEXT,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  date: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  badge: {
    backgroundColor: "rgba(180,243,77,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderColor: ACCENT,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BTN_BORDER,
  },
  ghostBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  actionText: { color: "#0A1300", fontWeight: "700", fontSize: 15 },
  ghostText: { color: TEXT },
  retry: {
    marginTop: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: "#0A1300", fontWeight: "700" },
});
