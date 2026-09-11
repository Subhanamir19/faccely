/* ============================================================================
 * Coach — the shape of an answer.
 *
 * This mirrors scorer-node/src/schemas/CoachSchema.ts. The backend validates
 * with Zod; the app only needs the types, so this is a plain type mirror rather
 * than a second copy of the schema.
 *
 * A reply is an array of typed blocks, not a markdown string. Each block maps
 * to a real React Native component, which is why a chart in Coach looks like a
 * chart everywhere else in the app instead of a web page embedded in a native
 * one.
 *
 * If the backend file changes, change this one in the same commit.
 * ========================================================================== */

import type { MetricKey } from "@/lib/types";

export type CoachRole = "user" | "assistant" | "system";

export type CoachTextBlock = { type: "text"; md: string };

export type CoachMetricCardBlock = {
  type: "metric_card";
  metric: MetricKey;
  score: number;
  /** Change since the previous scan. Absent when there is no earlier scan. */
  delta?: number;
  note: string;
};

export type CoachChartPoint = { x: string; y: number };

export type CoachChartBlock = {
  type: "chart";
  chart: "line" | "radar" | "bar";
  series: Array<{ label: string; points: CoachChartPoint[] }>;
  yMin?: number;
  yMax?: number;
  caption?: string;
};

export type CoachCompareBlock = {
  type: "compare";
  beforeScanId: string;
  afterScanId: string;
  deltas: Array<{ metric: MetricKey; from: number; to: number }>;
};

export type CoachTableBlock = {
  type: "table";
  headers: string[];
  rows: string[][];
};

export type CoachActionCardBlock = {
  type: "action_card";
  action: "add_exercise" | "add_protocol";
  id: string;
  title: string;
  reason: string;
};

export type CoachImageBlock = {
  type: "image";
  url: string;
  kind: "potential" | "hairstyle" | "concept";
  creditsLeft: number;
};

export type CoachChipsBlock = { type: "chips"; items: string[] };

export type CoachCitationBlock = {
  type: "citation";
  claim: string;
  tier: "proven" | "plausible" | "unproven";
};

export type CoachBlock =
  | CoachTextBlock
  | CoachMetricCardBlock
  | CoachChartBlock
  | CoachCompareBlock
  | CoachTableBlock
  | CoachActionCardBlock
  | CoachImageBlock
  | CoachChipsBlock
  | CoachCitationBlock;

/* -------------------------------------------------------------------------- */
/*   Stream events                                                            */
/* -------------------------------------------------------------------------- */

export type CoachStreamEvent =
  | { t: "start"; messageId: string; threadId: string }
  | { t: "delta"; i: number; text: string }
  | { t: "block"; i: number; block: CoachBlock }
  | { t: "tool"; name: string }
  | {
      t: "done";
      usage: { in: number; out: number };
      quota: CoachQuota;
    }
  | { t: "error"; code: CoachErrorCode; message?: string };

export type CoachErrorCode =
  | "quota_exceeded"
  | "daily_limit"
  | "safety_blocked"
  | "upstream_failed"
  | "invalid_request"
  | "internal";

export type CoachQuota = {
  messagesLeft: number;
  imagesLeft: number;
  resetsAt: string;
};

/* -------------------------------------------------------------------------- */
/*   Messages                                                                 */
/* -------------------------------------------------------------------------- */

export type CoachMessage = {
  id: string;
  role: CoachRole;
  /** Blocks for assistant turns; user turns carry text only. */
  blocks: CoachBlock[];
  text: string;
  createdAt: string;
  /** True while the reply is still arriving. */
  streaming?: boolean;
  /** Set when the turn ended in an error, so the row can offer a retry. */
  error?: CoachErrorCode;
};

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Whether a block came through intact enough to render.
 *
 * An unrecognised or malformed block is skipped rather than thrown on. A future
 * backend that emits a block type this build has never heard of should cost the
 * user one missing card, not a crashed conversation.
 */
export function isRenderableBlock(block: unknown): block is CoachBlock {
  if (!block || typeof block !== "object") return false;
  const candidate = block as { type?: unknown };

  switch (candidate.type) {
    case "text":
      return typeof (block as CoachTextBlock).md === "string";
    case "metric_card":
      return typeof (block as CoachMetricCardBlock).score === "number";
    case "chart":
      return Array.isArray((block as CoachChartBlock).series);
    case "compare":
      return Array.isArray((block as CoachCompareBlock).deltas);
    case "table":
      return Array.isArray((block as CoachTableBlock).rows);
    case "action_card":
      return typeof (block as CoachActionCardBlock).id === "string";
    case "image":
      return typeof (block as CoachImageBlock).url === "string";
    case "chips":
      return Array.isArray((block as CoachChipsBlock).items);
    case "citation":
      return typeof (block as CoachCitationBlock).claim === "string";
    default:
      return false;
  }
}

/** Plain-text mirror of an answer, for accessibility and for copying. */
export function blocksToText(blocks: CoachBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.md;
        case "metric_card":
          return `${block.metric.replace(/_/g, " ")}: ${block.score}. ${block.note}`;
        case "chart":
          return block.caption ?? "";
        case "citation":
          return `${block.claim} (${block.tier})`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
