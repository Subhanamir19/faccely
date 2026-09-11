import { metricKeys } from "../validators.js";
import type { CoachBlock } from "../schemas/CoachSchema.js";

/* ============================================================================
 * Number guard — the last line of defence against an invented score.
 *
 * Most figures are already impossible to fake: scores, deltas and chart points
 * are filled in by coachData from the database, never by the model. What is
 * left is prose. A model that has just been told jawline is 62 can still write
 * "your jawline is around 70" in the next sentence, and that sentence is the
 * one that destroys trust in the scan pipeline itself.
 *
 * So prose is checked against the figures the model was actually shown.
 *
 * The check is narrow on purpose. Advice is full of legitimate numbers — three
 * sets of ten, eight hours of sleep, twice a day — and stripping those would
 * gut the useful half of an answer. Only score-shaped claims are examined:
 *
 *   - a percentage:                      "up 12%"
 *   - a signed delta:                    "+4 since August"
 *   - a score out of 100:                "62/100", "62 out of 100"
 *   - a number next to a metric or the   "jawline is 62", "symmetry score 71"
 *     word score
 *
 * A flagged sentence is removed rather than rewritten: a half-corrected
 * sentence reads worse than a missing one, and the surrounding blocks — the
 * metric card, the chart — already carry the real figure.
 * ========================================================================== */

export interface NumberGuardResult {
  blocks: CoachBlock[];
  /** Sentences removed, for logging and for the hallucination-rate metric. */
  stripped: string[];
}

/**
 * Rounding tolerance when matching a quoted figure against a known one.
 *
 * Scores are stored rounded, and a model restating "61.6" as "62" is quoting,
 * not inventing. Anything further off is treated as invented.
 */
const MATCH_TOLERANCE = 1;

const METRIC_WORDS = [
  ...metricKeys,
  ...metricKeys.map((key) => key.replace(/_/g, " ")),
  "score",
  "scores",
  "rating",
  "overall",
];

/**
 * Units that mark a number as advice rather than a score.
 *
 * "Do 3 sets", "8 hours of sleep", "twice for 30 seconds" are all legitimate
 * and must survive. Without this, a sentence like "jawline exercises 3 times a
 * day" would be flagged purely because a number sits near a metric name.
 */
const UNIT_WORDS =
  "sets?|reps?|times?|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|" +
  "ml|l|mg|g|kg|lbs?|cm|mm|degrees?|°|litres?|liters?|glasses?|portions?|servings?|x";

/** Words that hedge a figure — the usual shape of an invented score. */
const APPROXIMATION_WORDS =
  "around|about|roughly|approximately|near|nearly|close to|sitting at|sits at|at";

/** Split on sentence enders, keeping the punctuation with its sentence. */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?\n]+[.!?]*\s*/g);
  return parts ?? [text];
}

function isKnown(value: number, known: readonly number[]): boolean {
  return known.some((candidate) => Math.abs(candidate - value) <= MATCH_TOLERANCE);
}

/**
 * Score-shaped figures in a sentence.
 *
 * Returns an empty array for a sentence whose numbers are all clearly advice
 * ("3 sets of 10"), which is the common case and must stay untouched.
 */
function extractScoreClaims(sentence: string): number[] {
  const claims: number[] = [];
  const lower = sentence.toLowerCase();

  /** True when a unit follows the number, marking it as advice, not a score. */
  const followedByUnit = (endIndex: number): boolean =>
    new RegExp(`^\\s*(?:${UNIT_WORDS})\\b`).test(lower.slice(endIndex));

  /** Push a match whose number ends the match, unless a unit follows it. */
  const pushUnlessUnit = (match: RegExpMatchArray): void => {
    const end = (match.index ?? 0) + match[0].length;
    if (followedByUnit(end)) return;
    claims.push(Math.abs(Number(match[1])));
  };

  /** Push a match whose number starts the match, unless a unit follows it. */
  const pushLeadingUnlessUnit = (match: RegExpMatchArray): void => {
    const end = (match.index ?? 0) + match[1].length;
    if (followedByUnit(end)) return;
    claims.push(Math.abs(Number(match[1])));
  };

  // Unambiguous score forms. A unit cannot rescue these, so they are taken as
  // claims regardless of what follows.

  // "12%" — a percentage in a coaching reply is a claimed change.
  for (const match of lower.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
    claims.push(Number(match[1]));
  }

  // "62/100" or "62 out of 100".
  for (const match of lower.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*100\b/g)) {
    claims.push(Number(match[1]));
  }

  // "+4" / "-3" — a signed number is a stated movement between scans.
  for (const match of lower.matchAll(/(?:^|[\s(])([+-]\d+(?:\.\d+)?)/g)) {
    claims.push(Math.abs(Number(match[1])));
  }

  // Contextual forms. These only count when no unit follows.

  // "up 4", "dropped 3".
  for (const match of lower.matchAll(
    /\b(?:up|down|gained|dropped|rose|fell|improved by|declined by)\s+(\d+(?:\.\d+)?)/g
  )) {
    pushUnlessUnit(match);
  }

  // "around 78", "sits at 62" — the usual shape of a hedged invention.
  for (const match of lower.matchAll(
    new RegExp(`\\b(?:${APPROXIMATION_WORDS})\\s+(\\d{1,3}(?:\\.\\d+)?)\\b`, "g")
  )) {
    pushUnlessUnit(match);
  }

  // A number sitting next to a metric name or the word "score", either order,
  // within a few words: "jawline is 62", "score of 71", "62 on cheekbones".
  for (const word of METRIC_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const after = new RegExp(`${escaped}\\b[^.!?]{0,20}?\\b(\\d{1,3}(?:\\.\\d+)?)\\b`, "g");
    const before = new RegExp(`\\b(\\d{1,3}(?:\\.\\d+)?)\\b[^.!?]{0,20}?${escaped}\\b`, "g");

    for (const match of lower.matchAll(after)) pushUnlessUnit(match);
    for (const match of lower.matchAll(before)) pushLeadingUnlessUnit(match);
  }

  // Only 0-100 values can be a score claim; a stray year or rep count is not.
  return claims.filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
}

/**
 * Remove sentences that quote a figure the model was never given.
 *
 * `known` is every number returned by the tools this turn — see
 * `ToolExecution.numbers` in coachTools.ts.
 *
 * Pure and synchronous, so the rules can be tested without a model or a
 * database behind them.
 */
export function guardNumbers(
  blocks: CoachBlock[],
  known: readonly number[]
): NumberGuardResult {
  const stripped: string[] = [];

  const guarded = blocks.map((block): CoachBlock | null => {
    if (block.type === "text") {
      const kept = splitSentences(block.md).filter((sentence) => {
        const claims = extractScoreClaims(sentence);
        const invented = claims.filter((value) => !isKnown(value, known));
        if (invented.length === 0) return true;

        stripped.push(sentence.trim());
        return false;
      });

      const md = kept.join("").trim();
      return md ? { ...block, md } : null;
    }

    // Card notes are model prose too, and sit directly beside the real score,
    // which makes a contradiction there especially damaging.
    if (block.type === "metric_card") {
      const claims = extractScoreClaims(block.note);
      const invented = claims.filter(
        (value) =>
          !isKnown(value, known) &&
          !isKnown(value, [block.score, Math.abs(block.delta ?? NaN)])
      );

      if (invented.length === 0) return block;

      stripped.push(block.note.trim());
      return { ...block, note: "See the score above." };
    }

    return block;
  });

  return {
    blocks: guarded.filter((block): block is CoachBlock => block !== null),
    stripped,
  };
}

/**
 * True when the guard removed everything worth saying.
 *
 * The caller retries once in this case rather than showing a reply made of
 * nothing but a chart and no words.
 */
export function isEmptyAfterGuard(blocks: CoachBlock[]): boolean {
  return !blocks.some(
    (block) =>
      (block.type === "text" && block.md.trim().length > 0) ||
      block.type === "metric_card" ||
      block.type === "chart" ||
      block.type === "compare" ||
      block.type === "table"
  );
}
