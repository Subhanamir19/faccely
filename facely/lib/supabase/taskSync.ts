// lib/supabase/taskSync.ts
// Syncs daily task history and streaks to Supabase.
// All writes are fire-and-forget. Failed writes go into an AsyncStorage queue
// and are retried the next time the app opens with network access.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./client";
import type { DayRecord } from "@/store/tasks";

// ---------------------------------------------------------------------------
// Queue types & storage key
// ---------------------------------------------------------------------------

const QUEUE_KEY     = "sigma_sync_queue_v1";
const MIGRATION_KEY = "sigma_history_migrated_v1";

type QueuedHistory = { type: "history"; userId: string; record: DayRecord };
type QueuedStreak  = { type: "streak";  userId: string; currentStreak: number; lastCompletedDate: string | null };
type QueuedWrite   = QueuedHistory | QueuedStreak;

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedWrite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

async function enqueue(item: QueuedWrite): Promise<void> {
  const queue = await readQueue();
  // Replace any existing entry for the same type + user (+ date for history)
  const deduped = queue.filter((q) => {
    if (q.type !== item.type || q.userId !== item.userId) return true;
    if (q.type === "history" && item.type === "history") {
      return q.record.date !== item.record.date;
    }
    return false; // always replace streak entry (one per user)
  });
  await writeQueue([...deduped, item]);
}

// ---------------------------------------------------------------------------
// Mood key → integer (matches DB CHECK constraint: 1=great 2=good 3=tired)
// ---------------------------------------------------------------------------

function moodToInt(mood: string | null): number | null {
  if (mood === "great") return 1;
  if (mood === "good")  return 2;
  if (mood === "tired") return 3;
  return null;
}

// ---------------------------------------------------------------------------
// Core upsert functions (throw on error — callers handle)
// ---------------------------------------------------------------------------

export async function upsertTaskHistory(userId: string, record: DayRecord): Promise<void> {
  const payload = {
    user_id:             userId,
    date:                record.date,
    tasks_completed:     record.tasks.filter((t) => t.status === "completed").map((t) => t.exerciseId),
    protocols_completed: record.protocols.filter((p) => p.status === "done").map((p) => p.id),
    mood:                moodToInt(record.mood),
    all_complete:        record.allComplete,    // true only when ALL exercises + protocols done
    completed_once:      record.completedOnce,  // sticky: were all tasks ever finished today?
  };

  // Explicit select-then-update/insert avoids relying on ON CONFLICT type casting
  // (PostgreSQL date column vs JS string can silently skip conflict detection)
  const { data: existing } = await supabase
    .from("user_task_history")
    .select("id")
    .eq("user_id", userId)
    .eq("date", record.date)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("user_task_history")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_task_history")
      .insert(payload);
    if (error) throw error;
  }
}

export async function upsertStreak(
  userId: string,
  currentStreak: number,
  lastCompletedDate: string | null,
): Promise<void> {
  // Preserve longest_streak: read current value then take the max
  const { data: existing } = await supabase
    .from("user_streaks")
    .select("longest_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const longestStreak = Math.max(existing?.longest_streak ?? 0, currentStreak);

  const { error } = await supabase.from("user_streaks").upsert(
    {
      user_id:             userId,
      current_streak:      currentStreak,
      longest_streak:      longestStreak,
      last_completed_date: lastCompletedDate,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Fire-and-forget helpers — called from the Zustand store actions
// ---------------------------------------------------------------------------

export function syncTaskHistory(userId: string | null, record: DayRecord): void {
  if (!userId) return;
  upsertTaskHistory(userId, record).catch(async () => {
    await enqueue({ type: "history", userId, record });
  });
}

export function syncStreak(
  userId: string | null,
  currentStreak: number,
  lastCompletedDate: string | null,
): void {
  if (!userId) return;
  upsertStreak(userId, currentStreak, lastCompletedDate).catch(async () => {
    await enqueue({ type: "streak", userId, currentStreak, lastCompletedDate });
  });
}

// ---------------------------------------------------------------------------
// Background merge — called on new-day init to reconcile remote streak
// ---------------------------------------------------------------------------

export async function fetchAndMergeStreak(
  userId: string,
  localStreak: number,
  setStreak: (n: number) => void,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("user_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle();

    if (data && data.current_streak > localStreak) {
      setStreak(data.current_streak);
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Flush offline queue — called on app open after auth is ready
// ---------------------------------------------------------------------------

export async function flushSyncQueue(userId: string): Promise<void> {
  const queue = await readQueue();
  if (!queue.length) return;

  const remaining: QueuedWrite[] = [];
  for (const item of queue) {
    if (item.userId !== userId) {
      remaining.push(item); // keep items belonging to other users
      continue;
    }
    try {
      if (item.type === "history") {
        await upsertTaskHistory(item.userId, item.record);
      } else {
        await upsertStreak(item.userId, item.currentStreak, item.lastCompletedDate);
      }
    } catch {
      remaining.push(item); // still failing — retry next time
    }
  }
  await writeQueue(remaining);
}

// ---------------------------------------------------------------------------
// One-time migration: upload existing local history to Supabase
// ---------------------------------------------------------------------------

export async function hasMigratedHistory(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function migrateLocalHistory(
  userId: string,
  history: DayRecord[],
  today: DayRecord | null,
): Promise<void> {
  const allRecords = today ? [today, ...history] : history;
  for (const record of allRecords) {
    try {
      await upsertTaskHistory(userId, record);
    } catch {}
  }
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, "1");
  } catch {}
}
