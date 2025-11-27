import { API_BASE } from "./config";
import { fetchWithRetry } from "./client";
import { getAuthState } from "@/store/auth";

export interface ScanHistoryItem {
  id: string;
  createdAt: string;
  modelVersion: string;
  hasSideImage: boolean;
}

export async function fetchScanHistory(limit = 20): Promise<ScanHistoryItem[]> {
  const { uid, deviceId } = getAuthState();
  if (!uid) throw new Error("Not authenticated");

  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const headers: Record<string, string> = { Accept: "application/json" };
  headers["x-user-id"] = uid;
  if (deviceId) headers["x-device-id"] = deviceId;

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
