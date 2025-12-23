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

type DayState = "today" | "past-complete" | "past-incomplete" | "future-locked";

type DayTileProps = {
  dayNumber: number;
  state: DayState;
  isRecovery: boolean;
  completedCount: number;
  total: number;
  onPress: () => void;
  disabled: boolean;
};

function DayTile({
  dayNumber,
  state,
  isRecovery,
  completedCount,
  total,
  onPress,
  disabled,
}: DayTileProps) {
  const status =
    state === "today"
      ? "Today"
      : state === "past-complete"
      ? "Done"
      : state === "past-incomplete"
      ? `${completedCount}/${total}`
      : "Locked";

  const ratio = total > 0 ? Math.min(1, completedCount / total) : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.dayCard,
        state === "today" && styles.dayToday,
        state === "past-complete" && styles.dayComplete,
        state === "past-incomplete" && styles.dayIncomplete,
        state === "future-locked" && styles.dayLocked,
        isRecovery && styles.dayRecovery,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>Day {dayNumber}</Text>
        {state === "past-complete" && <Text style={styles.checkmark}>✓</Text>}
        {state === "future-locked" && <Text style={styles.lock}>🔒</Text>}
      </View>
      <Text style={styles.dayStatus}>{status}</Text>
      {state !== "future-locked" && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{total}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function getContextLine(programType: 1 | 2 | 3 | null): string {
  if (programType === 1) return "Your program focuses on jawline and structural development";
  if (programType === 2) return "Your program focuses on eye symmetry and midface optimization";
  if (programType === 3) return "Your program focuses on skin clarity and facial refinement";
  return "Your personalized 70-day program";
}

export default function ProgramScreen() {
  const { program, programType, completions, todayIndex, fetchLatest, generate, loading, error } =
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

        const isToday = program ? d.dayNumber === todayIndex + 1 : false;
        const isPast = program ? d.dayNumber < todayIndex + 1 : false;
        const isFuture = program ? d.dayNumber > todayIndex + 1 : false;

        let state: DayState = "future-locked";
        if (isToday) {
          state = "today";
        } else if (isPast) {
          state = completedCount === total ? "past-complete" : "past-incomplete";
        }

        return {
          ...d,
          completedCount,
          total,
          state,
          disabled: isFuture,
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
          {__DEV__ && (
            <PillNavButton
              kind="ghost"
              label="🔄 Regenerate (Dev Only)"
              onPress={() => bootstrap(true)}
            />
          )}
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your 70-Day Program</Text>
        <Text style={styles.sub}>{getContextLine(programType)}</Text>
        {program && (
          <Text style={styles.daysRemaining}>
            {70 - todayIndex} days remaining • Day {todayIndex + 1} of 70
          </Text>
        )}
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
              state={item.state}
              isRecovery={item.isRecovery}
              completedCount={item.completedCount}
              total={item.total}
              disabled={item.disabled}
              onPress={() => {
                if (!item.disabled) {
                  router.push({
                    pathname: "/program/[day]",
                    params: { day: String(item.dayNumber) },
                  });
                }
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
  daysRemaining: { color: COLORS.accent, fontSize: 13, fontWeight: "600", marginTop: 4 },
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dayComplete: {
    borderColor: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  dayIncomplete: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.1)",
  },
  dayLocked: {
    opacity: 0.4,
    borderColor: COLORS.cardBorder,
  },
  dayRecovery: {
    borderColor: COLORS.sub,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayLabel: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  dayStatus: { color: COLORS.sub, fontSize: 11, marginTop: 2 },
  checkmark: { color: "#22c55e", fontSize: 16, fontWeight: "700" },
  lock: { fontSize: 14 },
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.track,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADII.circle,
    backgroundColor: COLORS.accent,
  },
  progressText: { color: COLORS.text, fontSize: 10, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3] },
  stateText: { color: COLORS.text, textAlign: "center" },
  footerRow: { gap: SP[2] },
});
