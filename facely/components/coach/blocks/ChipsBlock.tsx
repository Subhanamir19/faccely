import React from "react";
import { View, Pressable, Text } from "react-native";

import { hapticLight } from "@/lib/haptics";
import type { CoachChipsBlock } from "@/lib/coach/blocks";

import { COACH, COACH_RADIUS, COACH_TYPE } from "../theme";

/* ============================================================================
 * Tappable follow-up questions.
 *
 * The highest-leverage element in the feature. A user who never has to type
 * keeps the conversation going; one facing an empty input usually stops. The
 * backend guarantees these on every reply.
 *
 * Outlined on paper rather than filled with lime: three solid accent pills in a
 * row would turn the thread into a menu, and the spec keeps lime focal.
 * ========================================================================== */

export function ChipsBlock({
  block,
  onPress,
}: {
  block: CoachChipsBlock;
  onPress?: (text: string) => void;
}) {
  if (!onPress) return null;

  return (
    <View style={{ gap: 8 }}>
      {block.items.map((item) => (
        <Chip key={item} label={item} onPress={() => onPress(item)} />
      ))}
    </View>
  );
}

export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        maxWidth: "100%",
        // 44pt minimum touch target, per the brand spec.
        minHeight: 44,
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: COACH_RADIUS.pill,
        borderWidth: 1,
        borderColor: pressed ? COACH.accentDeep : COACH.border,
        backgroundColor: pressed ? COACH.accentSoft : COACH.surface,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={{ ...COACH_TYPE.caption, color: COACH.ink }}>{label}</Text>
    </Pressable>
  );
}
