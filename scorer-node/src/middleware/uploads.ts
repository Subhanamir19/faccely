// src/middleware/uploads.ts
import multer from "multer";

/**
 * Multer in memory so we can transcode with sharp.
 * Enforces our two canonical field names: 'frontal' and 'side'.
 * Caps file size to keep OpenAI latency and bills sane.
 */
const storage = multer.memoryStorage();

export const uploadPair = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
    files: 2
  }
}).fields([
  { name: "frontal", maxCount: 1 },
  { name: "side", maxCount: 1 }
]);

/**
 * Use this for single-image endpoints that accept either 'image' or 'frontal'.
 * Helpful while you migrate clients.
 */
export const uploadSingle = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1
  }
}).fields([
  { name: "image", maxCount: 1 },
  { name: "frontal", maxCount: 1 }
]);
