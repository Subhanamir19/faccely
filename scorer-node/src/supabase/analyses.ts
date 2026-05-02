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
  advanced_result: Record<string, unknown> | null;
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

/**
 * Persist the `advanced_result` JSON for a scan.  Most callers reach this
 * after `/analyze/explain` has already created an `analyses` row, in which
 * case we just UPDATE in place.  But the post-paywall onboarding flow goes
 * straight from `/analyze/pair` to `/analyze/advanced-explain` without any
 * basic-explain step, so the row may not exist yet — Postgres UPDATE is a
 * silent no-op on zero rows, which is how the Potential Face worker was
 * picking up jobs only to find `advanced_result` empty.
 *
 * Fix: try UPDATE first; if it matched no rows, INSERT a fresh `analyses`
 * row with the advanced_result and a placeholder `explanations` (the column
 * is NOT NULL).  Basic explain — if it ever runs later — will overwrite the
 * placeholder via its own createAnalysis call.
 */
export async function saveAdvancedResult(
  scanId: string,
  advancedResult: Record<string, unknown>
): Promise<void> {
  const { data: updated, error: updateError } = await supabase
    .from("analyses")
    .update({ advanced_result: advancedResult })
    .eq("scan_id", scanId)
    .select("id");

  if (updateError) {
    throw new Error(
      `Failed to update advanced result for scan ${scanId}: ${updateError.message}`
    );
  }

  if (updated && updated.length > 0) {
    return;
  }

  // No existing analyses row — create one carrying just the advanced_result.
  // `explanations` defaults to an empty object so the NOT NULL constraint is
  // satisfied; downstream consumers already tolerate missing/empty basic
  // explanations (they're optional in the dashboard rendering paths).
  console.log(
    `[saveAdvancedResult] no analyses row for scan ${scanId} — inserting fresh row with empty explanations placeholder.`
  );
  const { error: insertError } = await supabase
    .from("analyses")
    .insert({
      scan_id: scanId,
      explanations: {},
      advanced_result: advancedResult,
    });

  if (insertError) {
    throw new Error(
      `Failed to insert advanced result for scan ${scanId}: ${insertError.message}`
    );
  }
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
