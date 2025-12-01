import { getAuthState } from "@/store/auth";

type Options = {
  includeLegacy?: boolean;
};

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
