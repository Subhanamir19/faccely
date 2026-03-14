import { API_BASE } from "./config";
import { fetchWithRetry } from "./client";
import { buildAuthHeadersAsync } from "./authHeaders";

export type MetricInsight = {
  delta: number;
  verdict: "improved" | "same" | "declined";
};

export type AdvancedItem = {
  label: string;
  comment: string;
  change: "improving" | "same" | "worse";
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
  advanced?: AdvancedItem[];
};

export type InsightRecord = {
  id: string;
  user_id: string;
  latest_scan_id: string;
  created_at: string;
  content: InsightContent;
};

export type DashboardMetric = {
  key: string;
  current: number;
  baseline: number;
  best: number;
  delta: number;
  direction: "up" | "down" | "flat";
};

export type DashboardHistoryItem = {
  id: string;
  created_at: string;
  overall: number;
  label: string;
};

export type DashboardOverall = {
  current: number;
  baseline: number;
  best: number;
};

export type InsightData = {
  insight: InsightRecord | null;
  scan_count: number;
  overall: DashboardOverall | null;
  metrics: DashboardMetric[];
  graph_points: number[];
  graph_dates: string[];
  history: DashboardHistoryItem[];
  joined_days_ago: number;
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
