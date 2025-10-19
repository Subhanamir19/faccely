// facely/lib/api/analysis.ts
import { API_BASE } from "./config";
import {
  ApiResponseError,
  LONG_REQUEST_TIMEOUT_MS,
  buildApiError,
  fetchWithRetry,

} from "./client";

import type { Scores } from "./scores";

/**
 * Backend returns per-metric notes. Shape can vary (string | string[]).
 * We normalize to string[4] per metric in this module so UI stays stable.
 *
 * Example raw:
 * {
 *   jawline: ["Tier: Developing — soft mandibular border", "Refinement: reduce submental fat"],
 *   ...
 * }
 */
export type Explanations = Record<string, string[] | string>;

/* ---------- constants used for gentle normalization ---------- */

const EXPECTED_METRICS = [
  "eyes_symmetry",
  "jawline",
  "cheekbones",
  "nose_harmony",
  "facial_symmetry",
  "skin_quality",
  "sexual_dimorphism",
] as const;

/* ---------- internal helpers ---------- */

function toPart(uri: string, name: string): {
  uri: string;
  name: string;
  type: string;
} {
  const normalized =
    uri.startsWith("file://") ? uri : uri.startsWith("/") ? `file://${uri}` : uri;
  return { uri: normalized, name: `${name}.jpg`, type: "image/jpeg" };
}

const MAX_SUBMETRIC_CHAR = 140;

function normalizeLine(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= MAX_SUBMETRIC_CHAR) return trimmed;
  const sliced = trimmed.slice(0, MAX_SUBMETRIC_CHAR).trimEnd();
  return `${sliced}…`;
}

function ensureArray4(v: unknown): string[] {
  if (typeof v === "string") {
    const s = normalizeLine(v);


    return s ? [s, "", "", ""] : ["", "", "", ""];
  }
  if (Array.isArray(v)) {
    const arr = v
    .filter((x) => typeof x === "string")
    .map((s) => normalizeLine(s as string))


      .filter(Boolean)
      .slice(0, 4);
    while (arr.length < 4) arr.push("");
    return arr;
  }
  return ["", "", "", ""];
}

/**
 * Normalize any server shape into a clean `Record<metric, string[4]>`.
 * - Guarantees keys for our expected metrics (pads with empty strings).
 * - Preserves unexpected metrics from server too (also normalized).
 */
export function normalizeExplanations(raw: Explanations | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  if (raw && typeof raw === "object") {
    // Normalize whatever keys the server sent
    for (const k of Object.keys(raw)) {
      out[k] = ensureArray4((raw as any)[k]);
    }
  }

  // Make sure our expected metrics are always present
  for (const k of EXPECTED_METRICS) {
    if (!out[k]) out[k] = ["", "", "", ""];
  }

  return out;
}

async function parseExplanations(
  res: Response,
  context: string
): Promise<Record<string, string[]>> {
  if (!res.ok) {
    throw await buildApiError(res, context);
  }
  const json = (await res.json()) as Explanations;
  return normalizeExplanations(json);
}

/* ---------- public API ---------- */

/**
 * POST /analyze/explain for single image.
 * Sends multipart with the image and a small JSON scores blob so server can tailor notes.
 * Fields:
 *   - image: file
 *   - scores: application/json as string
 */
export async function explainMetrics(
  imageUri: string,
  scores: Scores,
  signal?: AbortSignal
): Promise<Record<string, string[]>> {
  const fd = new FormData();
  fd.append("image", toPart(imageUri, "image") as any);
  fd.append("scores", JSON.stringify(scores));
  const res = await fetchWithRetry(
    `${API_BASE}/analyze/explain`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
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
 * Sends multipart with both files and the scores JSON.
 * Fields:
 *   - frontal: file
 *   - side: file
 *   - scores: application/json as string
 */
export async function explainMetricsPair(
  frontalUri: string,
  sideUri: string,
  scores: Scores,
  signal?: AbortSignal
): Promise<Record<string, string[]>> {
  const buildFormData = () => {
    const fd = new FormData();
    fd.append("frontal", toPart(frontalUri, "frontal") as any);
    fd.append("side", toPart(sideUri, "side") as any);
    fd.append("scores", JSON.stringify(scores));
    return fd;
  };

  const attempt = async (path: string): Promise<Record<string, string[]>> => {
    const res = await fetchWithRetry(
      `${API_BASE}${path}`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: buildFormData(),
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

    if (!shouldRetryLegacy) {
      throw err;
    }

    // legacy route fallback
    return await attempt("/analyze/pair/explain");
  }
}
