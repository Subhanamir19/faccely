// lib/notifications.ts
// Smart notification scheduling — schedules daily reminders based on
// the user's historical task completion time.

import * as Notifications from "expo-notifications";
import { setJSON, getJSON } from "@/lib/storage";
import type { DayRecord } from "@/store/tasks";

const NOTIF_ID_KEY = "sigma_reminder_notif_id";
const DEFAULT_HOUR = 9;
const MIN_HOUR = 7;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scheduling logic
// ---------------------------------------------------------------------------

/**
 * Analyzes past completion timestamps from history and returns the optimal
 * hour to send the next day's reminder (1 hour before median completion time).
 */
export function computeOptimalHour(history: DayRecord[]): number {
  const hours: number[] = history
    .filter((r) => r.completedAt != null)
    .map((r) => new Date(r.completedAt!).getHours());

  if (hours.length < 3) return DEFAULT_HOUR;

  const sorted = [...hours].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return Math.max(MIN_HOUR, median - 1);
}

/**
 * Cancels any existing scheduled reminder, then schedules a new one for
 * tomorrow at the user's optimal completion time.
 */
export async function scheduleSmartReminder(
  history: DayRecord[],
  streak: number
): Promise<void> {
  await cancelReminder();

  const granted = await requestPermissions();
  if (!granted) return;

  const hour = computeOptimalHour(history);

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 1);
  scheduledDate.setHours(hour, 0, 0, 0);

  const body =
    streak > 1
      ? `Don't break your ${streak}-day streak`
      : "Start building your streak today";

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time for your Sigma routine 🔥",
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledDate,
    },
  });

  await setJSON(NOTIF_ID_KEY, id);
}

/**
 * Cancels the currently scheduled reminder (if any).
 */
export async function cancelReminder(): Promise<void> {
  const id = await getJSON<string | null>(NOTIF_ID_KEY, null);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}
