// lib/api/advancedAnalysis.ts
// POST /analyze/advanced-explain — returns one-liner commentary for each
// sub-metric across 4 groups: cheekbones, jawline, eyes, skin.

import { z } from "zod";
import { API_BASE } from "./config";
import {
  ApiResponseError,
  buildApiError,
  fetchWithRetry,
} from "./client";
import type { Scores } from "./scores";
import { prepareUploadPart, type UploadInput } from "./media";
import { buildAuthHeadersAsync } from "./authHeaders";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// Allow empty strings — UI shows shimmer for "" instead of crashing the parse
const Line  = z.string().max(400).default("");
const Score = z.number().min(0).max(100).default(50);

const AdvancedAnalysisSchema = z.object({
  cheekbones: z.object({
    width: Line,          width_score: Score,
    maxilla: Line,        maxilla_score: Score,
    bone_structure: Line, bone_structure_score: Score,
    face_fat: Line,       face_fat_score: Score,
  }),
  jawline: z.object({
    development: Line,  development_score: Score,
    gonial_angle: Line, gonial_angle_score: Score,
    projection: Line,   projection_score: Score,
  }),
  eyes: z.object({
    canthal_tilt: Line, canthal_tilt_score: Score,
    eye_type: Line,     eye_type_score: Score,
    brow_volume: Line,  brow_volume_score: Score,
    symmetry: Line,     symmetry_score: Score,
  }),
  skin: z.object({
    color: Line,   color_score: Score,
    quality: Line, quality_score: Score,
  }),
});

export type AdvancedAnalysis = z.infer<typeof AdvancedAnalysisSchema>;

// ---------------------------------------------------------------------------
// Internal parser
// ---------------------------------------------------------------------------

async function parseResponse(res: Response): Promise<AdvancedAnalysis> {
  if (!res.ok) throw await buildApiError(res, "Advanced analysis failed");
  const raw = await res.json();
  try {
    return AdvancedAnalysisSchema.parse(raw);
  } catch (err) {
    const detail = err instanceof z.ZodError ? err.message : String(err);
    logger.warn("[advancedAnalysis] invalid payload", detail, raw);
    throw new ApiResponseError(
      res.status,
      `Advanced analysis: invalid_payload — ${detail}`,
      raw
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * POST /analyze/advanced-explain
 * Sends the frontal image + existing scores; returns per-sub-metric commentary.
 */
export async function fetchAdvancedAnalysis(
  image: UploadInput,
  scores: Scores,
  scanId?: string | null,
  signal?: AbortSignal
): Promise<AdvancedAnalysis> {
  const fd = new FormData();
  const imagePart = await prepareUploadPart(image, "image.jpg");
  fd.append("image", imagePart as any);
  fd.append("scores", JSON.stringify(scores));
  if (scanId) fd.append("scanId", scanId);

  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });

  const res = await fetchWithRetry(
    `${API_BASE}/analyze/advanced-explain`,
    {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders },
      body: fd,
      signal,
      timeoutMs: 30_000,
    },
    2,
    800
  );

  return parseResponse(res);
}
