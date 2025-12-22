import { supabase } from "./client.js";
import type { Program } from "../schemas/ProgramSchema.js";

export type ProgramRecord = {
  id: string;
  user_id: string;
  created_at: string;
  version: string;
  scores_snapshot: Record<string, unknown>;
  days: Record<string, unknown>[];
  metadata: Record<string, unknown> | null;
};

export type CompletionRecord = {
  id: string;
  program_id: string;
  user_id: string;
  day_number: number;
  exercise_id: string;
  completed: boolean;
  completed_at: string | null;
};

export async function saveProgram(
  userId: string,
  program: Program,
  metadata?: Record<string, unknown>
): Promise<ProgramRecord> {
  const row = {
    id: program.programId,
    user_id: userId,
    version: program.version,
    scores_snapshot: program.scoresSnapshot,
    days: program.days,
    metadata: metadata ?? null,
  };

  const { data, error } = await supabase
    .from("programs")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save program: ${error.message}`);
  }
  return data as ProgramRecord;
}

export async function getLatestProgram(userId: string): Promise<ProgramRecord | null> {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch program: ${error.message}`);
  }
  return (data as ProgramRecord | null) ?? null;
}

export async function getProgramById(
  userId: string,
  programId: string
): Promise<ProgramRecord | null> {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch program ${programId}: ${error.message}`);
  }
  return (data as ProgramRecord | null) ?? null;
}

export async function getCompletions(programId: string): Promise<CompletionRecord[]> {
  const { data, error } = await supabase
    .from("program_completions")
    .select("*")
    .eq("program_id", programId);

  if (error) {
    throw new Error(`Failed to fetch completions: ${error.message}`);
  }
  return (data as CompletionRecord[]) ?? [];
}

export async function upsertCompletion(params: {
  userId: string;
  programId: string;
  dayNumber: number;
  exerciseId: string;
  completed: boolean;
}): Promise<CompletionRecord> {
  const row = {
    program_id: params.programId,
    user_id: params.userId,
    day_number: params.dayNumber,
    exercise_id: params.exerciseId,
    completed: params.completed,
    completed_at: params.completed ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("program_completions")
    .upsert(row, { onConflict: "program_id,day_number,exercise_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update completion: ${error.message}`);
  }
  return data as CompletionRecord;
}
