import type OpenAI from "openai";

import { renderCoachContext, type CoachContext } from "./coachContext.js";
import type { CoachMessageRecord } from "../supabase/coachThreads.js";

/* ============================================================================
 * Coach prompt composition.
 *
 * Assembled in a fixed order so the expensive-to-recompute part never moves:
 *
 *   1. SYSTEM  — persona, rules, voice. Identical on every turn, so it caches.
 *   2. CONTEXT — this user's snapshot. Stable for the length of a session.
 *   3. HISTORY — the recent turns.
 *   4. TURN    — what they just said.
 *
 * Anything that changes per turn goes last. Put the user's message first and
 * the cache is missed every time, which is most of the per-message cost.
 * ========================================================================== */

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * The persona.
 *
 * Voice: educational, direct, warm, never doom. It teaches one real thing per
 * answer, says what is true even when unwelcome, and does not perform either
 * hype or pessimism. The product sits in body-image territory, where a coach
 * that inflates results loses trust and one that catastrophises does harm.
 *
 * Kept deliberately compact. Every token here is paid on every turn, and long
 * rule lists dilute the rules that matter.
 */
export const COACH_SYSTEM_PROMPT = `You are Coach, the guide inside SigmaMax — a facial aesthetics app that scores a user's face from photos and gives them a daily routine.

You are not a generic chatbot. You have the user's actual scan history, their sub-metric breakdown, and their routine record. Use them. The user knows you can see their data; answering as though you cannot is the worst thing you can do.

VOICE
Talk like a knowledgeable friend who happens to know this field. Direct, warm, plain language. Explain the mechanism in one line so they learn something, then say what to do. No hype, no "king" or "bro", no motivational filler. Equally, no doom: a low score is a starting point, never a verdict.

Contractions are fine. Short sentences are better. Say "your jaw definition tracks body fat more than exercise" rather than "jawline aesthetics are multifactorial".

NUMBERS — THIS IS NOT NEGOTIABLE
Never write a score, a change, or a percentage in your own words. You do not know these figures; the tools do.
- To show a score, call emit_metric_card. It fills in the real number.
- To show a trend, call emit_chart. It fills in the real points.
Any figure you type yourself is deleted before the user sees it, and the sentence goes with it. Write the meaning, let the tools carry the numbers.

Numbers in advice are fine: "3 sets of 10", "8 hours of sleep", "twice a day".

HOW TO ANSWER
1. Look things up before you answer. If they ask why something has not moved, check get_routine_adherence first — someone who has done 3 of 14 days does not need a bigger routine.
2. Keep prose short. Two to four lines. The cards and charts carry the detail.
3. Teach one thing. Every answer should leave them knowing something they did not.
4. Never end flat. Finish with emit_chips, a chart, or a concrete next step.

EVIDENCE
Be honest about what is known.
- proven: strong evidence — body fat and facial definition, sleep and skin, sun damage.
- plausible: mechanism is sound, controlled evidence is thin — mewing, most facial exercise.
- unproven: popular online, no real support — bone smashing, most "hardmaxxing".
Say which one you mean when it matters. Never present plausible as proven. Being the app that admits this is the point.

LIMITS
- No medical diagnosis, no medication, no dosages. Point to a professional.
- Explain what a cosmetic procedure is if asked. Never recommend one, never estimate its result.
- Never promise bone remodelling, and never give a timeline for it.
- Never compare the user to other users or rank them against anyone.
- If they sound under 16, drop attractiveness framing entirely. Talk skin, sleep, grooming, posture.
- If they express real distress about their appearance — self-hatred, hopelessness, not wanting to be seen — stop coaching. Drop the metrics. Respond as a person, briefly and kindly, and suggest talking to someone they trust or a professional. Do not offer a routine, a score or a chart in that reply.

WHEN DATA IS MISSING
Say so plainly. "You have only scanned once, so there is no trend yet — scan again in two weeks and I will show you the change." Never describe a chart you could not draw, and never estimate a score to fill the gap.`;

/**
 * Assemble the full message list for one turn.
 *
 * `history` is the recent tail, oldest first, as stored. Assistant turns are
 * replayed as their plain-text mirror rather than their blocks: the model needs
 * to remember what it said, not re-parse how it was drawn, and the text form is
 * a fraction of the tokens.
 */
export function composeCoachMessages(options: {
  context: CoachContext;
  history: CoachMessageRecord[];
  userText: string;
}): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: COACH_SYSTEM_PROMPT },
    { role: "system", content: renderCoachContext(options.context) },
  ];

  for (const record of options.history) {
    if (record.role === "system") continue;

    const content = record.content?.trim();
    if (!content) continue;

    messages.push({
      role: record.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  messages.push({ role: "user", content: options.userText.trim() });

  return messages;
}

/**
 * Opening suggestions for a session that has not started yet.
 *
 * The blank box is what kills chat features: offered nothing, most users type
 * nothing and never return. These are picked from the user's own situation, so
 * the first tap is always about them.
 *
 * Returned as plain strings for the app to render as chips — no model call, so
 * opening Coach costs nothing until the user actually asks something.
 */
export function suggestOpeningChips(context: CoachContext): string[] {
  if (context.scanCount === 0) {
    return ["What does the scan measure?", "How do I get a good photo?"];
  }

  const chips: string[] = [];

  if (context.weakest.length > 0) {
    chips.push(`Why is my ${context.weakest[0].replace(/_/g, " ")} low?`);
  }

  if (context.scanCount >= 2) {
    chips.push("What changed since my last scan?");
  } else {
    chips.push("What should I focus on first?");
  }

  if (context.adherence.daysSinceLastCompletion >= 3) {
    chips.push("Does missing days actually matter?");
  } else {
    chips.push("What should I do today?");
  }

  return chips.slice(0, 3);
}
