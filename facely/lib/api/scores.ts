// facely/lib/api/scores.ts
// Stable, concurrency-safe upload helpers for facial scoring.

import API_BASE from "./config";
import * as FileSystem from "expo-file-system";

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

/* -------------------------------------------------------------------------- */
/*   Timeout helpers                                                          */
/* -------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = 180_000;

function timeoutFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

function filePart(uri: string, name: string) {
  // Android requires uri + name + type, always.
  return { uri, name, type: "image/jpeg" } as any;
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
    const r = await timeoutFetch(`${API_BASE}/health`, { method: "GET" }, 10_000);
    return r.ok;
  } catch (e) {
    console.warn("[scores] pingHealth legacy fallback failed:", (e as any)?.message);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*   Multipart upload: pair                                                   */
/* -------------------------------------------------------------------------- */

async function analyzePairMultipart(frontUri: string, sideUri: string): Promise<Scores> {
  const [frontPath, sidePath] = await Promise.all([
    resolveExistingPath(frontUri),
    resolveExistingPath(sideUri),
  ]);

  const form = new FormData();
  form.append("frontal", filePart(frontPath, "frontal.jpg"));
  form.append("side", filePart(sidePath, "side.jpg"));

  const url = `${API_BASE}/analyze/pair`;
  const start = Date.now();
  console.log("[scores] POST", url, { frontPath, sidePath });

  let res: Response;
  try {
    res = await timeoutFetch(url, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" }, // RN sets boundary automatically
    });
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
  console.log("[scores] /analyze/pair ok", json);
  return json as Scores;
}

/* -------------------------------------------------------------------------- */
/*   Byte-fallback upload: pair                                               */
/* -------------------------------------------------------------------------- */

async function analyzePairBytes(frontUri: string, sideUri: string): Promise<Scores> {
  const [frontPath, sidePath] = await Promise.all([
    resolveExistingPath(frontUri),
    resolveExistingPath(sideUri),
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

  const res = await timeoutFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      front: `data:image/jpeg;base64,${f}`,
      side: `data:image/jpeg;base64,${s}`,
    }),
  });

  const duration = Date.now() - start;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[scores] /analyze/pair-bytes fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Invalid JSON from server");
  console.log(`[scores] /analyze/pair-bytes ok (${duration} ms)`, json);
  return json as Scores;
}

/* -------------------------------------------------------------------------- */
/*   Public entrypoint: pair                                                  */
/* -------------------------------------------------------------------------- */

export async function analyzePair(frontUri: string, sideUri: string): Promise<Scores> {
  try {
    return await analyzePairMultipart(frontUri, sideUri);
  } catch (err: any) {
    if (err?.message === "NETWORK_LAYER_FAIL") {
      console.warn("[scores] falling back to /analyze/pair-bytes");
      return await analyzePairBytes(frontUri, sideUri);
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

export async function analyzeImage(uri: string): Promise<Scores> {
  const path = await resolveExistingPath(uri);
  const form = new FormData();
  // Server expects field "image" on /analyze
  form.append("image", { uri: path, name: "image.jpg", type: "image/jpeg" } as any);

  const url = `${API_BASE}/analyze`;
  const start = Date.now();
  console.log("[scores] POST", url, { path });

  let res: Response;
  try {
    res = await timeoutFetch(url, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" },
    });
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
  console.log("[scores] /analyze ok", json);
  return json as Scores;
}
