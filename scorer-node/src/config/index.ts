// src/config/index.ts
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Single source of truth for runtime configuration.
 * Load .env exactly once, validate with Zod, and never reach for process.env elsewhere.
 */
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  // External infra
  REDIS_URL: z.string().url().optional(),
  // Object storage optional for Phase 1; wire later
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_KEY: z.string().optional(),
  S3_SECRET: z.string().optional(),

  // Providers & models
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EXPLAINER_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_SCORES_MODEL: z.string().min(1).default("gpt-4o"),
  OPENAI_SCORES_MODEL_FALLBACK: z.string().optional(),
  OPENAI_MODEL_SIGMA: z.string().optional(),

  // Sigma tuning
  SIGMA_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  SIGMA_MAX_TOKENS: z.coerce.number().int().positive().default(800),
  SIGMA_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(200 * 1024),

  // Runtime knobs
  ROUTINE_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  ROUTINE_STRICT_SAUCE: z.string().optional(),
  WORKER_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),

  // Concurrency & queues
  MAX_CONCURRENT: z.coerce.number().int().positive().default(20),
  REQUEST_QUEUE_MAX_WAIT_MS: z.coerce.number().int().nonnegative().default(20_000),
  REQUEST_QUEUE_MAX_PENDING: z.coerce.number().int().nonnegative().default(100),

  // Caching TTLs (seconds)
  CACHE_TTL_ANALYZE_S: z.coerce.number().int().nonnegative().default(3600), // 1h
  CACHE_TTL_EXPLAIN_S: z.coerce.number().int().nonnegative().default(7200), // 2h
  CACHE_TTL_ROUTINE_S: z.coerce.number().int().nonnegative().default(7 * 86400),

  // Model cache knobs
  SCORE_CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 30),
  SCORE_CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(5000),
  EXPLAINER_CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 30),
  EXPLAINER_CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(5000),

  // Idempotency keys
  IDEMPOTENCY_TTL_S: z.coerce.number().int().positive().default(900), // 15 min

  // Feature flags (use "1"/"true" to enable)
  FF_ASYNC_ANALYZE: z.string().optional(),
  FF_ASYNC_ROUTINE: z.string().optional(),
  FEATURE_SIGMA_ENABLED: z.string().optional(),
  FF_ALLOW_HEADER_IDENTITY: z.string().optional(),

  // Auth
  // Supabase access tokens are HS256-signed with the project JWT secret (JWKS is empty).
  SUPABASE_JWT_SECRET: z.string().min(16).optional(),
  SUPABASE_ISSUER: z.string().url().optional(),
  SUPABASE_AUDIENCE: z.string().min(1).optional(),

  // Service meta
  SERVICE_NAME: z.string().default("scorer-node"),
  SERVICE_VERSION: z.string().optional(), // optionally set from env/CI
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  RATE_LIMIT_PER_MIN: process.env.RATE_LIMIT_PER_MIN,

  REDIS_URL: process.env.REDIS_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_KEY: process.env.S3_KEY,
  S3_SECRET: process.env.S3_SECRET,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_EXPLAINER_MODEL: process.env.OPENAI_EXPLAINER_MODEL,
  OPENAI_SCORES_MODEL: process.env.OPENAI_SCORES_MODEL,
  OPENAI_SCORES_MODEL_FALLBACK: process.env.OPENAI_SCORES_MODEL_FALLBACK,
  OPENAI_MODEL_SIGMA: process.env.OPENAI_MODEL_SIGMA,

  SIGMA_TEMPERATURE: process.env.SIGMA_TEMPERATURE,
  SIGMA_MAX_TOKENS: process.env.SIGMA_MAX_TOKENS,
  SIGMA_MAX_RESPONSE_BYTES: process.env.SIGMA_MAX_RESPONSE_BYTES,

  ROUTINE_LLM_TIMEOUT_MS: process.env.ROUTINE_LLM_TIMEOUT_MS,
  ROUTINE_STRICT_SAUCE: process.env.ROUTINE_STRICT_SAUCE,
  WORKER_TIMEOUT_MS: process.env.WORKER_TIMEOUT_MS,
  WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,

  MAX_CONCURRENT: process.env.MAX_CONCURRENT,
  REQUEST_QUEUE_MAX_WAIT_MS: process.env.REQUEST_QUEUE_MAX_WAIT_MS,
  REQUEST_QUEUE_MAX_PENDING: process.env.REQUEST_QUEUE_MAX_PENDING,

  CACHE_TTL_ANALYZE_S: process.env.CACHE_TTL_ANALYZE_S,
  CACHE_TTL_EXPLAIN_S: process.env.CACHE_TTL_EXPLAIN_S,
  CACHE_TTL_ROUTINE_S: process.env.CACHE_TTL_ROUTINE_S,
  SCORE_CACHE_TTL_MS: process.env.SCORE_CACHE_TTL_MS,
  SCORE_CACHE_MAX_ITEMS: process.env.SCORE_CACHE_MAX_ITEMS,
  EXPLAINER_CACHE_TTL_MS: process.env.EXPLAINER_CACHE_TTL_MS,
  EXPLAINER_CACHE_MAX_ITEMS: process.env.EXPLAINER_CACHE_MAX_ITEMS,

  IDEMPOTENCY_TTL_S: process.env.IDEMPOTENCY_TTL_S,

  FF_ASYNC_ANALYZE: process.env.FF_ASYNC_ANALYZE,
  FF_ASYNC_ROUTINE: process.env.FF_ASYNC_ROUTINE,
  FEATURE_SIGMA_ENABLED: process.env.FEATURE_SIGMA_ENABLED,
  FF_ALLOW_HEADER_IDENTITY: process.env.FF_ALLOW_HEADER_IDENTITY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_ISSUER: process.env.SUPABASE_ISSUER,
  SUPABASE_AUDIENCE: process.env.SUPABASE_AUDIENCE,

  SERVICE_NAME: process.env.SERVICE_NAME,
  SERVICE_VERSION: process.env.SERVICE_VERSION,
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const env = parsed.data;

if (env.NODE_ENV !== "test") {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY (required outside test)");
  }
  if (!env.REDIS_URL) {
    throw new Error("Missing REDIS_URL (required outside test)");
  }
  if (!env.SUPABASE_JWT_SECRET) {
    throw new Error("Missing SUPABASE_JWT_SECRET (required outside test)");
  }
}

const isTruthyFlag = (v?: string) => typeof v === "string" && /^(1|true|yes|on)$/i.test(v);
const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

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
  corsOrigins,
  rateLimitPerMin: env.RATE_LIMIT_PER_MIN,
  maxConcurrent: env.MAX_CONCURRENT,
  requestQueueMaxWaitMs: env.REQUEST_QUEUE_MAX_WAIT_MS,
  requestQueueMaxPending: env.REQUEST_QUEUE_MAX_PENDING,
};

export const PROVIDERS = {
  openai: {
    apiKey: env.OPENAI_API_KEY ?? "",
    explainerModel: env.OPENAI_EXPLAINER_MODEL,
    scoresModel: env.OPENAI_SCORES_MODEL,
    scoresFallbackModel: env.OPENAI_SCORES_MODEL_FALLBACK?.trim() || null,
    sigmaModel:
      env.OPENAI_MODEL_SIGMA && env.OPENAI_MODEL_SIGMA.trim().length > 0
        ? env.OPENAI_MODEL_SIGMA
        : env.OPENAI_SCORES_MODEL,
    sigmaTemperature: env.SIGMA_TEMPERATURE,
    sigmaMaxTokens: env.SIGMA_MAX_TOKENS,
    sigmaMaxResponseBytes: env.SIGMA_MAX_RESPONSE_BYTES,
  },
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

export const CACHE_LIMITS = {
  score: {
    ttlMs: env.SCORE_CACHE_TTL_MS,
    maxItems: env.SCORE_CACHE_MAX_ITEMS,
  },
  explain: {
    ttlMs: env.EXPLAINER_CACHE_TTL_MS,
    maxItems: env.EXPLAINER_CACHE_MAX_ITEMS,
  },
};

export const ROUTINE = {
  llmTimeoutMs: env.ROUTINE_LLM_TIMEOUT_MS,
  strictSauce: isTruthyFlag(env.ROUTINE_STRICT_SAUCE),
};

export const WORKERS = {
  timeoutMs: env.WORKER_TIMEOUT_MS,
  concurrency: env.WORKER_CONCURRENCY,
};

// Feature flags used to gate async cutover per-route
export const FEATURES = {
  asyncAnalyze: isTruthyFlag(env.FF_ASYNC_ANALYZE),
  asyncRoutine: isTruthyFlag(env.FF_ASYNC_ROUTINE),
  sigmaEnabled: isTruthyFlag(env.FEATURE_SIGMA_ENABLED),
  allowHeaderIdentity: isTruthyFlag(env.FF_ALLOW_HEADER_IDENTITY),
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

export const AUTH = {
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET?.trim() || null,
  supabaseIssuer: env.SUPABASE_ISSUER?.trim().replace(/\/+$/, "") || null,
  supabaseAudience: env.SUPABASE_AUDIENCE?.trim() || "authenticated",
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
  CACHE_LIMITS,
  ROUTINE,
  WORKERS,
  FEATURES,
  QUEUES,
  SLO,
  AUTH,
};
