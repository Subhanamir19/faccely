import { API_BASE } from "@/lib/api/config";
import { fetchWithRetry } from "@/lib/api/client";
import { getAuthState } from "@/store/auth";
import { buildAuthHeadersAsync } from "./authHeaders";

export async function syncUserProfile(onboardingCompleted?: boolean): Promise<void> {
  const { uid, deviceId } = getAuthState();
  if (!uid) return;

  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...authHeaders,
  };

  const body: Record<string, unknown> = {};
  if (typeof onboardingCompleted === "boolean") {
    body.onboardingCompleted = onboardingCompleted;
  }

  try {
    await fetchWithRetry(`${API_BASE}/users/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return;
  }
}
