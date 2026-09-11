import React, { useEffect, useRef } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";

import { TYPE } from "@/lib/tokens";
import type { CoachErrorCode, CoachMessage } from "@/lib/coach/blocks";

import { COACH, COACH_RADIUS, COACH_SPACE, COACH_TAB_CLEARANCE } from "./theme";
import { BlockRenderer } from "./blocks/BlockRenderer";

/* ============================================================================
 * The conversation.
 *
 * Laid out the way a chat assistant reads: the user's turns are compact bubbles
 * pushed to the right, Coach's replies run full width with no bubble at all.
 *
 * That asymmetry is doing real work. A chart or a metric card inside a chat
 * bubble reads as a quoted screenshot; the same card on the page reads as part
 * of the app. Coach's answers are app content that happens to be written in
 * response to a question.
 * ========================================================================== */

export type ThreadProps = {
  messages: CoachMessage[];
  activeTool: string | null;
  onChipPress: (text: string) => void;
};

/** Plain-English label for the lookup that is running. */
const TOOL_LABELS: Record<string, string> = {
  get_scan_history: "Reading your scans",
  get_submetrics: "Reading your breakdown",
  get_routine_adherence: "Checking your routine",
  get_profile: "Checking your profile",
  emit_metric_card: "Pulling the score",
  emit_chart: "Drawing the trend",
  emit_chips: "Thinking of follow-ups",
};

export function Thread({ messages, activeTool, onChipPress }: ThreadProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Follow the reply as it grows. Streaming text that scrolls out of view is
  // the same as no streaming at all.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, activeTool]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingTop: COACH_SPACE.gapLarge,
        paddingBottom: COACH_SPACE.section,
        gap: COACH_SPACE.section,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) =>
        message.role === "user" ? (
          <UserBubble key={message.id} text={message.text} />
        ) : (
          <CoachTurn key={message.id} message={message} onChipPress={onChipPress} />
        )
      )}

      {activeTool ? <ToolIndicator name={activeTool} /> : null}
    </ScrollView>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-end",
        maxWidth: "84%",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: COACH_RADIUS.bubble,
        borderBottomRightRadius: 6,
        backgroundColor: COACH.surface,
        borderWidth: 1,
        borderColor: COACH.border,
      }}
    >
      <Text style={{ ...TYPE.body, color: COACH.ink }}>{text}</Text>
    </View>
  );
}

function CoachTurn({
  message,
  onChipPress,
}: {
  message: CoachMessage;
  onChipPress: (text: string) => void;
}) {
  if (message.error) {
    return <ErrorNotice code={message.error} />;
  }

  // A streaming turn with nothing in it yet: the model is still thinking and no
  // tool is running, so show a pulse rather than an empty gap.
  if (message.blocks.length === 0 && message.streaming) {
    return <ToolIndicator name="thinking" />;
  }

  return <BlockRenderer blocks={message.blocks} onChipPress={onChipPress} />;
}

function ToolIndicator({ name }: { name: string }) {
  const label = TOOL_LABELS[name] ?? (name === "thinking" ? "Thinking" : "Working");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <ActivityIndicator size="small" color={COACH.inkFaint} />
      <Text style={{ ...TYPE.caption, color: COACH.inkFaint }}>{label}…</Text>
    </View>
  );
}

const ERROR_COPY: Record<CoachErrorCode, string> = {
  quota_exceeded: "You have used this week's Coach messages. They reset on Monday.",
  daily_limit: "That is today's Coach messages used up. More tomorrow.",
  safety_blocked: "I am not the right place for that one.",
  upstream_failed: "That did not go through. Try again.",
  invalid_request: "Something was wrong with that message.",
  internal: "Coach is unavailable right now.",
};

function ErrorNotice({ code }: { code: CoachErrorCode }) {
  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: COACH_RADIUS.card,
        backgroundColor: COACH.surfaceMuted,
        borderLeftWidth: 2,
        borderLeftColor: COACH.coral,
      }}
    >
      <Text style={{ ...TYPE.caption, color: COACH.inkMuted }}>{ERROR_COPY[code]}</Text>
    </View>
  );
}

/** Height the composer must clear so the last reply is never hidden. */
export const THREAD_BOTTOM_CLEARANCE = COACH_TAB_CLEARANCE;
