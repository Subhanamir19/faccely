import { supabase } from "./client.js";

/**
 * Store a device's Expo push token for a user. The token is the primary key,
 * so a device that switches accounts moves its token instead of notifying both.
 */
export async function upsertPushToken(input: {
  userId: string;
  token: string;
  platform: string | null;
}): Promise<void> {
  const { error } = await supabase.from("push_tokens").upsert({
    token: input.token,
    user_id: input.userId,
    platform: input.platform,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Failed to upsert push token: ${error.message}`);
  }
}

export async function getPushTokensForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to read push tokens: ${error.message}`);
  }
  return (data ?? []).map((row) => row.token as string);
}

export async function deletePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const { error } = await supabase.from("push_tokens").delete().in("token", tokens);
  if (error) {
    throw new Error(`Failed to delete push tokens: ${error.message}`);
  }
}
