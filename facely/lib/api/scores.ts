// facely/lib/api/scores.ts
// Stable, concurrency-safe upload helpers for facial scoring.

import { API_BASE } from "./config";
import * as FileSystem from "expo-file-system";
import {
  fetchWithRetry,
  DEFAULT_UPLOAD_TIMEOUT_MS,
  SHORT_REQUEST_TIMEOUT_MS,
} from "./client";
import {
  prepareUploadPart,
  resolveExistingPath,
  type UploadInput,
} from "./media";

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

type InputFile = UploadInput;

type PreparedUploadPart = Awaited<ReturnType<typeof prepareUploadPart>>;

export type UploadMeta = {
  single?: PreparedUploadPart;
  front?: PreparedUploadPart;
  side?: PreparedUploadPart;
};

const UPLOAD_META_SYMBOL = Symbol("facely.scores.uploadMeta");

function attachUploadMeta<T extends Scores>(scores: T, meta: UploadMeta): T {
  Object.defineProperty(scores, UPLOAD_META_SYMBOL, {
    value: meta,
    enumerable: false,
    configurable: true,
  });
  return scores;
}

export function consumeUploadMeta(scores: Scores): UploadMeta | undefined {
  const meta = (scores as any)[UPLOAD_META_SYMBOL] as UploadMeta | undefined;
  if (meta) {
    delete (scores as any)[UPLOAD_META_SYMBOL];
  }
  return meta;
}

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
  const missingOrInvalid: string[] = [];

  for (const key of METRIC_KEYS) {
    const value = (raw as any)?.[key];
    let numeric: number | null = null;

    if (typeof value === "number" && Number.isFinite(value)) {
      numeric = value;
    } else if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        numeric = parsed;
      }
    }

    if (numeric === null) {
      missingOrInvalid.push(key);
      sanitized[key] = 0 as Scores[typeof key];
      continue;
    }

    const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
    sanitized[key] = clamped as Scores[typeof key];
  }

  if (missingOrInvalid.length > 0) {
    console.warn("[scores] normalizeScores missing/invalid metrics:", {
      missingOrInvalid,
      raw,
    });
  }

  const values = METRIC_KEYS.map((key) => sanitized[key] as number);
  if (values.every((v) => v === 0)) {
    console.error("[scores] EMPTY_SCORES_GUARD", {
      raw,
      sanitized,
      missingOrInvalid,
    });
    throw new Error(
      "Analysis returned empty scores. Please retry with a clearer photo."
    );
  }

  return sanitized as Scores;
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
/*   Multipart upload: pair                                                   */
/* -------------------------------------------------------------------------- */

async function analyzePairMultipart(front: InputFile, side: InputFile): Promise<Scores> {
  const [frontPart, sidePart] = await Promise.all([
    prepareUploadPart(front, "front.jpg"),
    prepareUploadPart(side, "side.jpg"),
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
  console.log("[scores] /analyze/pair raw:", json);
  if (!json) throw new Error("Invalid JSON from server");
  console.log("[scores] /analyze/pair ok");
  return attachUploadMeta(normalizeScores(json), { front: frontPart, side: sidePart });
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
  console.log("[scores] /analyze/pair-bytes raw:", json);
  if (!json) throw new Error("Invalid JSON from server");
  console.log(`[scores] /analyze/pair-bytes ok (${duration} ms)`);
  const meta = {
    front: { uri: frontPath, name: "front.jpg", type: "image/jpeg" },
    side: { uri: sidePath, name: "side.jpg", type: "image/jpeg" },
  };
  return attachUploadMeta(normalizeScores(json), meta);
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
  const part = await prepareUploadPart(input, "image.jpg");

  const form = new FormData();
  form.append("image", part as any);

  const url = `${API_BASE}/analyze`;
  const start = Date.now();
  console.log("[scores] POST", url, { path: part.uri });

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
  console.log("[scores] /analyze raw:", json);
  if (!json) throw new Error("Invalid JSON from server");
  console.log("[scores] /analyze ok");
  return attachUploadMeta(normalizeScores(json), { single: part });
}
