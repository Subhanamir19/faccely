import { supabase } from "./client.js";
import type { InsightContent } from "../validators.js";

export interface InsightRecord {
  id: string;
  user_id: string;
  latest_scan_id: string;
  created_at: string;
  content: InsightContent;
}

export async function upsertInsight(
  userId: string,
  latestScanId: string,
  content: InsightContent
): Promise<InsightRecord> {
  const row = {
    user_id: userId,
    latest_scan_id: latestScanId,
    content,
  };

  const { data, error } = await supabase
    .from("insights")
    .upsert(row, { onConflict: "user_id,latest_scan_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert insight: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to upsert insight: no data returned.");
  }

  return data as InsightRecord;
}

export async function getLatestInsightForUser(
  userId: string
): Promise<InsightRecord | null> {
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch insight for user ${userId}: ${error.message}`);
  }

  return (data as InsightRecord | null) ?? null;
}
