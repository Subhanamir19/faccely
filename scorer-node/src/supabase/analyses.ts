import { supabase } from "./client.js";

export interface CreateAnalysisInput {
  scanId: string;
  explanations: Record<string, unknown>;
}

export interface AnalysisRecord {
  id: string;
  scan_id: string;
  created_at: string;
  explanations: Record<string, unknown>;
}

export async function createAnalysis(
  input: CreateAnalysisInput
): Promise<AnalysisRecord> {
  const row = {
    scan_id: input.scanId,
    explanations: input.explanations,
  };

  const { data, error } = await supabase
    .from("analyses")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create analysis: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to create analysis: no data returned.");
  }

  return data as AnalysisRecord;
}

export async function getAnalysisForScan(
  scanId: string
): Promise<AnalysisRecord | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch analysis for scan ${scanId}: ${error.message}`);
  }

  return (data as AnalysisRecord | null) ?? null;
}

export async function getAnalysisForScanBatch(
  scanIds: string[]
): Promise<Map<string, AnalysisRecord>> {
  if (scanIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .in("scan_id", scanIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch analyses for scans: ${error.message}`);
  }

  // Keep only the latest analysis per scan_id
  const map = new Map<string, AnalysisRecord>();
  for (const row of (data ?? []) as AnalysisRecord[]) {
    if (!map.has(row.scan_id)) {
      map.set(row.scan_id, row);
    }
  }
  return map;
}
