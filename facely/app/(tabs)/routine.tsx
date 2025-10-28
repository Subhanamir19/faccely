// app/(tabs)/routine.tsx
import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View, ActivityIndicator, StyleSheet, Alert } from "react-native";
import Text from "@/components/ui/T";
import { useScores } from "@/store/scores";
import { fetchRoutine } from "@/lib/api/routine";

type Task = { headline: string; category: string; protocol: string };
type Day = { day: number; components: Task[] };
type Routine = { days: Day[] };

export default function RoutineScreen() {
  const { scores } = useScores();
  const [data, setData] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!scores) throw new Error("Scores missing. Re-run analysis.");
        const r = await fetchRoutine(scores, "Use The Sauce protocols only.");
        setData(r);
      } catch (e: any) {
        Alert.alert("Routine error", String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [scores]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Generating your 5×5 routine…</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.err}>No routine available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {data.days.map((d) => (
          <View key={d.day} style={styles.card}>
            <Text style={styles.day}>Day {d.day}</Text>
            {d.components.map((c, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cat}>{c.category}</Text>
                <Text style={styles.head}>{c.headline}</Text>
                <Text style={styles.protocol}>{c.protocol}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "rgba(255,255,255,0.7)", marginTop: 8 },
  err: { color: "#FF6B6B" },
  card: {
    backgroundColor: "rgba(8,9,10,0.6)",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  day: { fontSize: 18, color: "white", marginBottom: 8, fontWeight: "600" },
  row: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  cat: { color: "#B8FF59", fontSize: 12, marginBottom: 2 },
  head: { color: "white", fontWeight: "600" },
  protocol: { color: "rgba(255,255,255,0.8)", marginTop: 2, fontSize: 13 },
});
