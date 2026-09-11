import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, TYPE, SP, RADII } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";
import { useCoach } from "@/store/coach";

import { Thread } from "./Thread";
import { Chip } from "./blocks/ChipsBlock";

/* ============================================================================
 * The Coach sheet.
 *
 * A 90%-height modal rather than a full screen, so the app stays visible behind
 * it and Coach reads as a layer over what the user was doing rather than a
 * place they navigated away to.
 *
 * Built on React Native's own Modal instead of a sheet library. What this needs
 * — a backdrop, a rounded panel, keyboard avoidance — is a few dozen lines, and
 * it avoids a dependency whose gesture handling would have to be reconciled
 * with the floating button's.
 * ========================================================================== */

export type CoachSheetProps = {
  /** Route the sheet was opened from, passed to the backend for context. */
  screen: string | null;
};

export function CoachSheet({ screen }: CoachSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  const open = useCoach((state) => state.open);
  const status = useCoach((state) => state.status);
  const messages = useCoach((state) => state.messages);
  const chips = useCoach((state) => state.chips);
  const quota = useCoach((state) => state.quota);
  const activeTool = useCoach((state) => state.activeTool);
  const closeCoach = useCoach((state) => state.closeCoach);
  const send = useCoach((state) => state.send);

  const busy = status !== "idle";

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      setDraft("");
      void send(trimmed, screen);
    },
    [busy, screen, send]
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={closeCoach}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: COLORS.modalBackdrop }}>
        {/* Tapping the strip above the sheet dismisses it. */}
        <Pressable style={{ flex: 1 }} onPress={closeCoach} accessibilityLabel="Close Coach" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            height: "90%",
            backgroundColor: COLORS.bgBottom,
            borderTopLeftRadius: RADII.card,
            borderTopRightRadius: RADII.card,
            borderTopWidth: 1,
            borderColor: COLORS.cardBorder,
            overflow: "hidden",
          }}
        >
          <Header quotaLabel={quotaLabel(quota?.messagesLeft)} onClose={closeCoach} />

          {messages.length === 0 ? (
            <EmptyState chips={chips} onChipPress={submit} />
          ) : (
            <Thread messages={messages} activeTool={activeTool} onChipPress={submit} />
          )}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => submit(draft)}
            busy={busy}
            bottomInset={insets.bottom}
            exhausted={quota?.messagesLeft === 0}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*   Pieces                                                                   */
/* -------------------------------------------------------------------------- */

function quotaLabel(messagesLeft: number | undefined): string | null {
  if (messagesLeft === undefined) return null;
  if (messagesLeft === 0) return "No messages left";
  return `${messagesLeft} left`;
}

function Header({
  quotaLabel: label,
  onClose,
}: {
  quotaLabel: string | null;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SP[4],
        paddingVertical: SP[3],
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
      }}
    >
      <Text style={{ ...TYPE.h4, color: COLORS.text }}>Coach</Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: SP[3] }}>
        {label ? (
          <Text style={{ ...TYPE.caption, color: COLORS.sub }}>{label}</Text>
        ) : null}

        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close Coach"
        >
          <Text style={{ ...TYPE.h4, color: COLORS.sub }}>✕</Text>
        </Pressable>
      </View>
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
    <View style={{ flex: 1, justifyContent: "flex-end", padding: SP[4], gap: SP[3] }}>
      <Text style={{ ...TYPE.body, color: COLORS.muted }}>
        Ask me anything about your face, your scores, or your routine. I can see your scans.
      </Text>

      <View style={{ gap: SP[2] }}>
        {chips.map((chip) => (
          <Chip key={chip} label={chip} onPress={() => onChipPress(chip)} />
        ))}
      </View>
    </View>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  bottomInset,
  exhausted,
}: {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  busy: boolean;
  bottomInset: number;
  exhausted: boolean;
}) {
  const canSend = value.trim().length > 0 && !busy && !exhausted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SP[2],
        paddingHorizontal: SP[4],
        paddingTop: SP[3],
        paddingBottom: Math.max(bottomInset, SP[3]),
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!exhausted}
        placeholder={exhausted ? "Messages reset on Monday" : "Ask Coach…"}
        placeholderTextColor={COLORS.sub}
        multiline
        maxLength={2000}
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          maxHeight: 120,
          minHeight: 44,
          paddingHorizontal: SP[4],
          paddingTop: SP[3],
          paddingBottom: SP[3],
          borderRadius: RADII.xl,
          backgroundColor: COLORS.inputBg,
          borderWidth: 1,
          borderColor: COLORS.cardBorder,
          color: COLORS.text,
          ...TYPE.body,
        }}
      />

      <Pressable
        onPress={() => {
          hapticLight();
          onSubmit();
        }}
        disabled={!canSend}
        style={{
          width: 44,
          height: 44,
          borderRadius: RADII.circle,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: canSend ? COLORS.accent : COLORS.btnDisabledBg,
        }}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Text style={{ ...TYPE.h4, color: canSend ? "#0B0B0B" : COLORS.btnDisabledText }}>
            ↑
          </Text>
        )}
      </Pressable>
    </View>
  );
}
