// facely/lib/api/analysis.ts
import { z } from "zod";
import { API_BASE } from "./config";
import {
  ApiResponseError,
  LONG_REQUEST_TIMEOUT_MS,
  buildApiError,
  fetchWithRetry,
} from "./client";
import type { Scores } from "./scores";
import { prepareUploadPart, type UploadInput } from "./media";
import { buildAuthHeadersAsync } from "./authHeaders";
import { logger } from '@/lib/logger';

export type Explanations = Record<string, string[]>;

const METRICS = [
  "eyes_symmetry",
  "jawline",
  "cheekbones",
  "nose_harmony",
  "facial_symmetry",
  "skin_quality",
  "sexual_dimorphism",
] as const;

type MetricKey = (typeof METRICS)[number];

const ExplanationLinesSchema = z.array(z.string()).length(4);
const ExplanationsPayloadSchema = z.object({
  eyes_symmetry: ExplanationLinesSchema,
  jawline: ExplanationLinesSchema,
  cheekbones: ExplanationLinesSchema,
  nose_harmony: ExplanationLinesSchema,
  facial_symmetry: ExplanationLinesSchema,
  skin_quality: ExplanationLinesSchema,
  sexual_dimorphism: ExplanationLinesSchema,
});

type ExplanationsPayload = z.infer<typeof ExplanationsPayloadSchema>;

/* ---------- helpers ---------- */

const MAX_SUBMETRIC_CHAR = 140;

function normalizeLine(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= MAX_SUBMETRIC_CHAR) return trimmed;
  const sliced = trimmed.slice(0, MAX_SUBMETRIC_CHAR).trimEnd();
  return `${sliced}...`;
}

function normalizeExplanations(raw: ExplanationsPayload): Explanations {
  const out: Record<string, string[]> = {};
  for (const metric of METRICS) {
    out[metric] = raw[metric].map((line) => normalizeLine(line));
  }
  return out;
}

async function parseExplanations(
  res: Response,
  context: string
): Promise<Explanations> {
  if (!res.ok) {
    throw await buildApiError(res, context);
  }

  const raw = await res.json();
  try {
    const parsed = ExplanationsPayloadSchema.parse(raw);
    return normalizeExplanations(parsed);
  } catch (err) {
    const detail = err instanceof z.ZodError ? err.message : String(err);
    logger.warn("[analysis] invalid payload", detail, raw);
    throw new ApiResponseError(res.status, `${context}: invalid_payload - ${detail}`, raw);
  }
}

/* ---------- public API ---------- */

/**
 * POST /analyze/explain for single image.
 * Sends multipart with the image and a small JSON scores blob so server can tailor notes.
 */
export async function explainMetrics(
  image: UploadInput,
  scores: Scores,
  scanId?: string | null,
  signal?: AbortSignal
): Promise<Explanations> {
  const fd = new FormData();
  const imagePart = await prepareUploadPart(image, "image.jpg");
  fd.append("image", imagePart as any);
  fd.append("scores", JSON.stringify(scores));
  if (scanId) fd.append("scanId", scanId);
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
  const res = await fetchWithRetry(
    `${API_BASE}/analyze/explain`,
    {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders },
      body: fd,
      signal,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    },
    3,
    1200
  );
  return parseExplanations(res, "Explanation request failed");
}

/**
 * POST /analyze/explain/pair for frontal + side pair.
 */
export async function explainMetricsPair(
  frontal: UploadInput,
  side: UploadInput,
  scores: Scores,
  scanId?: string | null,
  signal?: AbortSignal
): Promise<Explanations> {
  const buildFormData = async () => {
    const [frontalPart, sidePart] = await Promise.all([
      prepareUploadPart(frontal, "frontal.jpg"),
      prepareUploadPart(side, "side.jpg"),
    ]);
    const fd = new FormData();
    fd.append("frontal", frontalPart as any);
    fd.append("side", sidePart as any);
    fd.append("scores", JSON.stringify(scores));
    if (scanId) fd.append("scanId", scanId);
    return fd;
  };

  const attempt = async (path: string) => {
    const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
    const res = await fetchWithRetry(
      `${API_BASE}${path}`,
      {
        method: "POST",
        headers: { Accept: "application/json", ...authHeaders },
        body: await buildFormData(),
        signal,
        timeoutMs: LONG_REQUEST_TIMEOUT_MS,
      },
      3,
      1200
    );
    return parseExplanations(res, "Pair explanation request failed");
  };

  try {
    return await attempt("/analyze/explain/pair");
  } catch (err) {
    const shouldRetryLegacy =
      (err instanceof ApiResponseError && err.status === 404) ||
      (err instanceof TypeError && (err as any).message?.includes("Network request failed"));

    if (!shouldRetryLegacy) throw err;
    return await attempt("/analyze/pair/explain");
  }
}
