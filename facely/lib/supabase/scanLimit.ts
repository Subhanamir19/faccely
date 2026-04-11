import { supabase } from "./client";
import { getLocalDateString, getStartOfWeek } from "@/lib/time/nextMidnight";

export const WEEKLY_SCAN_LIMIT = 2;

export interface ScanLimitResult {
  allowed: boolean;
  reason?: "daily" | "weekly";
  scansThisWeek: number;
}

/**
 * Fetches all scans since the start of the current calendar week (Monday 00:00).
 * Returns the most recent scan time (for daily check) and the total count (for weekly check)
 * in a single Supabase round-trip.
 */
export async function getWeekScanData(
  userId: string
): Promise<{ lastScanTime: Date | null; weekCount: number }> {
  const weekStart = getStartOfWeek();

  const { data, error } = await supabase
    .from("scans")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return { lastScanTime: null, weekCount: 0 };

  return {
    lastScanTime: new Date(data[0].created_at),
    weekCount: data.length,
  };
}

/**
 * Pure check — no I/O. Weekly limit is checked first so the UI message is accurate.
 * Order matters: if both limits are hit, weekly is the binding constraint.
 */
export function checkScanLimit(
  lastScanTime: Date | null,
  weekCount: number
): ScanLimitResult {
  if (weekCount >= WEEKLY_SCAN_LIMIT) {
    return { allowed: false, reason: "weekly", scansThisWeek: weekCount };
  }

  if (lastScanTime && getLocalDateString(lastScanTime) === getLocalDateString()) {
    return { allowed: false, reason: "daily", scansThisWeek: weekCount };
  }

  return { allowed: true, scansThisWeek: weekCount };
}

// ---------------------------------------------------------------------------
// Legacy shims — kept so any other callers don't break while transitioning.
// Remove once confirmed nothing else references these.
// ---------------------------------------------------------------------------
/** @deprecated Use getWeekScanData + checkScanLimit instead. */
export async function getLastScanTime(userId: string): Promise<Date | null> {
  const { lastScanTime } = await getWeekScanData(userId);
  return lastScanTime;
}

/** @deprecated Use checkScanLimit instead. */
export function canScanNow(lastScanTime: Date | null): { allowed: boolean } {
  return checkScanLimit(lastScanTime, 0);
}
