// facely/lib/api/scores.ts
// Stable, concurrency-safe upload helpers for facial scoring.

import API_BASE from "./config";
import * as FileSystem from "expo-file-system";
import {
  fetchWithRetry,
  DEFAULT_UPLOAD_TIMEOUT_MS,
  SHORT_REQUEST_TIMEOUT_MS,
} from "./client";

/* -------------------------------------------------------------------------- */
/*   Types                                                                    */
/* -------------------------------------------------------------------------- */

export type Scores = {
  jawline: number;
  facial_symmetry: number;
  skin_quality: number;
  cheekbones: number;
  eyes_symmetry: number;
  nose_harmony: number;
  sexual_dimorphism: number;
};

type InputFile = string | { uri: string; name?: string; mime?: string };

/* -------------------------------------------------------------------------- */
/*   Safe normalization                                                       */
/* -------------------------------------------------------------------------- */

const METRIC_KEYS: (keyof Scores)[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
];

export function normalizeScores(raw: Partial<Scores> | null | undefined): Scores {
  const sanitized: Partial<Scores> = {};
  const missing: string[] = [];

  for (const key of METRIC_KEYS) {
    const value = (raw as any)?.[key];
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;

    if (!Number.isFinite(numeric)) {
      missing.push(key);
      continue;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
    sanitized[key] = clamped as Scores[typeof key];
  }

  if (missing.length > 0) {
    throw new Error("Analysis results were incomplete. Please retry the scan.");
  }

  const values = METRIC_KEYS.map((key) => sanitized[key] as number);
  if (values.every((v) => v === 0)) {
    throw new Error("Analysis returned empty scores. Please retry with a clearer photo.");
  }

  return sanitized as Scores;
}

/* -------------------------------------------------------------------------- */
/*   Resolve a readable file path without copying                             */
/* -------------------------------------------------------------------------- */

async function resolveExistingPath(uri: string): Promise<string> {
  const candidates = [uri];

  try {
    const u = new URL(uri);
    const path = u.pathname || "";
    const enc = `file://${encodeURI(path)}`;
    const dec = `file://${decodeURI(path)}`;
    for (const v of [enc, dec]) {
      if (!candidates.includes(v)) candidates.push(v);
    }
  } catch {
    if (!candidates.includes(encodeURI(uri))) candidates.push(encodeURI(uri));
    if (!candidates.includes(decodeURI(uri))) candidates.push(decodeURI(uri));
  }

  for (const cand of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(cand);
      if (info.exists) return cand;
    } catch {
      /* ignore and try next */
    }
  }

  const msg =
    "Selected image is no longer available on disk. Re-select the photo and try again.";
  const err = new Error(msg);
  (err as any).code = "FILE_GONE";
  (err as any).details = { uri, tried: candidates };
  throw err;
}

/* -------------------------------------------------------------------------- */
/*   Health check (legacy fallback)                                           */
/* -------------------------------------------------------------------------- */

export async function pingHealth(): Promise<boolean> {
  try {
    const r = await fetchWithRetry(`${API_BASE}/health`, {
      method: "GET",
      timeoutMs: SHORT_REQUEST_TIMEOUT_MS,
    });
    return r.ok;
  } catch (e) {
    console.warn("[scores] pingHealth failed:", (e as any)?.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*   Helpers: normalize InputFile -> FormData part                            */
/* -------------------------------------------------------------------------- */

function toFileMeta(input: InputFile, fallbackName: string) {
  if (typeof input === "string") {
    return { uri: input, name: fallbackName, mime: "image/jpeg" as const };
  }
  const name = input.name && input.name.trim().length > 0 ? input.name : fallbackName;
  const mime = input.mime && input.mime.trim().length > 0 ? input.mime : "image/jpeg";
  return { uri: input.uri, name, mime: mime as "image/jpeg" };
}

async function toFormPart(
  input: InputFile,
  fallbackName: string
): Promise<{ uri: string; name: string; type: string }> {
  const meta = toFileMeta(input, fallbackName);
  const path = await resolveExistingPath(meta.uri);
  // Important: Android/Expo needs file:// uri, .jpg name, and correct type
  return { uri: path, name: ensureJpegName(meta.name), type: meta.mime || "image/jpeg" } as any;
}

function ensureJpegName(name: string) {
  return /\.jpe?g$/i.test(name) ? name : `${name.replace(/\.[^./\\]+$/, "")}.jpg`;
}

/* -------------------------------------------------------------------------- */
/*   Multipart upload: pair                                                   */
/* -------------------------------------------------------------------------- */

async function analyzePairMultipart(front: InputFile, side: InputFile): Promise<Scores> {
  const [frontPart, sidePart] = await Promise.all([
    toFormPart(front, "front.jpg"),
    toFormPart(side, "side.jpg"),
  ]);

  const form = new FormData();
  form.append("frontal", frontPart as any);
  form.append("side", sidePart as any);

  const url = `${API_BASE}/analyze/pair`;
  const start = Date.now();
  console.log("[scores] POST", url, { front: frontPart.name, side: sidePart.name });

  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
      },
      3,
      800
    );
  } catch (e: any) {
    console.error("[scores] /analyze/pair network error:", e?.message || e);
    throw new Error("NETWORK_LAYER_FAIL");
  } finally {
    const duration = Date.now() - start;
    console.log(`[scores] /analyze/pair duration: ${duration} ms`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[scores] /analyze/pair fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Invalid JSON from server");
  console.log("[scores] /analyze/pair ok");
  return normalizeScores(json);
}

/* -------------------------------------------------------------------------- */
/*   Byte-fallback upload: pair                                               */
/* -------------------------------------------------------------------------- */

async function analyzePairBytes(front: InputFile, side: InputFile): Promise<Scores> {
  const [frontPath, sidePath] = await Promise.all([
    resolveExistingPath(typeof front === "string" ? front : front.uri),
    resolveExistingPath(typeof side === "string" ? side : side.uri),
  ]);

  console.log("[scores] POST /analyze/pair-bytes starting...", API_BASE, {
    frontPath,
    sidePath,
  });

  const [f, s] = await Promise.all([
    FileSystem.readAsStringAsync(frontPath, {
      encoding: FileSystem.EncodingType.Base64,
    }),
    FileSystem.readAsStringAsync(sidePath, {
      encoding: FileSystem.EncodingType.Base64,
    }),
  ]);

  const url = `${API_BASE}/analyze/pair-bytes`;
  const start = Date.now();

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      front: `data:image/jpeg;base64,${f}`,
      side: `data:image/jpeg;base64,${s}`,
    }),
    timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
  });

  const duration = Date.now() - start;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[scores] /analyze/pair-bytes fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Invalid JSON from server");
  console.log(`[scores] /analyze/pair-bytes ok (${duration} ms)`);
  return normalizeScores(json);
}

/* -------------------------------------------------------------------------- */
/*   Public entrypoint: pair                                                  */
/* -------------------------------------------------------------------------- */

export async function analyzePair(front: InputFile, side: InputFile): Promise<Scores> {
  try {
    return await analyzePairMultipart(front, side);
  } catch (err: any) {
    if (err?.message === "NETWORK_LAYER_FAIL") {
      console.warn("[scores] falling back to /analyze/pair-bytes");
      return await analyzePairBytes(front, side);
    }
    if ((err as any)?.code === "FILE_GONE") {
      console.error("[scores] file missing:", (err as any).details);
      throw err;
    }
    console.error("[scores] analyzePair unrecoverable error:", err);
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/*   Single-image upload                                                      */
/* -------------------------------------------------------------------------- */

export async function analyzeImage(input: InputFile): Promise<Scores> {
  const meta = toFileMeta(input, "image.jpg");
  const path = await resolveExistingPath(meta.uri);

  const form = new FormData();
  form.append("image", { uri: path, name: ensureJpegName(meta.name), type: meta.mime } as any);

  const url = `${API_BASE}/analyze`;
  const start = Date.now();
  console.log("[scores] POST", url, { path });

  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
        timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
      },
      3,
      800
    );
  } catch (e: any) {
    console.error("[scores] /analyze network error:", e?.message || e);
    throw new Error("NETWORK_LAYER_FAIL");
  } finally {
    const duration = Date.now() - start;
    console.log(`[scores] /analyze duration: ${duration} ms`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[scores] /analyze fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Invalid JSON from server");
  console.log("[scores] /analyze ok");
  return normalizeScores(json);
}
