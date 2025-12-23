import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { COLORS, RADII, SP } from "@/lib/tokens";
import PillNavButton from "@/components/ui/PillNavButton";
import { useProgramStore } from "@/store/program";
import { POSE_FRAMES, FALLBACK_FRAME } from "@/lib/programAssets";

function formatPhase(phase?: string) {
  if (phase === "foundation") return "Phase 1 • Foundation";
  if (phase === "development") return "Phase 2 • Development";
  if (phase === "peak") return "Phase 3 • Peak";
  return "";
}

function getContextLineForDay(programType: 1 | 2 | 3 | null, phase: string): string {
  const focus = {
    1: "jawline and structure",
    2: "eye symmetry and midface",
    3: "skin clarity and facial definition",
  }[programType ?? 1];

  const phaseAction = {
    foundation: "building control",
    development: "progressive loading",
    peak: "refinement and stabilization",
  }[phase] ?? "recovery";

  return `Today's routine is optimized for your ${focus} ${phaseAction}`;
}

type PlayerProps = {
  exerciseId: string;
  name: string;
  protocol: string;
  frames: any[];
  onDone: () => void;
};

function ExercisePlayer({ exerciseId, name, protocol, frames, onDone }: PlayerProps) {
  const [remaining, setRemaining] = useState(30);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    setRemaining(30);
    setFrameIdx(0);
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const frameTimer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(frameTimer);
    };
  }, [exerciseId, frames.length]);

  const frame = frames[frameIdx] ?? FALLBACK_FRAME;

  return (
    <View style={styles.playerCard}>
      <Text style={styles.playerTitle}>{name}</Text>
      <Text style={styles.protocol}>{protocol}</Text>
      <View style={styles.timerRow}>
        <Text style={styles.timerLabel}>30s timer</Text>
        <Text style={styles.timerValue}>{remaining}s</Text>
      </View>
      <View style={styles.imageWrap}>
        <Image source={frame} style={styles.image} resizeMode="contain" />
      </View>
      <PillNavButton kind="solid" label="Close" onPress={onDone} />
    </View>
  );
}

export default function ProgramDayScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const dayNumber = params?.day ? Number.parseInt(String(params.day), 10) : NaN;
  const { program, programType, completions, toggleCompletion } = useProgramStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const day = useMemo(
    () => program?.days.find((d) => d.dayNumber === dayNumber),
    [program, dayNumber]
  );

  const selected = day?.exercises.find((ex) => ex.id === selectedId) ?? null;
  const frames = selected ? POSE_FRAMES[selected.id] ?? [FALLBACK_FRAME] : [FALLBACK_FRAME];

  if (!program || !day || Number.isNaN(dayNumber)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.empty}>No day found.</Text>
          <PillNavButton kind="solid" label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const safeProgram = program;
  const safeDay = day;

  const dayCompleted = safeDay.exercises.every(
    (ex) => completions[`${safeProgram.programId}:${safeDay.dayNumber}:${ex.id}`]
  );

  async function handleCompletion(exerciseId: string) {
    setSubmitting(true);
    try {
      await toggleCompletion(safeDay.dayNumber, exerciseId);
      setShowConfirmation(true);

      // Auto-close after 1 second
      setTimeout(() => {
        setShowConfirmation(false);
        setSelectedId(null);
      }, 1000);
    } catch (err: any) {
      console.warn("Completion toggle failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <PillNavButton kind="ghost" label="Back" onPress={() => router.back()} />
          <View>
            <Text style={styles.title}>Day {safeDay.dayNumber}</Text>
            <Text style={styles.sub}>{formatPhase(safeDay.phase)}</Text>
            <Text style={styles.sub}>
              Focus: {safeDay.focusAreas.join(", ")} {safeDay.isRecovery ? "• Recovery" : ""}
            </Text>
          </View>
        </View>

        <View style={styles.contextBanner}>
          <Text style={styles.contextText}>{getContextLineForDay(programType, safeDay.phase)}</Text>
        </View>

        {safeDay.isRecovery ? (
          <View style={styles.recoveryPill}>
            <Text style={styles.recoveryText}>Active recovery • lighter intensity</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Exercises</Text>
            <Text style={styles.cardMeta}>
              {dayCompleted ? "All done" : "Tap an exercise to start or complete"}
            </Text>
          </View>
          {safeDay.exercises.map((ex) => {
            const key = `${safeProgram.programId}:${safeDay.dayNumber}:${ex.id}`;
            const done = !!completions[key];
            return (
              <Pressable
                key={ex.id}
                style={({ pressed }) => [
                  styles.exerciseRow,
                  done && styles.exerciseDone,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setSelectedId(ex.id)}
              >
                <View style={styles.exerciseMeta}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseSub}>
                    {ex.role} • {ex.intensity} • {ex.targets.join(", ")}
                  </Text>
                  <Text style={styles.protocol} numberOfLines={2}>
                    {ex.protocol}
                  </Text>
                </View>
                <Text style={done ? styles.doneBadge : styles.todoBadge}>
                  {done ? "Done" : "Start"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!selected && !showPlayer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>

            {showConfirmation ? (
              <View style={styles.confirmationBox}>
                <Text style={styles.confirmationText}>✓ Exercise marked complete!</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalText}>What would you like to do?</Text>
                <View style={styles.modalActions}>
                  <PillNavButton
                    kind="ghost"
                    label={submitting ? "Saving..." : "Task completed?"}
                    onPress={() => selected && handleCompletion(selected.id)}
                    disabled={submitting}
                  />
                  <PillNavButton
                    kind="solid"
                    label="Start"
                    onPress={() => setShowPlayer(true)}
                    disabled={submitting}
                  />
                </View>
                <PillNavButton kind="ghost" label="Close" onPress={() => setSelectedId(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected && showPlayer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {selected ? (
            <ExercisePlayer
              exerciseId={selected.id}
              name={selected.name}
              protocol={selected.protocol}
              frames={frames}
              onDone={() => {
                setShowPlayer(false);
                setSelectedId(null);
              }}
            />
          ) : (
            <ActivityIndicator color={COLORS.accent} />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgBottom },
  container: { padding: SP[4], gap: SP[3] },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3] },
  empty: { color: COLORS.text, fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: SP[3] },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "700" },
  sub: { color: COLORS.sub },
  recoveryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    backgroundColor: "rgba(180,243,77,0.12)",
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADII.pill,
  },
  recoveryText: { color: COLORS.accent, fontWeight: "700" },
  contextBanner: {
    padding: SP[3],
    backgroundColor: "rgba(180,243,77,0.08)",
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADII.md,
  },
  contextText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADII.lg,
    padding: SP[3],
    gap: SP[2],
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  cardMeta: { color: COLORS.sub, fontSize: 12 },
  exerciseRow: {
    padding: SP[2],
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
    gap: 4,
  },
  exerciseDone: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(180,243,77,0.12)",
  },
  exerciseMeta: { gap: 4 },
  exerciseName: { color: COLORS.text, fontWeight: "700" },
  exerciseSub: { color: COLORS.sub, fontSize: 12 },
  protocol: { color: COLORS.sub, fontSize: 12, lineHeight: 16 },
  doneBadge: { color: COLORS.accent, fontWeight: "700" },
  todoBadge: { color: COLORS.sub, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP[4],
  },
  modalCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    padding: SP[4],
    gap: SP[2],
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  modalText: { color: COLORS.sub },
  modalActions: { flexDirection: "row", gap: SP[2] },
  confirmationBox: {
    padding: SP[3],
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: RADII.md,
    borderColor: "#22c55e",
    borderWidth: 1,
  },
  confirmationText: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  playerCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    padding: SP[4],
    gap: SP[3],
  },
  playerTitle: { color: COLORS.text, fontSize: 20, fontWeight: "700" },
  timerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timerLabel: { color: COLORS.sub },
  timerValue: { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  imageWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%", borderRadius: RADII.md },
});
