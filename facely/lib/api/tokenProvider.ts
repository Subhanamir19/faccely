// facely/lib/api/tokenProvider.ts
// Single source of truth for obtaining a fresh Supabase access token for backend API calls.

import { supabase } from "@/lib/supabase/client";

function isValidJwt(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return trimmed.length > 0 && trimmed.split(".").length === 3;
}

/**
 * @deprecated Clerk-only legacy hook. No longer needed with Supabase sessions.
 */
export function registerTokenProvider(_getToken: unknown): void {
  void _getToken;
}

/**
 * Get a fresh Supabase JWT access token.
 * This should be called before each API request to avoid expired tokens.
 */
export async function getFreshToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Failed to read Supabase session: ${error.message}`);
  }

  const token = data.session?.access_token;
  if (!isValidJwt(token)) {
    throw new Error("No valid Supabase access token available; user is not authenticated.");
  }

  return token.trim();
}

/**
 * Best-effort hint for callers. The authoritative check is `getFreshToken()`.
 */
export function hasTokenProvider(): boolean {
  return true;
}
