import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, View, Text, Keyboard } from "react-native";

import type { CoachErrorCode, CoachMessage } from "@/lib/coach/blocks";

import { COACH, COACH_RADIUS, COACH_SPACE, COACH_TYPE } from "./theme";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { CoachAvatar } from "./Avatar";

/* ============================================================================
 * The conversation.
 *
 * The user's turn is a borderless grey bubble flush right. Coach's runs the
 * full page width with no bubble, under a small byline with the same face the
 * paywall and the empty screen show, so the voice is always the one character.
 * The byline sits above the reply rather than beside it, so cards and charts
 * keep the whole width.
 *
 * A chart or metric card inside a chat bubble reads as a screenshot quoted into
 * a conversation, where the same card on the page reads as part of the app.
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

  // The keyboard takes roughly half the screen. Without this the last reply is
  // behind it the moment the user taps the input to ask a follow-up.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => subscription.remove();
  }, []);

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
              <UserBubble text={message.text} />
            ) : (
              <>
                {startsGroup ? <CoachByline /> : null}
                <CoachContent message={message} onChipPress={onChipPress} />
              </>
            )}
          </View>
        );
      })}

      {activeTool ? (
        <View style={{ marginTop: 12 }}>
          <ToolIndicator name={activeTool} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function CoachByline() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <CoachAvatar />
      <Text style={{ ...COACH_TYPE.captionSemiBold, color: COACH.ink }}>Coach</Text>
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-end",
        maxWidth: "80%",
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: COACH_RADIUS.bubble,
        backgroundColor: COACH.fill,
      }}
    >
      <Text style={{ ...COACH_TYPE.body, color: COACH.ink }}>{text}</Text>
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

/**
 * A softly pulsing dot beside the label, in place of a platform spinner. The
 * whole row breathes together, so it reads as one "working" signal.
 */
function ToolIndicator({ name }: { name: string }) {
  const label = TOOL_LABELS[name] ?? (name === "thinking" ? "Thinking" : "Working");
  const [pulse] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingTop: 4,
        opacity: pulse,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: COACH_RADIUS.pill,
          backgroundColor: COACH.ink,
        }}
      />
      <Text style={{ ...COACH_TYPE.body, color: COACH.inkMuted }}>{label}…</Text>
    </Animated.View>
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

/** Plain assistant text, the way ChatGPT reports a limit, not a warning box. */
function ErrorNotice({ code }: { code: CoachErrorCode }) {
  return <Text style={{ ...COACH_TYPE.body, color: COACH.ink }}>{ERROR_COPY[code]}</Text>;
}
