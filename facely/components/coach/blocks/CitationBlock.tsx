import React from "react";
import { View, Text } from "react-native";

import type { CoachCitationBlock } from "@/lib/coach/blocks";

import { COACH, COACH_RADIUS, COACH_TYPE } from "../theme";

/* ============================================================================
 * Evidence labelling.
 *
 * Shown as its own block rather than folded into a sentence so the strength of
 * a claim cannot be softened by phrasing. Being the app that says "plausible,
 * no controlled trials" where competitors say "proven" is the differentiator,
 * which makes it worth the screen space.
 *
 * Drawn as a signal line with a coloured node, matching the vertical signal
 * motif used by the analysis screens.
 * ========================================================================== */

const TIER_STYLE: Record<
  CoachCitationBlock["tier"],
  { label: string; color: string }
> = {
  proven: { label: "Proven", color: COACH.positive },
  plausible: { label: "Plausible", color: COACH.band.average },
  unproven: { label: "Unproven", color: COACH.coral },
};

export function CitationBlock({ block }: { block: CoachCitationBlock }) {
  const tier = TIER_STYLE[block.tier];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: COACH_RADIUS.card,
        backgroundColor: COACH.surfaceMuted,
        borderLeftWidth: 2,
        borderLeftColor: tier.color,
      }}
    >
      <Text
        style={{
          ...COACH_TYPE.captionSemiBold,
          color: tier.color,
        }}
      >
        {tier.label}
      </Text>
      <Text style={{ ...COACH_TYPE.caption, color: COACH.inkMuted, flexShrink: 1 }}>
        {block.claim}
      </Text>
    </View>
  );
}
