// facely/lib/api/analysis.ts
import { API_BASE } from "./config";
import { buildApiError, fetchWithTimeout } from "./client";

import type { Scores } from "./scores";

/**
 * Backend returns per-metric notes. Keep this flexible to avoid frontend breaks.
 * Example:
 * {
 *   jawline: ["Tier: Developing — soft mandibular border", "Refinement: reduce submental fat"],
 *   ...
 * }
 */
export type Explanations = Record<string, string[] | string>;

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

async function parseExplanations(
  res: Response,
  context: string
): Promise<Explanations> {
  if (!res.ok) {
    throw await buildApiError(res, context);

  }
  // Shape can vary; let store/components normalize.
  return (await res.json()) as Explanations;
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
): Promise<Explanations> {
  const fd = new FormData();
  fd.append("image", toPart(imageUri, "image") as any);
  fd.append("scores", JSON.stringify(scores));
  const res = await fetchWithTimeout(`${API_BASE}/analyze/explain`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
    signal,
    timeoutMs: 90_000,
  });
  return parseExplanations(res, "Explanation request failed");

}

/**
 * POST /analyze/pair/explain for frontal + side pair.
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
): Promise<Explanations> {
  const fd = new FormData();
  fd.append("frontal", toPart(frontalUri, "frontal") as any);
  fd.append("side", toPart(sideUri, "side") as any);
  fd.append("scores", JSON.stringify(scores));

  const res = await fetchWithTimeout(`${API_BASE}/analyze/pair/explain`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
    signal,
    timeoutMs: 90_000,

  });
  return parseExplanations(res, "Pair explanation request failed");
}
