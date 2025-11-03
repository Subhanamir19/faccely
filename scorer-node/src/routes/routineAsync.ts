// src/routes/routineAsync.ts
import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { REDIS, SERVICE } from "../config/index.js";
import { enqueueRoutine } from "../queue/jobs.js";

// Minimal payload validation
const BodySchema = z.object({
  scores: z
    .record(z.number())
    .refine(
      (r) => Object.values(r).every((n) => Number.isFinite(n)),
      "scores must be a map of numbers"
    ),
  context: z.record(z.any()).optional(),
  protocolVersion: z.string().optional(),
});

const router = Router();

/** Canonicalize an object to a stable JSON string (sorted keys) */
function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map((v) => canonicalize(v)).join(",")}]`;
  const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalize(v)).join(",")}}`;
}

/** sha256 helper returning lowercase hex */
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

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
    return res
      .status(400)
      .json({ error: "invalid_body", issues: e?.issues ?? String(e) });
  }

  const reqId = (req.headers["x-request-id"] as string) || undefined;
  const idempotencyKey =
    (req.headers["idempotency-key"] as string) ||
    (req.headers["x-idempotency-key"] as string) ||
    undefined;

  // Deterministic identity for dedupe/cache layers
  const scoresHash = sha256(canonicalize(parsed.scores));

  const job = await enqueueRoutine({
    requestId: reqId,
    scoresHash, // now populated
    scores: parsed.scores,
    protocolVersion: parsed.protocolVersion ?? "v1",
    // carry the idempotency key through context for future replay/caching
    context: {
      ...(parsed.context ?? {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  });

  // NEW: write-through pending handle so repeats replay instead of re-enqueue
  await res.locals.idempotency?.setPending?.(job.id as string, `/jobs/${job.id}`);

  return res.status(202).json({
    job_id: job.id,
    status_url: `/jobs/${job.id}`,
    queue: SERVICE.name,
    scoresHash,
    idempotencyKey, // echo back so the client can correlate
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
