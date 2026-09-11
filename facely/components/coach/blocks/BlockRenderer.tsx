import React from "react";
import { View } from "react-native";

import { COLORS, SP } from "@/lib/tokens";
import type { CoachBlock } from "@/lib/coach/blocks";

import { TextBlock } from "./TextBlock";
import { MetricCardBlock } from "./MetricCardBlock";
import { ChartBlock } from "./ChartBlock";
import { ChipsBlock } from "./ChipsBlock";
import { CitationBlock } from "./CitationBlock";

/* ============================================================================
 * Turns one answer into native components.
 *
 * Unknown block types render nothing rather than throwing. The backend can ship
 * a new block before the app that draws it does, and an older build should lose
 * that one card, not the conversation.
 * ========================================================================== */

export type BlockRendererProps = {
  blocks: CoachBlock[];
  /** Tapping a suggested question sends it. */
  onChipPress?: (text: string) => void;
};

export function BlockRenderer({ blocks, onChipPress }: BlockRendererProps) {
  return (
    <View style={{ gap: SP[3] }}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} onChipPress={onChipPress} />
      ))}
    </View>
  );
}

function BlockView({
  block,
  onChipPress,
}: {
  block: CoachBlock;
  onChipPress?: (text: string) => void;
}) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;

    case "metric_card":
      return <MetricCardBlock block={block} />;

    case "chart":
      return <ChartBlock block={block} />;

    case "chips":
      return <ChipsBlock block={block} onPress={onChipPress} />;

    case "citation":
      return <CitationBlock block={block} />;

    // Rendered from phase 3 onwards. Skipped rather than half-drawn.
    case "compare":
    case "table":
    case "action_card":
    case "image":
    default:
      return null;
  }
}

/** Shared card surface, so every block type sits on the same material. */
export function BlockSurface({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 18,
        padding: SP[4],
      }}
    >
      {children}
    </View>
  );
}
