import React, { useEffect, useRef } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";

import { COLORS, TYPE, SP, RADII } from "@/lib/tokens";
import type { CoachErrorCode, CoachMessage } from "@/lib/coach/blocks";

import { BlockRenderer } from "./blocks/BlockRenderer";

/* ============================================================================
 * The conversation.
 *
 * User turns are bubbles; Coach's are bare blocks on the sheet background. That
 * asymmetry is intentional — a chart or a metric card inside a chat bubble
 * reads as a quoted screenshot rather than as part of the app.
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
      contentContainerStyle={{ padding: SP[4], gap: SP[5] }}
      keyboardShouldPersistTaps="handled"
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
        maxWidth: "85%",
        paddingVertical: SP[3],
        paddingHorizontal: SP[4],
        borderRadius: RADII.lg,
        borderBottomRightRadius: RADII.xs,
        backgroundColor: COLORS.accent,
      }}
    >
      <Text style={{ ...TYPE.body, color: "#0B0B0B" }}>{text}</Text>
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: SP[2] }}>
      <ActivityIndicator size="small" color={COLORS.accent} />
      <Text style={{ ...TYPE.caption, color: COLORS.sub }}>{label}…</Text>
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
        paddingVertical: SP[3],
        paddingHorizontal: SP[4],
        borderRadius: RADII.md,
        backgroundColor: COLORS.whiteGlass,
        borderLeftWidth: 2,
        borderLeftColor: COLORS.errorLight,
      }}
    >
      <Text style={{ ...TYPE.caption, color: COLORS.muted }}>{ERROR_COPY[code]}</Text>
    </View>
  );
}
