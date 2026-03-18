import { Router } from "express";
import { getLatestInsightForUser } from "../supabase/insights.js";
import { getAllScansForUser } from "../supabase/scans.js";
import { getAnalysisForScan } from "../supabase/analyses.js";
import {
  generateInsightsForUser,
  getInsightsOpenAIClient,
} from "../insights/generateInsights.js";
import { metricKeys } from "../validators.js";

export const insightsRouter = Router();

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function avgScore(scores: Record<string, number>): number {
  const vals = metricKeys
    .map((k) => scores[k])
    .filter((v): v is number => typeof v === "number");
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function relativeLabel(index: number, total: number): string {
  if (index === 0) return "Baseline";
  if (index === total - 1) return "Latest";
  if (index === total - 2) return "Previous";
  return `Scan #${index + 1}`;
}

/* -------------------------------------------------------------------------- */
/*   GET /insights                                                            */
/* -------------------------------------------------------------------------- */

insightsRouter.get("/", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const [insight, scans] = await Promise.all([
      getLatestInsightForUser(userId),
      getAllScansForUser(userId),
    ]);

    const latest = scans[scans.length - 1] ?? null;
    const previous = scans.length >= 2 ? scans[scans.length - 2] : null;

    const [latestAnalysis, previousAnalysis] = await Promise.all([
      latest ? getAnalysisForScan(latest.id) : Promise.resolve(null),
      previous ? getAnalysisForScan(previous.id) : Promise.resolve(null),
    ]);

    // DIAGNOSTIC LOGS — remove after debugging
    console.log("[insights GET] latest scan id:", latest?.id ?? "NONE");
    console.log("[insights GET] latestAnalysis row exists:", !!latestAnalysis);
    console.log("[insights GET] latestAnalysis.advanced_result:", latestAnalysis?.advanced_result ? "PRESENT" : "NULL");
    if (latestAnalysis?.advanced_result) {
      console.log("[insights GET] advanced_result keys:", Object.keys(latestAnalysis.advanced_result));
    }
    // ---

    const latestAdvanced = (latestAnalysis?.advanced_result as Record<string, unknown> | null) ?? null;
    const previousAdvanced = (previousAnalysis?.advanced_result as Record<string, unknown> | null) ?? null;

    const scanCount = scans.length;

    // Lazy trigger: only fire when no insight exists at all
    const needsGeneration = !insight;

    if (needsGeneration && scanCount >= 2) {
      const openai = getInsightsOpenAIClient();
      if (openai) {
        const latestScan = scans[scans.length - 1];
        generateInsightsForUser(openai, userId, latestScan.id).catch((err) =>
          console.error(
            "[insights] lazy generation failed:",
            err instanceof Error ? err.message : err
          )
        );
      }
    }

    // Build graph data from all scans (last 20 max for the chart)
    const graphScans = scans.slice(-20);
    const graphPoints = graphScans.map((s) =>
      avgScore(s.scores as Record<string, number>)
    );
    const graphDates = graphScans.map((s) => s.created_at);

    // Per-metric current / baseline / best across all scans
    const baseline = scans[0] ?? null;

    const metricsPayload =
      baseline && latest
        ? metricKeys.map((key) => {
            const baselineScores = baseline.scores as Record<string, number>;
            const latestScores = latest.scores as Record<string, number>;
            const current = latestScores[key] ?? 0;
            const baseVal = baselineScores[key] ?? 0;
            const best = scans.reduce((b, s) => {
              const v = (s.scores as Record<string, number>)[key] ?? 0;
              return v > b ? v : b;
            }, 0);
            const delta = Math.round((current - baseVal) * 10) / 10;
            const direction: "up" | "down" | "flat" =
              delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
            return { key, current, baseline: baseVal, best, delta, direction };
          })
        : [];

    // Scan history list (last 10, newest first for display)
    const historyScans = scans.slice(-10).reverse();
    const history = historyScans.map((s, i) => ({
      id: s.id,
      created_at: s.created_at,
      overall: avgScore(s.scores as Record<string, number>),
      label: relativeLabel(scans.length - 1 - i, scans.length),
    }));

    // Overall stats
    const overall =
      baseline && latest
        ? {
            current: avgScore(latest.scores as Record<string, number>),
            baseline: avgScore(baseline.scores as Record<string, number>),
            best: scans.reduce(
              (b, s) => Math.max(b, avgScore(s.scores as Record<string, number>)),
              0
            ),
          }
        : null;

    // Days since first scan
    const joinedDaysAgo = baseline
      ? Math.floor(
          (Date.now() - new Date(baseline.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    return res.json({
      insight: insight ?? null,
      scan_count: scanCount,
      overall,
      metrics: metricsPayload,
      graph_points: graphPoints,
      graph_dates: graphDates,
      history,
      joined_days_ago: joinedDaysAgo,
      latest_advanced: latestAdvanced,
      previous_advanced: previousAdvanced,
    });
  } catch (err) {
    console.error("[insights] failed to fetch insight", err);
    return res.status(500).json({ error: "insights_fetch_failed" });
  }
});
