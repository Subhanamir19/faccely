import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.OPENAI_API_KEY ??= "sk-test";

// Pinned so the expectations below do not move when a default is retuned.
process.env.COACH_WEEKLY_MESSAGE_CAP = "20";
process.env.COACH_WEEKLY_TOKEN_BUDGET = "80000";
process.env.COACH_DAILY_MESSAGE_CAP = "8";
process.env.COACH_WEEKLY_IMAGE_CAP = "2";

const { guardNumbers, isEmptyAfterGuard } = await import(
  "../src/services/coachNumberGuard.js"
);
const { evaluateQuota, currentPeriodStart, periodResetsAt } = await import(
  "../src/supabase/coachUsage.js"
);

import type { CoachBlock } from "../src/schemas/CoachSchema.js";
import type { CoachUsageRecord } from "../src/supabase/coachUsage.js";

/* ========================================================================== */
/*   Number guard                                                             */
/* ========================================================================== */

const text = (md: string): CoachBlock => ({ type: "text", md });

test("number guard keeps a score the tools actually returned", () => {
  const { blocks, stripped } = guardNumbers(
    [text("Your jawline is 62, which is your strongest metric.")],
    [62, 58, 71]
  );

  assert.equal(stripped.length, 0);
  assert.equal(blocks.length, 1);
});

test("number guard removes a score the tools never returned", () => {
  const { blocks, stripped } = guardNumbers(
    [text("Your jawline is 81 right now. Keep the routine going.")],
    [62, 58]
  );

  assert.equal(stripped.length, 1);
  assert.match(stripped[0], /81/);
  assert.equal(blocks.length, 1);
  assert.equal((blocks[0] as { md: string }).md, "Keep the routine going.");
});

test("number guard tolerates rounding of a stored score", () => {
  const { stripped } = guardNumbers([text("Cheekbones sit at 62.")], [61.6]);
  assert.equal(stripped.length, 0);
});

test("number guard leaves coaching numbers alone", () => {
  const { blocks, stripped } = guardNumbers(
    [text("Do 3 sets of 10 chin tucks daily and aim for 8 hours of sleep.")],
    []
  );

  assert.equal(stripped.length, 0);
  assert.equal(blocks.length, 1);
});

test("number guard leaves reps alone even beside a metric name", () => {
  const { stripped } = guardNumbers(
    [text("Do 10 reps of the jawline exercise, 3 sets a day.")],
    []
  );

  assert.equal(stripped.length, 0);
});

test("number guard catches a hedged invented score", () => {
  const { stripped } = guardNumbers([text("You are sitting at about 78 overall.")], [62]);
  assert.equal(stripped.length, 1);
});

test("number guard catches an invented movement", () => {
  const { stripped } = guardNumbers(
    [text("Symmetry is up 12% since your first scan.")],
    [64, 66]
  );

  assert.equal(stripped.length, 1);
});

test("number guard keeps a movement that matches a real delta", () => {
  const { stripped } = guardNumbers([text("Symmetry is up 4 since August.")], [4, 64, 68]);
  assert.equal(stripped.length, 0);
});

test("number guard replaces a contradicting metric card note", () => {
  const card: CoachBlock = {
    type: "metric_card",
    metric: "jawline",
    score: 62,
    delta: -3,
    note: "Holding steady around 78.",
  };

  const { blocks, stripped } = guardNumbers([card], [62, 3]);

  assert.equal(stripped.length, 1);
  assert.equal((blocks[0] as { note: string }).note, "See the score above.");
});

test("number guard keeps a card note that quotes its own score", () => {
  const card: CoachBlock = {
    type: "metric_card",
    metric: "jawline",
    score: 62,
    note: "At 62 this is your strongest area.",
  };

  const { stripped } = guardNumbers([card], []);
  assert.equal(stripped.length, 0);
});

test("isEmptyAfterGuard reports a reply left with nothing to say", () => {
  assert.equal(isEmptyAfterGuard([{ type: "chips", items: ["Why?"] }]), true);
  assert.equal(isEmptyAfterGuard([text("Here is the trend.")]), false);
});

/* ========================================================================== */
/*   Quota                                                                    */
/* ========================================================================== */

const MONDAY = new Date("2026-09-07T10:00:00Z"); // a Monday
const WEDNESDAY = new Date("2026-09-09T10:00:00Z");

function usage(overrides: Partial<CoachUsageRecord> = {}): CoachUsageRecord {
  return {
    user_id: "user-1",
    period_start: "2026-09-07",
    tokens_in: 0,
    tokens_out: 0,
    messages_count: 0,
    images_count: 0,
    cost_usd: 0,
    day_counts: {},
    updated_at: MONDAY.toISOString(),
    ...overrides,
  };
}

test("week starts on Monday UTC", () => {
  assert.equal(currentPeriodStart(MONDAY), "2026-09-07");
  assert.equal(currentPeriodStart(WEDNESDAY), "2026-09-07");
  assert.equal(currentPeriodStart(new Date("2026-09-13T23:59:00Z")), "2026-09-07");
  assert.equal(currentPeriodStart(new Date("2026-09-14T00:00:00Z")), "2026-09-14");
});

test("week resets the following Monday", () => {
  assert.equal(periodResetsAt("2026-09-07"), "2026-09-14T00:00:00.000Z");
});

test("a fresh week offers the full allowance", () => {
  const quota = evaluateQuota(null, WEDNESDAY);

  assert.equal(quota.allowed, true);
  assert.equal(quota.messagesLeft, 8); // capped by the daily limit, not the weekly one
  assert.equal(quota.imagesLeft, 2);
  assert.equal(quota.tokensLeft, 80_000);
});

test("short messages stretch further than long ones", () => {
  const frugal = evaluateQuota(
    usage({ messages_count: 5, tokens_in: 5_000, tokens_out: 1_000, day_counts: {} }),
    WEDNESDAY
  );
  const verbose = evaluateQuota(
    usage({ messages_count: 5, tokens_in: 40_000, tokens_out: 3_000, day_counts: {} }),
    WEDNESDAY
  );

  // Both have sent 5 messages; the verbose user has far less week left.
  assert.ok(frugal.tokensLeft > verbose.tokensLeft);
  assert.ok(frugal.messagesLeft > verbose.messagesLeft);
});

test("the weekly message cap stops the week", () => {
  const quota = evaluateQuota(usage({ messages_count: 20, tokens_in: 100 }), WEDNESDAY);

  assert.equal(quota.allowed, false);
  assert.equal(quota.reason, "weekly_messages");
  assert.equal(quota.messagesLeft, 0);
});

test("the token budget stops the week even under the message cap", () => {
  const quota = evaluateQuota(
    usage({ messages_count: 6, tokens_in: 78_000, tokens_out: 1_900 }),
    WEDNESDAY
  );

  assert.equal(quota.allowed, false);
  assert.equal(quota.reason, "weekly_tokens");
});

test("the daily limit stops a burst without ending the week", () => {
  const quota = evaluateQuota(
    usage({
      messages_count: 8,
      tokens_in: 8_000,
      tokens_out: 1_000,
      day_counts: { "2026-09-09": 8 },
    }),
    WEDNESDAY
  );

  assert.equal(quota.allowed, false);
  assert.equal(quota.reason, "daily_messages");
  assert.ok(quota.tokensLeft > 0);
});

test("the daily limit clears the next day", () => {
  const spent = usage({
    messages_count: 8,
    tokens_in: 8_000,
    tokens_out: 1_000,
    day_counts: { "2026-09-09": 8 },
  });

  const nextDay = evaluateQuota(spent, new Date("2026-09-10T09:00:00Z"));

  assert.equal(nextDay.allowed, true);
  assert.ok(nextDay.messagesLeft > 0);
});
