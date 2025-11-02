// src/config/index.ts
import { z } from "zod";

/**
 * Single source of truth for runtime configuration.
 * Validates env up front, gives sane defaults, and exports typed constants.
 * No side effects beyond reading process.env.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  // External infra
  REDIS_URL: z.string().url().optional(),
  // Object storage optional for Phase 1; wire later
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_KEY: z.string().optional(),
  S3_SECRET: z.string().optional(),

  // Providers
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY required").optional(),

  // Concurrency & queues
  MAX_CONCURRENT: z.coerce.number().int().positive().default(20),
  REQUEST_QUEUE_MAX_WAIT_MS: z.coerce.number().int().nonnegative().default(20_000),

  // Caching TTLs (seconds)
  CACHE_TTL_ANALYZE_S: z.coerce.number().int().nonnegative().default(3600),   // 1h
  CACHE_TTL_EXPLAIN_S: z.coerce.number().int().nonnegative().default(7200),   // 2h
  CACHE_TTL_ROUTINE_S: z.coerce.number().int().nonnegative().default(7 * 86400),

  // Idempotency keys
  IDEMPOTENCY_TTL_S: z.coerce.number().int().positive().default(900),         // 15 min

  // Feature flags (use "1"/"true" to enable)
  FF_ASYNC_ANALYZE: z.string().optional(),
  FF_ASYNC_ROUTINE: z.string().optional(),

  // Service meta
  SERVICE_NAME: z.string().default("scorer-node"),
  SERVICE_VERSION: z.string().optional(), // optionally set from env/CI
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,

  REDIS_URL: process.env.REDIS_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_KEY: process.env.S3_KEY,
  S3_SECRET: process.env.S3_SECRET,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  MAX_CONCURRENT: process.env.MAX_CONCURRENT,
  REQUEST_QUEUE_MAX_WAIT_MS: process.env.REQUEST_QUEUE_MAX_WAIT_MS,

  CACHE_TTL_ANALYZE_S: process.env.CACHE_TTL_ANALYZE_S,
  CACHE_TTL_EXPLAIN_S: process.env.CACHE_TTL_EXPLAIN_S,
  CACHE_TTL_ROUTINE_S: process.env.CACHE_TTL_ROUTINE_S,

  IDEMPOTENCY_TTL_S: process.env.IDEMPOTENCY_TTL_S,

  FF_ASYNC_ANALYZE: process.env.FF_ASYNC_ANALYZE,
  FF_ASYNC_ROUTINE: process.env.FF_ASYNC_ROUTINE,

  SERVICE_NAME: process.env.SERVICE_NAME,
  SERVICE_VERSION: process.env.SERVICE_VERSION,
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  // Fail fast with a readable message; don’t let the app boot with mystery nulls.
  const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const env = parsed.data;

const isTruthyFlag = (v?: string) =>
  typeof v === "string" && /^(1|true|yes|on)$/i.test(v);

// Derived flags
export const NODE_ENV = env.NODE_ENV;
export const IS_PROD = env.NODE_ENV === "production";
export const IS_DEV = env.NODE_ENV === "development";

export const SERVICE = {
  name: env.SERVICE_NAME,
  version: env.SERVICE_VERSION ?? "0.0.0",
};

export const SERVER = {
  port: env.PORT,
  maxConcurrent: env.MAX_CONCURRENT,
  requestQueueMaxWaitMs: env.REQUEST_QUEUE_MAX_WAIT_MS,
};

export const PROVIDERS = {
  openaiApiKey: env.OPENAI_API_KEY,
};

export const REDIS = {
  url: env.REDIS_URL,
};

export const STORAGE = {
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  key: env.S3_KEY,
  secret: env.S3_SECRET,
};

export const TTL = {
  analyzeS: env.CACHE_TTL_ANALYZE_S,
  explainS: env.CACHE_TTL_EXPLAIN_S,
  routineS: env.CACHE_TTL_ROUTINE_S,
  idempotencyS: env.IDEMPOTENCY_TTL_S,
};

// Feature flags used to gate async cutover per-route
export const FEATURES = {
  asyncAnalyze: isTruthyFlag(env.FF_ASYNC_ANALYZE),
  asyncRoutine: isTruthyFlag(env.FF_ASYNC_ROUTINE),
};

/**
 * Queue and job naming (must NOT include ':').
 * Use BullMQ's `prefix` (we set it to SERVICE.name) for namespacing instead.
 */
export const QUEUES = {
  image: "image_v1",
  analyze: "analyze_v1",
  explain: "explain_v1",
  routine: "routine_v1",
  dlq: "dlq_v1",
} as const;

// SLO targets for dashboards/alerts
export const SLO = {
  p95LightMs: 900,
  p95HeavyMs: 3000,
  availabilityTarget: 0.999,
};

// Minimal sanity helper for required provider keys when a route boots them.
export function assertProvider(name: string, present: unknown): asserts present {
  if (!present) throw new Error(`Missing provider configuration: ${name}`);
}

export default {
  NODE_ENV,
  IS_PROD,
  IS_DEV,
  SERVICE,
  SERVER,
  PROVIDERS,
  REDIS,
  STORAGE,
  TTL,
  FEATURES,
  QUEUES,
  SLO,
};
