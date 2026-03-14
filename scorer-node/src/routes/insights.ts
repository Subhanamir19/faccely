import { Router } from "express";
import { getLatestInsightForUser } from "../supabase/insights.js";
import { getAllScansForUser } from "../supabase/scans.js";

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

    return res.json({
      insight: insight ?? null,
      scan_count: scans.length,
    });
  } catch (err) {
    console.error("[insights] failed to fetch insight", err);
    return res.status(500).json({ error: "insights_fetch_failed" });
  }
});
