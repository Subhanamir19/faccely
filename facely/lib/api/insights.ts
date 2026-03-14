import { API_BASE } from "./config";
import { fetchWithRetry } from "./client";
import { buildAuthHeadersAsync } from "./authHeaders";

export type MetricInsight = {
  delta: number;
  verdict: "improved" | "same" | "declined";
};

export type InsightContent = {
  overall_delta: number;
  verdict: "improved" | "same" | "declined";
  narrative: string;
  metrics: {
    jawline: MetricInsight;
    facial_symmetry: MetricInsight;
    skin_quality: MetricInsight;
    cheekbones: MetricInsight;
    eyes_symmetry: MetricInsight;
    nose_harmony: MetricInsight;
    sexual_dimorphism: MetricInsight;
  };
};

export type InsightRecord = {
  id: string;
  user_id: string;
  latest_scan_id: string;
  created_at: string;
  content: InsightContent;
};

export type InsightData = {
  insight: InsightRecord | null;
  scan_count: number;
};

export async function fetchInsights(): Promise<InsightData> {
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  const res = await fetchWithRetry(`${API_BASE}/insights`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Insights request failed (HTTP ${res.status}) ${detail}`);
  }

  const payload = await res.json().catch(() => null);
  if (!payload || typeof payload.scan_count !== "number") {
    throw new Error("Invalid insights response");
  }

  return payload as InsightData;
}
