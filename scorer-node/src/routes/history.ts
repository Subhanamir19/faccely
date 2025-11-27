import { Router } from "express";
import { getScansForUser } from "../supabase/scans.js";

export const historyRouter = Router();

historyRouter.get("/scans", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const rawLimit = req.query?.limit;
  let limit = 20;

  if (typeof rawLimit === "string" && rawLimit.trim()) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isNaN(parsed)) limit = parsed;
  } else if (Array.isArray(rawLimit) && rawLimit[0]) {
    const parsed = Number.parseInt(String(rawLimit[0]), 10);
    if (!Number.isNaN(parsed)) limit = parsed;
  } else if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    limit = rawLimit;
  }

  limit = Math.min(50, Math.max(1, limit));

  try {
    const scans = await getScansForUser(userId, limit);
    const payload = scans.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      modelVersion: row.model_version,
      hasSideImage: row.side_image_path != null,
    }));
    return res.json({ scans: payload });
  } catch (err) {
    console.error("[history] failed to fetch scans", err);
    return res.status(500).json({ error: "history_fetch_failed" });
  }
});
