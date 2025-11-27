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
