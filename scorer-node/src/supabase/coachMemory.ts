import { supabase } from "./client.js";

import { COACH } from "../config/index.js";

/* ============================================================================
 * Coach memory — durable facts about a user, learned from conversation.
 *
 * Scans say what a face looks like. Memory says what the person is dealing
 * with: "in braces until 2027", "tried mewing for three months", "no budget for
 * products", "wants a sharper jaw for photos". Injecting a handful of those is
 * the difference between month-two answers that feel personal and answers that
 * restate the same generic advice.
 *
 * Deliberately small. Facts are short strings under stable keys, capped per
 * user, and the least recently used one is dropped when the cap is reached. A
 * growing memory would quietly grow the cost of every single turn.
 *
 * Schema lives in supabase/coach/001_coach_tables.sql.
 * ========================================================================== */

export interface CoachMemoryRecord {
  id: string;
  user_id: string;
  /** Stable slug, e.g. "braces" or "budget". One fact per key per user. */
  key: string;
  value: string;
  source: "chat" | "onboarding" | "scan";
  confidence: number;
  created_at: string;
  last_used_at: string;
}

export interface RememberInput {
  userId: string;
  key: string;
  value: string;
  source?: CoachMemoryRecord["source"];
  confidence?: number;
}

/** Trim and slug a key so "Braces " and "braces" cannot become two facts. */
function normaliseKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/**
 * Facts to inject into the prompt, most recently used first.
 *
 * Ordering by `last_used_at` means the facts that keep proving relevant stay in
 * the window, and stale ones drift out on their own.
 */
export async function getMemory(
  userId: string,
  limit: number = COACH.memoryFactCap
): Promise<CoachMemoryRecord[]> {
  const { data, error } = await supabase
    .from("coach_memory")
    .select("*")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch coach memory for user ${userId}: ${error.message}`);
  }

  return (data ?? []) as CoachMemoryRecord[];
}

/**
 * Write a fact, replacing any earlier fact under the same key.
 *
 * Upsert rather than insert because facts change: the user who was "saving for
 * braces" becomes "in braces", and holding both would put a contradiction in
 * the prompt.
 */
export async function remember(input: RememberInput): Promise<CoachMemoryRecord> {
  const key = normaliseKey(input.key);
  if (!key) {
    throw new Error("Failed to store coach memory: key is empty after normalisation.");
  }

  const row = {
    user_id: input.userId,
    key,
    value: input.value.trim().slice(0, 280),
    source: input.source ?? "chat",
    confidence: input.confidence ?? 1.0,
    last_used_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("coach_memory")
    .upsert(row, { onConflict: "user_id,key" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to store coach memory for user ${input.userId}: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to store coach memory: no data returned.");
  }

  await pruneMemory(input.userId);

  return data as CoachMemoryRecord;
}

/** Keep a fact in the window after it has been used in an answer. */
export async function touchMemory(userId: string, keys: string[]): Promise<void> {
  const normalised = keys.map(normaliseKey).filter(Boolean);
  if (normalised.length === 0) return;

  const { error } = await supabase
    .from("coach_memory")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("key", normalised);

  if (error) {
    throw new Error(`Failed to touch coach memory for user ${userId}: ${error.message}`);
  }
}

export async function forget(userId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from("coach_memory")
    .delete()
    .eq("user_id", userId)
    .eq("key", normaliseKey(key));

  if (error) {
    throw new Error(`Failed to delete coach memory for user ${userId}: ${error.message}`);
  }
}

/** Everything Coach knows about a user, wiped. Backs a "forget me" control. */
export async function forgetAll(userId: string): Promise<void> {
  const { error } = await supabase.from("coach_memory").delete().eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clear coach memory for user ${userId}: ${error.message}`);
  }
}

/**
 * Drop the least recently used facts above the per-user cap.
 *
 * Postgres cannot express "delete all but the newest N" in one statement
 * through PostgREST, so this reads the ids to keep and deletes the rest. It
 * runs only after a write, on a table holding at most a couple of dozen rows
 * per user, so the extra round trip is not worth a second RPC.
 */
async function pruneMemory(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("coach_memory")
    .select("id")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false })
    .range(COACH.memoryFactCap, COACH.memoryFactCap + 200);

  if (error) {
    throw new Error(`Failed to prune coach memory for user ${userId}: ${error.message}`);
  }

  const excess = (data ?? []) as Array<{ id: string }>;
  if (excess.length === 0) return;

  const { error: deleteError } = await supabase
    .from("coach_memory")
    .delete()
    .in(
      "id",
      excess.map((row) => row.id)
    );

  if (deleteError) {
    throw new Error(
      `Failed to prune coach memory for user ${userId}: ${deleteError.message}`
    );
  }
}
