import React from "react";
import { View, Text } from "react-native";

import { TYPE } from "@/lib/tokens";
import { METRIC_LABELS } from "@/lib/types";
import type { CoachMetricCardBlock } from "@/lib/coach/blocks";

import { COACH, COACH_SPACE, scoreBand } from "../theme";
import { BlockSurface } from "./BlockRenderer";

/* ============================================================================
 * One metric, its score, and how it moved.
 *
 * Every figure here came from the database, not the model — see
 * services/coachData.ts on the backend. The note is the only part Coach wrote.
 *
 * The score carries its band colour; the rest of the card stays ink on paper.
 * Colouring the whole surface by score would turn a guidance screen into a
 * verdict, which the brand spec rules out.
 * ========================================================================== */

export function MetricCardBlock({ block }: { block: CoachMetricCardBlock }) {
  const color = scoreBand(block.score);
  const hasDelta = typeof block.delta === "number" && block.delta !== 0;
  const rising = (block.delta ?? 0) > 0;

  return (
    <BlockSurface>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: COACH_SPACE.gap,
        }}
      >
        <Text style={{ ...TYPE.bodyMedium, color: COACH.ink, flexShrink: 1 }}>
          {METRIC_LABELS[block.metric] ?? block.metric.replace(/_/g, " ")}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={{ ...TYPE.h3, color }}>{block.score}</Text>

          {hasDelta ? (
            <Text
              style={{
                ...TYPE.caption,
                color: rising ? COACH.positive : COACH.coral,
              }}
            >
              {rising ? "+" : ""}
              {block.delta}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={{ ...TYPE.caption, color: COACH.inkMuted, marginTop: 8 }}>
        {block.note}
      </Text>
    </BlockSurface>
  );
}
