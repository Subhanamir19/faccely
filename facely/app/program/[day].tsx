import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { COLORS, RADII, SP } from "@/lib/tokens";
import PillNavButton from "@/components/ui/PillNavButton";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import MoodCheckModal from "@/components/ui/MoodCheckModal";
import { useProgramStore } from "@/store/program";

function formatPhase(phase?: string) {
  if (phase === "foundation") return "Phase 1 - Foundation";
  if (phase === "development") return "Phase 2 - Development";
  if (phase === "peak") return "Phase 3 - Peak";
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

// Modal view states
type ModalView = "action";

export default function ProgramDayScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const dayNumber = params?.day ? Number.parseInt(String(params.day), 10) : NaN;
  const { program, programType, completions, todayIndex, toggleCompletion, setDayMood } =
    useProgramStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDayComplete, setShowDayComplete] = useState(false);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const [modalView, setModalView] = useState<ModalView>("action");

  const day = useMemo(
    () => program?.days.find((d) => d.dayNumber === dayNumber),
    [program, dayNumber]
  );

  const selected = day?.exercises.find((ex) => ex.id === selectedId) ?? null;

  const isFutureDay = program ? dayNumber > todayIndex + 1 : false;

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

  if (isFutureDay) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={COLORS.sub} />
          <Text style={styles.lockedTitle}>Day {dayNumber} is Locked</Text>
          <Text style={styles.lockedSub}>
            This day will unlock when the time comes.{"\n"}Keep going with your current routine!
          </Text>
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

  const totalSeconds = safeDay.exercises.reduce((acc, ex) => acc + (ex.durationSeconds ?? 30), 0);
  const totalLabel = minutesLabelFromSeconds(totalSeconds);

  async function handleCompletion(exerciseId: string) {
    const key = `${safeProgram.programId}:${safeDay.dayNumber}:${exerciseId}`;
    const wasDone = !!completions[key];
    const willCompleteDay =
      !wasDone &&
      safeDay.exercises.every((ex) => {
        if (ex.id === exerciseId) return true;
        const otherKey = `${safeProgram.programId}:${safeDay.dayNumber}:${ex.id}`;
        return !!completions[otherKey];
      });

    setSubmitting(true);
    try {
      await toggleCompletion(safeDay.dayNumber, exerciseId);

      if (willCompleteDay) {
        setShowConfirmation(false);
        setSelectedId(null);
        setModalView("action");
        setTimeout(() => setShowDayComplete(true), 150);
        return;
      }

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
        <View style={styles.preferredHeaderRow}>
          <BackPill onPress={() => router.back()} />
          <View style={styles.preferredHeaderCenter}>
            <Text style={styles.preferredDayTitle}>Day {safeDay.dayNumber}</Text>
          </View>
          <View style={styles.preferredHeaderRight}>
            <Text style={styles.preferredTotalLabel}>{totalLabel}</Text>
          </View>
        </View>
        <Text style={styles.preferredPhaseText}>{formatPhase(safeDay.phase)}</Text>
        <Text style={styles.preferredFocusText} numberOfLines={1}>
          Focus: {safeDay.focusAreas.join(", ")}{safeDay.isRecovery ? " - Recovery" : ""}
        </Text>

        <Banner text={getContextLineForDay(programType, safeDay.phase)} />

        {safeDay.isRecovery ? (
          <View style={styles.recoveryPill}>
            <Text style={styles.recoveryText}>Active recovery - lighter intensity</Text>
          </View>
        ) : null}

        <View style={styles.preferredSectionHeader}>
          <Text style={styles.preferredSectionTitle}>Exercises</Text>
          <Text style={styles.preferredSectionHint}>
            {dayCompleted ? "All done" : "Tap a card or Start"}
          </Text>
        </View>

        <View style={styles.preferredExerciseList}>
          {safeDay.exercises.map((ex) => {
            const key = `${safeProgram.programId}:${safeDay.dayNumber}:${ex.id}`;
            const done = !!completions[key];
            const summary = summarizeTargets(ex.targets);

            return (
              <Pressable
                key={ex.id}
                onPress={() => {
                  setSelectedId(ex.id);
                  setModalView("action");
                }}
                style={({ pressed }) => [
                  styles.preferredExerciseCard,
                  pressed ? styles.preferredExerciseCardPressed : null,
                ]}
              >
                <View style={styles.preferredExerciseRow}>
                  <View style={styles.preferredExerciseLeft}>
                    <Text style={styles.preferredExerciseTitle} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={styles.preferredSummary} numberOfLines={1}>
                      {summary}
                    </Text>
                  </View>
                  <View style={styles.preferredExerciseRight}>
                    <StartPill
                      onPress={() => {
                        setSelectedId(ex.id);
                        setModalView("action");
                      }}
                    />
                    <CompletionDot done={done} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {showConfirmation ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={styles.confirmationBox}
              >
                <View style={styles.confirmationIconWrap}>
                  <Ionicons name="checkmark" size={18} color={COLORS.accent} />
                </View>
                <Text style={styles.confirmationText}>Exercise marked complete!</Text>
              </Animated.View>
            ) : modalView === "action" ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, styles.modalTitleHeader]} numberOfLines={1}>
                    {selected?.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSelectedId(null);
                      setModalView("action");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={({ pressed }) => [
                      styles.modalCloseIcon,
                      pressed ? styles.modalCloseIconPressed : null,
                    ]}
                  >
                    <Text style={styles.modalCloseIconText}>✕</Text>
                  </Pressable>
                </View>

                <Text style={styles.modalText}>What would you like to do?</Text>
                <View style={styles.modalActions}>
                  <PillNavButton
                    kind="ghost"
                    label={submitting ? "Saving..." : "Completed"}
                    onPress={() => selected && handleCompletion(selected.id)}
                    disabled={submitting}
                  />
                  <PillNavButton
                    kind="solid"
                    label="Guide"
                    onPress={() => {
                      const id = selected?.id;
                      setSelectedId(null);
                      setModalView("action");
                      if (id) {
                        router.push({
                          pathname: "/program/guide/[exerciseId]",
                          params: { exerciseId: id },
                        });
                      }
                    }}
                    disabled={submitting}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <DayCompleteModal
        visible={showDayComplete}
        dayNumber={safeDay.dayNumber}
        autoDismissMs={0}
        dismissOnBackdropPress={false}
        particles
        onClose={() => {
          setShowDayComplete(false);
          // Show mood check after celebration
          setTimeout(() => setShowMoodCheck(true), 200);
        }}
      />

      <MoodCheckModal
        visible={showMoodCheck}
        dayNumber={safeDay.dayNumber}
        onSelect={(mood) => {
          setDayMood(safeDay.dayNumber, mood);
          setShowMoodCheck(false);
        }}
        onSkip={() => setShowMoodCheck(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgBottom },
  container: { padding: SP[4], gap: SP[3], paddingBottom: SP[6] },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP[3], paddingHorizontal: SP[5] },
  empty: { color: COLORS.text, fontSize: 16, fontFamily: "Poppins-SemiBold" },
  lockedTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    marginTop: SP[2],
  },
  lockedSub: {
    color: COLORS.sub,
    fontSize: 14,
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
    lineHeight: 22,
  },
  backPill: {
    height: 44,
    paddingHorizontal: SP[3],
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  backPillPressed: { transform: [{ translateY: 1 }] },
  backPillText: { color: COLORS.text, fontSize: 14, fontFamily: "Poppins-SemiBold" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    padding: SP[3],
    backgroundColor: "rgba(180,243,77,0.08)",
    borderColor: "rgba(180,243,77,0.35)",
    borderWidth: 1,
    borderRadius: RADII.lg,
  },
  bannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(180,243,77,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.35)",
  },
  bannerIconText: { color: COLORS.accent, fontSize: 14, fontFamily: "Poppins-SemiBold" },
  bannerText: { flex: 1, color: COLORS.accent, fontSize: 13, fontFamily: "Poppins-SemiBold", lineHeight: 18 },

  completionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  completionDotTodo: { borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  completionDotDone: {
    borderWidth: 2,
    borderColor: "rgba(180,243,77,0.8)",
    backgroundColor: "rgba(180,243,77,0.35)",
  },
  completionDotText: { color: "#0B0B0B", fontSize: 14, fontFamily: "Poppins-SemiBold" },

  startPill: {
    minWidth: 88,
    height: 36,
    paddingHorizontal: SP[3],
    borderRadius: RADII.pill,
    backgroundColor: "rgba(180,243,77,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  startPillPressed: { transform: [{ translateY: 1 }] },
  startPillText: { color: "#0B0B0B", fontSize: 15, fontFamily: "Poppins-SemiBold" },

  preferredHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  preferredHeaderCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  preferredHeaderRight: { minWidth: 100, alignItems: "flex-end" },
  preferredDayTitle: { color: COLORS.text, fontSize: 28, fontFamily: "Poppins-SemiBold" },
  preferredTotalLabel: { color: COLORS.sub, fontSize: 12, fontFamily: "Poppins-SemiBold" },
  preferredPhaseText: { color: COLORS.sub, fontSize: 13, marginTop: 2, textAlign: "center", fontFamily: "Poppins-SemiBold" },
  preferredFocusText: { color: COLORS.sub, fontSize: 13, textAlign: "center", fontFamily: "Poppins-SemiBold" },

  preferredSectionHeader: { flexDirection: "row", alignItems: "center", marginTop: SP[2] },
  preferredSectionTitle: { color: COLORS.text, fontSize: 18, fontFamily: "Poppins-SemiBold", flex: 1 },
  preferredSectionHint: { color: COLORS.sub, fontSize: 12, fontFamily: "Poppins-SemiBold" },

  preferredExerciseList: { gap: SP[3] },
  preferredExerciseCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: RADII.lg,
    padding: SP[3],
  },
  preferredExerciseCardPressed: { transform: [{ translateY: 1 }], opacity: 0.98 },
  preferredExerciseRow: { flexDirection: "row", alignItems: "center", gap: SP[3] },
  preferredExerciseLeft: { flex: 1, gap: 6 },
  preferredExerciseTitle: { color: COLORS.text, fontSize: 16, fontFamily: "Poppins-SemiBold" },
  preferredMetaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: SP[2],
    paddingVertical: 4,
    borderRadius: RADII.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  preferredMetaText: { color: COLORS.sub, fontSize: 11, fontFamily: "Poppins-SemiBold" },
  preferredSummary: { color: COLORS.sub, fontSize: 12, lineHeight: 16, fontFamily: "Poppins-SemiBold" },
  preferredExerciseRight: { flexDirection: "row", alignItems: "center", gap: SP[2] },
  recoveryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    backgroundColor: "rgba(180,243,77,0.12)",
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADII.pill,
  },
  recoveryText: { color: COLORS.accent, fontWeight: "700", fontFamily: "Poppins-SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP[4],
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    padding: SP[4],
    gap: SP[3],
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[2],
  },
  modalCloseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseIconPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  modalCloseIconText: { color: COLORS.text, fontSize: 16, fontFamily: "Poppins-SemiBold" },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700", fontFamily: "Poppins-SemiBold" },
  modalTitleHeader: { flex: 1 },
  modalText: { color: COLORS.sub, fontSize: 13, lineHeight: 18, fontFamily: "Poppins-SemiBold" },
  modalActions: { width: "100%", flexDirection: "row", gap: SP[2] },
  confirmationBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP[3],
    padding: SP[4],
    backgroundColor: COLORS.accentGlow,
    borderRadius: RADII.lg,
    borderColor: COLORS.accentBorder,
    borderWidth: 1,
  },
  confirmationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(180,243,77,0.25)",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationText: {
    color: COLORS.accent,
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
});
