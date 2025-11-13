// app/(tabs)/routine.tsx
import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View, StyleSheet, Alert } from "react-native";
import Text from "@/components/ui/T";
import GlassBtn from "@/components/ui/GlassBtn";
import { useRoutineStore } from "../../store/routineStore";
import { useScores } from "../../store/scores";
import { fetchRoutine } from "../../lib/api/routine";

export default function RoutineScreen() {
  const {
    routine,
    todayIndex,
    completionMap,
    toggleTask,
    refreshDayIndex,
    resetRoutine,
    hydrateFromAPI,
    completionPercent,
  } = useRoutineStore();

  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    try {
      refreshDayIndex();
    } catch (e: any) {
      Alert.alert("Routine error", String(e?.message ?? e));
    }
  }, []);

  if (!routine) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.err}>No routine available.</Text>
      </SafeAreaView>
    );
  }

  const { days } = routine;
  const total = days.length;
  const progress = completionPercent();
  const isReadOnly = (dayIdx: number) => dayIdx < todayIndex;
  const completionKey = (dayIdx: number, taskIdx: number) =>
    `${routine.routineId}:${dayIdx}:${taskIdx}`;
  const isTaskDone = (dayIdx: number, taskIdx: number) =>
    Boolean(completionMap[completionKey(dayIdx, taskIdx)]);

  async function handleNewRoutine() {
    try {
      setGenLoading(true);
      const { scores } = useScores.getState();
      if (!scores) return Alert.alert("Run analysis first");
      const data = await fetchRoutine(scores, "Use The Sauce protocols only.");
      hydrateFromAPI(data);
    } catch (e: any) {
      Alert.alert("Routine error", String(e?.message ?? e));
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Header showing day/progress */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Day {todayIndex + 1} / {total} • {progress}% complete
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {days.map((d, di) => (
          <View
            key={d.day}
            style={[
              styles.card,
              di === todayIndex && { borderColor: "#B8FF59" },
              isReadOnly(di) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.day}>
              Day {d.day} {di === todayIndex ? "(Today)" : isReadOnly(di) ? "(Past)" : "(Upcoming)"}
            </Text>

            {d.components.map((c, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  isTaskDone(di, i) && { backgroundColor: "rgba(184,255,89,0.08)" },
                ]}
              >
                <Text style={styles.cat}>{c.category}</Text>
                <Text style={styles.head}>{c.headline}</Text>
                <Text style={styles.protocol}>{c.protocol}</Text>

                {!isReadOnly(di) && (
                  <GlassBtn
                    label={isTaskDone(di, i) ? "Undo" : "Done"}
                    onPress={() => toggleTask(di, i)}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <GlassBtn label="Reset Cached Routine" icon="trash" onPress={resetRoutine} />
        <GlassBtn
          label={genLoading ? "Generating…" : "Generate New Routine"}
          icon="refresh"
          onPress={handleNewRoutine}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  headerText: {
    color: "#B8FF59",
    fontWeight: "600",
    fontSize: 16,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  err: { color: "#FF6B6B" },
  card: {
    backgroundColor: "rgba(8,9,10,0.6)",
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  day: { fontSize: 18, color: "white", marginBottom: 8, fontWeight: "600" },
  row: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  cat: { color: "#B8FF59", fontSize: 12, marginBottom: 2 },
  head: { color: "white", fontWeight: "600" },
  protocol: { color: "rgba(255,255,255,0.8)", marginTop: 2, fontSize: 13 },
  bottom: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
});
