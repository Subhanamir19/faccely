import { API_BASE, API_BASE_REASON } from "./config";
import { fetchWithTimeout, toUserFacingError } from "./client";

function healthUrl(): string {
  return `${API_BASE.replace(/\/+$/, "")}/health`;
}

async function once(timeoutMs: number): Promise<{ reachable: boolean; status?: number; detail?: string }> {
  const url = healthUrl();
  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs,
    });

    // Try to read `{ ok: true }`, but don't explode if it isn't JSON.
    let okFlag: boolean | undefined;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await res.json().catch(() => null);
        if (body && typeof body === "object" && "ok" in body) {
          okFlag = Boolean((body as any).ok);
        }
      }
    } catch {
      // ignore JSON parse errors; status/ok below will decide
    }

    const reachable = res.ok && (okFlag === undefined ? true : okFlag === true);
    return { reachable, status: res.status, detail: reachable ? "ok" : "unhealthy" };
  } catch (e: any) {
    // Network-level failure (timeout, DNS, cleartext block, etc.)
    return { reachable: false, detail: e?.message || "network request failed" };
  }
}

/** Ping /health with a short retry to survive cold starts. */
export async function pingHealth(timeoutMs = 15000): Promise<boolean> {
  const url = healthUrl();
  try {
    const first = await once(timeoutMs);
    if (first.reachable) return true;

    // eslint-disable-next-line no-console
    console.warn(
      `[health] first attempt failed: ${first.detail || "unknown"} (status=${first.status ?? "n/a"}) url=${url} reason=${API_BASE_REASON}`
    );

    // brief backoff then one more try
    await new Promise(r => setTimeout(r, 800));

    const second = await once(timeoutMs);
    if (second.reachable) return true;

    // If both attempts failed, craft a user-facing error with context.
    const reason = second.detail || first.detail || "unreachable";
    const status = second.status ?? first.status;
    const technical = status ? `HTTP ${status}` : reason;

    const err = new Error(
      `Health check failed for ${url} (${technical}). Base reason: ${API_BASE_REASON}`
    );

    const friendly = toUserFacingError(err, `Health check failed for ${API_BASE}`);
    // eslint-disable-next-line no-console
    console.error(
      "[health] ping failed:",
      friendly.message,
      "| url=",
      url,
      "| reason=",
      API_BASE_REASON,
      "| status=",
      status ?? "n/a"
    );
    throw friendly;
  } catch (err) {
    const friendly = toUserFacingError(err, `Health check failed for ${API_BASE}`);
    // eslint-disable-next-line no-console
    console.error("[health] ping failed:", friendly.message, "| url=", url, "| reason=", API_BASE_REASON);
    throw friendly;
  }
}
