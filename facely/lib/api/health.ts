// facely/lib/api/health.ts
import { API_BASE } from "./config";
import { fetchWithTimeout } from "./client.js";


/** Ping backend /health and return true/false instead of throwing. */
export async function pingHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`, {
      method: "GET",
      signal,
      timeoutMs: 5_000,
    });
    if (!res.ok) return false;
    // Some backends return plain text, others JSON. Either is fine.
    return true;
  } catch {
    return false;
  }
}
