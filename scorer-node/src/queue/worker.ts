// scorer-node/src/queue/worker.ts
// BullMQ workers: wire OpenAI client inside the worker so generateRoutine has a client.

import { Worker, QueueEvents, type Processor } from "bullmq";
import OpenAI from "openai";
import { getRedis } from "../lib/redis.js";
import { QUEUES, SERVICE } from "../config/index.js";
import { ENV } from "../env.js";

// Same setter your HTTP routes use
import { setRoutineOpenAIClient } from "../routes/routine.js";
import { generateRoutine } from "../utils/generateRoutine.js";
import type { Scores } from "../validators.js";

type ClosableHandle = { close: () => Promise<void> };
type WorkerBundle = { workers: ClosableHandle[]; stop: () => Promise<void> };

type RoutineJob = {
  requestId?: string;
  scores: Scores;                          // <- use your strict Scores type
  protocolVersion?: string;
  context?: Record<string, unknown>;
};

export async function buildWorker(): Promise<WorkerBundle> {
  const connection = await getRedis();
  if (!connection) throw new Error("Redis required for workers");

  // CRITICAL: create and inject OpenAI for the worker runtime
  const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
  setRoutineOpenAIClient(openai);

  const routineProc: Processor<RoutineJob> = async (job) => {
    const { scores, protocolVersion, context } = job.data ?? {};
    if (!scores) throw new Error("routine job missing scores");
    const contextHint =
      protocolVersion || context
        ? JSON.stringify({
            ...(protocolVersion ? { protocolVersion } : {}),
            ...(context ? { context } : {}),
          })
        : undefined;
    // generateRoutine reads the injected client via setRoutineOpenAIClient(...)
    return await generateRoutine(scores, contextHint, openai);
  };

  const routineWorker = new Worker<RoutineJob>(QUEUES.routine, routineProc, {
    connection,
    concurrency: 3,
    prefix: SERVICE.name || "scorer-node",
    lockDuration: 60_000,
    autorun: true,
  });

  // events (cheap hooks, ready for metrics later)
  const routineEvents = new QueueEvents(QUEUES.routine, { connection, autorun: true });

  routineWorker.on("failed", (job, err) => {
    console.error("[worker:routine] failed", { id: job?.id, err: err?.message });
  });
  routineWorker.on("completed", (job) => {
    console.log("[worker:routine] completed", { id: job?.id });
  });

  const closables: ClosableHandle[] = [routineWorker, routineEvents];
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
