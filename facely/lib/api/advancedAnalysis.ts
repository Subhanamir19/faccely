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

const HaircutSchema = z.object({
  density: Line,     density_score: Score,     density_verdict: Verdict,
  styling: Line,     styling_score: Score,     styling_verdict: Verdict,
  facial_hair: Line, facial_hair_score: Score, facial_hair_verdict: Verdict,
}).default({
  density: "", density_score: 50, density_verdict: "",
  styling: "", styling_score: 50, styling_verdict: "",
  facial_hair: "", facial_hair_score: 50, facial_hair_verdict: "",
});

const HAIRCUT_DEFAULT = HaircutSchema.parse(undefined);

function pickFirst(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function normalizeHaircutPayload(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;

  const root = input as Record<string, unknown>;
  const source =
    root.haircut ??
    root.hair ??
    root.hair_metrics ??
    root.haircut_metrics ??
    root.hair_related;

  if (!source || typeof source !== "object") return input;

  const hair = source as Record<string, unknown>;
  return {
    ...root,
    haircut: {
      density: pickFirst(hair, ["density", "hair_density", "hairline_density"]) ?? HAIRCUT_DEFAULT.density,
      density_score: pickFirst(hair, ["density_score", "hair_density_score", "hairline_density_score"]) ?? HAIRCUT_DEFAULT.density_score,
      density_verdict: pickFirst(hair, ["density_verdict", "hair_density_verdict", "hairline_density_verdict"]) ?? HAIRCUT_DEFAULT.density_verdict,
      styling: pickFirst(hair, ["styling", "hair_styling", "style", "hair_style", "hairstyle"]) ?? HAIRCUT_DEFAULT.styling,
      styling_score: pickFirst(hair, ["styling_score", "hair_styling_score", "style_score", "hair_style_score", "hairstyle_score"]) ?? HAIRCUT_DEFAULT.styling_score,
      styling_verdict: pickFirst(hair, ["styling_verdict", "hair_styling_verdict", "style_verdict", "hair_style_verdict", "hairstyle_verdict"]) ?? HAIRCUT_DEFAULT.styling_verdict,
      facial_hair: pickFirst(hair, ["facial_hair", "facialHair", "beard", "beard_grooming"]) ?? HAIRCUT_DEFAULT.facial_hair,
      facial_hair_score: pickFirst(hair, ["facial_hair_score", "facialHair_score", "facialHairScore", "beard_score", "beard_grooming_score"]) ?? HAIRCUT_DEFAULT.facial_hair_score,
      facial_hair_verdict: pickFirst(hair, ["facial_hair_verdict", "facialHair_verdict", "facialHairVerdict", "beard_verdict", "beard_grooming_verdict"]) ?? HAIRCUT_DEFAULT.facial_hair_verdict,
    },
  };
}

const AdvancedAnalysisSchema = z.preprocess(normalizeHaircutPayload, z.object({
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
  haircut: HaircutSchema,
}));

export type AdvancedAnalysis = z.infer<typeof AdvancedAnalysisSchema>;

const HAIRCUT_KEYS = ["density", "styling", "facial_hair"] as const;

export function hasAssessedHaircut(data: AdvancedAnalysis | null | undefined): boolean {
  const haircut = data?.haircut as Record<string, unknown> | null | undefined;
  if (!haircut) return false;

  return HAIRCUT_KEYS.some((key) => {
    const score = haircut[`${key}_score`];
    const commentary = haircut[key];
    const verdict = haircut[`${key}_verdict`];

    return (
      typeof score === "number" &&
      (
        score !== 50 ||
        (typeof commentary === "string" && commentary.trim().length > 0) ||
        (typeof verdict === "string" && verdict.trim().length > 0)
      )
    );
  });
}

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
      timeoutMs: 60_000,
    },
    2,
    800
  );

  return parseResponse(res);
}
