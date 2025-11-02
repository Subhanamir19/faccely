// src/queue/jobs.ts
import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import { getRedis } from "../lib/redis.js";
import { QUEUES, SERVICE } from "../config/index.js";

/**
 * Central registry of BullMQ queues used by the service.
 * - Lazy-initialized against our existing Redis connection
 * - Safe enqueue helpers with defaults
 * - QueueEvents for lightweight instrumentation hooks (ready for Phase 4)
 */

type AnalyzeJob = {
  requestId?: string;
  artifactId?: string;           // future: when you move to presigned uploads
  // current flow still passes buffers via routes — we won't put buffers in jobs
  // Phase 2 focuses on routine/explain offloads first
  mime?: string;
  imageHash?: string;            // content-addressable key
};

type ExplainJob = {
  requestId?: string;
  mime?: string;
  imageHash: string;
  scores: Record<string, number>;
  pair?: { sideHash: string; sideMime?: string };
};

type RoutineJob = {
  requestId?: string;
  scoresHash: string;            // hash(JSON.stringify(scores))
  scores: Record<string, number>;
  protocolVersion?: string;      // pin for determinism
  context?: Record<string, unknown>;
};

type ImageJob = {
  requestId?: string;
  uploadKey: string;             // e.g., s3 key if/when you add object storage
  targetFormat?: "jpeg" | "png" | "webp";
};

/* ---------------------------- Lazy queue handles --------------------------- */

let qAnalyze: Queue<AnalyzeJob> | null = null;
let qExplain: Queue<ExplainJob> | null = null;
let qRoutine: Queue<RoutineJob> | null = null;
let qImage: Queue<ImageJob> | null = null;

let evAnalyze: QueueEvents | null = null;
let evExplain: QueueEvents | null = null;
let evRoutine: QueueEvents | null = null;
let evImage: QueueEvents | null = null;

async function ensureQueues() {
  if (qAnalyze && qExplain && qRoutine && qImage) return;
  const r = await getRedis();
  if (!r) throw new Error("Redis is required for queues. Set REDIS_URL.");

  const base = {
    connection: r,
    defaultJobOptions: defaultJobOptions(),
    prefix: SERVICE.name, // queue key namespace
  } as const;

  qAnalyze = new Queue<AnalyzeJob>(QUEUES.analyze, base);
  qExplain = new Queue<ExplainJob>(QUEUES.explain, base);
  qRoutine = new Queue<RoutineJob>(QUEUES.routine, base);
  qImage   = new Queue<ImageJob>(QUEUES.image, base);

  // Lightweight events; we’ll wire listeners in Phase 4 for metrics
  evAnalyze = new QueueEvents(QUEUES.analyze, { connection: r, autorun: true });
  evExplain = new QueueEvents(QUEUES.explain, { connection: r, autorun: true });
  evRoutine = new QueueEvents(QUEUES.routine, { connection: r, autorun: true });
  evImage   = new QueueEvents(QUEUES.image,   { connection: r, autorun: true });
}

/* ---------------------------- Default job options -------------------------- */

function defaultJobOptions(): JobsOptions {
  return {
    // give jobs a reasonable TTL in queue if workers are down
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 1000 },
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  };
}

/* ------------------------------ Enqueue helpers ---------------------------- */

export async function enqueueAnalyze(payload: AnalyzeJob, opts?: JobsOptions) {
  await ensureQueues();
  const id = payload.requestId ?? randomUUID();
  return qAnalyze!.add("analyze", payload, { jobId: id, ...opts });
}

export async function enqueueExplain(payload: ExplainJob, opts?: JobsOptions) {
  await ensureQueues();
  const id = payload.requestId ?? randomUUID();
  return qExplain!.add("explain", payload, { jobId: id, ...opts });
}

export async function enqueueRoutine(payload: RoutineJob, opts?: JobsOptions) {
  await ensureQueues();
  const id = payload.requestId ?? randomUUID();
  return qRoutine!.add("routine", payload, { jobId: id, ...opts });
}

export async function enqueueImage(payload: ImageJob, opts?: JobsOptions) {
  await ensureQueues();
  const id = payload.requestId ?? randomUUID();
  return qImage!.add("image", payload, { jobId: id, ...opts });
}

/* ------------------------------- Health probe ------------------------------ */

export async function queuesHealthy(): Promise<boolean> {
  try {
    await ensureQueues();
    // ping via count queries; cheap and verifies connection
    await Promise.all([
      qAnalyze!.getJobCounts(),
      qExplain!.getJobCounts(),
      qRoutine!.getJobCounts(),
      qImage!.getJobCounts(),
    ]);
    return true;
  } catch (e) {
    console.error("[QUEUES] health check failed:", (e as Error)?.message);
    return false;
  }
}

// ⬆️ keep your existing code intact

// --- ADD BELOW ---

import type { Job } from "bullmq";

export type JobStatus = "waiting" | "delayed" | "active" | "completed" | "failed" | "unknown";

export type JobSnapshot = {
  id: string;
  queue: "analyze" | "explain" | "routine" | "image" | "unknown";
  status: JobStatus;
  progress?: number;
  result?: any;
  error?: { name?: string; message?: string; stack?: string };
  attemptsMade?: number;
  created_at?: number;
  updated_at?: number;
};

/**
 * Try to find a job by id across all queues and return a normalized snapshot.
 * Returns null if the id is in none of the queues.
 */
export async function getJobSnapshot(jobId: string): Promise<JobSnapshot | null> {
  await ensureQueues();

  // Try each queue until we find the job
  const candidates: Array<["analyze" | "explain" | "routine" | "image", Queue<any>]> = [
    ["analyze", qAnalyze!],
    ["explain", qExplain!],
    ["routine", qRoutine!],
    ["image",   qImage!],
  ];

  for (const [key, q] of candidates) {
    const job = await q.getJob(jobId);
    if (job) return normalizeJob(job, key);
  }
  return null;
}

function normalizeJob(job: Job, key: JobSnapshot["queue"]): JobSnapshot {
  const status = inferStatus(job);
  const failed =
    status === "failed"
      ? job.failedReason || (job as any).stacktrace?.[0]
      : undefined;

  return {
    id: job.id as string,
    queue: key,
    status,
    progress: typeof job.progress === "number" ? job.progress : undefined,
    result: job.returnvalue,
    error: failed ? { message: failed } : undefined,
    attemptsMade: job.attemptsMade,
    created_at: job.timestamp,
    updated_at: job.processedOn ?? job.finishedOn ?? undefined,
  };
}

function inferStatus(job: Job): JobStatus {
  // BullMQ doesn't give a single state property; infer from timestamps
  if ((job as any).finishedOn) return job.failedReason ? "failed" : "completed";
  if ((job as any).processedOn) return "active";
  if ((job as any).delay && (job as any).delay > 0) return "delayed";
  if ((job as any).timestamp) return "waiting";
  return "unknown";
}
