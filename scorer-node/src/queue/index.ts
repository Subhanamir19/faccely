// src/queue/index.ts
import { startWorkers } from "./worker.js";
import { queuesHealthy } from "./jobs.js";
import { REDIS } from "../config/index.js";

let started = false;
let closers: Array<() => Promise<void> | void> = [];

export async function bootQueues(): Promise<void> {
  if (!REDIS.url) {
    console.warn("[QUEUES] REDIS_URL not set — queues disabled");
    return;
  }
  if (started) return;
  const workers = await startWorkers();
  closers = workers.map((w) => () => w.close());
  started = true;

  const onSignal = async (sig: string) => {
    console.log(`[QUEUES] closing on ${sig}`);
    for (const close of closers) {
      try { await close(); } catch {}
    }
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void onSignal(sig));
  }
}

export async function queuesProbe() {
  if (!REDIS.url) return { enabled: false, healthy: false, reason: "no_redis_url" };
  const ok = await queuesHealthy();
  return { enabled: true, healthy: ok };
}
