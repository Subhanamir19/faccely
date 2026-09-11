import { z } from "zod";
import type OpenAI from "openai";

import {
  buildChart,
  buildMetricCard,
  getProfile,
  getRoutineAdherence,
  getScanHistory,
  getSubmetrics,
} from "./coachData.js";
import { metricKeys, type MetricKey } from "../validators.js";
import type { CoachBlock } from "../schemas/CoachSchema.js";

/* ============================================================================
 * Coach tools — the only way the model reaches the user's data, and the only
 * way it puts a number on screen.
 *
 * Two kinds live here:
 *
 *   get_*   read the user's records and hand the rows back to the model
 *   emit_*  render a block; the model supplies the words, this file supplies
 *           every figure from the database
 *
 * Emitters are deliberately not free-form. The model cannot pass chart points
 * or a score — it names the metric and writes a caption, and `coachData` fills
 * the rest. A malformed or invented chart is therefore not something the model
 * is able to express, rather than something it is asked to avoid.
 *
 * Seven tools. Past roughly ten, models pick the wrong one noticeably more
 * often, so new capability should replace a tool rather than add one.
 * ========================================================================== */

export interface ToolExecution {
  name: string;
  /** JSON handed back to the model as the tool result. */
  payload: unknown;
  /** Block to stream to the app. Present only for `emit_*` tools. */
  block?: CoachBlock;
  /**
   * Every figure this result legitimately puts in front of the model, used by
   * coachNumberGuard to tell a quoted score from an invented one.
   */
  numbers: number[];
}

/* -------------------------------------------------------------------------- */
/*   Argument schemas                                                         */
/* -------------------------------------------------------------------------- */

const MetricEnum = z.enum(metricKeys);

const GetScanHistoryArgs = z.object({
  metric: MetricEnum.optional(),
  limit: z.number().int().min(2).max(24).default(6),
});

const GetSubmetricsArgs = z.object({
  // Opaque id, not necessarily UUID-shaped. See CompareBlockSchema.
  scan_id: z.string().min(1).max(64).optional(),
  group: z.enum(["cheekbones", "jawline", "eyes", "skin", "haircut"]).optional(),
});

const GetRoutineAdherenceArgs = z.object({
  days: z.number().int().min(7).max(90).default(14),
});

const GetProfileArgs = z.object({});

const EmitMetricCardArgs = z.object({
  metric: MetricEnum,
  note: z.string().min(1).max(200),
});

const EmitChartArgs = z.object({
  metrics: z.array(MetricEnum).min(1).max(4),
  chart: z.enum(["line", "radar", "bar"]).default("line"),
  limit: z.number().int().min(2).max(24).default(6),
  caption: z.string().max(160).optional(),
});

const EmitChipsArgs = z.object({
  items: z.array(z.string().min(1).max(48)).min(1).max(3),
});

/* -------------------------------------------------------------------------- */
/*   Tool definitions sent to the model                                       */
/* -------------------------------------------------------------------------- */

/**
 * Descriptions are prompt text, not documentation — they are the whole basis on
 * which the model picks a tool. Each says when to reach for it, not only what
 * it returns.
 */
export const COACH_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "get_scan_history",
      description:
        "Read the user's past face scans with their metric scores, oldest first. " +
        "Use this before discussing progress, trends, or any change over time. " +
        "Returns an empty list if they have never scanned.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: [...metricKeys],
            description: "Narrow the answer to one metric. Omit for all seven.",
          },
          limit: {
            type: "integer",
            minimum: 2,
            maximum: 24,
            description: "How many recent scans to read. Defaults to 6.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_submetrics",
      description:
        "Read the detailed breakdown behind a scan: cheekbone width, maxilla, bone " +
        "structure, face fat, fWHR, jaw development, gonial angle, projection, ramus, " +
        "canthal tilt, eye type, brow volume, eye symmetry, skin colour and quality, " +
        "hair density, styling and facial hair. Use this whenever the user asks why a " +
        "top-level score is what it is. Returns an empty list if the deeper analysis " +
        "has not run for that scan yet.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "string",
            description: "A specific scan. Omit for the most recent one.",
          },
          group: {
            type: "string",
            enum: ["cheekbones", "jawline", "eyes", "skin", "haircut"],
            description: "Narrow to one group. Omit for everything.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_routine_adherence",
      description:
        "Check whether the user has actually been doing their daily routine: days " +
        "completed, current streak, and days since they last finished one. Use this " +
        "before explaining why a score has not moved, and before suggesting they add " +
        "more work. Someone who has done 3 of the last 14 days does not need a bigger " +
        "routine.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "integer",
            minimum: 7,
            maximum: 90,
            description: "Size of the window in days. Defaults to 14.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description:
        "Read who the user is: age, gender, ethnicity, how many scans they have, and " +
        "the facts Coach has remembered about them from earlier conversations. Use " +
        "this when advice depends on their situation rather than their scores.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_metric_card",
      description:
        "Show one metric as a card with its current score and its change since the " +
        "last scan. You write the one-line note only — the score and the change are " +
        "filled in from the user's real scans. Never state a score in your own text; " +
        "show it with this instead.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: [...metricKeys] },
          note: {
            type: "string",
            maxLength: 200,
            description: "One line on what this score means for them right now.",
          },
        },
        required: ["metric", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_chart",
      description:
        "Plot one or more metrics over the user's scan history. You choose the metrics " +
        "and write the caption — every data point comes from their real scans. Use this " +
        "for any question about progress or trend. Needs at least two scans; if they " +
        "have fewer, the chart is skipped and you should say so plainly.",
      parameters: {
        type: "object",
        properties: {
          metrics: {
            type: "array",
            items: { type: "string", enum: [...metricKeys] },
            minItems: 1,
            maxItems: 4,
          },
          chart: { type: "string", enum: ["line", "radar", "bar"] },
          limit: {
            type: "integer",
            minimum: 2,
            maximum: 24,
            description: "How many recent scans to plot. Defaults to 6.",
          },
          caption: { type: "string", maxLength: 160 },
        },
        required: ["metrics"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "emit_chips",
      description:
        "Offer up to three tappable follow-up questions, written in the user's voice " +
        "(\"Why is my jawline flat?\"). End every reply with this unless you ended with " +
        "a chart or a card. Never leave the user with nothing to tap.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string", maxLength: 48 },
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  },
];

export const COACH_TOOL_NAMES = COACH_TOOL_DEFINITIONS.map(
  (tool) => tool.function.name
);

/* -------------------------------------------------------------------------- */
/*   Execution                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Collect every finite number in a tool result.
 *
 * The guard needs to know which figures the model was actually shown. Walking
 * the payload is more robust than listing them at each call site, because a
 * field added to a lookup later is covered without anyone remembering to.
 */
function collectNumbers(value: unknown, into: number[] = []): number[] {
  if (typeof value === "number") {
    if (Number.isFinite(value)) into.push(value);
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNumbers(item, into);
  }
  return into;
}

function parseArgs<T extends z.ZodTypeAny>(
  schema: T,
  raw: string
): z.infer<T> {
  let parsed: unknown;
  try {
    parsed = raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    throw new ToolArgumentError("arguments were not valid JSON");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ToolArgumentError(result.error.issues[0]?.message ?? "invalid arguments");
  }
  return result.data;
}

/** Bad arguments from the model. Reported back to it so it can retry. */
export class ToolArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolArgumentError";
  }
}

/**
 * Run one tool call.
 *
 * Failures are returned as `{ error }` payloads rather than thrown, so a broken
 * lookup costs the model one wasted call instead of collapsing the whole turn.
 * The user is far better served by a reply that admits one number is missing
 * than by an error screen.
 */
export async function executeCoachTool(
  userId: string,
  name: string,
  rawArguments: string
): Promise<ToolExecution> {
  try {
    switch (name) {
      case "get_scan_history": {
        const args = parseArgs(GetScanHistoryArgs, rawArguments);
        const history = await getScanHistory(userId, args.limit);

        const payload = args.metric
          ? history.map((entry) => ({
              scanId: entry.scanId,
              date: entry.date,
              score: entry.scores[args.metric as MetricKey] ?? null,
            }))
          : history;

        return { name, payload, numbers: collectNumbers(payload) };
      }

      case "get_submetrics": {
        const args = parseArgs(GetSubmetricsArgs, rawArguments);
        const all = await getSubmetrics(userId, args.scan_id);
        const payload = args.group
          ? all.filter((entry) => entry.group === args.group)
          : all;

        return { name, payload, numbers: collectNumbers(payload) };
      }

      case "get_routine_adherence": {
        const args = parseArgs(GetRoutineAdherenceArgs, rawArguments);
        const payload = await getRoutineAdherence(userId, args.days);
        return { name, payload, numbers: collectNumbers(payload) };
      }

      case "get_profile": {
        parseArgs(GetProfileArgs, rawArguments);
        const payload = await getProfile(userId);
        return { name, payload, numbers: collectNumbers(payload) };
      }

      case "emit_metric_card": {
        const args = parseArgs(EmitMetricCardArgs, rawArguments);
        const block = await buildMetricCard(userId, args.metric, args.note);

        if (!block) {
          return {
            name,
            payload: {
              rendered: false,
              reason: `No score recorded for ${args.metric}. Say so plainly instead.`,
            },
            numbers: [],
          };
        }

        return {
          name,
          payload: { rendered: true, score: block.score, delta: block.delta ?? null },
          block,
          numbers: collectNumbers([block.score, block.delta]),
        };
      }

      case "emit_chart": {
        const args = parseArgs(EmitChartArgs, rawArguments);
        const block = await buildChart(userId, {
          metrics: args.metrics,
          chart: args.chart,
          limit: args.limit,
          caption: args.caption,
        });

        if (!block) {
          return {
            name,
            payload: {
              rendered: false,
              reason:
                "Not enough scans to plot a trend — at least two are needed. Tell the " +
                "user that directly rather than describing a chart.",
            },
            numbers: [],
          };
        }

        return {
          name,
          payload: { rendered: true, points: block.series[0]?.points.length ?? 0 },
          block,
          numbers: collectNumbers(block.series),
        };
      }

      case "emit_chips": {
        const args = parseArgs(EmitChipsArgs, rawArguments);
        return {
          name,
          payload: { rendered: true },
          block: { type: "chips", items: args.items },
          numbers: [],
        };
      }

      default:
        return {
          name,
          payload: { error: `Unknown tool "${name}".` },
          numbers: [],
        };
    }
  } catch (err) {
    if (err instanceof ToolArgumentError) {
      return { name, payload: { error: err.message }, numbers: [] };
    }

    console.error(`[coach] tool ${name} failed for user ${userId}`, err);
    return {
      name,
      payload: {
        error: "That lookup failed. Answer without it and do not guess the numbers.",
      },
      numbers: [],
    };
  }
}
