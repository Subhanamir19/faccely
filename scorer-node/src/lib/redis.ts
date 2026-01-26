// src/lib/redis.ts
import { setTimeout as sleep } from "node:timers/promises";
// Import the namespace, then resolve the actual constructor safely
import * as RedisNS from "ioredis";
import type { Redis as RedisClient, RedisOptions } from "ioredis";
import { REDIS, SERVICE } from "../config/index.js";

// Resolve constructor across ESM/CJS shapes
const RedisCtor: new (url: string, opts?: RedisOptions) => RedisClient =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((RedisNS as any).default ?? (RedisNS as any));

let client: RedisClient | null = null;
let connecting = false;

export function isRedisEnabled(): boolean {
  return Boolean(REDIS.url && REDIS.url.length > 0);
}

export async function getRedis(): Promise<RedisClient | null> {
  if (!isRedisEnabled()) return null;
  if (client) return client;
  if (connecting) {
    await sleep(50);
    return client;
    }
  connecting = true;

  const options: RedisOptions = {
    enableAutoPipelining: true,
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      const delay = Math.min(1000 * Math.pow(2, times), 15_000);
      return delay;
    },
    reconnectOnError(err: Error) {
      const msg = err.message || "";
      return /READONLY|MOVED|ASK|CLUSTERDOWN/i.test(msg);
    },
  };

  const redis = new RedisCtor(REDIS.url as string, options);

  redis.on("connect", () => console.log(`[REDIS] connect → ${REDIS.url}`));
  redis.on("ready",   () => console.log("[REDIS] ready"));
  redis.on("error",   (err: unknown) => {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[REDIS] error:", m);
  });
  redis.on("end",     () => console.warn("[REDIS] connection ended"));

  const ok = await pingWithTimeout(redis, 3000);
  if (!ok) console.warn("[REDIS] ping failed within 3s; continuing without Redis");

  client = redis;
  connecting = false;
  addShutdownHook();
  return client;
}

async function pingWithTimeout(redis: RedisClient, ms: number): Promise<boolean> {
  return await Promise.race([
    redis.ping().then(() => true).catch(() => false),
    sleep(ms).then(() => false),
  ]);
}

let hookAdded = false;
function addShutdownHook() {
  if (hookAdded) return;
  hookAdded = true;
  const close = async (signal: string) => {
    if (client) {
      console.log(`[REDIS] closing on ${signal}`);
      try { await client.quit(); } catch { client.disconnect(); }
    }
    process.exit(0);
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void close(sig));
  }
}

/* Null-safe helpers */
export async function redisGet(key: string): Promise<string | null> {
  const r = await getRedis(); if (!r) return null; return r.get(key);
}
export async function redisSetEx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
  const r = await getRedis(); if (!r) return false; await r.set(key, value, "EX", ttlSeconds); return true;
}
export async function redisDel(key: string): Promise<boolean> {
  const r = await getRedis(); if (!r) return false; await r.del(key); return true;
}
export function k(...parts: Array<string | number>): string {
  return [SERVICE.name, ...parts].join(":");
}

/**
 * Check Redis connectivity and measure latency.
 */
export async function checkRedisHealth(): Promise<{
  ok: boolean;
  enabled: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!isRedisEnabled()) {
    return { ok: true, enabled: false, latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const redis = await getRedis();
    if (!redis) {
      return { ok: false, enabled: true, latencyMs: Date.now() - start, error: "Redis client unavailable" };
    }

    const pong = await redis.ping();
    const latencyMs = Date.now() - start;

    if (pong !== "PONG") {
      return { ok: false, enabled: true, latencyMs, error: `Unexpected response: ${pong}` };
    }

    return { ok: true, enabled: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, enabled: true, latencyMs, error: message };
  }
}
