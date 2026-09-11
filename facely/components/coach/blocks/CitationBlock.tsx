import React from "react";
import { View, Text } from "react-native";

import { COLORS, TYPE, SP, RADII } from "@/lib/tokens";
import type { CoachCitationBlock } from "@/lib/coach/blocks";

/* ============================================================================
 * Evidence labelling.
 *
 * Shown as its own block rather than folded into a sentence so the strength of
 * a claim cannot be softened by phrasing. Being the app that says "plausible,
 * no controlled trials" where competitors say "proven" is the differentiator,
 * which makes it worth the screen space.
 * ========================================================================== */

const TIER_STYLE: Record<
  CoachCitationBlock["tier"],
  { label: string; color: string }
> = {
  proven: { label: "Proven", color: COLORS.success },
  plausible: { label: "Plausible", color: COLORS.warning },
  unproven: { label: "Unproven", color: COLORS.errorLight },
};

export function CitationBlock({ block }: { block: CoachCitationBlock }) {
  const tier = TIER_STYLE[block.tier];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SP[2],
        paddingVertical: SP[2],
        paddingHorizontal: SP[3],
        borderRadius: RADII.md,
        backgroundColor: COLORS.whiteGlass,
        borderLeftWidth: 2,
        borderLeftColor: tier.color,
      }}
    >
      <Text style={{ ...TYPE.caption, color: tier.color, fontFamily: "Poppins-SemiBold" }}>
        {tier.label}
      </Text>
      <Text style={{ ...TYPE.caption, color: COLORS.muted, flexShrink: 1 }}>
        {block.claim}
      </Text>
    </View>
  );
}
