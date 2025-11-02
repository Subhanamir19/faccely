// src/routes/routineAsync.ts
import { Router } from "express";
import { z } from "zod";
import { REDIS, SERVICE } from "../config/index.js";
import { enqueueRoutine } from "../queue/jobs.js";

// Minimal payload validation
const BodySchema = z.object({
  scores: z.record(z.number()).refine(
    (r) => Object.values(r).every((n) => Number.isFinite(n)),
    "scores must be a map of numbers"
  ),
  context: z.record(z.any()).optional(),
  protocolVersion: z.string().optional(),
});

const router = Router();

/**
 * POST /routine/async
 * - 503 locally (no REDIS_URL)
 * - 202 on Railway (with Redis), returns job_id + status URL
 */
router.post("/", async (req, res) => {
  if (!REDIS.url) {
    return res.status(503).json({
      error: "queues_unavailable",
      hint: "Set REDIS_URL in env to enable async processing.",
    });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(req.body ?? {});
  } catch (e: any) {
    return res.status(400).json({ error: "invalid_body", issues: e?.issues ?? String(e) });
  }

  const reqId = (req.headers["x-request-id"] as string) || undefined;

  const job = await enqueueRoutine({
    requestId: reqId,
    scoresHash: "", // optional: you can hash(JSON.stringify(parsed.scores)) later
    scores: parsed.scores,
    protocolVersion: parsed.protocolVersion ?? "v1",
    context: parsed.context ?? {},
  });

  return res.status(202).json({
    job_id: job.id,
    status_url: `/jobs/${job.id}`,
    queue: SERVICE.name,
  });
});

/**
 * GET /routine/async/:id → convenience forward to /jobs/:id
 */
router.get("/:id", (req, res) => {
  const id = req.params.id;
  return res.redirect(307, `/jobs/${encodeURIComponent(id)}`);
});

export default router;
