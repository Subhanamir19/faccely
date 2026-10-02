import React, { useCallback, useState } from "react";
import { View, Text, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { useCoach } from "@/store/coach";
import { Thread } from "@/components/coach/Thread";
import { Composer, ComposerSkeleton } from "@/components/coach/Composer";
import { Chip } from "@/components/coach/blocks/ChipsBlock";
import { useProfile } from "@/store/profile";
import { useScores } from "@/store/scores";
import { useCoachSeen } from "@/store/coachSeen";
import type { Scores } from "@/lib/api/scores";
import { hapticLight } from "@/lib/haptics";
import { COACH, COACH_RADIUS, COACH_SPACE, COACH_TYPE } from "@/components/coach/theme";
import { useKeyboardVisible } from "@/components/coach/useKeyboard";

// The same coach portrait the paywall sells, so the face promised there is the
// face that greets the user here.
const COACH_IMAGE = require("../../assets/advanced-analysis-coach.png");
const COACH_IMAGE_SIZE = 112;

/* ============================================================================
 * The Coach tab.
 *
 * A full screen rather than a sheet, laid out the way a chat assistant reads:
 * title, conversation, input pinned to the bottom.
 *
 * The floating tab bar sits over content instead of reserving space, so the
 * composer carries its own clearance underneath.
 * ========================================================================== */

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  const initialising = useCoach((state) => state.initialising);
  const disabled = useCoach((state) => state.disabled);
  const status = useCoach((state) => state.status);
  const messages = useCoach((state) => state.messages);
  const chips = useCoach((state) => state.chips);
  const quota = useCoach((state) => state.quota);
  const activeTool = useCoach((state) => state.activeTool);
  const initialise = useCoach((state) => state.initialise);
  const send = useCoach((state) => state.send);
  const stop = useCoach((state) => state.stop);
  const hydrateProfile = useProfile((state) => state.hydrate);
  const keyboardVisible = useKeyboardVisible();
  const scores = useScores((state) => state.scores);
  const scanId = useScores((state) => state.scanId);
  const markScanSeen = useCoachSeen((state) => state.markScanSeen);

  const busy = status !== "idle";

  // Refresh suggestions and quota whenever the tab comes forward. Both change
  // underneath the screen — a new scan rewrites the suggestions, and a message
  // sent on another device spends the quota.
  useFocusEffect(
    useCallback(() => {
      void initialise("coach");
      // The profile store is hydrated by the Profile tab, which the user may
      // never have opened. Coach shows their avatar on every message, so it
      // loads it itself rather than rendering a placeholder for them.
      void hydrateProfile();
      // Opening the tab is what clears the new-scan badge.
      if (scanId) markScanSeen(scanId);
    }, [initialise, hydrateProfile, scanId, markScanSeen])
  );

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      setDraft("");
      void send(trimmed, "coach");
    },
    [busy, send]
  );

  // The tab bar floats over the screen rather than reserving space, so the
  // composer carries clearance for it — but only while the keyboard is down.
  // With the keyboard up, KeyboardAvoidingView has already padded the screen by
  // the keyboard's height and the tab bar is behind it, so that clearance would
  // strand the input mid-screen. The extra gap keeps the input from reading as
  // part of the bar.
  const composerBottomInset = keyboardVisible
    ? COACH_SPACE.gap
    : Math.max(insets.bottom, 8) +
      FLOATING_TAB_BAR.pillHeight +
      FLOATING_TAB_BAR.gapBottom +
      COACH_SPACE.gapLarge;

  return (
    <AppGradientBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Header topInset={insets.top} compact={keyboardVisible} />

        {disabled ? (
          <Unavailable />
        ) : initialising && messages.length === 0 ? (
          <ComposerSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState
            greeting={openingGreeting(scores)}
            chips={chips}
            onChipPress={submit}
          />
        ) : (
          <Thread messages={messages} activeTool={activeTool} onChipPress={submit} />
        )}

        {!disabled ? (
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => submit(draft)}
            onStop={stop}
            busy={busy}
            exhausted={quota?.messagesLeft === 0}
            bottomInset={composerBottomInset}
            messagesLeft={quota?.messagesLeft}
            onGetMore={() => router.push("/(onboarding)/paywall")}
          />
        ) : null}
      </KeyboardAvoidingView>
    </AppGradientBackground>
  );
}

/* -------------------------------------------------------------------------- */
/*   Pieces                                                                   */
/* -------------------------------------------------------------------------- */

const FALLBACK_GREETING =
  "I can see your scans, your scores and your routine. Ask me anything about them.";

/**
 * Open with something true about the user rather than an offer to help. A
 * specific number draws a first question far more often than a general one.
 * Built on the device from the latest scan, so it costs nothing.
 */
function openingGreeting(scores: Scores | null): string {
  if (!scores) return FALLBACK_GREETING;

  const [weakest] = (Object.entries(scores) as [keyof Scores, number][])
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) => a[1] - b[1]);
  if (!weakest) return FALLBACK_GREETING;

  const [key, value] = weakest;
  return `Your ${key.replace(/_/g, " ")} is at ${Math.round(value)}, your biggest room to grow. Ask me how to raise it.`;
}

/**
 * Topics the user can narrow the suggestions to before asking anything. Picking
 * one swaps the suggestions for questions about that area; picking it again
 * returns to the ones drawn from their scans.
 */
const TOPICS: { label: string; questions: string[] }[] = [
  {
    label: "Skin",
    questions: [
      "What is holding my skin score back?",
      "What should my skincare routine look like?",
      "How long until my skin looks different?",
    ],
  },
  {
    label: "Jaw",
    questions: [
      "How can I sharpen my jawline?",
      "Does mewing actually work?",
      "Would losing body fat change my jawline?",
    ],
  },
  {
    label: "Eyes",
    questions: [
      "What affects my eye area score?",
      "How do I get rid of dark circles?",
      "Can I change how my eyes look?",
    ],
  },
  {
    label: "Routine",
    questions: [
      "What should I do today?",
      "Is my routine working?",
      "What is the minimum that still works?",
    ],
  },
];

function Header({
  topInset,
  compact,
}: {
  topInset: number;
  /** Tightened while typing, where vertical space belongs to the thread. */
  compact: boolean;
}) {
  return (
    <View
      style={{
        // Tighter while the keyboard is up, so the conversation keeps as much
        // room as possible.
        paddingTop: topInset + (compact ? 8 : 12),
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingBottom: COACH_SPACE.gap,
        alignItems: "center",
      }}
    >
      {/* A small centred title, the way ChatGPT labels itself. The weekly
          allowance lives by the input, where it is spent. */}
      <Text style={{ ...COACH_TYPE.navTitle, color: COACH.ink }}>Coach</Text>
    </View>
  );
}

/**
 * What a fresh conversation shows.
 *
 * Never an empty box. The suggestions come from the user's own scans and
 * routine, so the first tap is always about them — which is the whole reason
 * the opening endpoint exists.
 */
function EmptyState({
  greeting,
  chips,
  onChipPress,
}: {
  greeting: string;
  chips: string[];
  onChipPress: (text: string) => void;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const suggestions = TOPICS.find((item) => item.label === topic)?.questions ?? chips;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingBottom: COACH_SPACE.section,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* The greeting owns the middle of the screen; the suggestions sit
          under it at the bottom, closest to the thumb and the input. */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: COACH_SPACE.gapLarge,
          paddingVertical: COACH_SPACE.section,
        }}
      >
        <Image
          source={COACH_IMAGE}
          style={{ width: COACH_IMAGE_SIZE, height: COACH_IMAGE_SIZE }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text
          style={{
            ...COACH_TYPE.body,
            color: COACH.inkMuted,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          {greeting}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {TOPICS.map((item) => (
          <TopicPill
            key={item.label}
            label={item.label}
            selected={topic === item.label}
            onPress={() => setTopic((current) => (current === item.label ? null : item.label))}
          />
        ))}
      </View>

      {suggestions.length > 0 ? (
        <View style={{ gap: 8 }}>
          {suggestions.map((chip) => (
            <Chip key={chip} label={chip} onPress={() => onChipPress(chip)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function TopicPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      hitSlop={4}
      style={{
        minHeight: 36,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderRadius: COACH_RADIUS.pill,
        // Filled ink when chosen, the same weight as the send button, so the
        // active filter is unmistakable next to the outlined suggestions.
        backgroundColor: selected ? COACH.ink : COACH.fill,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} questions`}
    >
      <Text style={{ ...COACH_TYPE.captionSemiBold, color: selected ? COACH.surface : COACH.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Unavailable() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: COACH_SPACE.pageMargin,
      }}
    >
      <Text style={{ ...COACH_TYPE.body, color: COACH.inkMuted, textAlign: "center" }}>
        Coach is not available right now.
      </Text>
    </View>
  );
}
