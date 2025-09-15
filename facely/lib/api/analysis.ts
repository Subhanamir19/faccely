import { API_BASE_URL } from "../config";
import type { Scores } from "../../store/scores";

// keep the same metric keys as scores
export type MetricKey =
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism"
  | "youthfulness";

export type Explanations = Record<MetricKey, string[]>;

const KEYS: MetricKey[] = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
  "youthfulness",
];

/** Utility: turn anything (string | string[] | unknown) into <= 2 concise lines */
function normalizeToTwoLines(v: unknown): string[] {
  const pickTwo = (arr: string[]) =>
    arr
      .map(s => String(s).trim())
      .filter(Boolean)
      .slice(0, 2);

  if (Array.isArray(v)) {
    // If items aren’t strings, coerce; also flatten if dev accidentally nested
    const flat = v.flat().map(x => (typeof x === "string" ? x : JSON.stringify(x)));
    const two = pickTwo(flat);
    return two.length ? two : ["No notes.", ""].filter(Boolean);
  }

  if (typeof v === "string") {
    // Split by sentences / newlines and take two
    const bits =
      v.split(/\r?\n+/)
        .flatMap(line => line.split(/(?<=[.!?])\s+/))
        .map(s => s.trim())
        .filter(Boolean);
    const two = pickTwo(bits.length ? bits : [v]);
    return two.length ? two : ["No notes.", ""].filter(Boolean);
  }

  // Unknown – give a safe fallback so UI never breaks
  return ["No notes.", ""].filter(Boolean);
}

/**
 * Calls backend /analyze/explain with the selfie + scores and
 * returns two concise lines per metric. Robust to loose server shapes.
 */
export async function explainMetrics(
  uri: string,
  scores: Scores,
  mime: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<Explanations> {
  const name =
    uri.split("/").pop() || (mime === "image/png" ? "selfie.png" : "selfie.jpg");

  const form = new FormData();
  // RN fetch file shape
  form.append("image" as any, { uri, name, type: mime } as any);
  form.append("scores", JSON.stringify(scores));

  const url = `${API_BASE_URL}/analyze/explain`;
  console.log("EXPLAIN →", url);
  const res = await fetch(url, { method: "POST", body: form });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${msg}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    // Some proxies return text/html on error—surface it cleanly
    const msg = await res.text().catch(() => "");
    throw new Error(`Bad JSON from server ${msg ? `- ${msg}` : ""}`);
  }

  const out: Partial<Explanations> = {};
  for (const k of KEYS) {
    out[k] = normalizeToTwoLines(data?.[k]);
  }
  return out as Explanations;
}
