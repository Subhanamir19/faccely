import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ApiResponseError } from "@/lib/api/client";
import Screen from "@/components/layout/Screen";
import PillNavButton from "@/components/ui/PillNavButton";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { useProgramStore } from "@/store/program";

type DayTileProps = {
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isRecovery: boolean;
  completedCount: number;
  total: number;
  onPress: () => void;
};

function DayTile({
  dayNumber,
  isToday,
  isPast,
  isRecovery,
  completedCount,
  total,
  onPress,
}: DayTileProps) {
  const status = isToday ? "Today" : isPast ? "Done" : "Upcoming";
  const ratio = total > 0 ? Math.min(1, completedCount / total) : 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCard,
        isToday && styles.dayToday,
        isRecovery && styles.dayRecovery,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>Day {dayNumber}</Text>
        <Text style={styles.dayStatus}>{status}</Text>
      </View>
      <Text style={styles.dayMeta}>{isRecovery ? "Active recovery" : "Program day"}</Text>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedCount}/{total}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProgramScreen() {
  const { program, completions, todayIndex, fetchLatest, generate, loading, error } =
    useProgramStore();
  const [booting, setBooting] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap(forceGenerate = false) {
    setScreenError(null);
    setBooting(true);
    try {
      if (forceGenerate) {
        await generate();
        return;
      }
      await fetchLatest();
    } catch (err: any) {
      // If no program exists, try generating. If no scores, redirect to analysis.
      if (err instanceof ApiResponseError && err.status === 404) {
        const code = (err.body as any)?.error;
        if (code === "no_history_scores") {
          setRedirecting(true);
          router.replace("/(tabs)/take-picture");
          return;
        }
        try {
          await generate();
          return;
        } catch (genErr: any) {
          if (genErr instanceof ApiResponseError && genErr.status === 404) {
            const genCode = (genErr.body as any)?.error;
            if (genCode === "no_history_scores") {
              setRedirecting(true);
              router.replace("/(tabs)/take-picture");
              return;
            }
          }
          setScreenError(genErr instanceof Error ? genErr.message : "Program generation failed");
        }
      } else {
        setScreenError(err instanceof Error ? err.message : "Program fetch failed");
      }
    } finally {
      setBooting(false);
    }
  }

  const days = program?.days ?? [];

  const dayData = useMemo(
    () =>
      days.map((d) => {
        const total = d.exercises.length;
        const completedCount = d.exercises.reduce((acc, ex) => {
          const key = `${program?.programId}:${d.dayNumber}:${ex.id}`;
          return acc + (completions[key] ? 1 : 0);
        }, 0);
        return {
          ...d,
          completedCount,
          total,
          isToday: program ? d.dayNumber === todayIndex + 1 : false,
          isPast: program ? d.dayNumber < todayIndex + 1 : false,
        };
      }),
    [days, completions, program, todayIndex]
  );

  if (redirecting) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.stateText}>Redirecting to face analysis...</Text>
        </View>
      </Screen>
    );
  }

  if (booting) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={styles.stateText}>Loading program...</Text>
        </View>
      </Screen>
    );
  }

  const emptyState = (
    <View style={styles.center}>
      <Text style={styles.stateText}>
        {screenError ?? error ?? "No program found. Generate one from your latest analysis."}
      </Text>
      <PillNavButton kind="solid" label="Generate program" onPress={() => bootstrap(true)} />
    </View>
  );

  return (
    <Screen
      scroll={false}
      footer={
        <View style={styles.footerRow}>
          <PillNavButton kind="ghost" label="Regenerate" onPress={() => bootstrap(true)} />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Program (70 days)</Text>
        <Text style={styles.sub}>5 exercises per day • uses your latest facial scores</Text>
      </View>

      {!program ? (
        emptyState
      ) : (
        <FlatList
          data={dayData}
          keyExtractor={(item) => String(item.dayNumber)}
          numColumns={5}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DayTile
              dayNumber={item.dayNumber}
              isToday={item.isToday}
              isPast={item.isPast}
              isRecovery={item.isRecovery}
              completedCount={item.completedCount}
              total={item.total}
              onPress={() => {
                router.push({
                  pathname: "/program/[day]",
                  params: { day: String(item.dayNumber) },
                });
              }}
            />
          )}
          ListEmptyComponent={emptyState}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: SP[3] },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "700" },
  sub: { color: COLORS.sub, fontSize: 15 },
  listContent: {
    paddingBottom: SP[4],
    gap: SP[2],
  },
  columnWrap: {
    gap: SP[2],
    marginBottom: SP[2],
  },
  dayCard: {
    flex: 1,
    minWidth: 0,
    padding: SP[2],
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADII.md,
  },
  dayToday: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dayRecovery: {
    borderColor: COLORS.sub,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayLabel: { color: COLORS.text, fontWeight: "700" },
  dayStatus: { color: COLORS.sub, fontSize: 12 },
  dayMeta: { color: COLORS.sub, marginTop: 4, fontSize: 12 },
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.accent,
  },
  progressText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3] },
  stateText: { color: COLORS.text, textAlign: "center" },
  footerRow: { gap: SP[2] },
});
