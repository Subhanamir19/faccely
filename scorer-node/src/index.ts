// scorer-node/src/index.ts
// Render-ready Express entry point with concurrency guard, CORS, and graceful shutdown.

import express from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import * as fs from "fs";
import sigmaRouter from "./routes/sigma.js";
import jobsRouter from "./routes/jobs.js";           // ← add this
import { historyRouter } from "./routes/history.js";
import { usersRouter } from "./routes/users.js";
import { idempotency } from "./middleware/idempotency.js";
import { verifyAuth } from "./middleware/auth.js";
import { bootQueues, queuesProbe } from "./queue/index.js";
import routineAsyncRouter from "./routes/routineAsync.js";
import { initMetrics } from "./observability/metrics.js";



import config, { PROVIDERS, ROUTINE, SERVER } from "./config/index.js";

console.log("[BOOT]", {
  env: config.NODE_ENV,
  service: config.SERVICE,
});

import { ZodError, type ZodIssue } from "zod";

import { generateRecommendations, RecommendationsParseError } from "./recommender.js";
import {
  ScoresSchema,
  ExplanationsSchemaV1,
  ExplanationsSchemaV2,
  RecommendationsRequestSchema, // ← you were missing this
 
  metricKeys,
  type MetricKey,
  type Scores,
  type ExplanationsV1,
  type ExplanationsV2,
} from "./validators.js";
import { scoreImageBytes, scoreImagePairBytes } from "./scorer.js";
import { explainImageBytes, explainImagePairBytes } from "./explainer.js";
import {
  router as routineRouter,
  setRoutineOpenAIClient,
} from "./routes/routine.js";
import protocolsRouter, { setProtocolsOpenAIClient } from "./routes/protocols.js";
import { programsRouter } from "./routes/programs.js";
import { createScan } from "./supabase/scans.js";
import { uploadScanImage } from "./supabase/storage.js";
import { createAnalysis } from "./supabase/analyses.js";
import { requestTimeout } from "./middleware/timeout.js";



/* -------------------------------------------------------------------------- */
/*   App core                                                                 */
/* -------------------------------------------------------------------------- */

const app = express();
app.set("trust proxy", 1); // we are behind Railway's proxy; needed for correct client IPs

// Mount metrics early; harmless order-wise
initMetrics(app, { enabled: true, path: "/metrics" }); // <-- ADD THIS

const openai = new OpenAI({
  apiKey: PROVIDERS.openai.apiKey,
  timeout: ROUTINE.llmTimeoutMs,
});

setRoutineOpenAIClient(openai);
setProtocolsOpenAIClient(openai);


// --- one-time schema sanity check (shows up in Railway logs) ---
try {
  // dist/index.js and dist/explainer.js live in the same folder at runtime
  const js = fs.readFileSync(new URL("./explainer.js", import.meta.url)).toString();
  const tupleNeedle = "items:" + "[";
  const hasTuple = js.includes(`${tupleNeedle}{`) || js.includes(`${tupleNeedle} {`);
  console.log("[SCHEMA_CHECK] dist/explainer.js tuple schema =", hasTuple ? "YES" : "NO");
} catch (e: any) {
  console.log("[SCHEMA_CHECK] could not read dist/explainer.js:", e?.message || e);
}


/* ---------------------------- Request logging ----------------------------- */
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} ct=${req.headers["content-type"] || ""}`
  );
  next();
});

/* ----------------------------- Security headers --------------------------- */
app.use(helmet());

/* ----------------------------- CORS normalize ----------------------------- */
function normalizeCorsOrigins(val: unknown): string | string[] | undefined {
  if (val == null) return undefined;
  if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
  const str = String(val).trim();
  if (!str) return undefined;
  if (str === "*") return "*";
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

const origins = normalizeCorsOrigins(SERVER.corsOrigins) ?? "*";
const corsOptions: CorsOptions = {
  origin: origins as any,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ------------------------------- JSON limit ------------------------------- */
app.use(express.json({ limit: "25mb" }));

/* ------------------------------ Rate limiting ------------------------------ */
app.use(rateLimit({
  windowMs: 60_000,
  limit: SERVER.rateLimitPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  // Safety valve if trust proxy is ever misconfigured:
  // validate: { xForwardedForHeader: false },
}));
/* ----------------------------- Request ID middleware ----------------------------- */
import { requestId } from "./middleware/requestId.js";
app.use(requestId());
app.use((req, res, next) => {
  res.on("finish", () => {
    console.log("[request]", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      requestId: res.locals.requestId,
      userId: res.locals.userId ?? null,
    });
  });
  next();
});

/* -------------------------- Multer memory storage -------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
      "application/octet-stream",
    ]);
    cb(null, ok.has(file.mimetype));
  },
});

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

async function toJpegBuffer(file: Express.Multer.File) {
  if (!file?.buffer?.length) {
    const err: any = new Error("empty_upload_buffer");
    err.status = 415;
    err.hint = "Use a JPEG or PNG image, not HEIC/HEIF or empty input.";
    throw err;
  }
  try {
    const out = await sharp(file.buffer).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return { buffer: out, mime: "image/jpeg" as const };
  } catch (e: any) {
    const msg = String(e?.message || e);
    const isHeif = /heif|heic|compression format has not been built/i.test(msg);
    if (isHeif) {
      const err: any = new Error("unsupported_image_codec_heic");
      err.status = 415;
      err.hint = "HEIC/HEIF not supported on server. Please upload JPEG or PNG.";
      throw err;
    }
    throw e;
  }
}


async function persistIdempotentResult(res: express.Response, body: unknown) {
  const store = res.locals?.idempotency;
  if (!store?.setCompleted) return;
  try {
    await store.setCompleted(body);
  } catch (err) {
    console.warn("[idempotency:setCompleted] failed", (err as Error)?.message || err);
  }
}

type ApiErrorOptions = {
  hint?: string;
  debugHint?: string;
  err?: any;
};

function apiError(code: string, message: string, opts?: ApiErrorOptions) {
  const payload: { errorCode: string; message: string; hint?: string; debugHint?: string } = {
    errorCode: code,
    message,
  };
  if (opts?.hint) payload.hint = opts.hint;
  const rawDebug =
    opts?.debugHint ||
    opts?.err?.response?.data?.error?.message ||
    opts?.err?.error?.message ||
    opts?.err?.message;
  if (rawDebug && !config.IS_PROD) {
    payload.debugHint = rawDebug;
  }
  return payload;
}

function getUpstreamStatus(err: any): number | null {
  const status = err?.status ?? err?.response?.status;
  return typeof status === "number" ? status : null;
}

function handleAnalyzeProviderErrors(res: express.Response, err: any): boolean {
  const upstreamStatus = getUpstreamStatus(err);
  const message = typeof err?.message === "string" ? err.message : "";

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    res
      .status(502)
      .json(
        apiError(
          "provider_auth_failed",
          "Scoring provider authentication failed. The service is misconfigured.",
          { err }
        )
      );
    return true;
  }

  if (upstreamStatus === 429) {
    res
      .status(503)
      .json(apiError("provider_rate_limited", "Scoring provider is rate-limited. Please try again later.", { err }));
    return true;
  }

  if (upstreamStatus !== null && upstreamStatus >= 500 && upstreamStatus <= 599) {
    res
      .status(503)
      .json(apiError("provider_unavailable", "Scoring provider is temporarily unavailable. Please try again later.", { err }));
    return true;
  }

  if (upstreamStatus === 415) {
    res
      .status(415)
      .json(
        apiError("unsupported_image_codec", "Image codec is not supported.", {
          hint: (err as any)?.hint,
          err,
        })
      );
    return true;
  }

  if (/unsupported or corrupted image/i.test(message) || /transcode failure/i.test(message)) {
    res
      .status(422)
      .json(
        apiError("invalid_image", "Unsupported or corrupted image. Please retry with a clearer JPEG or PNG photo.", {
          err,
        })
      );
    return true;
  }

  return false;
}

function preview(buf?: Buffer) {
  if (!buf) return "nil";
  const head = buf.slice(0, 12).toString("hex");
  return `${buf.length}B ${head}`;
}

// Coerce a V1 explanations object to V2 (pad to 4 lines)
function coerceV1toV2(v1: ExplanationsV1): ExplanationsV2 {
  const out: any = {};
  for (const k of Object.keys(v1)) {
    const arr = (v1 as any)[k] as string[];
    out[k] = [...arr, "", "", ""].slice(0, 4);
  }
  return out as ExplanationsV2;
}

class ScoresValidationError extends Error {
  body: { errorCode: string; message?: string; fields?: Array<{ path: string; message: string }> };
  constructor(body: ScoresValidationError["body"]) {
    super(body?.message ?? body.errorCode);
    this.body = body;
  }
}

class ExplanationProviderMalformedError extends Error {}

function parseScoresPayload(raw: string): Scores {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ScoresValidationError({
      errorCode: "invalid_scores_json",
      message: "scores must be valid JSON.",
    });
  }
  const result = ScoresSchema.safeParse(parsed);
  if (!result.success) {
    throw new ScoresValidationError({
      errorCode: "invalid_scores_payload",
      message: "scores payload failed validation.",
      fields: formatZodIssues(result.error.issues),
    });
  }
  return result.data;
}

function formatZodIssues(issues: ZodIssue[]): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.join(".") || issue.code,
    message: issue.message,
  }));
}

function parseExplanationPayload(notes: Record<MetricKey, string[]>): ExplanationsV2 {
  try {
    const parsed = ExplanationsSchemaV2.parse(notes);
    ensureExplanationCompleteness(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof ZodError) {
      const fallback = ExplanationsSchemaV1.safeParse(notes);
      if (fallback.success) {
        const coerced = ExplanationsSchemaV2.parse(coerceV1toV2(fallback.data));
        ensureExplanationCompleteness(coerced);
        return coerced;
      }
    }
    throw err;
  }
}

function ensureExplanationCompleteness(payload: ExplanationsV2) {
  for (const key of metricKeys) {
    const values = payload[key];
    const nonEmpty = values.filter((line) => typeof line === "string" && line.trim().length > 0);
    if (nonEmpty.length < 2) {
      throw new ExplanationProviderMalformedError(`metric ${key} missing content`);
    }
  }
}

type UploadField = { name: string; maxCount?: number };

function runSingleUpload(field: string, req: express.Request, res: express.Response) {
  return new Promise<void>((resolve, reject) => {
    upload.single(field)(req, res, (err: any) => (err ? reject(err) : resolve()));
  });
}

function runFieldUpload(fields: UploadField[], req: express.Request, res: express.Response) {
  return new Promise<void>((resolve, reject) => {
    upload.fields(fields)(req, res, (err: any) => (err ? reject(err) : resolve()));
  });
}

function isPayloadTooLargeError(err: any) {
  return err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
}

function isMulterError(err: any) {
  return err instanceof multer.MulterError;
}

function handleExplainKnownErrors(err: any, res: express.Response, label: string): boolean {
  if (err instanceof ScoresValidationError) {
    res.status(400).json(err.body);
    return true;
  }
  if (isPayloadTooLargeError(err)) {
    res.status(413).json({
      errorCode: "payload_too_large",
      message: "Image exceeds the maximum allowed size.",
    });
    return true;
  }
  if (err?.status === 415) {
    res.status(415).json({
      errorCode: "unsupported_media_type",
      message: "Use a JPEG or PNG image, not HEIC/HEIF or empty input.",
    });
    return true;
  }
  if (err instanceof ExplanationProviderMalformedError) {
    console.error(`[${label}] provider returned incomplete lines`);
    res.status(502).json({
      errorCode: "explanation_provider_malformed",
      message: "The explanation provider returned an invalid response shape.",
    });
    return true;
  }
  if (err instanceof ZodError) {
    console.error(`[${label}] provider payload failed schema`, err.issues);
    res.status(502).json({
      errorCode: "explanation_provider_malformed",
      message: "The explanation provider returned an invalid response shape.",
      issues: formatZodIssues(err.issues),
    });
    return true;
  }
  if (isMulterError(err)) {
    res.status(400).json({
      errorCode: "invalid_multipart_payload",
      message: "Invalid multipart payload.",
    });
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*   Concurrency guard                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Process-local guard; coordinate horizontal scaling via the job queue/config instead.
 * Limits are config-driven so behavior stays predictable under load.
 */
const MAX_CONCURRENT = config.SERVER.maxConcurrent;
const MAX_QUEUE_PENDING = config.SERVER.requestQueueMaxPending;
const QUEUE_MAX_WAIT_MS = config.SERVER.requestQueueMaxWaitMs;

// MAX_CONCURRENT bounds the number of simultaneous heavy jobs (scoring/explain).
let active = 0;
// FIFO of waiters to hand slots to once capacity frees up.
type Waiter = {
  resolve: (token: ConcurrencyToken) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
  enqueuedAt: number;
  cancelled: boolean;
};
const queue: Waiter[] = [];
// Each acquisition gets a token so we only release slots that were actually granted.
type ConcurrencyToken = { id: number; released: boolean };
let nextTokenId = 0;

function overloadedError(reason: "queue_full" | "timeout") {
  const err: any = new Error("server_overloaded");
  err.reason = reason;
  return err;
}

function grantSlot(): ConcurrencyToken {
  active += 1;
  return { id: ++nextTokenId, released: false };
}

function pruneQueue() {
  let i = 0;
  while (i < queue.length) {
    if (queue[i].cancelled) {
      const expired = queue.splice(i, 1)[0];
      clearTimeout(expired.timeout);
      continue;
    }
    i += 1;
  }
}

function enqueue(): Promise<ConcurrencyToken> {
  pruneQueue();
  return new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENT) {
      resolve(grantSlot());
      return;
    }
    if (queue.length >= MAX_QUEUE_PENDING) {
      reject(overloadedError("queue_full"));
      return;
    }
    const waiter: Waiter = {
      resolve,
      reject,
      enqueuedAt: Date.now(),
      cancelled: false,
      timeout: setTimeout(() => {
        waiter.cancelled = true;
        pruneQueue();
        reject(overloadedError("timeout"));
      }, QUEUE_MAX_WAIT_MS),
    };
    queue.push(waiter);
  });
}

function release(token?: ConcurrencyToken | null) {
  if (!token || token.released) return;
  token.released = true;
  active = Math.max(0, active - 1);
  pruneQueue();
  while (queue.length) {
    const next = queue.shift()!;
    clearTimeout(next.timeout);
    if (next.cancelled) continue;
    next.resolve(grantSlot());
    break;
  }
  if (active / MAX_CONCURRENT > 0.8) {
    console.warn(`[load] active=${active}/${MAX_CONCURRENT} nearing capacity`);
  }
}

function isServerOverloaded(err: any): boolean {
  return err?.message === "server_overloaded";
}

function respondServerOverloaded(res: express.Response) {
  return res.status(503).json(apiError("server_overloaded", "Server is busy, try again later."));
}

/* -------------------------------------------------------------------------- */
/*   Routes                                                                   */
/* -------------------------------------------------------------------------- */

// Idempotency is currently scoped to routine/protocols/recommendations flows only; scoring (/analyze*) and
// job status endpoints intentionally bypass it in v1.
// Programs endpoint does NOT use idempotency - program generation is naturally idempotent (same scores → same program)
// and cached error responses were causing issues.
app.use("/routine", requestTimeout(30_000), verifyAuth, idempotency(), routineRouter);
app.use("/protocols", requestTimeout(30_000), verifyAuth, idempotency(), protocolsRouter);
app.use("/programs", requestTimeout(30_000), verifyAuth, programsRouter);
app.use("/routine/async", verifyAuth, routineAsyncRouter);

app.use("/sigma", requestTimeout(30_000), verifyAuth, sigmaRouter);
app.use("/jobs", verifyAuth, jobsRouter);                    // ← add this line

app.get("/health", (_req, res) => res.json({ ok: true }));


// Queue health probe (enabled only when REDIS_URL is set)
app.get("/queues/health", async (_req, res) => {
  const probe = await queuesProbe();
  res.json(probe);
});

/* --------------------------- Identity context ---------------------------- */
app.use(["/analyze", "/analyze/*", "/explain", "/explain/*"], requestTimeout(30_000), verifyAuth);
app.use("/history", verifyAuth, historyRouter);
app.use("/users", verifyAuth, usersRouter);


/* ---------------------- /analyze/pair-bytes (fallback) -------------------- */
app.post("/analyze/pair-bytes", async (req, res) => {
  const t0 = Date.now();
  const userId = res.locals.userId;
  if (!userId) {
    console.error("analyze/explain missing userId", {
      route: "/analyze/pair-bytes",
      requestId: res.locals.requestId,
    });
    return res.status(401).json({ error: "missing_user_id" });
  }
  let slot: ConcurrencyToken | null = null;
  try {
    slot = await enqueue();
    const { front, side } = (req.body || {}) as { front?: string; side?: string };
    if (typeof front !== "string" || typeof side !== "string") {
      return res.status(400).json(
        apiError("missing_pair_images", "Fields 'front' and 'side' must be data URLs.", {
          hint: "Send both images as data:image/jpeg;base64,... strings.",
        })
      );
    }

    const fB64 = front.replace(/^data:image\/\w+;base64,/, "");
    const sB64 = side.replace(/^data:image\/\w+;base64,/, "");
    const fBuf = Buffer.from(fB64, "base64");
    const sBuf = Buffer.from(sB64, "base64");

    const { scores, modelVersion } = await scoreImagePairBytes(
      openai,
      fBuf,
      "image/jpeg",
      sBuf,
      "image/jpeg"
    );
    const parsed = ScoresSchema.parse(scores);

    let scanId: string | undefined;
    if (userId) {
      try {
        const frontKey = await uploadScanImage({
          userId,
          variant: "front",
          buffer: fBuf,
          contentType: "image/jpeg",
          requestId: res.locals.requestId,
        });
        const sideKey = await uploadScanImage({
          userId,
          variant: "side",
          buffer: sBuf,
          contentType: "image/jpeg",
          requestId: res.locals.requestId,
        });
        const scan = await createScan({
          userId,
          modelVersion,
          frontImagePath: frontKey,
          sideImagePath: sideKey,
          scores: parsed,
        });
        scanId = scan?.id;
      } catch (err) {
        console.error("analyze persist failed", {
          route: "/analyze/pair-bytes",
          userId,
          requestId: res.locals.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
        return res.status(502).json({ error: "scan_persist_failed" });
      }
    }

    if (scanId) return res.json({ ...parsed, scanId });
    res.json(parsed);
  } catch (err: any) {
    if (isServerOverloaded(err)) return respondServerOverloaded(res);
    console.error("[/analyze/pair-bytes] error:", err?.response?.data ?? err);
    if (err instanceof ZodError)
      return res.status(422).json({
        ...apiError(
          "invalid_scores_shape",
          "Scoring provider returned data that did not match the Scores schema.",
          { err }
        ),
          issues: err.issues,
        });
    if (handleAnalyzeProviderErrors(res, err)) return;
    res
      .status(500)
      .json(apiError("pair_bytes_failed", "Pair analysis failed. Please retry with a clearer photo.", { err }));
  } finally {
    if (slot) release(slot);
    console.log("[/analyze/pair-bytes] ms =", Date.now() - t0);
  }
});

/* --------------------------- /analyze (single) ---------------------------- */
app.post("/analyze", upload.single("image"), async (req, res) => {
  const t0 = Date.now();
  const userId = res.locals.userId;
  if (!userId) {
    console.error("analyze/explain missing userId", {
      route: "/analyze",
      requestId: res.locals.requestId,
    });
    return res.status(401).json({ error: "missing_user_id" });
  }
  let slot: ConcurrencyToken | null = null;
  try {
    slot = await enqueue();
    if (!req.file)
      return res
        .status(400)
        .json(
          apiError("missing_image", "Image field 'image' is required.", {
            hint: "Ensure the multipart field is named 'image'.",
          })
        );
    if (!req.file.buffer?.length)
      return res.status(400).json(
        apiError("empty_file_buffer", "Uploaded file contained no data.", {
          hint: "Do not set Content-Type manually when sending FormData.",
        })
      );

    console.log("[/analyze] buffer:", preview(req.file.buffer));
    const { scores, modelVersion } = await scoreImageBytes(openai, req.file.buffer, req.file.mimetype);
    const parsed = ScoresSchema.parse(scores);

    let scanId: string | undefined;
    if (userId) {
      try {
        const frontKey = await uploadScanImage({
          userId,
          variant: "front",
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
          requestId: res.locals.requestId,
        });
        const scan = await createScan({
          userId,
          modelVersion,
          frontImagePath: frontKey,
          sideImagePath: undefined,
          scores: parsed,
        });
        scanId = scan?.id;
      } catch (err) {
        console.error("analyze persist failed", {
          route: "/analyze",
          userId,
          requestId: res.locals.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
        return res.status(502).json({ error: "scan_persist_failed" });
      }
    }

    if (scanId) return res.json({ ...parsed, scanId });
    return res.json(parsed);
  } catch (err: any) {
    if (isServerOverloaded(err)) return respondServerOverloaded(res);
    console.error("[/analyze] error:", err?.response?.data ?? err);
    if (err instanceof ZodError)
      return res.status(422).json({
        ...apiError(
          "invalid_scores_shape",
          "Scoring provider returned data that did not match the Scores schema.",
          { err }
        ),
        issues: err.issues,
      });
    if ((err as any).status === 415) {
      return res
        .status(415)
        .json(
          apiError("unsupported_image_codec", "Image codec is not supported.", {
            hint: (err as any).hint,
            err,
          })
        );
    }
    if (handleAnalyzeProviderErrors(res, err)) return;
    res
      .status(500)
      .json(apiError("analysis_failed", "Analysis failed. Please retry with a clearer photo.", { err }));
    return;
  } finally {
    if (slot) release(slot);
    console.log("[/analyze] ms =", Date.now() - t0);
  }
});

/* --------------------------- /analyze/pair -------------------------------- */
app.post(
  "/analyze/pair",
  upload.fields([

    { name: "frontal", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    const t0 = Date.now();
    const userId = res.locals.userId;
    if (!userId) {
      console.error("analyze/explain missing userId", {
        route: "/analyze/pair",
        requestId: res.locals.requestId,
      });
      return res.status(401).json({ error: "missing_user_id" });
    }
    let slot: ConcurrencyToken | null = null;
    try {
      slot = await enqueue();
      const files = req.files as Record<string, Express.Multer.File[]>;
      const frontal = files?.frontal?.[0];
      const side = files?.side?.[0];
      if (!frontal || !side)
        return res.status(400).json(
          apiError("missing_pair_images", "Fields 'frontal' and 'side' are required.", {
            hint: "Send both frontal and side files in the multipart payload.",
          })
        );

      console.log("[/analyze/pair] buffers:", preview(frontal.buffer), preview(side.buffer));
      const { scores, modelVersion } = await scoreImagePairBytes(
        openai,
        frontal.buffer,
        frontal.mimetype,
        side.buffer,
        side.mimetype
      );
      const parsed = ScoresSchema.parse(scores);

      let scanId: string | undefined;
      if (res.locals.userId) {
        try {
          const frontKey = await uploadScanImage({
            userId,
            variant: "front",
            buffer: frontal.buffer,
            contentType: frontal.mimetype,
            requestId: res.locals.requestId,
          });
          const sideKey = await uploadScanImage({
            userId,
            variant: "side",
            buffer: side.buffer,
            contentType: side.mimetype,
            requestId: res.locals.requestId,
          });
          const scan = await createScan({
            userId,
            modelVersion,
            frontImagePath: frontKey,
            sideImagePath: sideKey,
            scores: parsed,
          });
          scanId = scan?.id;
        } catch (err) {
          console.error("analyze persist failed", {
            route: "/analyze/pair",
            userId,
            requestId: res.locals.requestId,
            error: err instanceof Error ? err.message : String(err),
          });
          return res.status(502).json({ error: "scan_persist_failed" });
        }
      }

      if (scanId) return res.json({ ...parsed, scanId });
      return res.json(parsed);
    } catch (err: any) {
      if (isServerOverloaded(err)) return respondServerOverloaded(res);
      console.error("[/analyze/pair] error:", err?.response?.data ?? err);
      if (err instanceof ZodError)
        return res.status(422).json({
          ...apiError(
            "invalid_scores_shape",
            "Scoring provider returned data that did not match the Scores schema.",
            { err }
          ),
          issues: err.issues,
        });
      if (handleAnalyzeProviderErrors(res, err)) return;
      res
        .status(500)
        .json(apiError("analysis_failed", "Analysis failed. Please retry with a clearer photo.", { err }));
      return;
    } finally {
      if (slot) release(slot);
      console.log("[/analyze/pair] ms =", Date.now() - t0);
    }
  }
);

/* ---------------------- /analyze/explain & /pair --------------------------- */
app.post("/analyze/explain", async (req, res) => {
  const t0 = Date.now();
  const userId = res.locals.userId;
  if (!userId) {
    console.error("analyze/explain missing userId", {
      route: "/analyze/explain",
      requestId: res.locals.requestId,
    });
    return res.status(401).json({ error: "missing_user_id" });
  }
  let slot: ConcurrencyToken | null = null;
  try {
    await runSingleUpload("image", req, res);
    const file = req.file;
    if (!file)
      return res.status(400).json(
        apiError("missing_image", "Image field 'image' is required.", {
          hint: "Ensure the multipart field is named 'image'.",
        })
      );
    const scoresRaw = req.body?.scores;
    if (typeof scoresRaw !== "string" || !scoresRaw.trim())
      return res.status(400).json(
        apiError("missing_scores", "Field 'scores' is required.", {
          hint: "Include the JSON-encoded scores blob in the 'scores' form field.",
        })
      );
    const scores = parseScoresPayload(scoresRaw);
    slot = await enqueue();
    const { buffer, mime } = await toJpegBuffer(file);
    const notes = await explainImageBytes(openai, buffer, mime, scores);
    const parsed = parseExplanationPayload(notes);
    const scanId = typeof req.body?.scanId === "string" ? req.body.scanId.trim() : "";
    if (scanId) {
      try {
        await createAnalysis({ scanId, explanations: parsed });
      } catch (err) {
        console.error("analysis persist failed", {
          route: "/analyze/explain",
          userId,
          requestId: res.locals.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
        return res.status(502).json({ error: "analysis_persist_failed" });
      }
    }
    return res.json(parsed);
  } catch (err: any) {
    if (isServerOverloaded(err)) return respondServerOverloaded(res);
    if (handleExplainKnownErrors(err, res, "/analyze/explain")) return;
    console.error("[/analyze/explain] error:", err?.response?.data ?? err);
    res.status(500).json({
      errorCode: "explanation_failed",
      message: "Failed to generate explanations.",
    });
    return;
  } finally {
    if (slot) release(slot);
    console.log("[/analyze/explain] ms =", Date.now() - t0);
  }
});

app.post("/analyze/explain/pair", async (req, res) => {
  const t0 = Date.now();
  const userId = res.locals.userId;
  if (!userId) {
    console.error("analyze/explain missing userId", {
      route: "/analyze/explain/pair",
      requestId: res.locals.requestId,
    });
    return res.status(401).json({ error: "missing_user_id" });
  }
  let slot: ConcurrencyToken | null = null;
  try {
    await runFieldUpload(
      [
        { name: "frontal", maxCount: 1 },
        { name: "side", maxCount: 1 },
      ],
      req,
      res
    );
    const files = req.files as Record<string, Express.Multer.File[]>;
    const frontal = files?.frontal?.[0];
    const side = files?.side?.[0];
    if (!frontal || !side)
      return res.status(400).json(
        apiError("missing_pair_images", "Fields 'frontal' and 'side' are required.", {
          hint: "Send both frontal and side files in the multipart payload.",
        })
      );

    const scoresRaw = req.body?.scores;
    if (typeof scoresRaw !== "string" || !scoresRaw.trim())
      return res.status(400).json(
        apiError("missing_scores", "Field 'scores' is required.", {
          hint: "Include the JSON-encoded scores blob in the 'scores' form field.",
        })
      );
    const scores = parseScoresPayload(scoresRaw);
    slot = await enqueue();
    const fJ = await toJpegBuffer(frontal);
    const sJ = await toJpegBuffer(side);
    const notes = await explainImagePairBytes(
      openai,
      fJ.buffer,
      fJ.mime,
      sJ.buffer,
      sJ.mime,
      scores
    );
    const parsed = parseExplanationPayload(notes);
    const scanId = typeof req.body?.scanId === "string" ? req.body.scanId.trim() : "";
    if (scanId) {
      try {
        await createAnalysis({ scanId, explanations: parsed });
      } catch (err) {
        console.error("analysis persist failed", {
          route: "/analyze/explain/pair",
          userId,
          requestId: res.locals.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
        return res.status(502).json({ error: "analysis_persist_failed" });
      }
    }
    return res.json(parsed);
  } catch (err: any) {
    if (isServerOverloaded(err)) return respondServerOverloaded(res);
    if (handleExplainKnownErrors(err, res, "/analyze/explain/pair")) return;
    console.error("[/analyze/explain/pair] error:", err?.response?.data ?? err);
    res.status(500).json({
      errorCode: "explanation_failed",
      message: "Failed to generate explanations.",
    });
    return;
  } finally {
    if (slot) release(slot);
    console.log("[/analyze/explain/pair] ms =", Date.now() - t0);
  }
});

/* ---------------------------- /recommendations ---------------------------- */
app.post("/recommendations", upload.none(), idempotency(), async (req, res) => {

  const parsedReq = RecommendationsRequestSchema.safeParse(req.body);
  if (!parsedReq.success)
    return res.status(400).json({
      error: "invalid_recommendations_payload",
      issues: parsedReq.error.issues?.map((i: ZodIssue) => ({
        //             ^^^^^^^^^^^^^ add type so TS stops whining
        path: i.path,
        code: i.code,
        message: i.message,
      })),
    });

  const t0 = Date.now();
  let slot: ConcurrencyToken | null = null;
  try {
    slot = await enqueue();
    const data = await generateRecommendations(parsedReq.data);
    await persistIdempotentResult(res, data);
    return res.json(data);
  } catch (err: any) {
    if (isServerOverloaded(err)) return respondServerOverloaded(res);
    if (err instanceof RecommendationsParseError) {
      console.error("[/recommendations] invalid completion:", err.rawPreview);
      return res.status(502).json({ error: "recommendations_generation_failed", detail: err.message });
    }
    if (err instanceof ZodError) {
      console.error("[/recommendations] invalid completion shape:", err.issues);
      return res.status(502).json({
        error: "recommendations_shape_invalid",
        detail: "Recommendations generation failed: upstream response had an unexpected shape.",
        issues: err.issues?.map((i: ZodIssue) => ({
          path: i.path,
          code: i.code,
          message: i.message,
        })),
      });
    }
    console.error("[/recommendations] error:", err?.response?.data ?? err);
    res
      .status(500)
      .json(
        apiError(
          "recommendations_failed",
          "Recommendations generation failed. Please retry with the same scores.",
          { err }
        )
      );
  } finally {
    if (slot) release(slot);
    console.log("[/recommendations] ms =", Date.now() - t0);
  }
});

/* -------------------------------------------------------------------------- */
/*   Server bind + graceful shutdown                                          */
/* -------------------------------------------------------------------------- */

// Boot BullMQ workers if REDIS_URL is set; no-op otherwise
void bootQueues();

const server = app.listen(SERVER.port, "0.0.0.0", () => {
  console.log(`Scorer listening on 0.0.0.0:${SERVER.port} (MAX_CONCURRENT=${MAX_CONCURRENT})`);
});


process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    console.log("Server closed cleanly.");
    process.exit(0);
  });
});
