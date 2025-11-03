// src/routes/jobs.ts
import { Router } from "express";
import { Queue, Job } from "bullmq";
import { QUEUES, SERVICE } from "../config/index.js";
import { getRedis } from "../lib/redis.js";

type KnownQueueName = typeof QUEUES[keyof typeof QUEUES];

const KNOWN_QUEUES: KnownQueueName[] = [
  QUEUES.analyze,
  QUEUES.explain,
  QUEUES.routine,
  QUEUES.image,
];

async function openQueue(name: KnownQueueName): Promise<Queue | null> {
  const conn = await getRedis();
  if (!conn) return null;
  return new Queue(name, { connection: conn as any, prefix: SERVICE.name });
}

async function findJob(id: string, queueHint?: string) {
  const names =
    queueHint && (KNOWN_QUEUES as string[]).includes(queueHint)
      ? [queueHint as KnownQueueName]
      : KNOWN_QUEUES;

  for (const name of names) {
    const q = await openQueue(name);
    if (!q) continue;
    try {
      const job = await Job.fromId(q, id);
      if (job) return { q, name, job };
    } finally {
      await q?.close().catch(() => {});
    }
  }
  return null;
}

function trimIfBig(v: unknown) {
  try {
    const s = JSON.stringify(v);
    if (s.length > 180_000) return { truncated: true, bytes: s.length };
    return v;
  } catch {
    return undefined;
  }
}

const router = Router();

/** GET /jobs/:id[?queue=analyze_v1] */
router.get("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "missing_job_id" });

  try {
    const found = await findJob(id, req.query.queue as string | undefined);
    if (!found) return res.status(404).json({ error: "job_not_found" });

    const { name, job } = found;
    const state = await job.getState(); // waiting|active|completed|failed|delayed|paused
    const progress = job.progress ?? null;

    let result: unknown;
    let error: unknown;

    if (state === "completed") {
      result = trimIfBig(job.returnvalue);

      // Write-through to idempotency layer if present
      try {
        await res.locals.idempotency?.setCompleted?.(result);
      } catch (e) {
        console.warn("[idempotency:setCompleted] failed", (e as Error)?.message);
      }
    }

    if (state === "failed") {
      error = {
        message: job.failedReason,
        stacktraces: job.stacktrace?.slice(0, 3),
      };
    }

    res.json({
      id: job.id,
      queue: name,
      status: state,
      progress,
      result,
      error,
      timestamps: {
        created: job.timestamp,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
      },
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "job_lookup_failed", detail: String(e?.message || e) });
  }
});

export default router;
