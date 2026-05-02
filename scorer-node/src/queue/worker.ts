// scorer-node/src/queue/worker.ts
// BullMQ workers: wire OpenAI client inside the worker so generateRoutine has a client.

import { Worker, QueueEvents, type Processor, Queue } from "bullmq";
import OpenAI from "openai";
import { getRedis } from "../lib/redis.js";
import { QUEUES, SERVICE, PROVIDERS, WORKERS, ROUTINE } from "../config/index.js";

// Same setter your HTTP routes use
import { setRoutineOpenAIClient } from "../routes/routine.js";
import { generateRoutine } from "../utils/generateRoutine.js";
import { generatePotentialFace } from "../services/potentialFaceGeneration.js";
import type { Scores } from "../validators.js";
import type { PotentialFaceJob } from "./jobs.js";

type ClosableHandle = { close: () => Promise<void> };
type WorkerBundle = { workers: ClosableHandle[]; stop: () => Promise<void> };

type RoutineJob = {
  requestId?: string;
  scores: Scores; // <- strict Scores type
  protocolVersion?: string;
  context?: Record<string, unknown>;
};

// Worker wall-clock cap (distinct from LLM's internal timeout)
const WORKER_TIMEOUT_MS = WORKERS.timeoutMs;

// Concurrency knob (keep modest; global budgets live elsewhere)
const WORKER_CONCURRENCY = WORKERS.concurrency;

export async function buildWorker(): Promise<WorkerBundle> {
  const connection = await getRedis();
  if (!connection) throw new Error("Redis required for workers");

  // Provision OpenAI for the worker runtime
  const openai = new OpenAI({
    apiKey: PROVIDERS.openai.apiKey,
    // hard cap so the SDK itself doesn't hang forever
    timeout: ROUTINE.llmTimeoutMs,
  });
  setRoutineOpenAIClient(openai);

  // NEW: dead-letter queue handle (compact payloads; auto-clean on complete)
  const dlq = new Queue(QUEUES.dlq, {
    connection,
    prefix: SERVICE.name || "scorer-node",
    defaultJobOptions: { removeOnComplete: true, attempts: 1 },
  });

  const routineProc: Processor<RoutineJob> = async (job) => {
    const startedAt = Date.now();
    const ctx = {
      q: QUEUES.routine,
      job_id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      requestId: job.data?.requestId,
    };

    try {
      const { scores, protocolVersion, context } = job.data ?? {};
      if (!scores) throw new Error("routine job missing scores");

      const contextHint =
        protocolVersion || context
          ? JSON.stringify({
              ...(protocolVersion ? { protocolVersion } : {}),
              ...(context ? { context } : {}),
            })
          : undefined;

      // Wall-clock cap at worker level; generateRoutine also has its own LLM timeout.
      const result = await withWorkerTimeout(
        () => generateRoutine(scores, contextHint, openai),
        WORKER_TIMEOUT_MS
      );

      console.log("[worker:routine] completed", {
        ...ctx,
        run_latency_ms: Date.now() - startedAt,
      });

      return result;
    } catch (err: any) {
      const run_latency_ms = Date.now() - startedAt;

      const payload = {
        queue: QUEUES.routine,
        job_id: ctx.job_id,
        attempts: ctx.attemptsMade,
        run_latency_ms,
        error: String(err?.message ?? err),
        code:
          err?.code ??
          (String(err?.message || "").includes("timeout")
            ? "WORKER_TIMEOUT"
            : "ERROR"),
        ts: Date.now(),
      };

      console.error("[worker:routine] failed", payload);

      // NEW: publish a compact failure record to DLQ
      try {
        await dlq.add("dead", payload);
      } catch (e) {
        console.warn("[worker:dlq] publish_failed", String((e as Error)?.message || e));
      }

      throw err instanceof Error ? err : new Error(String(err));
    }
  };

  const routineWorker = new Worker<RoutineJob>(QUEUES.routine, routineProc, {
    connection,
    concurrency: WORKER_CONCURRENCY,
    prefix: SERVICE.name || "scorer-node",
    // Keep lock above the LLM cap so BullMQ doesn't think it's stalled prematurely
    lockDuration: Math.max(WORKER_TIMEOUT_MS, 60_000),
    autorun: true,
  });

  const routineEvents = new QueueEvents(QUEUES.routine, {
    connection,
    autorun: true,
  });

  routineWorker.on("active", (job) => {
    console.log("[worker:routine] active", {
      id: job.id,
      attemptsMade: job.attemptsMade,
    });
  });

  routineWorker.on("completed", (job) => {
    console.log("[worker:routine] completed:event", { id: job?.id });
  });

  routineWorker.on("failed", (job, err) => {
    console.error("[worker:routine] failed:event", {
      id: job?.id,
      attemptsMade: job?.attemptsMade,
      err: err?.message,
    });
  });

  /* ------------------------------------------------------------------------ */
  /*   Potential Face worker                                                  */
  /* ------------------------------------------------------------------------ */
  //
  // gpt-image-1 image-edit calls take 15–40s, so we give this worker a
  // dedicated wall-clock cap and modest concurrency. Default attempts come
  // from the queue's defaultJobOptions (3 with exponential backoff). The
  // processor is responsible for marking the row `failed` only on the *final*
  // attempt — earlier attempts throw so BullMQ retries with the row still
  // `pending`.

  const POTENTIAL_FACE_TIMEOUT_MS = Math.max(WORKER_TIMEOUT_MS, 90_000);
  const POTENTIAL_FACE_CONCURRENCY = Math.max(1, Math.min(WORKER_CONCURRENCY, 4));

  const potentialFaceProc: Processor<PotentialFaceJob> = async (job) => {
    const startedAt = Date.now();
    const ctx = {
      q: QUEUES.potentialFace,
      job_id: job.id,
      attemptsMade: job.attemptsMade,
      potentialFaceId: job.data?.potentialFaceId,
      userId: job.data?.userId,
      stage: job.data?.stage,
    };
    console.log("[worker:potential-face] active", ctx);

    const totalAttempts = job.opts?.attempts ?? 1;
    // BullMQ increments attemptsMade *after* a failure; on the current run
    // the user has used (attemptsMade) prior attempts, so this is the
    // (attemptsMade + 1)-th try. Final iff this run hits the cap.
    const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;

    try {
      const result = await withWorkerTimeout(
        () =>
          generatePotentialFace(openai, {
            potentialFaceId: job.data.potentialFaceId,
            isFinalAttempt,
          }),
        POTENTIAL_FACE_TIMEOUT_MS
      );

      console.log("[worker:potential-face] completed", {
        ...ctx,
        latency_ms: Date.now() - startedAt,
        status: result?.status ?? "no-op",
      });
      return { status: result?.status ?? "no-op" };
    } catch (err: any) {
      const payload = {
        queue: QUEUES.potentialFace,
        job_id: ctx.job_id,
        potentialFaceId: ctx.potentialFaceId,
        userId: ctx.userId,
        stage: ctx.stage,
        attempts: ctx.attemptsMade,
        latency_ms: Date.now() - startedAt,
        error: String(err?.message ?? err),
        code:
          err?.code ??
          (String(err?.message || "").includes("timeout") ? "WORKER_TIMEOUT" : "ERROR"),
        ts: Date.now(),
      };
      console.error("[worker:potential-face] failed", payload);

      // Only emit to DLQ once we've exhausted retries. Earlier-attempt
      // failures are noise — BullMQ will retry the same job.
      if (isFinalAttempt) {
        try {
          await dlq.add("dead", payload);
        } catch (e) {
          console.warn(
            "[worker:potential-face:dlq] publish_failed",
            String((e as Error)?.message || e)
          );
        }
      }

      throw err instanceof Error ? err : new Error(String(err));
    }
  };

  const potentialFaceWorker = new Worker<PotentialFaceJob>(
    QUEUES.potentialFace,
    potentialFaceProc,
    {
      connection,
      concurrency: POTENTIAL_FACE_CONCURRENCY,
      prefix: SERVICE.name || "scorer-node",
      // Lock above the wall-clock cap so BullMQ doesn't think the job stalled
      // mid-OpenAI-call and reassigns it.
      lockDuration: POTENTIAL_FACE_TIMEOUT_MS + 30_000,
      autorun: true,
    }
  );

  const potentialFaceEvents = new QueueEvents(QUEUES.potentialFace, {
    connection,
    autorun: true,
  });

  potentialFaceWorker.on("active", (job) => {
    console.log("[worker:potential-face] active:event", {
      id: job.id,
      attemptsMade: job.attemptsMade,
    });
  });

  potentialFaceWorker.on("failed", (job, err) => {
    console.error("[worker:potential-face] failed:event", {
      id: job?.id,
      attemptsMade: job?.attemptsMade,
      err: err?.message,
    });
  });

  const closables: ClosableHandle[] = [
    routineWorker,
    routineEvents,
    potentialFaceWorker,
    potentialFaceEvents,
    dlq,
  ];
  const stop = async () => {
    for (const c of closables) {
      await c.close();
    }
  };

  return { stop, workers: closables };
}

export async function startWorkers(): Promise<WorkerBundle> {
  return buildWorker();
}

/**
 * Promise wall clock guard. Does not kill the inner task,
 * but generateRoutine enforces its own AbortController timeout,
 * so the inner call should resolve/reject before this fires.
 */
async function withWorkerTimeout<T>(
  task: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      task(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const e = new Error(`Worker timeout after ${timeoutMs} ms`) as Error & {
            code?: string;
          };
          e.code = "WORKER_TIMEOUT";
          reject(e);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
