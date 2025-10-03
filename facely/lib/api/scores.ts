// Frontend API for scoring endpoints. Sends proper multipart files.

import { API_BASE } from "./config";

export type Scores = {
  jawline: number;
  facial_symmetry: number;
  skin_quality: number;
  cheekbones: number;
  eyes_symmetry: number;
  nose_harmony: number;
  sexual_dimorphism: number;
};

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

export async function analyzeImage(uri: string): Promise<Scores> {
  const form = new FormData();
  form.append("image", filePart(uri));

  let res: Response;
  try {
    console.log("[API] POST", `${API_BASE}/analyze`);
    res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
  } catch (e: any) {
    console.log("[API] /analyze network error:", e?.message || e);
    throw new Error("NETWORK_UNREACHABLE");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.log("[API] /analyze HTTP", res.status, text);
    throw new Error(`HTTP_${res.status}`);
  }
  return (await res.json()) as Scores;
}

export async function analyzePair(frontalUri: string, sideUri: string): Promise<Scores> {
  const form = new FormData();
  form.append("frontal", filePart(frontalUri));
  form.append("side", filePart(sideUri));

  let res: Response;
  try {
    console.log("[API] POST", `${API_BASE}/analyze/pair`);
    res = await fetch(`${API_BASE}/analyze/pair`, { method: "POST", body: form });
  } catch (e: any) {
    console.log("[API] /analyze/pair network error:", e?.message || e);
    throw new Error("NETWORK_UNREACHABLE");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.log("[API] /analyze/pair HTTP", res.status, text);
    throw new Error(`HTTP_${res.status}`);
  }
  return (await res.json()) as Scores;
}
