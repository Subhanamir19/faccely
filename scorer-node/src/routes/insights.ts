import { Router } from "express";
import { getLatestInsightForUser } from "../supabase/insights.js";
import { getAllScansForUser } from "../supabase/scans.js";
import {
  generateInsightsForUser,
  getInsightsOpenAIClient,
} from "../insights/generateInsights.js";

export const insightsRouter = Router();

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

    // Lazy trigger: if no insight exists yet but user has enough scans, generate now
    if (!insight && scans.length >= 2) {
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

    return res.json({
      insight: insight ?? null,
      scan_count: scans.length,
    });
  } catch (err) {
    console.error("[insights] failed to fetch insight", err);
    return res.status(500).json({ error: "insights_fetch_failed" });
  }
});
