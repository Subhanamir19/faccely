import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.OPENAI_API_KEY ??= "sk-test";

const { renderCoachContext } = await import("../src/services/coachContext.js");
const { composeCoachMessages, suggestOpeningChips, COACH_SYSTEM_PROMPT } = await import(
  "../src/services/coachPrompt.js"
);

import type { CoachContext } from "../src/services/coachContext.js";
import type { CoachMessageRecord } from "../src/supabase/coachThreads.js";

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    profile: {
      age: 19,
      gender: "male",
      ethnicity: null,
      scanCount: 3,
      firstScanDate: "2026-07-01",
      latestScanDate: "2026-09-01",
      memory: {},
    },
    latestScores: { jawline: 62, cheekbones: 55, skin_quality: 71 },
    latestScanDate: "2026-09-01",
    deltas: { jawline: 4, cheekbones: 0, skin_quality: -2 },
    weakest: ["cheekbones", "jawline"],
    adherence: {
      daysCompleted: 9,
      daysInWindow: 14,
      ratio: 9 / 14,
      currentStreak: 3,
      daysSinceLastCompletion: 0,
    },
    scanCount: 3,
    screen: null,
    ...overrides,
  };
}

/* ========================================================================== */
/*   Context rendering                                                        */
/* ========================================================================== */

test("context carries scores with their movement", () => {
  const rendered = renderCoachContext(context());

  assert.match(rendered, /jawline 62 \(\+4\)/);
  assert.match(rendered, /skin_quality 71 \(-2\)/);
  // A metric that did not move is rendered without a movement suffix.
  assert.match(rendered, /cheekbones 55(?!\s*\()/);
});

test("context states plainly when there are no scans", () => {
  const rendered = renderCoachContext(
    context({ latestScores: null, latestScanDate: null, deltas: null, weakest: [], scanCount: 0 })
  );

  assert.match(rendered, /never scanned/);
  assert.doesNotMatch(rendered, /lowest metrics/);
});

test("context includes routine adherence", () => {
  const rendered = renderCoachContext(context());
  assert.match(rendered, /9\/14 days done/);
  assert.match(rendered, /streak 3/);
});

test("context includes remembered facts when present", () => {
  const withMemory = context();
  withMemory.profile.memory = { braces: "in braces until 2027" };

  const rendered = renderCoachContext(withMemory);
  assert.match(rendered, /braces: in braces until 2027/);
});

test("context names the screen Coach was opened from", () => {
  const rendered = renderCoachContext(context({ screen: "analysis" }));
  assert.match(rendered, /opened from: analysis/);
});

/* ========================================================================== */
/*   Message composition                                                      */
/* ========================================================================== */

function message(
  role: CoachMessageRecord["role"],
  content: string | null
): CoachMessageRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    thread_id: "00000000-0000-0000-0000-000000000002",
    user_id: "user-1",
    role,
    content,
    blocks: null,
    tools: null,
    usage: null,
    screen: null,
    created_at: new Date(0).toISOString(),
  };
}

test("the cacheable system prompt comes first, the new turn last", () => {
  const messages = composeCoachMessages({
    context: context(),
    history: [message("user", "hey"), message("assistant", "Hello.")],
    userText: "why is my jawline low?",
  });

  assert.equal(messages[0].role, "system");
  assert.equal(messages[0].content, COACH_SYSTEM_PROMPT);
  assert.equal(messages[1].role, "system");
  assert.equal(messages.at(-1)?.role, "user");
  assert.equal(messages.at(-1)?.content, "why is my jawline low?");
});

test("empty and system history rows are skipped", () => {
  const messages = composeCoachMessages({
    context: context(),
    history: [message("assistant", null), message("system", "internal"), message("user", "  ")],
    userText: "hello",
  });

  // Two system preambles plus the new turn; nothing from history survives.
  assert.equal(messages.length, 3);
});

/* ========================================================================== */
/*   Opening chips                                                            */
/* ========================================================================== */

test("a user who has never scanned is not asked about scores", () => {
  const chips = suggestOpeningChips(
    context({ latestScores: null, weakest: [], scanCount: 0 })
  );

  assert.ok(chips.length > 0);
  assert.ok(chips.every((chip) => !/low|changed/i.test(chip)));
});

test("chips name the user's own weakest metric", () => {
  const chips = suggestOpeningChips(context());
  assert.ok(chips.some((chip) => chip.includes("cheekbones")));
});

test("a lapsed user is asked about missed days instead of today", () => {
  const lapsed = context();
  lapsed.adherence.daysSinceLastCompletion = 5;

  const chips = suggestOpeningChips(lapsed);
  assert.ok(chips.some((chip) => /missing days/i.test(chip)));
});

test("chips never exceed three", () => {
  assert.ok(suggestOpeningChips(context()).length <= 3);
});
