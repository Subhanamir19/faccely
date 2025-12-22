import { getAuthState } from "@/store/auth";
import { getFreshToken } from "./tokenProvider";

type Options = {
  includeLegacy?: boolean;
};

/**
 * Build auth headers with a FRESH token from Clerk.
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
    const userId = state.uid ?? state.user?.uid ?? undefined;
    const email = state.user?.email ?? undefined;
    const deviceId = state.deviceId ?? undefined;

    if (userId) headers["x-user-id"] = userId;
    if (email) headers["x-email"] = email;
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
    const userId = state.uid ?? state.user?.uid ?? undefined;
    const email = state.user?.email ?? undefined;
    const deviceId = state.deviceId ?? undefined;

    if (userId) headers["x-user-id"] = userId;
    if (email) headers["x-email"] = email;
    if (deviceId) headers["x-device-id"] = deviceId;
  }

  return headers;
}
