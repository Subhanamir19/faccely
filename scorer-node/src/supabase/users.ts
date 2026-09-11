import { supabase } from "./client.js";

export interface UserUpsertInput {
  id: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  ethnicity?: string | null;
  onboardingCompleted?: boolean;
  deviceId?: string | null;
}

export async function upsertUserProfile(input: UserUpsertInput): Promise<void> {
  const row: Record<string, unknown> = { id: input.id };

  if (input.email !== undefined) {
    row.email = input.email;
  }
  if (input.age !== undefined) {
    row.age = input.age;
  }
  if (input.gender !== undefined) {
    row.gender = input.gender;
  }
  if (input.ethnicity !== undefined) {
    row.ethnicity = input.ethnicity;
  }
  if (input.onboardingCompleted !== undefined) {
    row.onboarding_completed = input.onboardingCompleted;
  }
  if (input.deviceId !== undefined) {
    row.device_id = input.deviceId;
  }

  const { error } = await supabase.from("users").upsert(row);
  if (error) {
    throw new Error(`Failed to upsert user profile: ${error.message}`);
  }
}

export interface UserProfileRecord {
  id: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  ethnicity: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
}

/**
 * Read a user's profile row, or null when it has not been created yet.
 *
 * Callers treat a missing row as "not onboarded" rather than an error: the row
 * is written by `upsertUserProfile` during onboarding, so an account can exist
 * without one.
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfileRecord | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, age, gender, ethnicity, onboarding_completed, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user profile for ${userId}: ${error.message}`);
  }

  return (data as UserProfileRecord | null) ?? null;
}

export async function deleteUserWithCascade(
  userId: string
): Promise<"deleted" | "not_found"> {
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .select("id");

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }

  if (Array.isArray(data) && data.length > 0) {
    return "deleted";
  }

  return "not_found";
}
