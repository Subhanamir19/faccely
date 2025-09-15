import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import OpenAI from "openai";

import { ENV } from "./env";
import { ScoresSchema, ExplanationsSchema } from "./validators";
import { scoreImageBytes } from "./scorer";
import { explainImageBytes } from "./explainer";

const app = express();
app.use(helmet());
app.use(cors({ origin: ENV.CORS_ORIGINS }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, max: ENV.RATE_LIMIT_PER_MIN }));

const upload = multer({ limits: { fileSize: 3 * 1024 * 1024 } }); // 3MB cap

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });
    const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
    const scores = await scoreImageBytes(
      client,
      req.file.buffer,
      req.file.mimetype || "image/jpeg"
    );
    const parsed = ScoresSchema.parse(scores);
    res.json(parsed);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || "internal_error" });
  }
});

/** NEW: explanations route */
app.post("/analyze/explain", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file 'image' required" });

    // scores come as multipart field "scores" (string); validate as numbers 0–100
    const scoresRaw = req.body?.scores;
    if (!scoresRaw) return res.status(400).json({ error: "field 'scores' required" });

    let scoresJson: unknown;
    try {
      scoresJson = JSON.parse(scoresRaw);
    } catch {
      return res.status(400).json({ error: "scores must be valid JSON" });
    }
    const scores = ScoresSchema.parse(scoresJson);

    const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
    const notes = await explainImageBytes(
      client,
      req.file.buffer,
      req.file.mimetype || "image/jpeg",
      scores
    );

    // validate the shape: string[2] per metric
    const parsed = ExplanationsSchema.parse(notes);
    res.json(parsed);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || "internal_error" });
  }
});

app.listen(ENV.PORT, () => {
  console.log(`Scorer listening on :${ENV.PORT}`);
});
