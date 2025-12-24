import { getAuthState } from "@/store/auth";
import { getFreshToken } from "./tokenProvider";

type Options = {
  includeLegacy?: boolean;
};

/**
 * Build auth headers with a FRESH Supabase access token.
 * This is async because it fetches a new token for each request,
 * ensuring we never send an expired JWT to the backend.
 */
export async function buildAuthHeadersAsync(options?: Options): Promise<Record<string, string>> {
  const token = await getFreshToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (options?.includeLegacy) {
    const state = getAuthState();
    const deviceId = state.deviceId ?? undefined;

    // Metadata only (never used as identity).
    if (deviceId) headers["x-device-id"] = deviceId;
  }

  return headers;
}

/**
 * @deprecated Use buildAuthHeadersAsync instead for production-grade token handling.
 * This synchronous version uses cached tokens which may be expired.
 */
export function buildAuthHeaders(options?: Options): Record<string, string> {
  const state = getAuthState();
  const idToken = state.idToken;
  if (!idToken || !idToken.trim()) {
    throw new Error("No idToken available in auth store; user is not authenticated.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };

  if (options?.includeLegacy) {
    const deviceId = state.deviceId ?? undefined;

    // Metadata only (never used as identity).
    if (deviceId) headers["x-device-id"] = deviceId;
  }

  return headers;
}
