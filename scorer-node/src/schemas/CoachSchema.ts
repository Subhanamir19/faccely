// scorer-node/src/schemas/CoachSchema.ts
import { z } from "zod";

import { metricKeys } from "../validators.js";

/* ============================================================================
 * Coach — shared contracts between the API and the app.
 *
 * Two things live here and nothing else:
 *   1. Blocks — the typed pieces an assistant answer is assembled from.
 *   2. Wire events — the NDJSON frames the streaming endpoint emits.
 *
 * Pure Zod. No side effects, no I/O, no imports beyond the metric key list, so
 * this file can be mirrored verbatim in the app without dragging server code
 * across.
 *
 * Design rule that everything here exists to enforce: the model never invents a
 * number. Scores, deltas and chart points are only ever copied from tool
 * results. See services/coachNumberGuard.ts for the check that holds the model
 * to it.
 * ========================================================================== */

/* ------------------------------- Primitives ------------------------------- */

export const CoachMetricKeySchema = z.enum(metricKeys);
export type CoachMetricKey = z.infer<typeof CoachMetricKeySchema>;

export const CoachRoleSchema = z.enum(["user", "assistant", "system"]);
export type CoachRole = z.infer<typeof CoachRoleSchema>;

/** 0-100, matching every score the scoring pipeline produces. */
const ScoreValueSchema = z.number().min(0).max(100);

/* --------------------------------- Blocks --------------------------------- */

/**
 * Prose. Inline `**bold**` and `*italic*` are honoured by the renderer; block
 * markdown (headings, lists, tables, fences) is not, because each of those has
 * a dedicated block type and a native component behind it.
 *
 * The 600-character cap is deliberate. It keeps replies scannable on a phone
 * and it keeps output tokens — the expensive half of every call — bounded.
 */
export const TextBlockSchema = z.object({
  type: z.literal("text"),
  md: z.string().min(1).max(600),
});

/** A single metric with its current score and, when known, its movement. */
export const MetricCardBlockSchema = z.object({
  type: z.literal("metric_card"),
  metric: CoachMetricKeySchema,
  score: ScoreValueSchema,
  /** Change against the previous scan. Omitted when there is no earlier scan. */
  delta: z.number().min(-100).max(100).optional(),
  note: z.string().min(1).max(200),
});

export const ChartPointSchema = z.object({
  /** Axis label. Dates arrive pre-formatted so the app does no date maths. */
  x: z.string().min(1).max(32),
  y: z.number(),
});

/**
 * Charts are capped at 4 series × 24 points. Past that a phone chart is
 * unreadable, and an uncapped series is an easy way for a model to burn tokens.
 */
export const ChartBlockSchema = z.object({
  type: z.literal("chart"),
  chart: z.enum(["line", "radar", "bar"]),
  series: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        points: z.array(ChartPointSchema).min(1).max(24),
      })
    )
    .min(1)
    .max(4),
  yMin: z.number().optional(),
  yMax: z.number().optional(),
  caption: z.string().max(160).optional(),
});

/**
 * Two scans side by side, with the metric movements between them.
 *
 * Scan ids are validated as opaque strings rather than UUIDs. Ids in this
 * database are not uniformly UUID-shaped — `users.id` is text — so pinning a
 * format here would reject perfectly good rows.
 */
export const CompareBlockSchema = z.object({
  type: z.literal("compare"),
  beforeScanId: z.string().min(1).max(64),
  afterScanId: z.string().min(1).max(64),
  deltas: z
    .array(
      z.object({
        metric: CoachMetricKeySchema,
        from: ScoreValueSchema,
        to: ScoreValueSchema,
      })
    )
    .min(1)
    .max(metricKeys.length),
});

/** Four columns is the most a phone renders without horizontal scrolling. */
export const TableBlockSchema = z.object({
  type: z.literal("table"),
  headers: z.array(z.string().min(1).max(24)).min(2).max(4),
  rows: z.array(z.array(z.string().max(80)).min(2).max(4)).min(1).max(8),
});

/**
 * A suggested change to the user's plan. Rendering it is not applying it — the
 * app shows a button, and the write only happens on an explicit tap.
 */
export const ActionCardBlockSchema = z.object({
  type: z.literal("action_card"),
  action: z.enum(["add_exercise", "add_protocol"]),
  /** Catalog id. Validated against the real catalog before the card is sent. */
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  reason: z.string().min(1).max(200),
});

export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  url: z.string().url(),
  kind: z.enum(["potential", "hairstyle", "concept"]),
  creditsLeft: z.number().int().min(0),
});

/**
 * Tappable follow-up questions. These carry most of the engagement in the
 * feature: a user who never has to type keeps talking. Every assistant reply
 * ends with one of chips, a chart, or an action card — never a dead end.
 */
export const ChipsBlockSchema = z.object({
  type: z.literal("chips"),
  items: z.array(z.string().min(1).max(48)).min(1).max(3),
});

/**
 * Evidence labelling. The product's credibility rests on saying "plausible"
 * where competitors say "proven", so the tier is part of the contract rather
 * than a turn of phrase inside a text block.
 */
export const CitationBlockSchema = z.object({
  type: z.literal("citation"),
  claim: z.string().min(1).max(200),
  tier: z.enum(["proven", "plausible", "unproven"]),
});

export const CoachBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  MetricCardBlockSchema,
  ChartBlockSchema,
  CompareBlockSchema,
  TableBlockSchema,
  ActionCardBlockSchema,
  ImageBlockSchema,
  ChipsBlockSchema,
  CitationBlockSchema,
]);
export type CoachBlock = z.infer<typeof CoachBlockSchema>;

export type CoachTextBlock = z.infer<typeof TextBlockSchema>;
export type CoachMetricCardBlock = z.infer<typeof MetricCardBlockSchema>;
export type CoachChartBlock = z.infer<typeof ChartBlockSchema>;
export type CoachCompareBlock = z.infer<typeof CompareBlockSchema>;
export type CoachTableBlock = z.infer<typeof TableBlockSchema>;
export type CoachActionCardBlock = z.infer<typeof ActionCardBlockSchema>;
export type CoachImageBlock = z.infer<typeof ImageBlockSchema>;
export type CoachChipsBlock = z.infer<typeof ChipsBlockSchema>;
export type CoachCitationBlock = z.infer<typeof CitationBlockSchema>;

/** 12 blocks is far beyond any sane answer; it exists to bound a runaway loop. */
export const CoachBlocksSchema = z.array(CoachBlockSchema).min(1).max(12);

/* ------------------------------ Wire protocol ----------------------------- */

/**
 * The stream is NDJSON: one JSON object per line, newline-terminated.
 *
 * Chosen over SSE because the app reads it with `expo/fetch`, whose response
 * body is a plain `ReadableStream` — splitting on "\n" needs no client library,
 * where SSE would need one.
 *
 * Text arrives token by token so the reply starts moving immediately. Every
 * other block arrives complete: half a chart is worse than a late one.
 */
export const CoachStreamEventSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("start"),
    messageId: z.string().uuid(),
    threadId: z.string().uuid(),
  }),
  z.object({
    t: z.literal("delta"),
    /** Index of the block this text belongs to, in final block order. */
    i: z.number().int().min(0),
    text: z.string(),
  }),
  z.object({
    t: z.literal("block"),
    i: z.number().int().min(0),
    block: CoachBlockSchema,
  }),
  z.object({
    /**
     * A data lookup started. Surfaced in the UI ("reading your scans…") on
     * purpose: watching Coach consult real records is what separates it from a
     * generic chatbot, so it is shown rather than hidden.
     */
    t: z.literal("tool"),
    name: z.string().min(1),
  }),
  z.object({
    t: z.literal("done"),
    usage: z.object({
      in: z.number().int().min(0),
      out: z.number().int().min(0),
    }),
    quota: z.object({
      messagesLeft: z.number().int().min(0),
      imagesLeft: z.number().int().min(0),
      resetsAt: z.string().datetime({ offset: true }),
    }),
  }),
  z.object({
    t: z.literal("error"),
    code: z.enum([
      "quota_exceeded",
      "daily_limit",
      "safety_blocked",
      "upstream_failed",
      "invalid_request",
      "internal",
    ]),
    message: z.string().max(200).optional(),
  }),
]);
export type CoachStreamEvent = z.infer<typeof CoachStreamEventSchema>;

/** Serialise one event as a single NDJSON line, newline included. */
export function encodeStreamEvent(event: CoachStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/* -------------------------------- Requests -------------------------------- */

/**
 * `screen` is the route the floating button was tapped on. It is free
 * intelligence: opening Coach from the cheekbones breakdown should produce a
 * different opening question than opening it from the dashboard.
 */
export const CoachSendRequestSchema = z.object({
  thread_id: z.string().uuid().optional(),
  user_text: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2_000, "Message too long (max 2000 characters)"),
  screen: z.string().max(64).optional(),
});
export type CoachSendRequest = z.infer<typeof CoachSendRequestSchema>;

export const CoachHistoryQuerySchema = z.object({
  thread_id: z.string().uuid().optional(),
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CoachHistoryQuery = z.infer<typeof CoachHistoryQuerySchema>;

/* -------------------------------- Responses ------------------------------- */

export const CoachMessageSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  role: CoachRoleSchema,
  /** Plain-text mirror of the answer. Used for search and for context replay. */
  content: z.string().nullable(),
  blocks: CoachBlocksSchema.nullable(),
  screen: z.string().nullable(),
  created_at: z.string(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;

export const CoachHistoryResponseSchema = z.object({
  thread_id: z.string().uuid(),
  messages: z.array(CoachMessageSchema),
  /** Oldest returned timestamp; pass back as `before` to page further. */
  next_before: z.string().nullable(),
});
export type CoachHistoryResponse = z.infer<typeof CoachHistoryResponseSchema>;
