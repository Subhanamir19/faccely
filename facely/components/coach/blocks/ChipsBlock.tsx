import React from "react";
import { View, Pressable, Text } from "react-native";

import { COLORS, TYPE, SP, RADII } from "@/lib/tokens";
import { hapticLight } from "@/lib/haptics";
import type { CoachChipsBlock } from "@/lib/coach/blocks";

/* ============================================================================
 * Tappable follow-up questions.
 *
 * The highest-leverage element in the feature. A user who never has to type
 * keeps the conversation going; one facing an empty input usually stops. Coach
 * is instructed to end every reply with these unless it ended with a chart.
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
    <View style={{ gap: SP[2] }}>
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
        paddingVertical: SP[2],
        paddingHorizontal: SP[4],
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: COLORS.accentBorder,
        backgroundColor: pressed ? COLORS.accentGlow : COLORS.whiteGlass,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={{ ...TYPE.caption, color: COLORS.accent }}>{label}</Text>
    </Pressable>
  );
}
