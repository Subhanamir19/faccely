import { supabase } from "./client";
import { getLocalDateString } from "@/lib/time/nextMidnight";

export async function getLastScanTime(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from("scans")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return new Date(data.created_at);
}

export function canScanNow(lastScanTime: Date | null): { allowed: boolean } {
  if (!lastScanTime) return { allowed: true };
  return { allowed: getLocalDateString(lastScanTime) !== getLocalDateString() };
}
