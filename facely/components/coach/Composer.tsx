import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { ArrowUp, Square } from "lucide-react-native";

import { hapticLight } from "@/lib/haptics";

import { COACH, COACH_RADIUS, COACH_SPACE, COACH_TYPE } from "./theme";

/* ============================================================================
 * The input row.
 *
 * A single rounded field with the send control inside it, the shape people
 * already expect from a chat assistant. It grows with the text up to a ceiling,
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
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  exhausted,
  bottomInset,
}: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy && !exhausted;

  return (
    <View
      style={{
        paddingHorizontal: COACH_SPACE.pageMargin,
        paddingTop: COACH_SPACE.gap,
        paddingBottom: bottomInset,
        backgroundColor: COACH.bg,
        borderTopWidth: 1,
        borderTopColor: COACH.hairline,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingLeft: COACH_SPACE.cardPadding,
          paddingRight: 6,
          paddingVertical: 6,
          borderRadius: COACH_RADIUS.composer,
          backgroundColor: COACH.surface,
          borderWidth: 1,
          borderColor: COACH.border,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!exhausted}
          placeholder={exhausted ? "Messages reset on Monday" : "Ask Coach anything…"}
          placeholderTextColor={COACH.inkFaint}
          multiline
          maxLength={2000}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 32,
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
            backgroundColor: busy
              ? COACH.surfaceMuted
              : canSend
                ? COACH.accent
                : COACH.surfaceMuted,
          }}
          accessibilityRole="button"
          accessibilityLabel={busy ? "Stop generating" : "Send message"}
        >
          {busy ? (
            <Square size={14} color={COACH.ink} fill={COACH.ink} />
          ) : (
            <ArrowUp size={20} color={canSend ? COACH.ink : COACH.inkFaint} />
          )}
        </Pressable>
      </View>
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
