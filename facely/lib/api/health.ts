import { API_BASE } from "./config";
import { fetchWithTimeout, toUserFacingError } from "./client";

async function once(timeoutMs: number): Promise<boolean> {
  const res = await fetchWithTimeout(`${API_BASE}/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
    timeoutMs
  });
  return res.ok === true;
}

/** Ping /health with a short retry to survive cold starts. */
export async function pingHealth(timeoutMs = 15000): Promise<boolean> {
  try {
    if (await once(timeoutMs)) return true;
    // brief backoff then one more try
    await new Promise(r => setTimeout(r, 800));
    return await once(timeoutMs);
  } catch (err) {
    const friendly = toUserFacingError(
      err,
      `Health check failed for ${API_BASE}`
    );
    // eslint-disable-next-line no-console
    console.error("[health] ping failed:", friendly.message);
    throw friendly;
  }
}
