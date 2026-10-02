import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { ArrowUp, Square } from "lucide-react-native";

import { hapticLight } from "@/lib/haptics";

import { COACH, COACH_RADIUS, COACH_SPACE, COACH_TYPE } from "./theme";

/* ============================================================================
 * The input row.
 *
 * A single borderless grey pill with the send control inside it, floating on
 * the page with no divider above — the shape people already expect from
 * ChatGPT. It grows with the text up to a ceiling,
 * then scrolls, so a long question never pushes the conversation off screen.
 *
 * While a reply is streaming the send button becomes stop. Cancelling aborts
 * the request on the server too, so an unwanted answer stops costing money the
 * moment the user says so.
 * ========================================================================== */

export type ComposerProps = {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  exhausted: boolean;
  /** Extra bottom padding so the row clears the floating tab bar. */
  bottomInset: number;
  /** Messages left this week; the note only appears when it runs low. */
  messagesLeft?: number;
  /** Where "Get more" goes. Omitted, the note is informational only. */
  onGetMore?: () => void;
};

/** At or below this, the allowance is shown by the input instead of hidden. */
const LOW_QUOTA = 3;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  exhausted,
  bottomInset,
  messagesLeft,
  onGetMore,
}: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy && !exhausted;
  const showQuota = messagesLeft !== undefined && messagesLeft <= LOW_QUOTA;

  return (
    <View
      style={{
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingTop: COACH_SPACE.gap,
        paddingBottom: bottomInset,
      }}
    >
      {/* The allowance sits where it is spent, and only once it matters, so
          it is noticed at the moment an upgrade makes sense. */}
      {showQuota ? (
        <QuotaNote messagesLeft={messagesLeft} onGetMore={onGetMore} />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          minHeight: 56,
          paddingLeft: COACH_SPACE.pageMargin,
          paddingRight: 10,
          paddingVertical: 10,
          borderRadius: COACH_RADIUS.composer,
          backgroundColor: COACH.fill,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!exhausted}
          placeholder={exhausted ? "Messages reset on Monday" : "Ask anything"}
          placeholderTextColor={COACH.inkFaint}
          multiline
          maxLength={2000}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 36,
            paddingTop: 6,
            paddingBottom: 6,
            color: COACH.ink,
            ...COACH_TYPE.body,
          }}
        />

        <Pressable
          onPress={() => {
            hapticLight();
            if (busy) onStop();
            else onSubmit();
          }}
          disabled={!busy && !canSend}
          hitSlop={6}
          style={{
            width: 36,
            height: 36,
            borderRadius: COACH_RADIUS.pill,
            alignItems: "center",
            justifyContent: "center",
            // Solid ink when it will do something, a faint disc when it will not.
            backgroundColor: busy || canSend ? COACH.ink : COACH.border,
          }}
          accessibilityRole="button"
          accessibilityLabel={busy ? "Stop generating" : "Send message"}
        >
          {busy ? (
            <Square size={12} color={COACH.surface} fill={COACH.surface} />
          ) : (
            <ArrowUp size={20} color={canSend ? COACH.surface : COACH.inkFaint} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function QuotaNote({
  messagesLeft,
  onGetMore,
}: {
  messagesLeft: number;
  onGetMore?: () => void;
}) {
  const label =
    messagesLeft === 0
      ? "No messages left this week"
      : `${messagesLeft} ${messagesLeft === 1 ? "message" : "messages"} left this week`;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      <Text style={{ ...COACH_TYPE.small, color: COACH.inkFaint }}>{label}</Text>
      {onGetMore ? (
        <Pressable
          onPress={() => {
            hapticLight();
            onGetMore();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Get more Coach messages"
        >
          <Text style={{ ...COACH_TYPE.small, color: COACH.accentDeep, fontWeight: "600" }}>
            Get more
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Shown in place of the composer while the first load is in flight. */
export function ComposerSkeleton() {
  return (
    <View style={{ padding: COACH_SPACE.pageMargin, alignItems: "center" }}>
      <ActivityIndicator size="small" color={COACH.inkFaint} />
      <Text style={{ ...COACH_TYPE.caption, color: COACH.inkFaint, marginTop: 8 }}>
        Loading Coach…
      </Text>
    </View>
  );
}
