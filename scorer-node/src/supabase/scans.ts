import { supabase } from "./client.js";

export interface CreateScanInput {
  userId: string;
  modelVersion: string;
  frontImagePath: string;
  sideImagePath?: string | null;
  scores: Record<string, unknown>;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  created_at: string;
  model_version: string;
  front_image_path: string;
  side_image_path: string | null;
  scores: Record<string, unknown>;
}

export async function createScan(input: CreateScanInput): Promise<ScanRecord> {
  const row = {
    user_id: input.userId,
    model_version: input.modelVersion,
    front_image_path: input.frontImagePath,
    side_image_path: input.sideImagePath ?? null,
    scores: input.scores,
  };

  const { data, error } = await supabase
    .from("scans")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create scan: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to create scan: no data returned.");
  }

  return data as ScanRecord;
}

export async function getScansForUser(
  userId: string,
  limit = 20
): Promise<ScanRecord[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch scans for user ${userId}: ${error.message}`);
  }

  return (data ?? []) as ScanRecord[];
}
