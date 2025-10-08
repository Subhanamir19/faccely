// scorer-node/src/index.ts
// Render-ready Express entry point with concurrency guard, CORS, and graceful shutdown.

import express from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import { ZodError, type ZodIssue } from "zod";

import { generateRecommendations, RecommendationsParseError } from "./recommender.js";
import { ENV } from "./env.js";
import {
  ScoresSchema,
  ExplanationsSchema,
  RecommendationsRequestSchema,
} from "./validators.js";
import { scoreImageBytes, scoreImagePairBytes } from "./scorer.js";
import { explainImageBytes, explainImagePairBytes } from "./explainer.js";

/* -------------------------------------------------------------------------- */
/*   App core                                                                 */
/* -------------------------------------------------------------------------- */

const app = express();
const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

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

const origins = normalizeCorsOrigins(ENV.CORS_ORIGINS) ?? "*";
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
app.use(rateLimit({ windowMs: 60_000, max: ENV.RATE_LIMIT_PER_MIN }));

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
  if (!file?.buffer?.length) throw new Error("empty_upload_buffer");
  const out = await sharp(file.buffer).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { buffer: out, mime: "image/jpeg" as const };
}

function errorPayload(err: any) {
  const openaiMsg =
    err?.response?.data?.error?.message || err?.error?.message || err?.message || "unknown_error";
  const status = err?.status || err?.response?.status;
  return { error: "upstream_failed", status, detail: openaiMsg };
}

function preview(buf?: Buffer) {
  if (!buf) return "nil";
  const head = buf.slice(0, 12).toString("hex");
  return `${buf.length}B ${head}`;
}

/* -------------------------------------------------------------------------- */
/*   Concurrency guard                                                        */
/* -------------------------------------------------------------------------- */

// Read from process.env to avoid typing changes in ENV.
const MAX_CONCURRENT: number = (() => {
  const raw = process.env.MAX_CONCURRENT;
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

let active = 0;
const queue: (() => void)[] = [];

function enqueue(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else if (queue.length < 100) {
      queue.push(resolve);
    } else {
      reject(new Error("server_overloaded"));
    }
  });
}

function release() {
  active = Math.max(0, active - 1);
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
  if (active / MAX_CONCURRENT > 0.8) {
    console.warn(`[load] active=${active}/${MAX_CONCURRENT} nearing capacity`);
  }
}

/* -------------------------------------------------------------------------- */
/*   Routes                                                                   */
/* -------------------------------------------------------------------------- */

app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------- /analyze/pair-bytes (fallback) -------------------- */
app.post("/analyze/pair-bytes", async (req, res) => {
  const t0 = Date.now();
  try {
    await enqueue();
    const { front, side } = (req.body || {}) as { front?: string; side?: string };
    if (typeof front !== "string" || typeof side !== "string") {
      return res.status(400).json({ error: "fields 'front' and 'side' required as data URLs" });
    }

    const fB64 = front.replace(/^data:image\/\w+;base64,/, "");
    const sB64 = side.replace(/^data:image\/\w+;base64,/, "");
    const fBuf = Buffer.from(fB64, "base64");
    const sBuf = Buffer.from(sB64, "base64");

    const scores = await scoreImagePairBytes(openai, fBuf, "image/jpeg", sBuf, "image/jpeg");
    const parsed = ScoresSchema.parse(scores);
    res.json(parsed);
  } catch (err: any) {
    if (err.message === "server_overloaded")
      return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
    console.error("[/analyze/pair-bytes] error:", err?.response?.data ?? err);
    if (err instanceof ZodError)
      return res.status(422).json({ error: "invalid_scores_shape", issues: err.issues });
    res.status(500).json({ error: "pair_bytes_failed", detail: err?.message || "unknown" });
  } finally {
    release();
    console.log("[/analyze/pair-bytes] ms =", Date.now() - t0);
  }
});

/* --------------------------- /analyze (single) ---------------------------- */
app.post("/analyze", upload.single("image"), async (req, res) => {
  const t0 = Date.now();
  try {
    await enqueue();
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });
    if (!req.file.buffer?.length)
      return res.status(400).json({
        error: "empty_file_buffer",
        hint: "Likely bad client FormData. Do NOT set Content-Type manually.",
      });

    console.log("[/analyze] buffer:", preview(req.file.buffer));
    const scores = await scoreImageBytes(openai, req.file.buffer, req.file.mimetype);
    const parsed = ScoresSchema.parse(scores);
    res.json(parsed);
  } catch (err: any) {
    if (err.message === "server_overloaded")
      return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
    console.error("[/analyze] error:", err?.response?.data ?? err);
    if (err instanceof ZodError)
      return res.status(422).json({ error: "invalid_scores_shape", issues: err.issues });
    res.status(500).json(errorPayload(err));
  } finally {
    release();
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
    try {
      await enqueue();
      const files = req.files as Record<string, Express.Multer.File[]>;
      const frontal = files?.frontal?.[0];
      const side = files?.side?.[0];
      if (!frontal || !side)
        return res.status(400).json({ error: "files 'frontal' and 'side' required" });

      console.log("[/analyze/pair] buffers:", preview(frontal.buffer), preview(side.buffer));
      const scores = await scoreImagePairBytes(
        openai,
        frontal.buffer,
        frontal.mimetype,
        side.buffer,
        side.mimetype
      );
      const parsed = ScoresSchema.parse(scores);
      res.json(parsed);
    } catch (err: any) {
      if (err.message === "server_overloaded")
        return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
      console.error("[/analyze/pair] error:", err?.response?.data ?? err);
      if (err instanceof ZodError)
        return res.status(422).json({ error: "invalid_scores_shape", issues: err.issues });
      res.status(500).json(errorPayload(err));
    } finally {
      release();
      console.log("[/analyze/pair] ms =", Date.now() - t0);
    }
  }
);

/* ---------------------- /analyze/explain & /pair --------------------------- */
app.post("/analyze/explain", upload.single("image"), async (req, res) => {
  const t0 = Date.now();
  try {
    await enqueue();
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });
    const scoresRaw = req.body?.scores;
    if (!scoresRaw) return res.status(400).json({ error: "field 'scores' required" });

    const scores = ScoresSchema.parse(JSON.parse(scoresRaw));
    const { buffer, mime } = await toJpegBuffer(req.file);
    const notes = await explainImageBytes(openai, buffer, mime, scores);
    const parsed = ExplanationsSchema.parse(notes);
    res.json(parsed);
  } catch (err: any) {
    if (err.message === "server_overloaded")
      return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
    console.error("[/analyze/explain] error:", err?.response?.data ?? err);
    if (err instanceof ZodError)
      return res.status(422).json({ error: "invalid_explanations_shape", issues: err.issues });
    res.status(500).json(errorPayload(err));
  } finally {
    release();
    console.log("[/analyze/explain] ms =", Date.now() - t0);
  }
});

app.post(
  "/analyze/explain/pair",
  upload.fields([
    { name: "frontal", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    const t0 = Date.now();
    try {
      await enqueue();
      const files = req.files as Record<string, Express.Multer.File[]>;
      const frontal = files?.frontal?.[0];
      const side = files?.side?.[0];
      if (!frontal || !side)
        return res.status(400).json({ error: "files 'frontal' and 'side' required" });

      const scores = ScoresSchema.parse(JSON.parse(req.body?.scores));
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
      const parsed = ExplanationsSchema.parse(notes);
      res.json(parsed);
    } catch (err: any) {
      if (err.message === "server_overloaded")
        return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
      console.error("[/analyze/explain/pair] error:", err?.response?.data ?? err);
      if (err instanceof ZodError)
        return res.status(422).json({ error: "invalid_explanations_shape", issues: err.issues });
      res.status(500).json(errorPayload(err));
    } finally {
      release();
      console.log("[/analyze/explain/pair] ms =", Date.now() - t0);
    }
  }
);

/* ---------------------------- /recommendations ---------------------------- */
app.post("/recommendations", upload.none(), async (req, res) => {
  const parsedReq = RecommendationsRequestSchema.safeParse(req.body);
  if (!parsedReq.success)
    return res.status(400).json({
      error: "invalid_recommendations_payload",
      issues: parsedReq.error.issues?.map((i) => ({
        path: i.path,
        code: i.code,
        message: i.message,
      })),
    });

  const t0 = Date.now();
  try {
    await enqueue();
    const data = await generateRecommendations(parsedReq.data);
    res.json(data);
  } catch (err: any) {
    if (err.message === "server_overloaded")
      return res.status(503).json({ error: "too_many_requests", hint: "retry later" });
    if (err instanceof RecommendationsParseError) {
      console.error("[/recommendations] invalid completion:", err.rawPreview);
      return res.status(502).json({ error: "recommendations_generation_failed", detail: err.message });
    }
    if (err instanceof ZodError) {
      console.error("[/recommendations] invalid completion shape:", err.issues);
      return res.status(502).json({
        error: "recommendations_shape_invalid",
        detail: "Routine generation failed: upstream response had an unexpected shape.",
        issues: err.issues?.map((i: ZodIssue) => ({
          path: i.path,
          code: i.code,
          message: i.message,
        })),
      });
    }
    console.error("[/recommendations] error:", err?.response?.data ?? err);
    res.status(500).json(errorPayload(err));
  } finally {
    release();
    console.log("[/recommendations] ms =", Date.now() - t0);
  }
});

/* -------------------------------------------------------------------------- */
/*   Server bind + graceful shutdown                                          */
/* -------------------------------------------------------------------------- */
const server = app.listen(ENV.PORT, "0.0.0.0", () => {
  console.log(`Scorer listening on 0.0.0.0:${ENV.PORT} (MAX_CONCURRENT=${MAX_CONCURRENT})`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    console.log("Server closed cleanly.");
    process.exit(0);
  });
});
