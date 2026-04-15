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
const Line    = z.string().max(400).default("");
const Score   = z.number().min(0).max(100).default(50);
// Verdict: 1-3 word label from the backend; empty string triggers client-side
// score-tier fallback so the pill always shows something meaningful.
const Verdict = z.string().max(30).default("");

const AdvancedAnalysisSchema = z.object({
  cheekbones: z.object({
    width: Line,          width_score: Score,          width_verdict: Verdict,
    maxilla: Line,        maxilla_score: Score,        maxilla_verdict: Verdict,
    bone_structure: Line, bone_structure_score: Score, bone_structure_verdict: Verdict,
    face_fat: Line,       face_fat_score: Score,       face_fat_verdict: Verdict,
    // fwhr — always present (frontal estimate); defaults guard old cached responses.
    fwhr: Line,           fwhr_score: Score,           fwhr_verdict: Verdict,
  }),
  jawline: z.object({
    development: Line,  development_score: Score,  development_verdict: Verdict,
    gonial_angle: Line, gonial_angle_score: Score, gonial_angle_verdict: Verdict,
    projection: Line,   projection_score: Score,   projection_verdict: Verdict,
    // ramus — "" + 50 + "" when no side image was provided; frontend suppresses those rows.
    ramus: Line,        ramus_score: Score,        ramus_verdict: Verdict,
  }),
  eyes: z.object({
    canthal_tilt: Line, canthal_tilt_score: Score, canthal_tilt_verdict: Verdict,
    eye_type: Line,     eye_type_score: Score,     eye_type_verdict: Verdict,
    brow_volume: Line,  brow_volume_score: Score,  brow_volume_verdict: Verdict,
    symmetry: Line,     symmetry_score: Score,     symmetry_verdict: Verdict,
  }),
  skin: z.object({
    color: Line,   color_score: Score,   color_verdict: Verdict,
    quality: Line, quality_score: Score, quality_verdict: Verdict,
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
 * Sends the frontal image (required) + optional side image + existing scores.
 * Ramus assessment is only possible when sideImage is provided.
 */
export async function fetchAdvancedAnalysis(
  image: UploadInput,
  scores: Scores,
  scanId?: string | null,
  sideImage?: UploadInput | null,
  signal?: AbortSignal
): Promise<AdvancedAnalysis> {
  const fd = new FormData();
  const imagePart = await prepareUploadPart(image, "image.jpg");
  fd.append("image", imagePart as any);

  // Side image is optional — single-scan users won't have it.
  if (sideImage) {
    try {
      const sidePart = await prepareUploadPart(sideImage, "side.jpg");
      fd.append("side_image", sidePart as any);
    } catch (e) {
      // Non-fatal: if side image fails to prepare, proceed without it.
      logger.warn("[advancedAnalysis] side image preparation failed — proceeding without ramus:", e);
    }
  }

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
