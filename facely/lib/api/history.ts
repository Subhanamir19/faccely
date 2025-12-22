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
    const detail = await res.text().catch(() => "");
    const suffix = detail ? ` - ${detail}` : "";
    throw new Error(`History request failed (HTTP ${res.status})${suffix}`);
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
    const detail = await res.text().catch(() => "");
    const suffix = detail ? ` - ${detail}` : "";
    throw new Error(`History detail request failed (HTTP ${res.status})${suffix}`);
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
