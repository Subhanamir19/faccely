// scorer-node/src/routes/generate.ts
// POST /generate/ten-by-ten — AI face enhancement using gpt-image-1.
// Receives a face photo (multipart), calls OpenAI images.edit, returns b64 result.

import express from "express";
import multer from "multer";
import os from "os";
import path from "path";
import * as fs from "fs";
import OpenAI, { toFile } from "openai";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*   OpenAI client injection                                                  */
/* -------------------------------------------------------------------------- */

let _openai: OpenAI | null = null;

export function setGenerateOpenAIClient(client: OpenAI) {
  _openai = client;
}

/* -------------------------------------------------------------------------- */
/*   Multer — disk storage for this router                                    */
/* -------------------------------------------------------------------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `gen-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = new Set(["image/jpeg", "image/png", "image/webp", "application/octet-stream"]);
    cb(null, ok.has(file.mimetype));
  },
});

/* -------------------------------------------------------------------------- */
/*   Prompt builder                                                           */
/* -------------------------------------------------------------------------- */

function buildPrompt(meta: { gender?: string; ethnicity?: string; age?: string }): string {
  const genderNote = meta.gender ? `${meta.gender} person` : "person";
  const ethnicityNote = meta.ethnicity ? `, ${meta.ethnicity} ethnicity` : "";
  const ageNote = meta.age ? `, approximately ${meta.age} years old` : "";

  return (
    `Enhance this ${genderNote}${ethnicityNote}${ageNote} to their ideal facial potential. ` +
    `Make the following improvements while strictly preserving their identity, skin tone, eye color, and hair: ` +
    `(1) sharpen and define the jawline and chin for a chiseled look, ` +
    `(2) create hunter eyes with a slight positive canthal tilt and well-defined orbital rims, ` +
    `(3) improve forward maxilla projection and cheekbone prominence, ` +
    `(4) clear, smooth, and perfect the skin texture and complexion. ` +
    `The result must be photorealistic, natural-looking, and clearly the same person — just their best version.`
  );
}

/* -------------------------------------------------------------------------- */
/*   POST /ten-by-ten                                                         */
/* -------------------------------------------------------------------------- */

router.post("/ten-by-ten", upload.single("image"), async (req, res) => {
  const t0 = Date.now();
  const userId = res.locals.userId;
  const file = req.file;

  if (!_openai) {
    return res.status(500).json({ error: "openai_not_initialized" });
  }
  if (!userId) {
    return res.status(401).json({ error: "missing_user_id" });
  }
  if (!file) {
    return res.status(400).json({
      error: "missing_image",
      hint: "Include the photo as a 'image' field in multipart/form-data.",
    });
  }

  try {
    const buffer = file.path
      ? await fs.promises.readFile(file.path)
      : file.buffer;

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "empty_image" });
    }

    const { gender, ethnicity, age } = req.body as Record<string, string>;
    const prompt = buildPrompt({ gender, ethnicity, age });

    console.log("[/generate/ten-by-ten] calling gpt-image-1, userId:", userId);

    const response = await _openai.images.edit({
      model: "gpt-image-1",
      image: await toFile(buffer, "face.jpg", { type: "image/jpeg" }),
      prompt,
      n: 1,
      size: "1024x1024",
    } as any); // cast: response_format not needed for gpt-image-1 (always returns b64)

    const b64 = response.data[0]?.b64_json;
    if (!b64) {
      console.error("[/generate/ten-by-ten] OpenAI returned no b64_json", response);
      return res.status(502).json({ error: "no_image_returned" });
    }

    return res.json({ b64 });
  } catch (err: any) {
    const upstreamStatus: number | null =
      typeof err?.status === "number" ? err.status :
      typeof err?.response?.status === "number" ? err.response.status : null;
    const message: string = err?.message ?? "Generation failed";

    console.error("[/generate/ten-by-ten] error:", message, "upstream:", upstreamStatus);

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return res.status(502).json({ error: "provider_auth_failed", message: "OpenAI auth failed." });
    }
    if (upstreamStatus === 429) {
      return res.status(503).json({ error: "provider_rate_limited", message: "OpenAI rate limited. Try again later." });
    }
    if (upstreamStatus === 400) {
      return res.status(422).json({ error: "invalid_image", message: "Image rejected. Try a clearer frontal photo." });
    }

    return res.status(500).json({ error: "generation_failed", message });
  } finally {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    console.log("[/generate/ten-by-ten] ms =", Date.now() - t0);
  }
});

export default router;
