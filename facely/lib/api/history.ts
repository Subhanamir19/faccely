import { API_BASE } from "./config";
import { fetchWithRetry } from "./client";
import { getAuthState } from "@/store/auth";
import { buildAuthHeadersAsync } from "./authHeaders";
import type { Scores } from "./scores";

export interface ScanHistoryItem {
  id: string;
  createdAt: string;
  modelVersion: string;
  hasSideImage: boolean;
}

export interface ScanDetail {
  id: string;
  createdAt: string;
  modelVersion: string;
  hasSideImage: boolean;
  scores: Scores;
  images: {
    front: { path: string; url: string };
    side: { path: string; url: string } | null;
  };
  explanations: Record<string, string[]> | null;
  analysisCreatedAt: string | null;
}

/** Extract a user-facing message from a non-ok response body. */
async function extractErrorMessage(res: Response): Promise<string> {
  // Railway-level 404 ("Application not found") means the service is down —
  // always show a friendly message regardless of the body content.
  if (res.status === 404 || res.status === 503) {
    return "Server temporarily unavailable. Please try again later.";
  }
  const raw = await res.text().catch(() => "");
  // For other error codes, try to surface the app's own message field.
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // not JSON — fall through
  }
  return raw || `Request failed (${res.status})`;
}

export async function fetchScanHistory(limit = 20): Promise<ScanHistoryItem[]> {
  const { uid, deviceId } = getAuthState();
  if (!uid) throw new Error("Not authenticated");

  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders,
  };

  const url = `${API_BASE}/history/scans?limit=${encodeURIComponent(String(safeLimit))}`;
  const res = await fetchWithRetry(url, { method: "GET", headers });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message);
  }

  const payload = await res.json().catch(() => null);
  const scans = (payload as any)?.scans;
  if (!Array.isArray(scans)) {
    throw new Error("Invalid history response");
  }

  return scans as ScanHistoryItem[];
}

export async function fetchScanDetail(scanId: string): Promise<ScanDetail> {
  const { uid, deviceId } = getAuthState();
  if (!uid) throw new Error("Not authenticated");

  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders,
  };

  const url = `${API_BASE}/history/scans/${encodeURIComponent(scanId)}`;
  const res = await fetchWithRetry(url, { method: "GET", headers });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message);
  }

  const payload = await res.json().catch(() => null);
  if (
    !payload ||
    typeof payload.id !== "string" ||
    !payload.scores ||
    !payload.images ||
    !payload.images.front ||
    typeof payload.images.front.url !== "string"
  ) {
    throw new Error("Invalid history detail response");
  }

  return payload as ScanDetail;
}
