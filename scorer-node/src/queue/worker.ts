// src/queue/worker.ts
import { Worker, type Processor, type WorkerOptions } from "bullmq";
import { getRedis } from "../lib/redis.js";
import { QUEUES, SERVICE } from "../config/index.js";
import { generateRoutine } from "../utils/generateRoutine.js";
import { explainImageBytes } from "../explainer.js";
import { scoreImageBytes } from "../scorer.js";
import OpenAI from "openai";

/**
 * Boots BullMQ workers for heavy jobs.
 * - Uses the shared Redis connection
 * - Creates its own OpenAI client (workers run outside the web request)
 */

type JobPayload = Record<string, any>;

// single OpenAI client for worker processes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function makeWorkerOptions(r: unknown): WorkerOptions {
  // BullMQ accepts an ioredis instance for `connection`
  return {
    concurrency: 4,
    connection: r as any,
    prefix: SERVICE.name,
  };
}

async function buildWorker<Q extends string>(
  queueName: Q,
  processor: Processor<JobPayload>
) {
  const r = await getRedis();
  if (!r) throw new Error("Redis required for workers");
  const worker = new Worker(queueName, processor, makeWorkerOptions(r));

  worker.on("ready", () => console.log(`[WORKER:${queueName}] ready`));
  worker.on("active", (job) => console.log(`[WORKER:${queueName}] started job ${job.id}`));
  worker.on("completed", (job) => console.log(`[WORKER:${queueName}] completed ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[WORKER:${queueName}] failed ${job?.id}:`, err?.message)
  );

  return worker;
}

/* --------------------------- Job processor logic --------------------------- */

const analyzeProc: Processor = async (job) => {
  const { buffer, mime } = job.data;
  // NOTE: long-term we’ll pass hashes/urls, not buffers
  const res = await scoreImageBytes(openai, buffer, mime);
  return res;
};

const explainProc: Processor = async (job) => {
  const { buffer, mime, scores } = job.data;
  const res = await explainImageBytes(openai, buffer, mime, scores);
  return res;
};

const routineProc: Processor = async (job) => {
  const { scores, context } = job.data;
  const res = await generateRoutine(scores, context);
  return res;
};

/* --------------------------- Worker boot sequence -------------------------- */

export async function startWorkers() {
  const workers = await Promise.all([
    buildWorker(QUEUES.analyze, analyzeProc),
    buildWorker(QUEUES.explain, explainProc),
    buildWorker(QUEUES.routine, routineProc),
  ]);

  console.log(`[WORKERS] launched → ${workers.length} workers`);
  return workers;
}
