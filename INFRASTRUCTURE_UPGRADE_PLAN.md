# Infrastructure Upgrade Plan: 100K+ Daily Invocations

**Target:** Handle 1,000 concurrent users / 100,000+ daily invocations with zero degradation.

**Guiding Principles:**
1. Readability & Clarity
2. Maintainability & Extensibility
3. Consistency & Architectural Coherence
4. Functional Correctness
5. Error Handling & Safety
6. Security Posture
7. Performance & Efficiency
8. Scalability Awareness
9. Leanness (zero overengineering)

---

## Executive Summary

| Layer | Current State | Target State |
|-------|--------------|--------------|
| **Compute** | Single Node.js process | 3-5 stateless containers + autoscaling |
| **Rate Limiting** | 30 req/min (process-local) | 10,000 req/min (distributed) |
| **Concurrency** | 20 max concurrent | 200 per instance, coordinated |
| **Database** | Single Supabase client | Connection pooling (pgBouncer) |
| **Cache** | In-memory + single Redis | Redis Cluster |
| **File Uploads** | 15MB in memory | Stream to S3 |
| **Job Status** | HTTP polling | Server-Sent Events (SSE) |
| **Observability** | Basic Prometheus | Structured logs + traces + dashboards |

---

## Phase 1: Quick Wins (Config Changes Only)

**Effort:** < 1 day | **Impact:** 3-5x capacity improvement

### 1.1 Increase Rate Limits

```env
# .env changes
RATE_LIMIT_PER_MIN=6000          # From 30 → 6000 (100 req/sec burst)
MAX_CONCURRENT=100               # From 20 → 100
REQUEST_QUEUE_MAX_PENDING=500    # From 100 → 500
REQUEST_QUEUE_MAX_WAIT_MS=30000  # From 20s → 30s
```

### 1.2 Increase Worker Capacity

```env
WORKER_CONCURRENCY=10            # From 3 → 10
ROUTINE_LLM_TIMEOUT_MS=45000     # From 25s → 45s (handle LLM latency spikes)
```

### 1.3 Extend Cache TTLs

```env
CACHE_TTL_ANALYZE_S=14400        # 4 hours (from 1 hour)
CACHE_TTL_EXPLAIN_S=28800        # 8 hours (from 2 hours)
SCORE_CACHE_MAX_ITEMS=20000      # From 5000
```

**Resulting capacity:** ~200-300 concurrent users

---

## Phase 2: Horizontal Scaling

**Effort:** 2-3 days | **Impact:** Linear scaling to 1000+ users

### 2.1 Stateless Container Architecture

The current architecture is already mostly stateless. Changes needed:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
│                    (Railway/Render/AWS ALB)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   API Node 1    │  │   API Node 2    │  │   API Node 3    │
│   (Express)     │  │   (Express)     │  │   (Express)     │
│   MAX_CONC=100  │  │   MAX_CONC=100  │  │   MAX_CONC=100  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Redis Cluster  │  │    Supabase     │  │    OpenAI API   │
│  (Cache+Queue)  │  │  (PostgreSQL)   │  │    (External)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 2.2 Distributed Rate Limiting

Replace process-local rate limiter with Redis-backed:

```typescript
// src/middleware/rateLimit.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedis } from "../lib/redis.js";
import { SERVER } from "../config/index.js";

let limiter: RateLimiterRedis | null = null;

export async function initRateLimiter() {
  const redis = await getRedis();
  if (!redis) {
    console.warn("[RATE_LIMIT] No Redis - falling back to memory limiter");
    return null;
  }

  limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:",
    points: SERVER.rateLimitPerMin,    // requests
    duration: 60,                       // per 60 seconds
    blockDuration: 0,                   // don't block, just reject
  });

  return limiter;
}

export function rateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!limiter) return next();

    const key = res.locals.userId || req.ip;
    try {
      await limiter.consume(key);
      next();
    } catch {
      res.status(429).json({
        errorCode: "rate_limited",
        message: "Too many requests. Please slow down.",
        retryAfter: 60,
      });
    }
  };
}
```

**Add dependency:**
```bash
npm install rate-limiter-flexible
```

### 2.3 Remove Process-Local Concurrency Guard

The current `enqueue()/release()` pattern works per-process only. For horizontal scaling:

**Option A (Recommended): Keep per-process, tune MAX_CONCURRENT per instance**
- Simpler, no distributed coordination needed
- Each of 5 instances handles MAX_CONCURRENT=100 = 500 total concurrent
- BullMQ already handles job distribution

**Option B: Distributed semaphore via Redis**
- Only if strict global limit is required
- Uses Redis INCR/DECR with TTL

```typescript
// src/lib/distributedLock.ts (Option B only)
import { getRedis, k } from "./redis.js";

const LOCK_KEY = k("concurrent_slots");
const GLOBAL_MAX = 500;

export async function acquireSlot(timeoutMs = 20000): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return crypto.randomUUID(); // fallback: always grant

  const slotId = crypto.randomUUID();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const current = await redis.incr(LOCK_KEY);
    if (current <= GLOBAL_MAX) {
      await redis.expire(LOCK_KEY, 120); // auto-cleanup
      return slotId;
    }
    await redis.decr(LOCK_KEY);
    await new Promise(r => setTimeout(r, 100));
  }

  return null; // timeout
}

export async function releaseSlot(slotId: string | null): Promise<void> {
  if (!slotId) return;
  const redis = await getRedis();
  if (!redis) return;
  await redis.decr(LOCK_KEY);
}
```

### 2.4 Railway/Render Scaling Config

**Railway (railway.toml):**
```toml
[deploy]
numReplicas = 3
healthcheckPath = "/health"
healthcheckTimeout = 10
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5

[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

**Or use Auto-scaling:**
```toml
[deploy]
minReplicas = 2
maxReplicas = 10
```

---

## Phase 3: Database & Connection Pooling

**Effort:** 1-2 days | **Impact:** Eliminates DB bottleneck

### 3.1 Enable Supabase Connection Pooling (pgBouncer)

Supabase provides pgBouncer on port 6543. Update connection:

```typescript
// src/supabase/client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL not set");
if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

// Use pooler URL for production
const url = process.env.SUPABASE_POOLER_URL || supabaseUrl;

export const supabase: SupabaseClient = createClient(url, supabaseServiceRoleKey, {
  db: {
    schema: "public",
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Environment:**
```env
# Use the pooler URL (port 6543) instead of direct connection (port 5432)
SUPABASE_POOLER_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 3.2 Direct PostgreSQL with Pool (Alternative)

If you need more control than Supabase client provides:

```typescript
// src/db/pool.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB_POOL] Unexpected error:", err.message);
});

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
```

---

## Phase 4: File Upload Streaming

**Effort:** 1-2 days | **Impact:** Eliminates OOM risk at scale

### 4.1 Replace Memory Storage with S3 Streaming

Current problem: `multer.memoryStorage()` loads entire files into RAM.

```typescript
// src/middleware/upload.ts
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { STORAGE } from "../config/index.js";

const s3 = new S3Client({
  endpoint: STORAGE.endpoint,
  region: "auto",
  credentials: {
    accessKeyId: STORAGE.key!,
    secretAccessKey: STORAGE.secret!,
  },
});

// Stream directly to S3 during upload
export const uploadToS3 = multer({
  storage: multerS3({
    s3,
    bucket: STORAGE.bucket!,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = req.res?.locals.userId || "anonymous";
      const timestamp = Date.now();
      const key = `uploads/${userId}/${timestamp}-${file.originalname}`;
      cb(null, key);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg", "image/png", "image/webp",
      "image/gif", "image/heic", "image/heif",
    ]);
    cb(null, allowed.has(file.mimetype));
  },
});

// Fetch from S3 when needed for processing
export async function getFileBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: STORAGE.bucket,
    Key: key,
  });
  const response = await s3.send(command);
  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

**Add dependencies:**
```bash
npm install @aws-sdk/client-s3 multer-s3
```

### 4.2 Hybrid Approach (Recommended)

For small files, memory is faster. Stream only large files:

```typescript
// src/middleware/upload.ts
import multer from "multer";

const STREAM_THRESHOLD = 2 * 1024 * 1024; // 2MB

// Use memory for small files, disk for large
const storage = multer.diskStorage({
  destination: "/tmp/uploads",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const upload = multer({
  storage: multer.memoryStorage(), // Keep memory for now
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 2, // Max 2 files per request (frontal + side)
  },
});
```

---

## Phase 5: Server-Sent Events for Job Status

**Effort:** 2 days | **Impact:** Eliminates polling, 10x request reduction

### 5.1 SSE Endpoint

Replace polling `/jobs/:id` with push-based updates:

```typescript
// src/routes/jobsSSE.ts
import { Router, Request, Response } from "express";
import { getRedis, k } from "../lib/redis.js";

const router = Router();

// Client subscribes to job updates
router.get("/:jobId/stream", async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const userId = res.locals.userId;

  // Validate job belongs to user
  const redis = await getRedis();
  const jobMeta = await redis?.get(k("job", jobId));
  if (!jobMeta) return res.status(404).json({ error: "job_not_found" });

  const meta = JSON.parse(jobMeta);
  if (meta.userId !== userId) return res.status(403).json({ error: "forbidden" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  // Send initial state
  res.write(`data: ${JSON.stringify({ status: meta.status, progress: meta.progress })}\n\n`);

  // Subscribe to Redis pub/sub
  const subscriber = redis?.duplicate();
  await subscriber?.subscribe(k("job", jobId, "updates"));

  subscriber?.on("message", (channel, message) => {
    res.write(`data: ${message}\n\n`);

    const update = JSON.parse(message);
    if (update.status === "completed" || update.status === "failed") {
      subscriber?.unsubscribe();
      subscriber?.quit();
      res.end();
    }
  });

  // Cleanup on client disconnect
  req.on("close", () => {
    subscriber?.unsubscribe();
    subscriber?.quit();
  });

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => clearInterval(heartbeat));
});

export default router;
```

### 5.2 Publish Updates from Worker

```typescript
// src/queue/worker.ts (additions)
import { getRedis, k } from "../lib/redis.js";

async function publishJobUpdate(jobId: string, update: object) {
  const redis = await getRedis();
  if (!redis) return;

  const channel = k("job", jobId, "updates");
  await redis.publish(channel, JSON.stringify(update));

  // Also update stored state for late subscribers
  await redis.set(k("job", jobId), JSON.stringify(update), "EX", 3600);
}

// In job processor:
await publishJobUpdate(job.id, { status: "processing", progress: 50 });
// ... do work ...
await publishJobUpdate(job.id, { status: "completed", result: data });
```

---

## Phase 6: Redis Cluster

**Effort:** 1 day | **Impact:** Eliminates Redis single-point-of-failure

### 6.1 Cluster Configuration

```typescript
// src/lib/redis.ts (updated)
import Redis, { Cluster, RedisOptions, ClusterOptions } from "ioredis";
import { REDIS } from "../config/index.js";

type RedisConnection = Redis | Cluster;
let client: RedisConnection | null = null;

export async function getRedis(): Promise<RedisConnection | null> {
  if (!REDIS.url) return null;
  if (client) return client;

  const isCluster = REDIS.url.includes(",") || process.env.REDIS_CLUSTER === "true";

  if (isCluster) {
    const nodes = REDIS.url.split(",").map(url => {
      const u = new URL(url.trim());
      return { host: u.hostname, port: parseInt(u.port || "6379") };
    });

    client = new Redis.Cluster(nodes, {
      redisOptions: {
        password: new URL(REDIS.url.split(",")[0]).password,
        enableAutoPipelining: true,
      },
      scaleReads: "slave",
    });
  } else {
    client = new Redis(REDIS.url, {
      enableAutoPipelining: true,
      maxRetriesPerRequest: null,
    });
  }

  return client;
}
```

### 6.2 Managed Redis Options

| Provider | Plan | Connections | Memory | Cost/mo |
|----------|------|-------------|--------|---------|
| Upstash | Pro | Unlimited | 10GB | $120 |
| Redis Cloud | Pro | 500 | 5GB | $150 |
| Railway Redis | - | 100 | 1GB | $20 |

**Recommendation:** Start with Railway Redis, upgrade to Upstash when >500 concurrent.

---

## Phase 7: Observability

**Effort:** 1-2 days | **Impact:** Diagnose issues before users notice

### 7.1 Structured Logging

```typescript
// src/lib/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  duration?: number;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, ctx?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "scorer-node",
    ...ctx,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
};
```

### 7.2 Request Tracing

```typescript
// src/middleware/tracing.ts
import { randomUUID } from "crypto";

export function tracing() {
  return (req: Request, res: Response, next: NextFunction) => {
    const traceId = req.headers["x-trace-id"] as string || randomUUID();
    const spanId = randomUUID().slice(0, 8);

    res.locals.traceId = traceId;
    res.locals.spanId = spanId;
    res.setHeader("x-trace-id", traceId);

    const start = Date.now();
    res.on("finish", () => {
      logger.info("request_completed", {
        traceId,
        spanId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        userId: res.locals.userId,
      });
    });

    next();
  };
}
```

### 7.3 Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Request latency P95 | <3s | >5s |
| Error rate | <0.1% | >1% |
| Active connections | <80% capacity | >90% |
| Queue depth | <100 | >500 |
| Redis latency | <10ms | >100ms |
| OpenAI latency P95 | <20s | >30s |

---

## Phase 8: Security Hardening

**Effort:** 1 day | **Impact:** Production-ready security posture

### 8.1 Supabase JWT Verification

Supabase access tokens are `HS256` signed with your project's **JWT secret** (the JWKS endpoint is empty), so you should verify using `SUPABASE_JWT_SECRET` rather than fetching JWKS.

```typescript
// src/middleware/auth.ts (updated)
import { jwtVerify, JWTVerifyResult } from "jose";
import { AUTH } from "../config/index.js";

export async function verifyToken(token: string): Promise<JWTVerifyResult> {
  const secret = new TextEncoder().encode(AUTH.supabaseJwtSecret!);
  return jwtVerify(token, secret, {
    issuer: AUTH.supabaseIssuer!,
    audience: AUTH.supabaseAudience,
    algorithms: ["HS256"],
  });
}
```

### 8.2 Input Validation

Already using Zod extensively - ensure all endpoints validate:

```typescript
// Checklist:
// [x] /analyze - file type validation via multer
// [x] /routine - RecommendationsRequestSchema
// [x] /protocols - validate protocol ID
// [ ] /programs - add ProgramRequestSchema
// [ ] /sigma - add SigmaRequestSchema
```

### 8.3 Rate Limit by User, Not Just IP

```typescript
// Update rate limiter key generation
const key = res.locals.userId || req.ip; // Prefer userId when available
```

---

## Implementation Checklist

### Phase 1: Quick Wins (Day 1)
- [ ] Update environment variables in Railway
- [ ] Deploy and verify with load test

### Phase 2: Horizontal Scaling (Days 2-4)
- [ ] Install `rate-limiter-flexible`
- [ ] Implement distributed rate limiting
- [ ] Configure Railway for 3 replicas
- [ ] Verify load balancing works

### Phase 3: Database (Days 5-6)
- [ ] Switch to Supabase pooler URL
- [ ] Verify connection limits in dashboard

### Phase 4: File Uploads (Days 7-8)
- [ ] Configure S3/Cloudflare R2 bucket
- [ ] Implement streaming upload (optional)
- [ ] Update storage.ts to use new bucket

### Phase 5: SSE (Days 9-10)
- [ ] Implement SSE endpoint
- [ ] Update workers to publish updates
- [ ] Update mobile app to use SSE

### Phase 6: Redis Cluster (Day 11)
- [ ] Provision Upstash or Redis Cloud
- [ ] Update connection config
- [ ] Migrate existing keys

### Phase 7: Observability (Day 12)
- [ ] Implement structured logger
- [ ] Add request tracing
- [ ] Set up alerts in Railway/Datadog

### Phase 8: Security (Day 13)
- [ ] Implement JWKS caching
- [ ] Audit all input validation
- [ ] Security review

---

## Capacity Planning

### After Full Implementation

| Metric | Value |
|--------|-------|
| API instances | 5 (auto-scale 2-10) |
| Max concurrent per instance | 100 |
| **Total concurrent capacity** | **500-1000** |
| Requests/minute (rate limit) | 10,000 |
| **Daily invocations** | **100,000+** |
| P95 latency (analyze) | <3s |
| P95 latency (routine) | <15s |
| Availability target | 99.9% |

### Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Railway (5 instances) | Pro | $100-200 |
| Upstash Redis | Pro | $120 |
| Supabase | Pro | $25 |
| Cloudflare R2 | Pay-as-you-go | $10-30 |
| OpenAI | Tier 4+ | Variable |
| **Total Infrastructure** | | **~$300-400/mo** |

---

## Files to Create/Modify

### New Files
```
src/middleware/rateLimit.ts       # Distributed rate limiting
src/middleware/tracing.ts         # Request tracing
src/lib/logger.ts                 # Structured logging
src/lib/distributedLock.ts        # Optional: global concurrency
src/routes/jobsSSE.ts             # Server-Sent Events
```

### Modified Files
```
src/config/index.ts               # New config options
src/lib/redis.ts                  # Cluster support
src/supabase/client.ts            # Pooler URL
src/middleware/auth.ts            # JWKS caching
src/index.ts                      # Wire new middleware
src/queue/worker.ts               # Publish job updates
.env.example                      # Document new vars
Dockerfile                        # Health check
railway.toml                      # Scaling config
```

---

## Load Testing

Before and after each phase, run:

```bash
# Install k6
brew install k6

# Create test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp to 100 users
    { duration: '1m', target: 100 },   // Hold
    { duration: '30s', target: 500 },  // Ramp to 500
    { duration: '1m', target: 500 },   // Hold
    { duration: '30s', target: 1000 }, // Ramp to 1000
    { duration: '1m', target: 1000 },  // Hold
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

export default function () {
  const res = http.get('https://your-api.railway.app/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
EOF

# Run test
k6 run load-test.js
```

---

## Rollback Plan

Each phase can be rolled back independently:

| Phase | Rollback Method |
|-------|-----------------|
| 1 | Revert env vars |
| 2 | Scale to 1 replica, remove rate-limiter-flexible |
| 3 | Switch back to direct Supabase URL |
| 4 | Already backward compatible |
| 5 | Clients fall back to polling |
| 6 | Point to single Redis instance |
| 7 | Remove logger, keep console.log |
| 8 | Remove JWKS cache |

---

## Success Criteria

- [ ] Handle 1,000 concurrent users with <5s P95 latency
- [ ] Zero 503 errors under normal load
- [ ] <1% error rate at peak
- [ ] Auto-scale from 2→10 instances based on load
- [ ] Recovery from single instance failure in <30s
- [ ] All requests traced end-to-end
