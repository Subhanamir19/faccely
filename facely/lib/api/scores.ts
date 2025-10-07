// facely/lib/api/scores.ts
import { API_BASE } from "./config";
import { LONG_REQUEST_TIMEOUT_MS, buildApiError, fetchWithTimeout } from "./client";

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

function normalizeFileUri(uri: string): string {
  return uri.startsWith("file://") ? uri : uri.startsWith("/") ? `file://${uri}` : uri;
}

function toPart(uri: string, name: string): {
  uri: string;
  name: string;
  type: string;
} {
  const normalized = normalizeFileUri(uri);
  // Label as JPEG; the server will sniff true type anyway.
  return { uri: normalized, name: `${name}.jpg`, type: "image/jpeg" };
}

/** Some Android emulators choke on { uri, name, type }. Blobs are more reliable. */
async function toBlobPart(uri: string, name: string): Promise<{ blob: Blob; filename: string }> {
  const normalized = normalizeFileUri(uri);
  // RN fetch can read file:// URIs and return a Blob
  const res = await fetch(normalized);
  // Defensive: ensure 200-ish; local file fetch often reports ok anyway
  if (!res || typeof res.blob !== "function") {
    throw new Error(`Failed to open file for upload: ${normalized}`);
  }
  const blob = await res.blob();
  return { blob, filename: `${name}.jpg` };
}

async function parseScores(res: Response): Promise<Scores> {
  if (!res.ok) {
    throw await buildApiError(res, "Score request failed");
  }
  const json = (await res.json()) as unknown;

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
    (out as any)[k] = Math.max(0, Math.min(100, Math.round(v)));
  }
  return out as Scores;
}

/* ---------- public API ---------- */

/** POST /analyze with a single image (multipart/form-data). */
export async function analyzeImage(uri: string, signal?: AbortSignal): Promise<Scores> {
  const fd = new FormData();

  // Prefer Blob to avoid emulator URI weirdness
  try {
    const { blob, filename } = await toBlobPart(uri, "image");
    (fd as any).append("image", blob as any, filename);
  } catch {
    // Fallback to { uri, name, type } if blob read fails
    (fd as any).append("image", toPart(uri, "image") as any);
  }

  console.log("[scores] POST /analyze starting…", API_BASE);
  const res = await fetchWithTimeout(`${API_BASE}/analyze`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // Do NOT set Content-Type manually; RN will add the correct multipart boundary.
    },
    body: fd,
    signal,
    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
  });
  console.log("[scores] POST /analyze done, status =", res.status);

  return parseScores(res);
}

/** POST /analyze/pair with frontal + side images (multipart/form-data). */
export async function analyzePair(
  frontalUri: string,
  sideUri: string,
  signal?: AbortSignal
): Promise<Scores> {
  const fd = new FormData();

  try {
    const f = await toBlobPart(frontalUri, "frontal");
    const s = await toBlobPart(sideUri, "side");
    (fd as any).append("frontal", f.blob as any, f.filename);
    (fd as any).append("side", s.blob as any, s.filename);
  } catch {
    // Fallback to URI parts if Blob read fails
    (fd as any).append("frontal", toPart(frontalUri, "frontal") as any);
    (fd as any).append("side", toPart(sideUri, "side") as any);
  }

  console.log("[scores] POST /analyze/pair starting…", API_BASE);
  const res = await fetchWithTimeout(`${API_BASE}/analyze/pair`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // Let RN set multipart boundary automatically.
    },
    body: fd,
    signal,
    timeoutMs: LONG_REQUEST_TIMEOUT_MS,
  });
  console.log("[scores] POST /analyze/pair done, status =", res.status);

  return parseScores(res);
}
