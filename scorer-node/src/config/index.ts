// src/config/index.ts
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Single source of truth for runtime configuration.
 * Uses dotenv with override:true to ensure .env takes precedence over system env vars.
 */
dotenv.config({ override: true });

// Helper to normalize empty strings to undefined
const emptyToUndefined = (v?: string) => (v && v.trim() ? v.trim() : undefined);

// Normalize URL to ensure it has https:// scheme
const normalizeUrl = (v?: string): string | undefined => {
  if (!v || !v.trim()) return undefined;
  const trimmed = v.trim().replace(/\/+$/, ""); // Remove trailing slashes
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  // Redis - fully optional, enables caching when present
  REDIS_URL: z.string().optional().transform(emptyToUndefined),

  // Object storage - optional
  S3_ENDPOINT: z.string().optional().transform(emptyToUndefined),
  S3_BUCKET: z.string().optional().transform(emptyToUndefined),
  S3_KEY: z.string().optional().transform(emptyToUndefined),
  S3_SECRET: z.string().optional().transform(emptyToUndefined),

  // OpenAI - required in non-test environments (for explanations)
  OPENAI_API_KEY: z.string().optional().transform(emptyToUndefined),
  OPENAI_EXPLAINER_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_SCORES_MODEL: z.string().min(1).default("gpt-4o"),
  OPENAI_SCORES_MODEL_FALLBACK: z.string().optional().transform(emptyToUndefined),
  OPENAI_MODEL_SIGMA: z.string().optional().transform(emptyToUndefined),

  // ML Scoring API - uses local ML model instead of OpenAI for scoring
  ML_SCORING_API_URL: z.string().optional().transform(normalizeUrl),
  ML_SCORING_ENABLED: z.string().optional(),

  // Sigma AI tuning
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
  CACHE_TTL_ANALYZE_S: z.coerce.number().int().nonnegative().default(3600),
  CACHE_TTL_EXPLAIN_S: z.coerce.number().int().nonnegative().default(7200),
  CACHE_TTL_ROUTINE_S: z.coerce.number().int().nonnegative().default(7 * 86400),

  // In-memory cache limits
  SCORE_CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 30),
  SCORE_CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(5000),
  EXPLAINER_CACHE_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 24 * 30),
  EXPLAINER_CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(5000),

  // Idempotency
  IDEMPOTENCY_TTL_S: z.coerce.number().int().positive().default(900),

  // Feature flags
  FF_ASYNC_ANALYZE: z.string().optional(),
  FF_ASYNC_ROUTINE: z.string().optional(),
  FEATURE_SIGMA_ENABLED: z.string().optional(),

  // Supabase Auth - the only auth system we use
  SUPABASE_JWT_SECRET: z.string().optional().transform(v =>
    v && v.trim().length >= 16 ? v.trim() : undefined
  ),
  SUPABASE_ISSUER: z.string().optional().transform(emptyToUndefined),
  SUPABASE_AUDIENCE: z.string().optional().transform(v => emptyToUndefined(v) ?? "authenticated"),

  // Service meta
  SERVICE_NAME: z.string().default("scorer-node"),
  SERVICE_VERSION: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const env = parsed.data;

// Validate required vars based on environment
if (env.NODE_ENV !== "test") {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY (required outside test)");
  }
}

if (env.NODE_ENV === "production") {
  if (!env.SUPABASE_JWT_SECRET) {
    throw new Error("Missing SUPABASE_JWT_SECRET (required in production)");
  }
}

const isTruthyFlag = (v?: string) => typeof v === "string" && /^(1|true|yes|on)$/i.test(v);

// ─────────────────────────────────────────────────────────────────────────────
// Exported Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_ENV = env.NODE_ENV;
export const IS_PROD = env.NODE_ENV === "production";
export const IS_DEV = env.NODE_ENV === "development";
export const IS_TEST = env.NODE_ENV === "test";

export const SERVICE = {
  name: env.SERVICE_NAME,
  version: env.SERVICE_VERSION ?? "0.0.0",
};

export const SERVER = {
  port: env.PORT,
  corsOrigins: env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
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
    scoresFallbackModel: env.OPENAI_SCORES_MODEL_FALLBACK ?? null,
    sigmaModel: env.OPENAI_MODEL_SIGMA ?? env.OPENAI_SCORES_MODEL,
    sigmaTemperature: env.SIGMA_TEMPERATURE,
    sigmaMaxTokens: env.SIGMA_MAX_TOKENS,
    sigmaMaxResponseBytes: env.SIGMA_MAX_RESPONSE_BYTES,
  },
};

// Redis is fully optional - caching is disabled when not configured
export const REDIS = {
  url: env.REDIS_URL,
  enabled: Boolean(env.REDIS_URL),
};

export const STORAGE = {
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  key: env.S3_KEY,
  secret: env.S3_SECRET,
  enabled: Boolean(env.S3_ENDPOINT && env.S3_BUCKET),
};

export const TTL = {
  analyzeS: env.CACHE_TTL_ANALYZE_S,
  explainS: env.CACHE_TTL_EXPLAIN_S,
  routineS: env.CACHE_TTL_ROUTINE_S,
  idempotencyS: env.IDEMPOTENCY_TTL_S,
};

export const CACHE_LIMITS = {
  score: { ttlMs: env.SCORE_CACHE_TTL_MS, maxItems: env.SCORE_CACHE_MAX_ITEMS },
  explain: { ttlMs: env.EXPLAINER_CACHE_TTL_MS, maxItems: env.EXPLAINER_CACHE_MAX_ITEMS },
};

export const ROUTINE = {
  llmTimeoutMs: env.ROUTINE_LLM_TIMEOUT_MS,
  strictSauce: isTruthyFlag(env.ROUTINE_STRICT_SAUCE),
};

export const WORKERS = {
  timeoutMs: env.WORKER_TIMEOUT_MS,
  concurrency: env.WORKER_CONCURRENCY,
};

export const FEATURES = {
  asyncAnalyze: isTruthyFlag(env.FF_ASYNC_ANALYZE),
  asyncRoutine: isTruthyFlag(env.FF_ASYNC_ROUTINE),
  sigmaEnabled: isTruthyFlag(env.FEATURE_SIGMA_ENABLED),
  mlScoringEnabled: isTruthyFlag(env.ML_SCORING_ENABLED),
};

export const ML_SCORING = {
  apiUrl: env.ML_SCORING_API_URL ?? null,
  enabled: isTruthyFlag(env.ML_SCORING_ENABLED) && Boolean(env.ML_SCORING_API_URL),
};

export const QUEUES = {
  image: "image_v1",
  analyze: "analyze_v1",
  explain: "explain_v1",
  routine: "routine_v1",
  dlq: "dlq_v1",
} as const;

export const SLO = {
  p95LightMs: 900,
  p95HeavyMs: 3000,
  availabilityTarget: 0.999,
};

// Supabase is our only auth provider
export const AUTH = {
  jwtSecret: env.SUPABASE_JWT_SECRET ?? null,
  issuer: env.SUPABASE_ISSUER?.replace(/\/+$/, "") ?? null,
  audience: env.SUPABASE_AUDIENCE,
  /** True if JWT validation is fully configured */
  enabled: Boolean(env.SUPABASE_JWT_SECRET),
};

export function assertProvider(name: string, present: unknown): asserts present {
  if (!present) throw new Error(`Missing provider configuration: ${name}`);
}

export default {
  NODE_ENV, IS_PROD, IS_DEV, IS_TEST,
  SERVICE, SERVER, PROVIDERS, REDIS, STORAGE,
  TTL, CACHE_LIMITS, ROUTINE, WORKERS, FEATURES, QUEUES, SLO, AUTH, ML_SCORING,
};
