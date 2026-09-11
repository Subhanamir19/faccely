import { supabase } from "./client.js";

import type { CoachBlock, CoachRole } from "../schemas/CoachSchema.js";

/* ============================================================================
 * Coach threads and messages.
 *
 * Sigma, the prototype this replaces, kept threads in a process-local Map, so a
 * deploy erased every conversation and `user_id` was the literal string "anon".
 * Everything here is per-user and durable.
 *
 * Schema lives in supabase/coach/001_coach_tables.sql.
 * ========================================================================== */

export interface CoachThreadRecord {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  archived: boolean;
}

export interface CoachMessageRecord {
  id: string;
  thread_id: string;
  user_id: string;
  role: CoachRole;
  content: string | null;
  blocks: CoachBlock[] | null;
  tools: string[] | null;
  usage: CoachMessageUsage | null;
  screen: string | null;
  created_at: string;
}

export interface CoachMessageUsage {
  model: string;
  tokens_in: number;
  tokens_out: number;
  /** Estimated, from the model's list price at the time of the call. */
  cost_usd: number;
  /** Wall-clock milliseconds from request accepted to stream closed. */
  latency_ms?: number;
  /** Which tier answered: the cheap router model or the full one. */
  tier?: "small" | "large";
}

export interface AppendMessageInput {
  threadId: string;
  userId: string;
  role: CoachRole;
  content?: string | null;
  blocks?: CoachBlock[] | null;
  tools?: string[] | null;
  usage?: CoachMessageUsage | null;
  screen?: string | null;
}

/* -------------------------------------------------------------------------- */
/*   Threads                                                                  */
/* -------------------------------------------------------------------------- */

export async function createThread(
  userId: string,
  title?: string | null
): Promise<CoachThreadRecord> {
  const { data, error } = await supabase
    .from("coach_threads")
    .insert({ user_id: userId, title: title ?? null })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create coach thread for user ${userId}: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to create coach thread: no data returned.");
  }

  return data as CoachThreadRecord;
}

/**
 * The thread the user is still talking in, or null on a first visit.
 *
 * Coach is a single ongoing conversation rather than a list of chats, so the
 * most recently touched non-archived thread is the right one to resume.
 */
export async function getActiveThread(
  userId: string
): Promise<CoachThreadRecord | null> {
  const { data, error } = await supabase
    .from("coach_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch coach thread for user ${userId}: ${error.message}`);
  }

  return (data as CoachThreadRecord | null) ?? null;
}

/**
 * Resume the active thread, or open one. Used on the first message of a
 * session, where the app may not know a thread id yet.
 */
export async function getOrCreateActiveThread(
  userId: string
): Promise<CoachThreadRecord> {
  const existing = await getActiveThread(userId);
  return existing ?? createThread(userId);
}

/**
 * Fetch a thread, scoped to its owner.
 *
 * The `user_id` filter is the authorisation check, not a convenience: without
 * it a caller who guessed a thread id would read someone else's conversation.
 * Every read and write in this module is scoped the same way.
 */
export async function getThreadForUser(
  userId: string,
  threadId: string
): Promise<CoachThreadRecord | null> {
  const { data, error } = await supabase
    .from("coach_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch coach thread ${threadId} for user ${userId}: ${error.message}`
    );
  }

  return (data as CoachThreadRecord | null) ?? null;
}

/**
 * Mark the thread read up to now.
 *
 * Proactive messages (phase 4) badge the floating button as unread; this is
 * what clears it.
 */
export async function markThreadSeen(
  userId: string,
  threadId: string
): Promise<void> {
  const { error } = await supabase
    .from("coach_threads")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", threadId);

  if (error) {
    throw new Error(`Failed to mark coach thread ${threadId} seen: ${error.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/*   Messages                                                                 */
/* -------------------------------------------------------------------------- */

export async function appendMessage(
  input: AppendMessageInput
): Promise<CoachMessageRecord> {
  const row = {
    thread_id: input.threadId,
    user_id: input.userId,
    role: input.role,
    content: input.content ?? null,
    blocks: input.blocks ?? null,
    tools: input.tools ?? null,
    usage: input.usage ?? null,
    screen: input.screen ?? null,
  };

  const { data, error } = await supabase
    .from("coach_messages")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to append coach message to thread ${input.threadId}: ${error.message}`
    );
  }
  if (!data) {
    throw new Error("Failed to append coach message: no data returned.");
  }

  return data as CoachMessageRecord;
}

/**
 * The last `limit` messages, oldest first.
 *
 * Oldest-first is what both callers want — the app renders top to bottom, and
 * the prompt builder replays turns in order — so the reversal happens once,
 * here, instead of at every call site.
 *
 * Only the recent tail is ever sent to the model. An unbounded thread would
 * make every turn progressively more expensive for no gain in answer quality.
 */
export async function getRecentMessages(
  userId: string,
  threadId: string,
  limit = 8
): Promise<CoachMessageRecord[]> {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to fetch coach messages for thread ${threadId}: ${error.message}`
    );
  }

  return ((data ?? []) as CoachMessageRecord[]).reverse();
}

/**
 * One page of history for the app's message list, newest first.
 *
 * Paged on `created_at` rather than an offset so that messages arriving while
 * the user scrolls cannot shift the window and duplicate a row.
 */
export async function getMessagePage(
  userId: string,
  threadId: string,
  options: { before?: string; limit?: number } = {}
): Promise<CoachMessageRecord[]> {
  const limit = options.limit ?? 20;

  let query = supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Failed to page coach messages for thread ${threadId}: ${error.message}`
    );
  }

  return (data ?? []) as CoachMessageRecord[];
}
