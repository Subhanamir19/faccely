import { supabase } from "./client.js";

import { COACH } from "../config/index.js";

/* ============================================================================
 * Coach quota accounting.
 *
 * The subscription is roughly $4/week, and the target is to keep model spend
 * under 15% of that. Two limits run at once:
 *
 *   - a message count, so the allowance is legible ("12 messages left")
 *   - a token budget, so someone writing essays cannot cost 10x someone asking
 *     short questions for the same number of messages
 *
 * Whichever runs out first stops the week. That is what produces the intended
 * "12-20 messages depending on how long they are" behaviour without asking the
 * user to think about tokens.
 *
 * A daily sub-limit sits on top so a week cannot be spent in one sitting —
 * partly a cost smoother, mostly a nudge toward Coach being a daily habit.
 *
 * Schema lives in supabase/coach/001_coach_tables.sql, and the atomic increment
 * in supabase/coach/002_coach_usage_rpc.sql.
 * ========================================================================== */

export interface CoachUsageRecord {
  user_id: string;
  /** Monday 00:00 UTC of the week this row covers, as YYYY-MM-DD. */
  period_start: string;
  tokens_in: number;
  tokens_out: number;
  messages_count: number;
  images_count: number;
  cost_usd: number;
  /** Messages sent per day this week, keyed YYYY-MM-DD. */
  day_counts: Record<string, number>;
  updated_at: string;
}

export interface CoachQuotaStatus {
  /** False when any limit is spent; `reason` says which. */
  allowed: boolean;
  reason?: "weekly_messages" | "weekly_tokens" | "daily_messages";
  messagesLeft: number;
  imagesLeft: number;
  tokensLeft: number;
  /** ISO timestamp of the next weekly reset. */
  resetsAt: string;
}

export interface RecordUsageInput {
  userId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  /** Count a message against the quota. False for internal or retried calls. */
  countsAsMessage?: boolean;
  imagesGenerated?: number;
}

const MS_PER_DAY = 86_400_000;

/* -------------------------------------------------------------------------- */
/*   Period maths                                                             */
/* -------------------------------------------------------------------------- */

/** YYYY-MM-DD in UTC, matching the `date` shape used elsewhere in the repo. */
function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Monday 00:00 UTC of the week containing `now`.
 *
 * A fixed weekly boundary rather than a rolling 7-day window: the user can be
 * told "resets Monday", and the quota cannot be gamed by spreading messages to
 * keep a rolling window permanently half-open.
 */
export function currentPeriodStart(now: Date = new Date()): string {
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  // getUTCDay(): 0 = Sunday. Shift so Monday is 0.
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return toDateString(new Date(utcMidnight - daysSinceMonday * MS_PER_DAY));
}

/** Start of the week after the one `periodStart` belongs to. */
export function periodResetsAt(periodStart: string): string {
  return new Date(Date.parse(`${periodStart}T00:00:00Z`) + 7 * MS_PER_DAY).toISOString();
}

/* -------------------------------------------------------------------------- */
/*   Reads                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * This week's usage row, or null when the user has not talked to Coach yet.
 *
 * A missing row is the normal state at the start of every week, not an error:
 * rows are created lazily by the first `recordUsage` call.
 */
export async function getUsage(
  userId: string,
  periodStart: string = currentPeriodStart()
): Promise<CoachUsageRecord | null> {
  const { data, error } = await supabase
    .from("coach_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch coach usage for user ${userId}: ${error.message}`);
  }

  return (data as CoachUsageRecord | null) ?? null;
}

/**
 * Convert a usage row into what the user is allowed to do right now.
 *
 * Pure, and exported, so quota rules can be tested without a database.
 */
export function evaluateQuota(
  usage: CoachUsageRecord | null,
  now: Date = new Date()
): CoachQuotaStatus {
  const periodStart = usage?.period_start ?? currentPeriodStart(now);
  const resetsAt = periodResetsAt(periodStart);

  const tokensUsed = (usage?.tokens_in ?? 0) + (usage?.tokens_out ?? 0);
  const messagesUsed = usage?.messages_count ?? 0;
  const imagesUsed = usage?.images_count ?? 0;
  const usedToday = usage?.day_counts?.[toDateString(now)] ?? 0;

  const tokensLeft = Math.max(0, COACH.weeklyTokenBudget - tokensUsed);
  const imagesLeft = Math.max(0, COACH.weeklyImageCap - imagesUsed);
  const dailyLeft = Math.max(0, COACH.dailyMessageCap - usedToday);

  // How many more messages the remaining token budget can pay for, using the
  // running average cost of this user's own messages. Someone who writes long
  // prompts sees the allowance shrink honestly instead of hitting a wall at 20.
  const averageTokensPerMessage =
    messagesUsed > 0
      ? Math.max(COACH.minTokensPerMessage, Math.round(tokensUsed / messagesUsed))
      : COACH.estimatedTokensPerMessage;

  const messagesLeft = Math.min(
    Math.max(0, COACH.weeklyMessageCap - messagesUsed),
    Math.floor(tokensLeft / averageTokensPerMessage),
    dailyLeft
  );

  let reason: CoachQuotaStatus["reason"];
  if (messagesUsed >= COACH.weeklyMessageCap) {
    reason = "weekly_messages";
  } else if (tokensLeft < averageTokensPerMessage) {
    reason = "weekly_tokens";
  } else if (dailyLeft <= 0) {
    reason = "daily_messages";
  }

  return {
    allowed: messagesLeft > 0,
    reason,
    messagesLeft,
    imagesLeft,
    tokensLeft,
    resetsAt,
  };
}

/** Quota status for a user, read straight from the database. */
export async function checkQuota(
  userId: string,
  now: Date = new Date()
): Promise<CoachQuotaStatus> {
  const usage = await getUsage(userId, currentPeriodStart(now));
  return evaluateQuota(usage, now);
}

/* -------------------------------------------------------------------------- */
/*   Writes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Add one turn's cost to this week's row and return the updated quota.
 *
 * Delegates to the `coach_record_usage` Postgres function so the increment is
 * atomic. Read-modify-write from Node would silently lose counts whenever two
 * requests for the same user overlap — which is exactly what happens when
 * someone double-taps send, and exactly the case a quota must not miscount.
 *
 * Called after the stream closes, with real token counts. A turn that fails
 * upstream is not charged.
 */
export async function recordUsage(
  input: RecordUsageInput,
  now: Date = new Date()
): Promise<CoachQuotaStatus> {
  const { data, error } = await supabase.rpc("coach_record_usage", {
    p_user_id: input.userId,
    p_period_start: currentPeriodStart(now),
    p_day: toDateString(now),
    p_tokens_in: Math.max(0, Math.round(input.tokensIn)),
    p_tokens_out: Math.max(0, Math.round(input.tokensOut)),
    p_cost_usd: Math.max(0, input.costUsd),
    p_messages: input.countsAsMessage === false ? 0 : 1,
    p_images: Math.max(0, input.imagesGenerated ?? 0),
  });

  if (error) {
    throw new Error(`Failed to record coach usage for user ${input.userId}: ${error.message}`);
  }

  const updated = (Array.isArray(data) ? data[0] : data) as CoachUsageRecord | null;
  return evaluateQuota(updated ?? null, now);
}
