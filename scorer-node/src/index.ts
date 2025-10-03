// C:\SS\scorer-node\src\index.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import { ZodError } from "zod";

import { generateRecommendations } from "./recommender";
import { ENV } from "./env";
import {
  ScoresSchema,
  ExplanationsSchema,
  RecommendationsRequestSchema,
} from "./validators";
import { scoreImageBytes, scoreImagePairBytes } from "./scorer";
import { explainImageBytes, explainImagePairBytes } from "./explainer";

const app = express();
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} ct=${req.headers["content-type"] || ""}`
  );
  next();
});

app.use(helmet());
app.use(cors({ origin: "*" }));

app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, max: ENV.RATE_LIMIT_PER_MIN }));

/**
 * Create a single OpenAI client and reuse it.
 * Avoids per-request setup and keeps connections warm.
 */
const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

/**
 * Multer in-memory storage so we can inspect/normalize before OpenAI.
 * Size cap is generous; scorer will downscale internally.
 * Accept common image types and the occasional "octet-stream" lie from RN.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB per file
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

/** -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */

async function toJpegBuffer(file: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new Error("empty_upload_buffer");
  }
  const out = await sharp(file.buffer).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { buffer: out, mime: "image/jpeg" as const };
}

function errorPayload(err: any) {
  const openaiMsg =
    err?.response?.data?.error?.message ||
    err?.error?.message ||
    err?.message ||
    "unknown_error";
  const status = err?.status || err?.response?.status;
  return { error: "upstream_failed", status, detail: openaiMsg };
}

/** Tiny buffer preview for debugging bad multipart bodies */
function preview(buf?: Buffer) {
  if (!buf) return "nil";
  const head = buf.slice(0, 12).toString("hex");
  return `${buf.length}B ${head}`;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Single-image analysis
 * NOTE: Pass raw bytes to scorer; scorer handles normalization to PNG.
 */
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });
    if (!req.file.buffer?.length) {
      return res.status(400).json({
        error: "empty_file_buffer",
        hint: "Likely bad client FormData. Do NOT set Content-Type manually.",
      });
    }

    console.log("[/analyze] buffer:", preview(req.file.buffer));

    const t0 = Date.now();
    const scores = await scoreImageBytes(openai, req.file.buffer, req.file.mimetype);
    console.log("[/analyze] total ms =", Date.now() - t0);

    const parsed = ScoresSchema.parse(scores);
    res.json(parsed);
  } catch (err: any) {
    console.error("[/analyze] error:", err?.response?.data ?? err);
    if (err instanceof ZodError) {
      return res.status(422).json({ error: "invalid_scores_shape", issues: err.issues });
    }
    res.status(500).json(errorPayload(err));
  }
});

/**
 * Two-image analysis
 * NOTE: Same: send raw buffers, let scorer normalize both.
 */
app.post(
  "/analyze/pair",
  upload.fields([
    { name: "frontal", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const frontal = files?.frontal?.[0];
      const side = files?.side?.[0];

      if (!frontal || !side) {
        return res.status(400).json({ error: "files 'frontal' and 'side' required" });
      }
      if (!frontal.buffer?.length || !side.buffer?.length) {
        return res.status(400).json({
          error: "empty_file_buffers",
          hint: "Likely bad client FormData. Do NOT set Content-Type manually. Send { uri, name, type } parts.",
        });
      }

      console.log("[/analyze/pair] buffers:", "frontal", preview(frontal.buffer), "side", preview(side.buffer));

      const t0 = Date.now();
      const scores = await scoreImagePairBytes(
        openai,
        frontal.buffer,
        frontal.mimetype,
        side.buffer,
        side.mimetype
      );
      console.log("[/analyze/pair] total ms =", Date.now() - t0);

      const parsed = ScoresSchema.parse(scores);
      res.json(parsed);
    } catch (err: any) {
      console.error("[/analyze/pair] error:", err?.response?.data ?? err);
      if (err instanceof ZodError) {
        return res.status(422).json({ error: "invalid_scores_shape", issues: err.issues });
      }
      res.status(500).json(errorPayload(err));
    }
  }
);

/**
 * Single-image explanations
 * Still using JPEG conversion until explainer is updated to normalize internally.
 */
app.post("/analyze/explain", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });

    const scoresRaw = req.body?.scores;
    if (!scoresRaw) return res.status(400).json({ error: "field 'scores' required" });

    let scoresJson: unknown;
    try {
      scoresJson = JSON.parse(scoresRaw);
    } catch {
      return res.status(400).json({ error: "scores must be valid JSON" });
    }
    const scores = ScoresSchema.parse(scoresJson);

    const { buffer, mime } = await toJpegBuffer(req.file);

    const t0 = Date.now();
    const notes = await explainImageBytes(openai, buffer, mime, scores);
    console.log("[/analyze/explain] total ms =", Date.now() - t0);

    const parsed = ExplanationsSchema.parse(notes);
    res.json(parsed);
  } catch (err: any) {
    console.error("[/analyze/explain] error:", err?.response?.data ?? err);
    if (err instanceof ZodError) {
      return res.status(422).json({ error: "invalid_explanations_shape", issues: err.issues });
    }
    res.status(500).json(errorPayload(err));
  }
});

/**
 * Pair explanations (frontal + side)
 * Still using JPEG conversion until explainer is updated to normalize internally.
 */
app.post(
  "/analyze/explain/pair",
  upload.fields([
    { name: "frontal", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const frontal = files?.frontal?.[0];
      const side = files?.side?.[0];
      if (!frontal || !side) {
        return res.status(400).json({ error: "files 'frontal' and 'side' required" });
      }

      const scoresRaw = req.body?.scores;
      if (!scoresRaw) return res.status(400).json({ error: "field 'scores' required" });

      let scoresJson: unknown;
      try {
        scoresJson = JSON.parse(scoresRaw);
      } catch {
        return res.status(400).json({ error: "scores must be valid JSON" });
      }
      const scores = ScoresSchema.parse(scoresJson);

      const fJ = await toJpegBuffer(frontal);
      const sJ = await toJpegBuffer(side);

      const t0 = Date.now();
      const notes = await explainImagePairBytes(
        openai,
        fJ.buffer,
        fJ.mime,
        sJ.buffer,
        sJ.mime,
        scores
      );
      console.log("[/analyze/explain/pair] total ms =", Date.now() - t0);

      const parsed = ExplanationsSchema.parse(notes);
      res.json(parsed);
    } catch (err: any) {
      console.error("[/analyze/explain/pair] error:", err?.response?.data ?? err);
      if (err instanceof ZodError) {
        return res.status(422).json({ error: "invalid_explanations_shape", issues: err.issues });
      }
      res.status(500).json(errorPayload(err));
    }
  }
);

/**
 * Recommendations (JSON-only)
 */
app.post("/recommendations", upload.none(), async (req, res) => {
  try {
    const payload = RecommendationsRequestSchema.parse(req.body);
    const data = await generateRecommendations(payload);
    res.json(data);
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "invalid_recommendations_payload",
        issues: err.issues?.map((i) => ({
          path: i.path,
          code: i.code,
          message: i.message,
        })),
      });
    }
    console.error("[/recommendations] error:", err?.response?.data ?? err);
    res.status(500).json(errorPayload(err));
  }
});

app.listen(ENV.PORT, () => {
  console.log(`Scorer listening on :${ENV.PORT}`);
});
