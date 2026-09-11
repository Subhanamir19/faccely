import React, { useCallback, useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TYPE } from "@/lib/tokens";
import { AppGradientBackground } from "@/components/layout/AppGradientBackground";
import { FLOATING_TAB_BAR } from "@/components/layout/floatingTabBar";
import { useCoach } from "@/store/coach";
import { Thread } from "@/components/coach/Thread";
import { Composer, ComposerSkeleton } from "@/components/coach/Composer";
import { Chip } from "@/components/coach/blocks/ChipsBlock";
import { COACH, COACH_SPACE } from "@/components/coach/theme";

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

  const busy = status !== "idle";

  // Refresh suggestions and quota whenever the tab comes forward. Both change
  // underneath the screen — a new scan rewrites the suggestions, and a message
  // sent on another device spends the quota.
  useFocusEffect(
    useCallback(() => {
      void initialise("coach");
    }, [initialise])
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

  // The tab bar floats over the screen, so the composer adds its own clearance.
  const composerBottomInset =
    Math.max(insets.bottom, 8) + FLOATING_TAB_BAR.pillHeight + FLOATING_TAB_BAR.gapBottom;

  return (
    <AppGradientBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Header
          topInset={insets.top}
          quotaLabel={quotaLabel(quota?.messagesLeft)}
        />

        {disabled ? (
          <Unavailable />
        ) : initialising && messages.length === 0 ? (
          <ComposerSkeleton />
        ) : messages.length === 0 ? (
          <EmptyState chips={chips} onChipPress={submit} />
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
          />
        ) : null}
      </KeyboardAvoidingView>
    </AppGradientBackground>
  );
}

/* -------------------------------------------------------------------------- */
/*   Pieces                                                                   */
/* -------------------------------------------------------------------------- */

function quotaLabel(messagesLeft: number | undefined): string | null {
  if (messagesLeft === undefined) return null;
  if (messagesLeft === 0) return "No messages left";
  return `${messagesLeft} left this week`;
}

function Header({
  topInset,
  quotaLabel: label,
}: {
  topInset: number;
  quotaLabel: string | null;
}) {
  return (
    <View
      style={{
        // 24px top-safe clearance, per the design spec.
        paddingTop: topInset + 24,
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingBottom: COACH_SPACE.gap,
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: COACH_SPACE.gap,
      }}
    >
      <Text style={{ ...TYPE.h2, color: COACH.ink }}>Coach</Text>
      {label ? (
        <Text style={{ ...TYPE.caption, color: COACH.inkFaint }}>{label}</Text>
      ) : null}
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
  chips,
  onChipPress,
}: {
  chips: string[];
  onChipPress: (text: string) => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "flex-end",
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingBottom: COACH_SPACE.section,
        gap: COACH_SPACE.gapLarge,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ ...TYPE.body, color: COACH.inkMuted }}>
        I can see your scans, your scores and your routine. Ask me anything about them.
      </Text>

      <View style={{ gap: 8 }}>
        {chips.map((chip) => (
          <Chip key={chip} label={chip} onPress={() => onChipPress(chip)} />
        ))}
      </View>
    </ScrollView>
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
      <Text style={{ ...TYPE.body, color: COACH.inkMuted, textAlign: "center" }}>
        Coach is not available right now.
      </Text>
    </View>
  );
}
