import React, { useMemo } from "react";
import { Text } from "react-native";

import { TYPE } from "@/lib/tokens";
import { COACH } from "../theme";
import type { CoachTextBlock } from "@/lib/coach/blocks";

/* ============================================================================
 * Coach prose.
 *
 * Only inline bold and italic are supported, because every other kind of
 * markdown has a dedicated block type behind it — a list is chips, a table is a
 * table block, a figure is a metric card. Rendering general markdown here would
 * let the model route around those and produce a web page.
 *
 * The parser is a deliberate hundred lines less than a markdown library: it
 * scans for ** and * runs and nothing else.
 * ========================================================================== */

type Segment = { text: string; bold?: boolean; italic?: boolean };

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function parseInline(md: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of md.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ text: md.slice(lastIndex, index) });
    }

    const token = match[0];
    if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else {
      segments.push({ text: token.slice(1, -1), italic: true });
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < md.length) {
    segments.push({ text: md.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text: md }];
}

export function TextBlock({ block }: { block: CoachTextBlock }) {
  const segments = useMemo(() => parseInline(block.md), [block.md]);

  return (
    <Text
      style={{
        ...TYPE.body,
        color: COACH.ink,
      }}
    >
      {segments.map((segment, index) => (
        <Text
          key={index}
          style={{
            fontFamily: segment.bold ? "Poppins-SemiBold" : TYPE.body.fontFamily,
            fontStyle: segment.italic ? "italic" : "normal",
          }}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
