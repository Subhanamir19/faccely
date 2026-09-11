import React, { useEffect, useRef } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";

import type { CoachErrorCode, CoachMessage } from "@/lib/coach/blocks";

import {
  COACH,
  COACH_AVATAR,
  COACH_RADIUS,
  COACH_SPACE,
  COACH_TAB_CLEARANCE,
  COACH_TYPE,
} from "./theme";
import { CoachAvatar, UserAvatar } from "./Avatar";
import { BlockRenderer } from "./blocks/BlockRenderer";

/* ============================================================================
 * The conversation.
 *
 * Both sides carry an avatar, the way a normal chat reads: Coach's illustrated
 * face on the left of its replies, the user's profile photo on the right of
 * theirs.
 *
 * The user's turn is a compact bubble; Coach's runs full width with no bubble.
 * A chart or metric card inside a chat bubble reads as a screenshot quoted into
 * a conversation, where the same card on the page reads as part of the app.
 *
 * Consecutive turns from the same side show the avatar only once, so a
 * back-and-forth does not turn into a column of repeated faces.
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
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const startsGroup = previous?.role !== message.role;

        return (
          <View
            key={message.id}
            style={{ marginTop: index === 0 ? 0 : startsGroup ? COACH_SPACE.section : 12 }}
          >
            {message.role === "user" ? (
              <UserRow text={message.text} showAvatar={startsGroup} />
            ) : (
              <CoachRow
                message={message}
                showAvatar={startsGroup}
                onChipPress={onChipPress}
              />
            )}
          </View>
        );
      })}

      {activeTool ? (
        <View style={{ marginTop: 12, paddingLeft: COACH_AVATAR.size + COACH_AVATAR.gutter }}>
          <ToolIndicator name={activeTool} />
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Fixed-width avatar column, so messages line up whether or not one shows. */
function AvatarSlot({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ width: COACH_AVATAR.size, alignItems: "center" }}>{children}</View>
  );
}

function UserRow({ text, showAvatar }: { text: string; showAvatar: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "flex-start",
        gap: COACH_AVATAR.gutter,
      }}
    >
      <View
        style={{
          maxWidth: "78%",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: COACH_RADIUS.bubble,
          borderBottomRightRadius: 6,
          backgroundColor: COACH.surface,
          borderWidth: 1,
          borderColor: COACH.border,
        }}
      >
        <Text style={{ ...COACH_TYPE.body, color: COACH.ink }}>{text}</Text>
      </View>

      <AvatarSlot>{showAvatar ? <UserAvatar /> : null}</AvatarSlot>
    </View>
  );
}

function CoachRow({
  message,
  showAvatar,
  onChipPress,
}: {
  message: CoachMessage;
  showAvatar: boolean;
  onChipPress: (text: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: COACH_AVATAR.gutter }}>
      <AvatarSlot>{showAvatar ? <CoachAvatar /> : null}</AvatarSlot>

      <View style={{ flex: 1 }}>
        <CoachContent message={message} onChipPress={onChipPress} />
      </View>
    </View>
  );
}

function CoachContent({
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 }}>
      <ActivityIndicator size="small" color={COACH.inkFaint} />
      <Text style={{ ...COACH_TYPE.caption, color: COACH.inkFaint }}>{label}…</Text>
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
      <Text style={{ ...COACH_TYPE.caption, color: COACH.inkMuted }}>
        {ERROR_COPY[code]}
      </Text>
    </View>
  );
}

/** Height the composer must clear so the last reply is never hidden. */
export const THREAD_BOTTOM_CLEARANCE = COACH_TAB_CLEARANCE;
