import React from "react";
import { View, Text } from "react-native";

import { COLORS, TYPE, SP } from "@/lib/tokens";
import { METRIC_LABELS } from "@/lib/types";
import type { CoachMetricCardBlock } from "@/lib/coach/blocks";

import { BlockSurface } from "./BlockRenderer";

/* ============================================================================
 * One metric, its score, and how it moved.
 *
 * Every figure here came from the database, not the model — see
 * services/coachData.ts on the backend. The note is the only part Coach wrote.
 * ========================================================================== */

/** Score to tier colour, matching the bands used elsewhere in the app. */
function scoreColor(score: number): string {
  if (score >= 85) return COLORS.verdictElite;
  if (score >= 70) return COLORS.verdictGreat;
  if (score >= 55) return COLORS.verdictGood;
  if (score >= 40) return COLORS.verdictAverage;
  return COLORS.verdictPoor;
}

export function MetricCardBlock({ block }: { block: CoachMetricCardBlock }) {
  const color = scoreColor(block.score);
  const hasDelta = typeof block.delta === "number" && block.delta !== 0;

  return (
    <BlockSurface>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SP[3],
        }}
      >
        <Text style={{ ...TYPE.bodyMedium, color: COLORS.text, flexShrink: 1 }}>
          {METRIC_LABELS[block.metric] ?? block.metric.replace(/_/g, " ")}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "baseline", gap: SP[2] }}>
          <Text style={{ ...TYPE.h3, color }}>{block.score}</Text>

          {hasDelta ? (
            <Text
              style={{
                ...TYPE.caption,
                color: (block.delta as number) > 0 ? COLORS.success : COLORS.errorLight,
              }}
            >
              {(block.delta as number) > 0 ? "+" : ""}
              {block.delta}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={{ ...TYPE.caption, color: COLORS.sub, marginTop: SP[2] }}>
        {block.note}
      </Text>
    </BlockSurface>
  );
}
