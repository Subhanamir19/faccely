import { API_BASE } from "./config";
import type { Scores } from "./scores";

export type Explanations = Record<
  | "jawline"
  | "facial_symmetry"
  | "skin_quality"
  | "cheekbones"
  | "eyes_symmetry"
  | "nose_harmony"
  | "sexual_dimorphism",
  [string, string]
>;

function filenameFromUri(uri: string): string {
  try {
    const q = uri.split("?")[0];
    const last = q.substring(q.lastIndexOf("/") + 1) || "upload.jpg";
    return last.includes(".") ? last : last + ".jpg";
  } catch {
    return "upload.jpg";
  }
}
function mimeFromUri(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  if (u.endsWith(".heic") || u.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}
function filePart(uri: string) {
  return { uri, name: filenameFromUri(uri), type: mimeFromUri(uri) } as any;
}

export async function explainMetrics(uri: string, scores: Scores) {
  const form = new FormData();
  form.append("image", filePart(uri));
  form.append("scores", JSON.stringify(scores));

  const res = await fetch(`${API_BASE}/analyze/explain`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${text}`);
  }
  return (await res.json());
}

export async function explainMetricsPair(frontalUri: string, sideUri: string, scores: Scores) {
  const form = new FormData();
  form.append("frontal", filePart(frontalUri));
  form.append("side", filePart(sideUri));
  form.append("scores", JSON.stringify(scores));

  const res = await fetch(`${API_BASE}/analyze/explain/pair`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${text}`);
  }
  return (await res.json());
}
