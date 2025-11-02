// src/queue/index.ts
import { startWorkers } from "./worker.js";
import { queuesHealthy } from "./jobs.js";
import { REDIS } from "../config/index.js";

let started = false;
let closers: Array<() => Promise<void> | void> = [];

function maskRedis(url?: string | null) {
  if (!url) return "absent";
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port || "6379";
    const user = u.username || "default";
    const hasPass = Boolean(u.password);
    return `redis://${user}:${hasPass ? "***" : ""}@${host}:${port}`;
  } catch {
    return "malformed";
  }
}

/**
 * Boot BullMQ workers if REDIS_URL is set.
 * Never crash the process — log and continue if Redis is missing/unreachable.
 */
export async function bootQueues(): Promise<void> {
  if (started) return;

  const masked = maskRedis(REDIS.url);
  if (!REDIS.url) {
    console.warn(`[QUEUES] REDIS_URL not set — queues disabled (env=${masked})`);
    started = true; // prevent repeated logs
    return;
  }

  try {
    const workers = await startWorkers(); // may throw if getRedis() returns null
    closers = workers.map((w) => () => w.close());
    started = true;
    console.log(`[QUEUES] workers started (redis=${masked})`);
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    console.warn(`[QUEUES] failed to start workers (redis=${masked}) → ${msg}`);
    // Do NOT throw — keep API up even if queues are down.
  }

  // graceful shutdown
  const onSignal = async (sig: string) => {
    for (const close of closers) {
      try { await close(); } catch {}
    }
    console.log(`[QUEUES] closed on ${sig}`);
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void onSignal(sig));
  }
}

/** Lightweight probe for routes/health. */
export async function queuesProbe() {
  if (!REDIS.url) return { enabled: false, healthy: false, reason: "no_redis_url" };
  const ok = await queuesHealthy();
  return { enabled: true, healthy: ok };
}
