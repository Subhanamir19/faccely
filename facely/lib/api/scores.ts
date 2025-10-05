// facely/lib/api/scores.ts
import { API_BASE } from "./config";
import { buildApiError, fetchWithTimeout } from "./client.ts";

/** Keep this aligned with backend keys. */
export type Scores = {
  jawline: number;
  facial_symmetry: number;
  skin_quality: number;
  cheekbones: number;
  eyes_symmetry: number;
  nose_harmony: number;
  sexual_dimorphism: number;
};

/* ---------- internal helpers ---------- */

function toPart(uri: string, name: string): {
  uri: string;
  name: string;
  type: string;
} {
  const normalized =
    uri.startsWith("file://") ? uri : uri.startsWith("/") ? `file://${uri}` : uri;
  // Label as JPEG; the server should sniff true type anyway.
  return { uri: normalized, name: `${name}.jpg`, type: "image/jpeg" };
}

async function parseScores(res: Response): Promise<Scores> {
  if (!res.ok) {
    throw await buildApiError(res, "Score request failed");

  }
  const json = (await res.json()) as unknown;

  // Minimal guard: ensure numeric 0..100 for each expected key.
  const keys: (keyof Scores)[] = [
    "jawline",
    "facial_symmetry",
    "skin_quality",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "sexual_dimorphism",
  ];
  const out: Partial<Scores> = {};
  for (const k of keys) {
    const v = (json as any)?.[k];
    if (typeof v !== "number" || !isFinite(v)) {
      throw new Error(`Invalid score for "${k}"`);
    }
    // Hard clamp for safety.
    (out as any)[k] = Math.max(0, Math.min(100, Math.round(v)));
  }
  return out as Scores;
}

/* ---------- public API ---------- */

/** POST /analyze with a single image (multipart/form-data). */
export async function analyzeImage(uri: string, signal?: AbortSignal): Promise<Scores> {
  const fd = new FormData();
  // Backend single-image field name assumed "image".
  fd.append("image", toPart(uri, "image") as any);

  const res = await fetchWithTimeout(`${API_BASE}/analyze`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // Don't set Content-Type; RN will add correct multipart boundary.
    },
    body: fd,
    signal,
    timeoutMs: 90_000,

  });

  return parseScores(res);
}

/** POST /analyze/pair with frontal + side images (multipart/form-data). */
export async function analyzePair(
  frontalUri: string,
  sideUri: string,
  signal?: AbortSignal
): Promise<Scores> {
  const fd = new FormData();
  // Field names expected by backend: "frontal" and "side".
  fd.append("frontal", toPart(frontalUri, "frontal") as any);
  fd.append("side", toPart(sideUri, "side") as any);

  const res = await fetchWithTimeout(`${API_BASE}/analyze/pair`, {

    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: fd,
    signal,
    timeoutMs: 90_000,

  });

  return parseScores(res);
}
