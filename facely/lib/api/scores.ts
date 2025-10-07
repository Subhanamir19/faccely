// facely/lib/api/scores.ts
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

function timeoutFetch(input: RequestInfo | URL, init: RequestInit = {}, ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

function filePart(uri: string, name: string) {
  // Android requires uri + name + type, always.
  return { uri, name, type: "image/jpeg" } as any;
}

/* ----------------------------------------------------------------------------
   File handling helpers: make URIs readable and stable
----------------------------------------------------------------------------- */

/** Copy the given uri into our own cache and return the new path. Handles file:// and content:// */
async function materializeToCache(uri: string): Promise<string> {
  const extMatch = /\.([A-Za-z0-9]+)(?:\?|#|$)/.exec(uri);
  const ext = (extMatch?.[1] || "jpg").toLowerCase();
  const dest =
    `${FileSystem.cacheDirectory}upload-` +
    `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Try raw, then URL-decoded (Expo sometimes percent-encodes path chunks)
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e1) {
    const decoded = decodeURI(uri);
    if (decoded !== uri) {
      await FileSystem.copyAsync({ from: decoded, to: dest });
      return dest;
    }
    throw e1;
  }
}

/** Ensure we can actually read the file: if it doesn't exist, copy it into our cache. */
async function ensureReadableFile(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  } catch {
    // fall through to materialize
  }
  return materializeToCache(uri);
}

export async function pingHealth(): Promise<boolean> {
  try {
    const r = await timeoutFetch(`${API_BASE}/health`, { method: "GET" }, 10000);
    return r.ok;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------------------------
   Uploads
----------------------------------------------------------------------------- */

async function analyzePairMultipart(frontUri: string, sideUri: string): Promise<Scores> {
  // Make sure both files are real, readable paths under our control
  const [frontPath, sidePath] = await Promise.all([
    ensureReadableFile(frontUri),
    ensureReadableFile(sideUri),
  ]);

  const form = new FormData();
  // FIELD NAMES MUST MATCH SERVER EXACTLY
  form.append("frontal", filePart(frontPath, "frontal.jpg"));
  form.append("side",    filePart(sidePath,  "side.jpg"));

  console.log("[scores] POST /analyze/pair starting...", API_BASE, {
    frontPath,
    sidePath,
  });

  let res: Response;
  try {
    res = await timeoutFetch(`${API_BASE}/analyze/pair`, {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" }, // do NOT set Content-Type
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
  // Same: first materialize to our cache, then read
  const [frontPath, sidePath] = await Promise.all([
    ensureReadableFile(frontUri),
    ensureReadableFile(sideUri),
  ]);

  console.log("[scores] POST /analyze/pair-bytes starting...", API_BASE, {
    frontPath,
    sidePath,
  });

  const [f, s] = await Promise.all([
    FileSystem.readAsStringAsync(frontPath, { encoding: FileSystem.EncodingType.Base64 }),
    FileSystem.readAsStringAsync(sidePath,  { encoding: FileSystem.EncodingType.Base64 }),
  ]);

  const res = await timeoutFetch(`${API_BASE}/analyze/pair-bytes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      front: `data:image/jpeg;base64,${f}`,
      side:  `data:image/jpeg;base64,${s}`,
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
    throw err;
  }
}
