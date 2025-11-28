import { Router } from "express";
import { getAnalysisForScan } from "../supabase/analyses.js";
import { getScanById, getScansForUser, type ScanRecord } from "../supabase/scans.js";
import { signScanImage } from "../supabase/storage.js";

export const historyRouter = Router();

type HistoryScanDetailResponse = {
  id: string;
  createdAt: string;
  modelVersion: string;
  hasSideImage: boolean;
  scores: ScanRecord["scores"];
  images: {
    front: { path: string; url: string };
    side: { path: string; url: string } | null;
  };
  explanations: Record<string, unknown> | null;
  analysisCreatedAt: string | null;
};

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

historyRouter.get("/scans/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const scanId = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  if (!scanId) {
    return res.status(400).json({ error: "invalid_scan_id" });
  }

  try {
    const scan = await getScanById(userId, scanId);
    if (!scan) {
      return res.status(404).json({ error: "scan_not_found" });
    }

    const [frontUrl, sideUrl, analysis] = await Promise.all([
      signScanImage(scan.front_image_path),
      scan.side_image_path ? signScanImage(scan.side_image_path) : Promise.resolve(null),
      getAnalysisForScan(scan.id),
    ]);

    const payload: HistoryScanDetailResponse = {
      id: scan.id,
      createdAt: scan.created_at,
      modelVersion: scan.model_version,
      hasSideImage: scan.side_image_path != null,
      scores: scan.scores,
      images: {
        front: { path: scan.front_image_path, url: frontUrl },
        side: scan.side_image_path
          ? { path: scan.side_image_path, url: sideUrl as string }
          : null,
      },
      explanations: analysis?.explanations ?? null,
      analysisCreatedAt: analysis?.created_at ?? null,
    };

    return res.json(payload);
  } catch (err) {
    console.error("[history] failed to fetch scan detail", err);
    return res.status(500).json({ error: "history_scan_detail_failed" });
  }
});
