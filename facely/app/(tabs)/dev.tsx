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
import { BlueprintModal } from "@/components/analysis/BlueprintModal";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useScores } from "@/store/scores";
import type { AdvancedAnalysis } from "@/lib/api/advancedAnalysis";
import ProgramHero from "@/components/program/ProgramHero";
import InsightPulseCard, { PulseType } from "@/components/ui/InsightPulseCard";
import { useNotifications } from "@/store/notifications";
import RingLoader, { type RingLoaderKind } from "@/components/ui/RingLoader";
import { Image as RNImage } from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONSENT_KEY = "advanced_analysis_consent";

// Actual sequence the user sees from a fresh install.
// Entry is /(onboarding)/splash (see app/index.tsx). Each step's router.push
// traced to confirm the chain. End: /(tabs)/program.
const ONBOARDING_FLOW_SCREENS: { label: string; route: string }[] = [
  { label: "Splash",            route: "/(onboarding)/splash" },           // → warmup
  { label: "Warmup",            route: "/(onboarding)/warmup" },           // → goals
  { label: "Goals",             route: "/(onboarding)/goals" },            // → gender
  { label: "Gender",            route: "/(onboarding)/gender" },           // → age
  { label: "Birthday",          route: "/(onboarding)/age" },              // → ethnicity
  { label: "Ethnicity",         route: "/(onboarding)/ethnicity" },        // → scan
  { label: "Scan",              route: "/(onboarding)/scan" },             // → trust
  { label: "Trust",             route: "/(onboarding)/trust" },            // → time-dedication
  { label: "Time Dedication",   route: "/(onboarding)/time-dedication" },  // → routine-animation
  { label: "Routine Animation", route: "/(onboarding)/routine-animation" },// → score-projection
  { label: "Score Projection",  route: "/(onboarding)/score-projection" }, // → features
  { label: "Features",          route: "/(onboarding)/features" },         // → transformation
  { label: "Transformation",    route: "/(onboarding)/transformation" },   // → paywall
  { label: "Paywall",           route: "/(onboarding)/paywall" },          // → score-teaser
  { label: "Score Teaser",      route: "/(onboarding)/score-teaser" },     // → (tabs)/program
];

// Screens that exist but are NOT reachable from the main splash → score-teaser flow.
// Preview only.
const ONBOARDING_ORPHANS: { label: string; route: string; note: string }[] = [
  { label: "Hook",            route: "/(onboarding)/hook",           note: "alt entry — only used by loading.tsx for returning users" },
  { label: "Intro",           route: "/(onboarding)/intro",          note: "routes to goals, but nothing routes to intro except hook" },
  { label: "Improve Areas",   route: "/(onboarding)/improve-areas",  note: "removed from live flow — duplicated goals selection" },
  { label: "Welcome",         route: "/(onboarding)/welcome",        note: "legacy entry — no inbound route" },
  { label: "Experience",      route: "/(onboarding)/experience",     note: "no inbound route" },
  { label: "Face Scan (alt)", route: "/(onboarding)/face-scan",      note: "alt to /scan" },
  { label: "Results Reveal",  route: "/(onboarding)/results-reveal", note: "legacy" },
  { label: "Building Plan",   route: "/(onboarding)/building-plan",  note: "unlinked" },
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

  // Program hero preview
  const [heroVisible, setHeroVisible] = useState(false);
  const HERO_ZONE_SETS = [
    ["jawline", "cheekbones"],
    ["eyes", "cheekbones"],
    ["jawline", "nose"],
    ["eyes", "jawline", "cheekbones"],
  ];
  const [heroZoneIdx, setHeroZoneIdx] = useState(0);

  // Blueprint modal preview
  const [blueprintVisible, setBlueprintVisible] = useState(false);
  const [loaderPreviewVisible, setLoaderPreviewVisible] = useState(false);
  const [loaderKindIdx, setLoaderKindIdx] = useState(0);
  const { data: advancedData } = useAdvancedAnalysis();
  const { imageUri } = useScores();
  const MOCK_ADVANCED: AdvancedAnalysis = {
    cheekbones: { width: "", width_score: 48, width_verdict: "", maxilla: "", maxilla_score: 38, maxilla_verdict: "", bone_structure: "", bone_structure_score: 52, bone_structure_verdict: "", face_fat: "", face_fat_score: 41, face_fat_verdict: "" },
    jawline:    { development: "", development_score: 44, development_verdict: "", gonial_angle: "", gonial_angle_score: 62, gonial_angle_verdict: "", projection: "", projection_score: 35, projection_verdict: "" },
    eyes:       { canthal_tilt: "", canthal_tilt_score: 57, canthal_tilt_verdict: "", eye_type: "", eye_type_score: 66, eye_type_verdict: "", brow_volume: "", brow_volume_score: 71, brow_volume_verdict: "", symmetry: "", symmetry_score: 49, symmetry_verdict: "" },
    skin:       { color: "", color_score: 73, color_verdict: "", quality: "", quality_score: 60, quality_verdict: "" },
  };

  // Insight Pulse preview
  const PULSE_VARIANTS: {
    type: PulseType;
    message: string;
    detail: string;
    ctaLabel: string;
  }[] = [
    {
      type: "momentum",
      message: "Jawline definition improved 4.1% this week",
      detail: "Based on your last 3 scans. Your best streak yet — mewing + posture work is showing.",
      ctaLabel: "View Full Breakdown",
    },
    {
      type: "alert",
      message: "Facial symmetry dipped 2.3% since last scan",
      detail: "Could be sleep, hydration, or lighting. Don't sweat it — scan again tomorrow.",
      ctaLabel: "See What Changed",
    },
    {
      type: "milestone",
      message: "New personal best — overall score: 8.3 / 10",
      detail: "Top 18% in facial harmony this month. You're trending up across 5 metrics.",
      ctaLabel: "See Full Report",
    },
    {
      type: "insight",
      message: "Your cheekbone score has improved 3 weeks in a row",
      detail: "Consistent gains suggest your routine is working. Keep the mewing pressure consistent.",
      ctaLabel: "View Trend",
    },
    {
      type: "nudge",
      message: "It's been 4 days since your last scan",
      detail: "",
      ctaLabel: "",
    },
  ];
  const [pulseVariantIdx, setPulseVariantIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0); // bump to remount

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

        {/* ── Insight Pulse Preview ─────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Insight Pulse Card"
            subtitle="In-app notification banner — tap card to expand, × to dismiss"
          />

          {/* Live preview inline */}
          <InsightPulseCard
            key={pulseKey}
            type={PULSE_VARIANTS[pulseVariantIdx].type}
            message={PULSE_VARIANTS[pulseVariantIdx].message}
            detail={PULSE_VARIANTS[pulseVariantIdx].detail || undefined}
            ctaLabel={PULSE_VARIANTS[pulseVariantIdx].ctaLabel || undefined}
            autoDismissMs={0}
            onDismiss={() => setPulseKey((k) => k + 1)}
          />

          {/* Variant switcher */}
          <View style={styles.row}>
            <DevButton
              label="◀  Prev"
              onPress={() => {
                setPulseVariantIdx((i) => (i - 1 + PULSE_VARIANTS.length) % PULSE_VARIANTS.length);
                setPulseKey((k) => k + 1);
              }}
            />
            <DevButton
              label="Next  ▶"
              onPress={() => {
                setPulseVariantIdx((i) => (i + 1) % PULSE_VARIANTS.length);
                setPulseKey((k) => k + 1);
              }}
            />
          </View>

          <DevButton
            label="↺  Replay Animation"
            accent
            onPress={() => setPulseKey((k) => k + 1)}
          />

          <T style={styles.sectionSubtitle} variant="small" color="sub">
            {pulseVariantIdx + 1} / {PULSE_VARIANTS.length} — {PULSE_VARIANTS[pulseVariantIdx].type.toUpperCase()}
          </T>

          <View style={styles.divider} />

          <DevButton
            label="🗑  Reset All Notification Cooldowns"
            onPress={async () => {
              await useNotifications.getState().resetCooldowns();
              Alert.alert("Reset", "All cooldowns cleared — notifications will re-evaluate on next dashboard focus.");
            }}
          />
        </GlassCard>

        {/* ── Onboarding Flow ────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Onboarding Flow"
            subtitle="Screens in the order they appear to the user"
          />

          {/* Full sequence launcher */}
          <DevButton
            label="▶  Run Full Sequence (from Splash)"
            accent
            onPress={() => router.push("/(onboarding)/splash")}
          />

          <View style={styles.divider} />

          <T style={styles.subLabel}>Step-by-step · tap to preview</T>
          <View style={styles.screenGrid}>
            {ONBOARDING_FLOW_SCREENS.map(({ label, route }, idx) => (
              <TouchableOpacity
                key={route}
                style={styles.flowChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.flowIndex}>
                  <T style={styles.flowIndexText}>{String(idx + 1).padStart(2, "0")}</T>
                </View>
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* ── Orphan Onboarding Screens ──────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Orphan Screens"
            subtitle="Exist but not reachable from the main onboarding flow"
          />
          <View style={styles.screenGrid}>
            {ONBOARDING_ORPHANS.map(({ label, route, note }) => (
              <TouchableOpacity
                key={route}
                style={styles.orphanChip}
                onPress={() => router.push(route as any)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <T style={styles.screenChipText}>{label}</T>
                  <T style={styles.orphanNote}>{note}</T>
                </View>
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

        {/* ── Blueprint Modal Preview ───────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Blueprint Modal"
            subtitle={advancedData ? "Using real scan data" : "Using mock data (no scan yet)"}
          />
          <DevButton
            label="▶  Preview Modal"
            accent
            onPress={() => setBlueprintVisible(true)}
          />
        </GlassCard>

        {/* ── Loaders Preview ───────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Loaders"
            subtitle="Ring loader — mascot · user photo · brand. Switch via header."
          />
          <DevButton
            label="▶  Preview All Loaders"
            accent
            onPress={() => {
              setLoaderKindIdx(0);
              setLoaderPreviewVisible(true);
            }}
          />
        </GlassCard>

        {/* ── Score Card Shortcut ───────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Score Card"
            subtitle="Jump directly to the live scoring screen"
          />
          <DevButton
            label="▶  Open Score Screen"
            accent
            onPress={() => router.push("/(tabs)/score" as any)}
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

        {/* ── Session Completion Screen ─────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Session Completion Screen"
            subtitle="Redesigned: stats → streak ring → tomorrow card hierarchy"
          />
          <DevButton
            label="▶  Preview (2 / 5 done)"
            accent
            onPress={() => router.push("/program/complete?doneCount=2&total=5" as any)}
          />
          <DevButton
            label="▶  Preview (5 / 5 done)"
            accent
            onPress={() => router.push("/program/complete?doneCount=5&total=5" as any)}
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

        {/* ── 3 Newest Exercises ────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="3 New Exercises"
            subtitle="Guide screen + session player previews"
          />
          {[
            { label: "Chin Stretch",         id: "chin-stretch" },
            { label: "Neck Stretch",         id: "neck-stretch" },
            { label: "Tongue Posture Press", id: "tongue-touching" },
            { label: "Side Tongue Stretch",  id: "side-tongue" },
          ].map(({ label, id }) => (
            <View key={id} style={styles.row}>
              <DevButton
                label={`Guide — ${label}`}
                accent
                onPress={() => router.push(`/program/guide/${id}` as any)}
              />
              <DevButton
                label="Session"
                accent
                onPress={() => router.push(`/program/session?previewExerciseIds=${id}` as any)}
              />
            </View>
          ))}
          <DevButton
            label="▶  All 4 Together"
            accent
            onPress={() => router.push("/program/session?previewExerciseIds=chin-stretch,neck-stretch,tongue-touching,side-tongue" as any)}
          />
        </GlassCard>

        {/* ── Exercise Timer Preview ───────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Exercise Timer Preview"
            subtitle="Preview every exercise exactly as it appears in the session player"
          />
          <View style={styles.screenGrid}>
            {[
              { label: "Neck & Jawline Extension", id: "jawline-1" },
              { label: "Chin Tuck",                id: "chin-tucks" },
              { label: "Fish Face",                id: "fish-face" },
              { label: "Gua Sha Sculpting",        id: "gua-sha" },
              { label: "Eyelid Isolation Squint",  id: "hunter-eyes-1" },
              { label: "Hunter Eyes Squinch",      id: "hunter-eyes-2" },
              { label: "Jaw Resistance Press",     id: "jaw-resistance" },
              { label: "Lymphatic Drainage",       id: "lymphatic-drainage" },
              { label: "Neck Lift",                id: "neck-lift-1" },
              { label: "Skyward Neck Stretch",     id: "neck-lift-2" },
              { label: "Nasal Bridge Sculpting",   id: "nose-massage" },
              { label: "Nose Contouring Massage",  id: "slim-nose-massage" },
              { label: "Neck Curls",               id: "neck-curls" },
              { label: "Towel Chewing",            id: "towel-chewing" },
              { label: "Cheek Puffs",              id: "alternating-cheek-puffs" },
              { label: "Midface Lift",             id: "midface-exercise" },
              { label: "Lower Face Lift",          id: "lowerface-exercise" },
              { label: "Chin Training",            id: "chin-training" },
              { label: "Chin Stretch",             id: "chin-stretch" },
              { label: "Neck Stretch",             id: "neck-stretch" },
              { label: "Tongue Posture Press",     id: "tongue-touching" },
              { label: "Side Tongue Stretch",      id: "side-tongue" },
            ].map(({ label, id }) => (
              <TouchableOpacity
                key={id}
                style={styles.screenChip}
                onPress={() => router.push(`/program/session?previewExerciseIds=${id}` as any)}
                activeOpacity={0.7}
              >
                <T style={styles.screenChipText}>{label}</T>
                <T style={styles.screenChipArrow}>→</T>
              </TouchableOpacity>
            ))}
          </View>
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

        {/* ── Program Hero ──────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Program Hero"
            subtitle="Mascot header with animated zone overlays — exercise screen top section"
          />
          <DevButton
            label="▶  Preview Hero"
            accent
            onPress={() => setHeroVisible(true)}
          />
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
            label="✓  Complete All Exercises (preview all-done state)"
            accent
            onPress={() => {
              const { today, completeTask } = useTasksStore.getState();
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              today.tasks.forEach((t) => {
                if (t.status !== "completed") completeTask(t.exerciseId);
              });
              router.push("/(tabs)/program" as any);
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

      {/* Program Hero full-screen preview */}
      <Modal
        visible={heroVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setHeroVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgBottom }}>
          {/* Header bar */}
          <View style={styles.previewHeader}>
            <T style={styles.previewTitle}>Program Hero Preview</T>
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => setHeroZoneIdx((i) => (i + 1) % HERO_ZONE_SETS.length)}
                hitSlop={12}
                style={styles.previewBtn}
              >
                <T style={styles.previewBtnText}>↺  Zones</T>
              </Pressable>
              <Pressable
                onPress={() => setHeroVisible(false)}
                hitSlop={12}
                style={[styles.previewBtn, styles.previewBtnClose]}
              >
                <T style={styles.previewBtnText}>✕  Close</T>
              </Pressable>
            </View>
          </View>

          {/* The hero itself */}
          <ProgramHero
            userName="Alex"
            streak={7}
            activeZones={HERO_ZONE_SETS[heroZoneIdx]}
            completedTasks={2}
            totalTasks={5}
          />

          {/* Spacer so you can see where the screen content would begin */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Blueprint modal preview */}
      <BlueprintModal
        data={advancedData ?? MOCK_ADVANCED}
        imageUri={imageUri ?? null}
        visible={blueprintVisible}
        onDismiss={() => setBlueprintVisible(false)}
      />

      {/* ── Loaders preview ──────────────────────────────────────────── */}
      <Modal
        visible={loaderPreviewVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLoaderPreviewVisible(false)}
      >
        {(() => {
          const KINDS: { kind: RingLoaderKind; label: string; title: string; subtitle: string }[] = [
            { kind: "mascot", label: "Mascot",     title: "Building your routine",  subtitle: "Personalising your daily plan" },
            { kind: "photo",  label: "Photo Scan", title: "Analyzing your face",    subtitle: "Mapping proportions & harmony" },
            { kind: "brand",  label: "Brand",      title: "Preparing SigmaMax",     subtitle: "Setting things up" },
          ];
          const current = KINDS[loaderKindIdx];
          const fallbackPhoto = RNImage.resolveAssetSource(
            require("../../assets/loading/face-loader.jpg")
          ).uri;
          const photoUri =
            current.kind === "photo" ? (imageUri ?? fallbackPhoto) : undefined;
          return (
            <View style={{ flex: 1, backgroundColor: COLORS.lightBg }}>
              <RingLoader
                kind={current.kind}
                photoUri={photoUri}
                title={current.title}
                subtitle={current.subtitle}
              />

              {/* Floating header — switcher + close */}
              <SafeAreaView
                pointerEvents="box-none"
                style={{ position: "absolute", top: 0, left: 0, right: 0 }}
              >
                <View style={styles.previewHeader}>
                  <T style={[styles.previewTitle, { color: COLORS.lightText }]}>
                    Loader · {current.label}
                  </T>
                  <View style={styles.previewActions}>
                    <Pressable
                      onPress={() => setLoaderKindIdx((i) => (i + 1) % KINDS.length)}
                      hitSlop={12}
                      style={[styles.previewBtn, { backgroundColor: "rgba(0,0,0,0.06)" }]}
                    >
                      <T style={[styles.previewBtnText, { color: COLORS.lightText }]}>
                        ↺  Switch
                      </T>
                    </Pressable>
                    <Pressable
                      onPress={() => setLoaderPreviewVisible(false)}
                      hitSlop={12}
                      style={[styles.previewBtn, styles.previewBtnClose]}
                    >
                      <T style={styles.previewBtnText}>✕  Close</T>
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </View>
          );
        })()}
      </Modal>

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

  // Numbered flow chip
  flowChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingHorizontal: SP[3],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  flowIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  flowIndexText: {
    fontSize: 11,
    color: COLORS.accent,
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.4,
  },

  // Orphan chip — muted styling
  orphanChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[4],
    paddingVertical: SP[3],
    borderRadius: RADII.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "dashed",
  },
  orphanNote: {
    fontSize: 11,
    color: COLORS.sub,
    fontFamily: "Poppins-Regular",
    marginTop: 2,
    fontStyle: "italic",
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
