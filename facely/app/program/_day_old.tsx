// @ts-nocheck
// Archived old Program Day screen (kept for reference).
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { COLORS, RADII, SP } from "@/lib/tokens";
import PillNavButton from "@/components/ui/PillNavButton";
import { useProgramStore } from "@/store/program";
import { POSE_FRAMES, FALLBACK_FRAME } from "@/lib/programAssets";

function formatPhase(phase?: string) {
  if (phase === "foundation") return "Phase 1 - Foundation";
  if (phase === "development") return "Phase 2 - Development";
  if (phase === "peak") return "Phase 3 - Peak";
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

function minutesLabelFromSeconds(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const minutes = Math.max(1, Math.round(safe / 60));
  return `~${minutes} min total`;
}

function summarizeTargets(targets: unknown) {
  const cleaned = (Array.isArray(targets) ? targets : [])
    .map((t) => String(t).trim())
    .filter(Boolean);
  if (cleaned.length === 0) return "Improve facial control.";
  return `Improve ${cleaned.join(", ")}.`;
}

function BackPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.backPill, pressed ? styles.backPillPressed : null]}
    >
      <Text style={styles.backPillText}>{"\u2190"} Back</Text>
    </Pressable>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Text style={styles.bannerIconText}>✓</Text>
      </View>
      <Text style={styles.bannerText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function CompletionDot({ done }: { done: boolean }) {
  return (
    <View style={[styles.completionDot, done ? styles.completionDotDone : styles.completionDotTodo]}>
      {done ? <Text style={styles.completionDotText}>✓</Text> : null}
    </View>
  );
}

function StartPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start exercise"
      style={({ pressed }) => [styles.startPill, pressed ? styles.startPillPressed : null]}
    >
      <Text style={styles.startPillText}>Start</Text>
    </Pressable>
  );
}

type PlayerProps = {
  exerciseId: string;
  frames: any[];
  onMarkComplete: () => Promise<boolean>;
  onDone: () => void;
};

type PlayerMode = "preview" | "perform";

const DEFAULT_DURATION_SECONDS = 30;

function ExercisePlayer({ exerciseId, frames, onMarkComplete, onDone }: PlayerProps) {
  const { height: windowHeight } = useWindowDimensions();
  const safeFrames = frames.length > 0 ? frames : [FALLBACK_FRAME];
  const lastPoseIdx = safeFrames.length - 1;
  const imageHeight = Math.min(Math.round(windowHeight * 0.55), 420);

  const [mode, setMode] = useState<PlayerMode>("preview");
  const [poseIdx, setPoseIdx] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_DURATION_SECONDS);
  const [runId, setRunId] = useState(0);
  const promptShownRef = useRef(false);
  const completingRef = useRef(false);

  useEffect(() => {
    setMode("preview");
    setPoseIdx(0);
    setRemaining(DEFAULT_DURATION_SECONDS);
    setRunId(0);
    promptShownRef.current = false;
    completingRef.current = false;
  }, [exerciseId, safeFrames.length]);

  useEffect(() => {
    if (mode !== "perform") return;

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [mode, runId]);

  useEffect(() => {
    if (mode !== "perform") return;
    if (remaining !== 0) return;
    if (promptShownRef.current) return;
    if (completingRef.current) return;

    promptShownRef.current = true;

    Alert.alert(
      "Time's up",
      "Mark as complete or do again?",
      [
        {
          text: "Do again",
          style: "cancel",
          onPress: () => {
            promptShownRef.current = false;
            setRemaining(DEFAULT_DURATION_SECONDS);
            setRunId((v) => v + 1);
          },
        },
        {
          text: "Mark as complete",
          onPress: () => {
            if (completingRef.current) return;
            completingRef.current = true;
            void (async () => {
              const ok = await onMarkComplete();
              if (ok) {
                onDone();
                return;
              }
              completingRef.current = false;
              promptShownRef.current = false;
              Alert.alert("Error", "Couldn't mark complete. Please try again.");
            })();
          },
        },
      ],
      { cancelable: false }
    );
  }, [mode, onDone, onMarkComplete, remaining]);

  const frame = safeFrames[poseIdx] ?? FALLBACK_FRAME;
  const canPrev = poseIdx > 0;
  const canNext = poseIdx < lastPoseIdx;

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerTopRow}>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.playerCloseBtn, pressed ? styles.playerCloseBtnPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.playerCloseText}>Close</Text>
        </Pressable>
      </View>
      {mode === "preview" ? (
        <>
          <View style={[styles.imageWrap, { height: imageHeight }]}>
            <Image source={frame} style={styles.image} resizeMode="contain" />
          </View>

          <View style={styles.poseNavRow}>
            <Pressable
              onPress={canPrev ? () => setPoseIdx((v) => Math.max(0, v - 1)) : undefined}
              style={({ pressed }) => [
                styles.poseNavBtn,
                !canPrev && styles.poseNavBtnDisabled,
                pressed && canPrev ? styles.poseNavBtnPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous pose"
            >
              <Text style={styles.poseNavBtnText}>{"<"}</Text>
            </Pressable>

            <Text style={styles.poseCounter}>
              {poseIdx + 1}/{safeFrames.length}
            </Text>

            <Pressable
              onPress={canNext ? () => setPoseIdx((v) => Math.min(lastPoseIdx, v + 1)) : undefined}
              style={({ pressed }) => [
                styles.poseNavBtn,
                !canNext && styles.poseNavBtnDisabled,
                pressed && canNext ? styles.poseNavBtnPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next pose"
            >
              <Text style={styles.poseNavBtnText}>{">"}</Text>
            </Pressable>
          </View>

          {poseIdx === lastPoseIdx ? (
            <PillNavButton
              kind="solid"
              label="Perform"
              onPress={() => {
                promptShownRef.current = false;
                completingRef.current = false;
                setRemaining(DEFAULT_DURATION_SECONDS);
                setMode("perform");
                setRunId((v) => v + 1);
              }}
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.timerOnlyWrap}>
            <Text style={styles.timerOnlyValue}>{remaining}s</Text>
          </View>
        </>
      )}
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
          <BackPill onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const safeProgram = program;
  const safeDay = day;

  const dayCompleted = safeDay.exercises.every(
    (ex) => completions[`${safeProgram.programId}:${safeDay.dayNumber}:${ex.id}`]
  );

  const totalSeconds = safeDay.exercises.reduce((acc, ex) => acc + (ex.durationSeconds ?? DEFAULT_DURATION_SECONDS), 0);
  const totalLabel = minutesLabelFromSeconds(totalSeconds);

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

  async function markCompleteIfNeeded(exerciseId: string): Promise<boolean> {
    if (submitting) return false;
    const state = useProgramStore.getState();
    const programId = state.program?.programId;
    if (!programId) return false;
    const key = `${programId}:${safeDay.dayNumber}:${exerciseId}`;
    if (state.completions?.[key]) return true;

    setSubmitting(true);
    try {
      await toggleCompletion(safeDay.dayNumber, exerciseId);
      return true;
    } catch (err) {
      console.warn("Completion toggle failed", err);
      return false;
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
              frames={frames}
              onMarkComplete={() => markCompleteIfNeeded(selected.id)}
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
  imageWrap: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADII.md,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%", borderRadius: RADII.md },
  playerTopRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  playerCloseBtn: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  playerCloseBtnPressed: {
    transform: [{ translateY: 1 }],
  },
  playerCloseText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  poseNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
  },
  poseNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  poseNavBtnPressed: {
    transform: [{ translateY: 1 }],
  },
  poseNavBtnDisabled: {
    opacity: 0.4,
  },
  poseNavBtnText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  poseCounter: {
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "700",
  },
  timerOnlyWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SP[5],
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
  },
  timerOnlyValue: {
    color: COLORS.text,
    fontSize: 44,
    fontWeight: "900",
  },
});
