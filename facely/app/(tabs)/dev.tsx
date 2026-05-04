// app/(tabs)/dev.tsx
// Developer tooling screen — only reachable in __DEV__ builds.

import React, { useState, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
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
import { API_BASE } from "@/lib/api/config";
import { buildAuthHeadersAsync } from "@/lib/api/authHeaders";

const FONT = "ProximaNova-Bold";

const DASH_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

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
// Progress Dashboard Mockups
// ---------------------------------------------------------------------------

const MOCK_METRICS = [
  { label: "Jawline Definition", score: 61, delta: -0.8 },
  { label: "Cheek Hollows", score: 58, delta: 1.2 },
  { label: "Skin Clarity", score: 74, delta: 2.4 },
  { label: "Eye Symmetry", score: 79, delta: 3.1 },
  { label: "Maxilla Projection", score: 55, delta: 0.9 },
];

function DashCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[mockStyles.dashCard, style]}>{children}</View>;
}

function MiniFace({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={mockStyles.faceCol}>
      <View style={[mockStyles.faceBox, accent && mockStyles.faceBoxAccent]}>
        <View style={mockStyles.faceHead} />
        <View style={mockStyles.faceNeck} />
      </View>
      <T style={[mockStyles.faceLabel, accent && mockStyles.faceLabelAccent]}>{label}</T>
    </View>
  );
}

function Sparkline() {
  return (
    <View style={mockStyles.sparkWrap}>
      {[18, 28, 23, 42, 36, 58, 64, 72].map((h, i) => (
        <View key={i} style={[mockStyles.sparkBar, { height: h }]} />
      ))}
    </View>
  );
}

function WeekRibbon() {
  return (
    <View style={mockStyles.weekRow}>
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <View key={`${d}-${i}`} style={mockStyles.weekCell}>
          <View
            style={[
              mockStyles.weekDot,
              i < 4 && mockStyles.weekDotDone,
              i === 4 && mockStyles.weekDotToday,
            ]}
          />
          <T style={[mockStyles.weekText, i === 4 && mockStyles.weekTextToday]}>{d}</T>
        </View>
      ))}
    </View>
  );
}

function MetricLine({
  label,
  score,
  delta,
  index,
  compact,
}: {
  label: string;
  score: number;
  delta: number;
  index?: number;
  compact?: boolean;
}) {
  const positive = delta >= 0;
  return (
    <View style={[mockStyles.metricLine, compact && mockStyles.metricLineCompact]}>
      {typeof index === "number" && (
        <View style={mockStyles.rankPill}>
          <T style={mockStyles.rankText}>{String(index).padStart(2, "0")}</T>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T style={mockStyles.metricName} numberOfLines={1}>{label.toUpperCase()}</T>
        {!compact && (
          <T style={mockStyles.metricMeta}>
            {positive ? "+" : ""}{delta.toFixed(1)} since baseline
          </T>
        )}
      </View>
      <T style={[mockStyles.metricDelta, !positive && { color: COLORS.declineRed }]}>
        {positive ? "+" : ""}{delta.toFixed(1)}
      </T>
      <T style={mockStyles.metricScore}>{score}</T>
    </View>
  );
}

function BlackPill({ label }: { label: string }) {
  return (
    <View style={mockStyles.blackPill}>
      <T style={mockStyles.blackPillText}>{label}</T>
    </View>
  );
}

function MockupShell({
  number,
  title,
  thesis,
  children,
}: {
  number: string;
  title: string;
  thesis: string;
  children: React.ReactNode;
}) {
  return (
    <View style={mockStyles.mockupShell}>
      <View style={mockStyles.mockupHeader}>
        <View style={mockStyles.mockupNum}>
          <T style={mockStyles.mockupNumText}>{number}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T style={mockStyles.mockupTitle}>{title}</T>
          <T style={mockStyles.mockupThesis}>{thesis}</T>
        </View>
      </View>
      <View style={mockStyles.phoneFrame}>
        {children}
      </View>
    </View>
  );
}

function CommandCenterMockup() {
  return (
    <MockupShell
      number="01"
      title="Command Center"
      thesis="One transformation state, one action stack."
    >
      <View style={mockStyles.identityRow}>
        <T style={mockStyles.identityText}>Day 18 - Alex's transformation</T>
        <View style={mockStyles.streakPill}><T style={mockStyles.streakText}>4</T></View>
      </View>
      <WeekRibbon />
      <DashCard style={mockStyles.heroMock}>
        <View style={mockStyles.heroTopRow}>
          <View>
            <T style={mockStyles.heroEyebrow}>OVERALL RATING</T>
            <T style={mockStyles.heroScore}>72</T>
            <T style={mockStyles.heroTier}>S T R O N G</T>
          </View>
          <Sparkline />
        </View>
        <View style={mockStyles.heroBottomRow}>
          <View>
            <T style={mockStyles.heroSmallNum}>+4.2</T>
            <T style={mockStyles.heroSmallLabel}>FROM START</T>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <T style={mockStyles.heroSmallNum}>+8</T>
            <T style={mockStyles.heroSmallLabel}>TO ELITE</T>
          </View>
        </View>
        <View style={mockStyles.compareMiniRow}>
          <MiniFace label="Today" />
          <T style={mockStyles.arrowText}>{"->"}</T>
          <MiniFace label="Potential" accent />
        </View>
        <View style={mockStyles.progressTrack}>
          <View style={[mockStyles.progressFill, { width: "38%" }]} />
        </View>
        <T style={mockStyles.progressCaption}>38% closer to stage 1</T>
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>TODAY'S MOVE</T>
        <MetricLine label="Jawline Definition" score={61} delta={-0.8} />
        <BlackPill label="TRAIN THIS METRIC" />
        <View style={mockStyles.dividerLight} />
        {MOCK_METRICS.slice(1, 4).map((m, i) => (
          <MetricLine key={m.label} {...m} index={i + 1} compact />
        ))}
      </DashCard>
    </MockupShell>
  );
}

function ProgressStoryMockup() {
  return (
    <MockupShell
      number="02"
      title="Progress Story"
      thesis="A vertical narrative: now, next, potential, evidence."
    >
      <View style={mockStyles.storyLine} />
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>NOW</T>
        <T style={mockStyles.storyBig}>72 STRONG</T>
        <T style={mockStyles.storySub}>+4.2 since baseline - strongest gain: Eyes</T>
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>NEXT INFLECTION</T>
        <T style={mockStyles.storyBig}>+8 to Elite band</T>
        <T style={mockStyles.storySub}>Focus: Jawline Definition</T>
        <BlackPill label="START SESSION" />
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>POTENTIAL STAGE</T>
        <View style={mockStyles.compareMiniRow}>
          <MiniFace label="Today" />
          <T style={mockStyles.arrowText}>{"->"}</T>
          <MiniFace label="Stage 1" accent />
        </View>
      </DashCard>
      <DashCard style={mockStyles.storyCard}>
        <T style={mockStyles.sectionKicker}>EVIDENCE</T>
        <MetricLine label="Top sub-metrics" score={5} delta={3.1} compact />
        <Sparkline />
      </DashCard>
    </MockupShell>
  );
}

function PriorityStackMockup() {
  return (
    <MockupShell
      number="03"
      title="Priority Stack"
      thesis="Training-first. One ranked queue replaces scattered cards."
    >
      <DashCard style={mockStyles.compactHero}>
        <View>
          <T style={mockStyles.heroScoreSmall}>72 STRONG</T>
          <T style={mockStyles.storySub}>Day 18 - 6 scans - streak 4</T>
        </View>
        <Sparkline />
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>PRIORITY STACK</T>
        {MOCK_METRICS.map((m, i) => (
          <MetricLine key={m.label} {...m} index={i + 1} compact={i !== 0} />
        ))}
        <BlackPill label="TRAIN PRIORITY 01" />
      </DashCard>
      <DashCard>
        <View style={mockStyles.inlinePotential}>
          <MiniFace label="Today" />
          <View style={{ flex: 1 }}>
            <T style={mockStyles.metricName}>POTENTIAL PREVIEW</T>
            <T style={mockStyles.metricMeta}>Stage 1 - 38% closer</T>
            <View style={mockStyles.progressTrack}>
              <View style={[mockStyles.progressFill, { width: "38%" }]} />
            </View>
          </View>
        </View>
      </DashCard>
    </MockupShell>
  );
}

function TransformationSplitMockup() {
  return (
    <MockupShell
      number="04"
      title="Transformation Split"
      thesis="Makes potential face the emotional centerpiece."
    >
      <DashCard>
        <T style={mockStyles.sectionKicker}>TRANSFORMATION</T>
        <View style={mockStyles.compareLargeRow}>
          <MiniFace label="Today" />
          <MiniFace label="Potential" accent />
        </View>
        <View style={mockStyles.heroBottomRow}>
          <View>
            <T style={mockStyles.heroSmallNum}>72 now</T>
            <T style={mockStyles.heroSmallLabel}>CURRENT</T>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <T style={mockStyles.heroSmallNum}>38%</T>
            <T style={mockStyles.heroSmallLabel}>CLOSER</T>
          </View>
        </View>
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>WHAT CHANGED</T>
        <MetricLine label="Eye Symmetry" score={79} delta={3.1} compact />
        <MetricLine label="Skin Quality" score={74} delta={2.4} compact />
        <MetricLine label="Jawline" score={61} delta={-0.8} compact />
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>WHAT TO DO</T>
        <MetricLine label="Jawline Definition" score={61} delta={-0.8} />
        <BlackPill label="START WORKOUT" />
      </DashCard>
    </MockupShell>
  );
}

function AnalystModeMockup() {
  return (
    <MockupShell
      number="05"
      title="Compact Analyst Mode"
      thesis="Power-user density with the least card chrome."
    >
      <View style={mockStyles.analystHeader}>
        <View>
          <T style={mockStyles.heroScoreSmall}>72 STRONG</T>
          <T style={mockStyles.storySub}>+4.2 - 6 scans tracked</T>
        </View>
        <Sparkline />
      </View>
      <DashCard style={mockStyles.heatmapCard}>
        <T style={mockStyles.sectionKicker}>METRIC HEATMAP</T>
        {MOCK_METRICS.map((m) => (
          <View key={m.label} style={mockStyles.heatRow}>
            <T style={mockStyles.heatName}>{m.label}</T>
            <T style={mockStyles.heatScore}>{m.score}</T>
            <T style={[mockStyles.heatDelta, m.delta < 0 && { color: COLORS.declineRed }]}>
              {m.delta >= 0 ? "+" : ""}{m.delta.toFixed(1)}
            </T>
            <View style={[mockStyles.heatDot, m.delta < 0 && { backgroundColor: COLORS.declineRedSoft }]} />
          </View>
        ))}
      </DashCard>
      <DashCard>
        <T style={mockStyles.sectionKicker}>SELECTED: JAWLINE</T>
        <T style={mockStyles.storySub}>Definition - Gonial angle - Chin projection</T>
        <BlackPill label="TRAIN THIS METRIC" />
      </DashCard>
    </MockupShell>
  );
}

function ProgressDashboardMockupsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={mockStyles.modalRoot}>
        <View style={mockStyles.modalHeader}>
          <View style={{ flex: 1 }}>
            <T style={mockStyles.modalTitle}>Progress UI Mockups</T>
            <T style={mockStyles.modalSub}>Static previews using current dashboard language</T>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={mockStyles.closeBtn}>
            <T style={mockStyles.closeText}>Close</T>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={mockStyles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <CommandCenterMockup />
          <ProgressStoryMockup />
          <PriorityStackMockup />
          <TransformationSplitMockup />
          <AnalystModeMockup />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const SCAN_BYPASS_KEY = "dev_bypass_scan_limit";
type PotentialPromptMode = "conservative" | "balanced" | "aggressive";
const POTENTIAL_PROMPT_MODES: PotentialPromptMode[] = ["aggressive", "balanced", "conservative"];

export default function DevScreen() {
  const [consentValue, setConsentValue] = useState<string | null | "…">("…");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [progressMockupsVisible, setProgressMockupsVisible] = useState(false);
  const [potentialSourceUri, setPotentialSourceUri] = useState<string | null>(null);
  const [potentialResultUri, setPotentialResultUri] = useState<string | null>(null);
  const [potentialGenerating, setPotentialGenerating] = useState(false);
  const [potentialMeta, setPotentialMeta] = useState<string | null>(null);
  const [potentialPromptMode, setPotentialPromptMode] = useState<PotentialPromptMode>("aggressive");
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
    cheekbones: { width: "", width_score: 48, width_verdict: "", maxilla: "", maxilla_score: 38, maxilla_verdict: "", bone_structure: "", bone_structure_score: 52, bone_structure_verdict: "", face_fat: "", face_fat_score: 41, face_fat_verdict: "", fwhr: "", fwhr_score: 54, fwhr_verdict: "" },
    jawline:    { development: "", development_score: 44, development_verdict: "", gonial_angle: "", gonial_angle_score: 62, gonial_angle_verdict: "", projection: "", projection_score: 35, projection_verdict: "", ramus: "", ramus_score: 50, ramus_verdict: "" },
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

  const handlePickPotentialSource = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri ?? null;
    if (!uri) return;
    setPotentialSourceUri(uri);
    setPotentialResultUri(null);
    setPotentialMeta(null);
  };

  const handleGeneratePotentialDev = async () => {
    if (!potentialSourceUri || potentialGenerating) return;
    setPotentialGenerating(true);
    setPotentialMeta(null);

    try {
      const form = new FormData();
      form.append("image", {
        uri: potentialSourceUri,
        name: "potential-face-source.jpg",
        type: "image/jpeg",
      } as any);
      form.append("promptMode", potentialPromptMode);

      const headers = await buildAuthHeadersAsync({ includeLegacy: true });
      const res = await fetch(`${API_BASE}/generate/potential-face-dev`, {
        method: "POST",
        headers: { Accept: "application/json", ...headers },
        body: form,
      });

      const payload = await res.json().catch(() => null) as
        | {
            b64?: string;
            model?: string;
            promptVersion?: string;
            promptMode?: PotentialPromptMode;
            message?: string;
            error?: string;
            providerStatus?: number;
            providerCode?: string | null;
            providerType?: string | null;
            providerMessage?: string;
          }
        | null;

      if (!res.ok || !payload?.b64) {
        const providerDetails = [
          payload?.providerStatus ? `Provider status: ${payload.providerStatus}` : null,
          payload?.providerCode ? `Provider code: ${payload.providerCode}` : null,
          payload?.providerType ? `Provider type: ${payload.providerType}` : null,
          payload?.providerMessage ? `Provider message: ${payload.providerMessage}` : null,
        ].filter(Boolean).join("\n");
        throw new Error(
          [
            payload?.message ?? payload?.error ?? `Generation failed (${res.status})`,
            providerDetails || null,
          ].filter(Boolean).join("\n\n")
        );
      }

      setPotentialResultUri(`data:image/png;base64,${payload.b64}`);
      setPotentialMeta(
        `${payload.model ?? "gpt-image-2"} · ${payload.promptMode ?? potentialPromptMode} · prompt ${payload.promptVersion ?? "unknown"}`
      );
    } catch (err: any) {
      const message = err?.message ?? String(err);
      Alert.alert(
        "Potential face dev gen failed",
        `${message}\n\nEndpoint:\n${API_BASE}/generate/potential-face-dev\n\nIf this says Network request failed, the app cannot reach the deployed Railway backend from the simulator/network.`
      );
    } finally {
      setPotentialGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <T style={styles.screenTitle}>Dev Tools</T>

        {/* Progress Dashboard Mockups */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Progress Dashboard Mockups"
            subtitle="Five layout directions for reducing tracking-screen cognitive load"
          />
          <DevButton
            label="Preview All Variations"
            accent
            onPress={() => setProgressMockupsVisible(true)}
          />
        </GlassCard>

        {/* ── Insight Pulse Preview ─────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader
            title="Potential Face Image Lab"
            subtitle="Pick any face photo and compare conservative, balanced, and aggressive potential-face prompts"
          />

          <View style={styles.potentialLabGrid}>
            <View style={styles.potentialLabPane}>
              <T style={styles.subLabel}>SOURCE</T>
              {potentialSourceUri ? (
                <RNImage source={{ uri: potentialSourceUri }} style={styles.potentialLabImage} resizeMode="cover" />
              ) : (
                <View style={styles.potentialLabPlaceholder}>
                  <T style={styles.potentialLabPlaceholderText}>No image selected</T>
                </View>
              )}
            </View>

            <View style={styles.potentialLabPane}>
              <T style={styles.subLabel}>POTENTIAL</T>
              {potentialResultUri ? (
                <RNImage source={{ uri: potentialResultUri }} style={styles.potentialLabImage} resizeMode="cover" />
              ) : (
                <View style={styles.potentialLabPlaceholder}>
                  <T style={styles.potentialLabPlaceholderText}>
                    {potentialGenerating ? "Generating..." : "Result appears here"}
                  </T>
                </View>
              )}
            </View>
          </View>

          {potentialMeta ? (
            <T style={styles.sectionSubtitle} variant="small" color="sub">{potentialMeta}</T>
          ) : null}

          <View style={styles.row}>
            {POTENTIAL_PROMPT_MODES.map((mode) => (
              <DevButton
                key={mode}
                label={mode.charAt(0).toUpperCase() + mode.slice(1)}
                accent={potentialPromptMode === mode}
                onPress={() => {
                  setPotentialPromptMode(mode);
                  setPotentialResultUri(null);
                  setPotentialMeta(null);
                }}
              />
            ))}
          </View>

          <View style={styles.row}>
            <DevButton label="Choose Image" accent onPress={handlePickPotentialSource} />
            <DevButton
              label={potentialGenerating ? "Generating..." : "Generate"}
              accent={!!potentialSourceUri && !potentialGenerating}
              onPress={handleGeneratePotentialDev}
            />
          </View>
        </GlassCard>

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
          <DevButton
            label="🔄  Full Reset Today (UI flip test)"
            accent
            onPress={() => {
              const state = useTasksStore.getState();
              const today = state.today;
              if (!today) {
                Alert.alert("No tasks", "Today's tasks are not loaded yet.");
                return;
              }
              useTasksStore.setState({
                today: {
                  ...today,
                  tasks: today.tasks.map((t) => ({ ...t, status: "pending" as const })),
                  protocols: today.protocols.map((p) => ({ ...p, status: "pending" as const })),
                  allComplete: false,
                  completedOnce: false,
                  mood: null,
                },
                completionModalShownDate: null,
              });
              router.push("/(tabs)/program" as any);
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

      <ProgressDashboardMockupsModal
        visible={progressMockupsVisible}
        onClose={() => setProgressMockupsVisible(false)}
      />

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
const mockStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  modalHeader: {
    paddingHorizontal: SP[5],
    paddingVertical: SP[4],
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightHairline,
    backgroundColor: COLORS.lightBg,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  modalSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  closeBtn: {
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    paddingHorizontal: SP[4],
    paddingVertical: SP[2],
  },
  closeText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  modalContent: {
    paddingHorizontal: SP[4],
    paddingTop: SP[4],
    paddingBottom: SP[12],
    gap: SP[6],
  },
  mockupShell: {
    gap: SP[3],
  },
  mockupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  mockupNum: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ctaBlack,
  },
  mockupNumText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  mockupTitle: {
    fontFamily: FONT,
    fontSize: 20,
    color: COLORS.lightText,
    letterSpacing: -0.3,
  },
  mockupThesis: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  phoneFrame: {
    borderRadius: RADII.card,
    backgroundColor: COLORS.lightBg,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    padding: SP[4],
    gap: SP[3],
    ...DASH_SHADOW,
  },
  dashCard: {
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    padding: SP[4],
    gap: SP[3],
    ...DASH_SHADOW,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identityText: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightSub,
  },
  streakPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightCard,
    alignItems: "center",
    justifyContent: "center",
  },
  streakText: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SP[1],
  },
  weekCell: {
    alignItems: "center",
    flex: 1,
    gap: 5,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lightBorder,
  },
  weekDotDone: {
    backgroundColor: COLORS.ctaBlack,
  },
  weekDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lightCard,
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  weekText: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
  },
  weekTextToday: {
    color: COLORS.lightText,
  },
  heroMock: {
    padding: SP[5],
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SP[4],
  },
  heroEyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.9,
  },
  heroScore: {
    fontFamily: FONT,
    fontSize: 76,
    lineHeight: 78,
    color: COLORS.lightText,
    letterSpacing: -3,
  },
  heroTier: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightMuted,
    letterSpacing: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroSmallNum: {
    fontFamily: FONT,
    fontSize: 17,
    color: COLORS.lightText,
  },
  heroSmallLabel: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightSub,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  heroScoreSmall: {
    fontFamily: FONT,
    fontSize: 24,
    color: COLORS.lightText,
    letterSpacing: -0.5,
  },
  sparkWrap: {
    height: 76,
    minWidth: 96,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 5,
  },
  sparkBar: {
    width: 7,
    borderRadius: 4,
    backgroundColor: COLORS.ctaBlack,
    opacity: 0.88,
  },
  compareMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
  },
  compareLargeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SP[3],
  },
  faceCol: {
    flex: 1,
    alignItems: "center",
    gap: SP[2],
  },
  faceBox: {
    width: "100%",
    height: 112,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.iconTileLavender,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faceBoxAccent: {
    borderWidth: 2,
    borderColor: COLORS.ctaBlack,
  },
  faceHead: {
    width: 54,
    height: 66,
    borderRadius: 28,
    backgroundColor: "#D8CDD9",
  },
  faceNeck: {
    width: 36,
    height: 28,
    marginTop: -4,
    borderRadius: 14,
    backgroundColor: "#D8CDD9",
  },
  faceLabel: {
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.3,
  },
  faceLabelAccent: {
    color: COLORS.lightText,
  },
  arrowText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLORS.lightSub,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.lightSurfaceAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.ctaBlack,
  },
  progressCaption: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightSub,
    textAlign: "right",
  },
  sectionKicker: {
    fontFamily: FONT,
    fontSize: 11,
    color: COLORS.lightSub,
    letterSpacing: 0.9,
  },
  metricLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[2],
  },
  metricLineCompact: {
    paddingVertical: SP[2],
  },
  rankPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  rankText: {
    fontFamily: FONT,
    fontSize: 10,
    color: COLORS.lightText,
  },
  metricName: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
    letterSpacing: 0.1,
  },
  metricMeta: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: COLORS.lightSub,
    marginTop: 2,
  },
  metricDelta: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightText,
    minWidth: 44,
    textAlign: "right",
  },
  metricScore: {
    fontFamily: FONT,
    fontSize: 18,
    color: COLORS.lightText,
    minWidth: 28,
    textAlign: "right",
  },
  blackPill: {
    minHeight: 46,
    borderRadius: RADII.circle,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
  },
  blackPillText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  dividerLight: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightHairline,
  },
  storyLine: {
    position: "absolute",
    left: SP[8],
    top: 80,
    bottom: 30,
    width: 2,
    backgroundColor: COLORS.lightHairline,
  },
  storyCard: {
    marginLeft: SP[6],
  },
  storyBig: {
    fontFamily: FONT,
    fontSize: 22,
    color: COLORS.lightText,
    letterSpacing: -0.4,
  },
  storySub: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.lightSub,
  },
  compactHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlinePotential: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[4],
  },
  analystHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP[1],
  },
  heatmapCard: {
    gap: SP[2],
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
    paddingVertical: SP[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightHairline,
  },
  heatName: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.lightText,
  },
  heatScore: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLORS.lightText,
    width: 28,
    textAlign: "right",
  },
  heatDelta: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.lightText,
    width: 42,
    textAlign: "right",
  },
  heatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.lightSurfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
});

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
  potentialLabGrid: {
    flexDirection: "row",
    gap: SP[3],
  },
  potentialLabPane: {
    flex: 1,
    gap: SP[2],
  },
  potentialLabImage: {
    width: "100%",
    aspectRatio: 0.76,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.whiteGlass,
  },
  potentialLabPlaceholder: {
    width: "100%",
    aspectRatio: 0.76,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.whiteGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[3],
  },
  potentialLabPlaceholderText: {
    fontSize: 12,
    color: COLORS.sub,
    textAlign: "center",
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
