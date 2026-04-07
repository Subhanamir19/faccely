// app/(tabs)/dev.tsx
// Developer tooling screen — only reachable in __DEV__ builds.

import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  ImageBackground,
} from "react-native";
import InsightRevealCard from "@/components/scores/InsightRevealCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import T from "@/components/ui/T";
import GlassCard from "@/components/ui/GlassCard";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ConsentModalInner } from "@/hooks/useAdvancedAnalysisConsent";
import DayCompleteModal from "@/components/ui/DayCompleteModal";
import ComebackModal from "@/components/ui/ComebackModal";
import StreakCelebrationModal from "@/components/ui/StreakCelebrationModal";
import HalfwayHypeModal from "@/components/ui/HalfwayHypeModal";
import DidYouKnowModal from "@/components/ui/DidYouKnowModal";
import { resetAllLifeModalFlags, DID_YOU_KNOW_FACTS } from "@/lib/lifeModals";
import { useTasksStore } from "@/store/tasks";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONSENT_KEY = "advanced_analysis_consent";

const ONBOARDING_SCREENS: { label: string; route: string }[] = [
  { label: "Splash",           route: "/(onboarding)/splash" },
  { label: "Transformation",   route: "/(onboarding)/transformation" },
  { label: "Goals",            route: "/(onboarding)/goals" },
  { label: "Use Case",         route: "/(onboarding)/use-case" },
  { label: "Gender",           route: "/(onboarding)/gender" },
  { label: "Age",              route: "/(onboarding)/age" },
  { label: "Ethnicity",        route: "/(onboarding)/ethnicity" },
  { label: "Edge",             route: "/(onboarding)/edge" },
  { label: "Face Scan",        route: "/(onboarding)/face-scan" },
  { label: "Trust",            route: "/(onboarding)/trust" },
  { label: "Score Teaser",     route: "/(onboarding)/score-teaser" },
  { label: "Improve Areas",    route: "/(onboarding)/improve-areas" },
  { label: "Time Dedication",  route: "/(onboarding)/time-dedication" },
  { label: "Routine Animation",route: "/(onboarding)/routine-animation" },
  { label: "Results Reveal",   route: "/(onboarding)/results-reveal" },
  { label: "Score Projection", route: "/(onboarding)/score-projection" },
  { label: "Paywall",          route: "/(onboarding)/paywall" },
];

// ---------------------------------------------------------------------------
// Small reusable row button
// ---------------------------------------------------------------------------
function DevButton({
  label,
  onPress,
  accent,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.devBtn, accent && styles.devBtnAccent]}
    >
      <T style={[styles.devBtnText, accent && styles.devBtnTextAccent]}>{label}</T>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <T style={styles.sectionTitle}>{title}</T>
      {subtitle ? <T style={styles.sectionSubtitle}>{subtitle}</T> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const SCAN_BYPASS_KEY = "dev_bypass_scan_limit";

export default function DevScreen() {
  const [consentValue, setConsentValue] = useState<string | null | "…">("…");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [dayCompleteVisible, setDayCompleteVisible] = useState(false);
  const [insightPreviewVisible, setInsightPreviewVisible] = useState(false);
  const [insightPreviewKey, setInsightPreviewKey] = useState(0); // bump to replay
  const currentStreak = useTasksStore((s) => s.currentStreak);
  const history       = useTasksStore((s) => s.history);
  const dayNumber     = history.length + 1; // total days since user started
  const [scanBypass, setScanBypass] = useState<boolean | "…">("…");

  // Life modal previews
  type LifeModal = "comeback" | "streak" | "halfway" | "didyouknow";
  const [lifeModal, setLifeModal] = useState<LifeModal | null>(null);
  const [celebMilestone, setCelebMilestone] = useState(0);
  const [previewFact] = useState(
    DID_YOU_KNOW_FACTS[Math.floor(Math.random() * DID_YOU_KNOW_FACTS.length)],
  );

  const refreshConsent = useCallback(async () => {
    const val = await AsyncStorage.getItem(CONSENT_KEY);
    setConsentValue(val);
  }, []);

  const refreshScanBypass = useCallback(async () => {
    const val = await AsyncStorage.getItem(SCAN_BYPASS_KEY);
    setScanBypass(val === "true");
  }, []);

  useEffect(() => {
    void refreshConsent();
    void refreshScanBypass();
  }, [refreshConsent, refreshScanBypass]);

  const handleResetConsent = async () => {
    await AsyncStorage.removeItem(CONSENT_KEY);
    await refreshConsent();
    Alert.alert("Reset", "Consent cleared — gate will fire on next Advanced Analysis tap.");
  };

  const consentStatus =
    consentValue === "…"
      ? "Loading…"
      : consentValue
      ? `Granted · ${consentValue}`
      : "Not granted";

  const consentColor =
    consentValue === "…" ? COLORS.sub : consentValue ? COLORS.success : COLORS.sub;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <T style={styles.screenTitle}>Dev Tools</T>

        {/* ── Onboarding ─────────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Onboarding"
            subtitle="Jump to any screen or run the full sequence"
          />

          {/* Full sequence launcher */}
          <DevButton
            label="▶  Run Full Sequence (from Intro)"
            accent
            onPress={() => router.push("/(onboarding)/splash")}
          />

          {/* Divider */}
          <View style={styles.divider} />

          {/* Individual screens */}
          <T style={styles.subLabel}>Individual screens</T>
          <View style={styles.screenGrid}>
            {ONBOARDING_SCREENS.map(({ label, route }) => (
              <TouchableOpacity
                key={route}
                style={styles.screenChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Advanced Analysis UI Preview ─────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Advanced Analysis"
            subtitle="3-section accordion breakdown — What's Working / Just Okay / Needs Work"
          />
          <DevButton
            label="▶  Preview UI"
            accent
            onPress={() => router.push("/(tabs)/analysis")}
          />
        </GlassCard>

        {/* ── Insight Reveal Preview ────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Insight Reveal (new score screen)"
            subtitle="Two-section animated reveal: What's working / Needs attention"
          />
          <DevButton
            label="▶  Preview Full Screen"
            accent
            onPress={() => {
              setInsightPreviewKey((k) => k + 1);
              setInsightPreviewVisible(true);
            }}
          />
        </GlassCard>

        {/* ── Day Complete Modal ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Day Complete Modal"
            subtitle="Celebration shown when all tasks are finished"
          />
          <DevButton
            label="▶  Preview Modal"
            accent
            onPress={() => setDayCompleteVisible(true)}
          />
        </GlassCard>

        {/* ── Consent Modal ──────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Consent Modal"
            subtitle="Advanced Analysis gate"
          />

          <View style={styles.statusRow}>
            <T style={styles.statusLabel}>Storage value</T>
            <T style={[styles.statusValue, { color: consentColor }]} numberOfLines={1}>
              {consentStatus}
            </T>
          </View>

          <View style={styles.row}>
            <DevButton
              label="Preview Modal"
              accent
              onPress={() => setPreviewVisible(true)}
            />
            <DevButton label="Reset Consent" onPress={handleResetConsent} />
          </View>
        </GlassCard>

        {/* ── Life Moment Modals ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Life Moment Modals"
            subtitle="Pose overlays that appear on the daily routine screen"
          />

          <DevButton
            label="😬  Comeback  (2+ days absent)"
            accent
            onPress={() => setLifeModal("comeback")}
          />
          <DevButton
            label={`🔥  Streak — Day ${currentStreak} (real)`}
            accent
            onPress={() => { setCelebMilestone(currentStreak); setLifeModal("streak"); }}
          />
          <DevButton
            label="👍  Halfway Hype  (50% tasks done)"
            accent
            onPress={() => setLifeModal("halfway")}
          />
          <DevButton
            label="💡  Did You Know"
            accent
            onPress={() => setLifeModal("didyouknow")}
          />

          <View style={styles.divider} />

          <DevButton
            label="Reset All Life Modal Flags"
            onPress={async () => {
              await resetAllLifeModalFlags();
              Alert.alert("Reset", "All life modal flags cleared.\nSession flags reset on next app restart.");
            }}
          />
        </GlassCard>

        {/* ── New Exercise Previews ─────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="New Exercise Preview"
            subtitle="Preview the 2 new exercises in the session player"
          />
          <DevButton
            label="▶  Midface Lift"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=midface-exercise" as any)}
          />
          <DevButton
            label="▶  Lower Face Lift"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=lowerface-exercise" as any)}
          />
          <DevButton
            label="▶  Both Together"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=midface-exercise,lowerface-exercise" as any)}
          />
        </GlassCard>

        {/* ── Daily Flow Screen Previews ────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Daily Flow Screens"
            subtitle="Preview the 4-screen daily workflow"
          />
          <View style={styles.screenGrid}>
            {[
              { label: "🔥  Streak Screen",       route: "/program/streak" },
              { label: "💪  Workout Reveal",       route: "/program/workout-reveal" },
              { label: "📋  Exercise List",        route: "/program/list" },
              { label: "▶  Session Player",       route: "/program/session" },
              { label: "🏆  Completion Screen",    route: "/program/complete" },
            ].map(({ label, route }) => (
              <TouchableOpacity
                key={route}
                style={styles.screenChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Tasks / Exercises ─────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Today's Exercises"
            subtitle="Reset completion state for UI testing"
          />
          <DevButton
            label="↺  Rebuild Diet Protocols"
            accent
            onPress={() => {
              useTasksStore.getState().rebuildProtocols();
              Alert.alert("Done", "Diet protocols rebuilt from updated catalog.");
            }}
          />
          <DevButton
            label="↺  Uncheck All Exercises"
            accent
            onPress={() => {
              const { today } = useTasksStore.getState();
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              const { uncompleteTask } = useTasksStore.getState();
              today.tasks.forEach((t) => {
                if (t.status === "completed") uncompleteTask(t.exerciseId);
              });
              Alert.alert("Done", "All exercises reset to pending.");
            }}
          />
        </GlassCard>

        {/* ── Scan Limit Bypass ──────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Scan Limit Bypass"
            subtitle="Skip the 24-hour rolling window for testing"
          />

          <View style={styles.statusRow}>
            <T style={styles.statusLabel}>Status</T>
            <T
              style={[
                styles.statusValue,
                {
                  color:
                    scanBypass === "…"
                      ? COLORS.sub
                      : scanBypass
                      ? COLORS.success
                      : COLORS.sub,
                },
              ]}
              numberOfLines={1}
            >
              {scanBypass === "…" ? "Loading…" : scanBypass ? "Bypassed ✓" : "Enforced (normal)"}
            </T>
          </View>

          <View style={styles.row}>
            <DevButton
              label="Enable Bypass"
              accent
              onPress={async () => {
                await AsyncStorage.setItem(SCAN_BYPASS_KEY, "true");
                await refreshScanBypass();
              }}
            />
            <DevButton
              label="Disable Bypass"
              onPress={async () => {
                await AsyncStorage.removeItem(SCAN_BYPASS_KEY);
                await refreshScanBypass();
              }}
            />
          </View>
        </GlassCard>
      </ScrollView>

      {/* Day Complete preview modal */}
      <DayCompleteModal
        visible={dayCompleteVisible}
        dayNumber={dayNumber}
        streak={currentStreak}
        onClose={() => setDayCompleteVisible(false)}
        dismissOnBackdropPress
      />

      {/* Consent preview modal — no storage interaction */}
      <ConsentModalInner
        visible={previewVisible}
        onAgree={() => {
          setPreviewVisible(false);
          Alert.alert("Preview only", '"I Agree" tapped — nothing was saved.');
        }}
        onCancel={() => setPreviewVisible(false)}
      />

      {/* ── Insight Reveal full-screen preview ──────────────────────── */}
      <Modal
        visible={insightPreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setInsightPreviewVisible(false)}
      >
        <ImageBackground
          source={require("../../assets/bg/score-bg.jpg")}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" }} />
          <SafeAreaView style={{ flex: 1 }}>
            {/* Close + replay header */}
            <View style={styles.previewHeader}>
              <T style={styles.previewTitle}>Score Screen Preview</T>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => {
                    setInsightPreviewKey((k) => k + 1);
                  }}
                  hitSlop={12}
                  style={styles.previewBtn}
                >
                  <T style={styles.previewBtnText}>↺  Replay</T>
                </Pressable>
                <Pressable
                  onPress={() => setInsightPreviewVisible(false)}
                  hitSlop={12}
                  style={[styles.previewBtn, styles.previewBtnClose]}
                >
                  <T style={styles.previewBtnText}>✕  Close</T>
                </Pressable>
              </View>
            </View>

            {/* The card itself with mock data */}
            <InsightRevealCard
              key={insightPreviewKey}
              totalScore={71}
              imageUri={null}
              metrics={[
                { label: "Jawline",       score: 78 },
                { label: "Cheekbones",    score: 82 },
                { label: "Eye Symmetry",  score: 69 },
                { label: "Symmetry",      score: 74 },
                { label: "Masculinity",   score: 67 },
                { label: "Skin Quality",  score: 54 },
                { label: "Nose Balance",  score: 60 },
              ]}
            />
          </SafeAreaView>
        </ImageBackground>
      </Modal>

      {/* Life moment modal previews */}
      <ComebackModal
        visible={lifeModal === "comeback"}
        missedDays={3}
        onClose={() => setLifeModal(null)}
      />
      <StreakCelebrationModal
        visible={lifeModal === "streak"}
        streakDays={celebMilestone}
        onClose={() => setLifeModal(null)}
      />
      <HalfwayHypeModal
        visible={lifeModal === "halfway"}
        completedCount={3}
        totalCount={5}
        onClose={() => setLifeModal(null)}
      />
      <DidYouKnowModal
        visible={lifeModal === "didyouknow"}
        fact={previewFact}
        onClose={() => setLifeModal(null)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  content: {
    paddingHorizontal: SP[4],
    paddingTop: SP[5],
    paddingBottom: SP[12],
    gap: SP[4],
  },
  screenTitle: {
    fontSize: 26,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: SP[1],
  },

  // Card
  card: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    gap: SP[3],
  },

  // Section header
  sectionHeader: {
    gap: SP[1],
    marginBottom: SP[1],
  },
  sectionTitle: {
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: SP[1],
  },

  subLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: "Poppins-Regular",
  },

  // Screen grid
  screenGrid: {
    gap: SP[2],
  },
  screenChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  screenChipText: {
    fontSize: 14,
    color: COLORS.dim,
  },
  screenChipArrow: {
    fontSize: 14,
    color: COLORS.sub,
  },

  // Dev buttons
  devBtn: {
    flex: 1,
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
  },
  devBtnAccent: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.accentBorder,
  },
  devBtnText: {
    fontSize: 14,
    color: COLORS.dim,
  },
  devBtnTextAccent: {
    color: COLORS.accent,
  },

  // Consent status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SP[2],
    paddingHorizontal: SP[3],
    borderRadius: RADII.sm,
    backgroundColor: COLORS.whiteGlass,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
  },
  statusValue: {
    fontSize: 12,
    color: COLORS.sub,
    flex: 1,
    textAlign: "right",
    fontFamily: "Poppins-Regular",
  },

  // Row of two buttons
  row: {
    flexDirection: "row",
    gap: SP[3],
  },

  // Insight preview modal header
  previewHeader: {
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
    marginBottom: SP[2],
  },
  previewTitle: {
    fontSize: 15,
    color: COLORS.text,
  },
  previewActions: {
    flexDirection: "row",
    gap: SP[2],
  },
  previewBtn: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  previewBtnClose: {
    borderColor: "rgba(255,80,80,0.3)",
    backgroundColor: "rgba(255,80,80,0.08)",
  },
  previewBtnText: {
    fontSize: 13,
    color: COLORS.dim,
  },
});
