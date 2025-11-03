// src/queue/index.ts
import { startWorkers } from "./worker.js";
import { queuesHealthy } from "./jobs.js";
import { REDIS } from "../config/index.js";

let started = false;
let closers: Array<() => Promise<void> | void> = [];
type Closable = { close: () => Promise<void> };

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

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Boot BullMQ workers if REDIS_URL is set.
 * - Retries a few times to avoid race with Redis readiness.
 * - Never crashes the API; logs and continues if queues can't start.
 */
export async function bootQueues(): Promise<void> {
  if (started) return;

  const masked = maskRedis(REDIS.url);
  if (!REDIS.url) {
    console.warn(`[QUEUES] REDIS_URL not set — queues disabled (env=${masked})`);
    started = true; // avoid repeating the warning
    return;
  }

  const maxAttempts = 5;
  let attempt = 0;
  while (attempt < maxAttempts && !started) {
    attempt++;
    try {
      const { workers } = await startWorkers(); // will throw if Redis not ready
      closers = workers.map((w: Closable) => () => w.close());
      started = true;
      console.log(`[QUEUES] workers started (redis=${masked})`);
      break;
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000); // 0.5s → 5s
      console.warn(`[QUEUES] start attempt ${attempt}/${maxAttempts} failed → ${msg}. retrying in ${delay}ms`);
      await wait(delay);
    }
  }

  if (!started) {
    console.warn(`[QUEUES] giving up after ${maxAttempts} attempts — queues disabled (redis=${masked})`);
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
