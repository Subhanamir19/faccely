// facely/lib/api/scores.ts
// Stop copying temp files. Resolve a stable, existing path and use it as-is.

import API_BASE from "./config";
import * as FileSystem from "expo-file-system";

export type Scores = {
  jawline: number;
  facial_symmetry: number;
  skin_quality: number;
  cheekbones: number;
  eyes_symmetry: number;
  nose_harmony: number;
  sexual_dimorphism: number;
};

const DEFAULT_TIMEOUT_MS = 180_000;

function timeoutFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_TIMEOUT_MS
) {
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

/* ----------------------------------------------------------------------------
   Resolve a readable file path without copying (no ENOENT roulette)
----------------------------------------------------------------------------- */

/**
 * Given a URI returned by ImagePicker, return a variant that actually exists.
 * We try:
 *   1) the URI as-is (usually file:///...%40anonymous%2Ffacely.../ImagePicker/xxx.jpeg)
 *   2) encodeURI(uri)  — some toolchains hand us already-decoded strings
 *   3) decodeURI(uri)  — some logs are encoded, FS expects decoded
 *
 * If none exist, we throw a loud error. That means the temp file is gone.
 */
async function resolveExistingPath(uri: string): Promise<string> {
  const candidates = [uri];

  // Avoid double-encoding "file://", keep scheme exact then vary only the path
  try {
    const u = new URL(uri);
    const path = u.pathname || "";
    const enc = `file://${encodeURI(path)}`;
    const dec = `file://${decodeURI(path)}`;
    // Push unique variants only
    for (const v of [enc, dec]) {
      if (!candidates.includes(v)) candidates.push(v);
    }
  } catch {
    // Not a URL? Fine, brute-force variants
    if (!candidates.includes(encodeURI(uri))) candidates.push(encodeURI(uri));
    if (!candidates.includes(decodeURI(uri))) candidates.push(decodeURI(uri));
  }

  for (const cand of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(cand);
      if (info.exists) return cand;
    } catch {
      // ignore and try next
    }
  }

  // If we reach here, the picker temp is gone. Tell the caller plainly.
  const msg =
    "Selected image is no longer available on disk. Re-select the photo and try again.";
  const err = new Error(msg);
  (err as any).code = "FILE_GONE";
  (err as any).details = { uri, tried: candidates };
  throw err;
}

export async function pingHealth(): Promise<boolean> {
  try {
    const r = await timeoutFetch(`${API_BASE}/health`, { method: "GET" }, 10_000);
    return r.ok;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------------------------
   Uploads
----------------------------------------------------------------------------- */

async function analyzePairMultipart(frontUri: string, sideUri: string): Promise<Scores> {
  // Resolve existing paths; do NOT copy them anywhere
  const [frontPath, sidePath] = await Promise.all([
    resolveExistingPath(frontUri),
    resolveExistingPath(sideUri),
  ]);

  const form = new FormData();
  // FIELD NAMES MUST MATCH SERVER EXACTLY
  form.append("frontal", filePart(frontPath, "frontal.jpg"));
  form.append("side", filePart(sidePath, "side.jpg"));

  console.log("[scores] POST /analyze/pair starting...", API_BASE, {
    frontPath,
    sidePath,
  });

  let res: Response;
  try {
    res = await timeoutFetch(`${API_BASE}/analyze/pair`, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" }, // do NOT set Content-Type, RN sets boundary
    });
  } catch (e: any) {
    console.log("[scores] /analyze/pair network error:", e?.message || e);
    throw new Error("NETWORK_LAYER_FAIL");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log("[scores] /analyze/pair fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }

  const json = await res.json();
  console.log("[scores] /analyze/pair ok", json);
  return json as Scores;
}

async function analyzePairBytes(frontUri: string, sideUri: string): Promise<Scores> {
  // Resolve existing paths; then base64 encode directly
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

  const res = await timeoutFetch(`${API_BASE}/analyze/pair-bytes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      front: `data:image/jpeg;base64,${f}`,
      side: `data:image/jpeg;base64,${s}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log("[scores] /analyze/pair-bytes fail http", res.status, body);
    throw new Error(`HTTP ${res.status} ${body}`);
  }
  const json = await res.json();
  console.log("[scores] /analyze/pair-bytes ok", json);
  return json as Scores;
}

export async function analyzePair(frontUri: string, sideUri: string): Promise<Scores> {
  try {
    return await analyzePairMultipart(frontUri, sideUri);
  } catch (err: any) {
    if (err?.message === "NETWORK_LAYER_FAIL") {
      console.log("[scores] falling back to /analyze/pair-bytes");
      return await analyzePairBytes(frontUri, sideUri);
    }
    // If the file is gone, bubble a clear, user-facing message
    if ((err as any)?.code === "FILE_GONE") {
      console.log("[scores] file missing:", (err as any).details);
      throw err;
    }
    throw err;
  }
}
