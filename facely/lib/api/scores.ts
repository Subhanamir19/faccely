// Frontend API for scoring endpoints. Sends proper multipart files.
// Do NOT set Content-Type manually; React Native will set the boundary.

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
  return {
    uri,                                  // file:// or content://
    name: filenameFromUri(uri),
    type: mimeFromUri(uri),
  } as any;
}

// --- Single image ---
export async function analyzeImage(uri: string): Promise<Scores> {
  const form = new FormData();
  form.append("image", filePart(uri));    // backend expects 'image'

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`analyze failed: ${res.status} ${text}`);
  }
  return (await res.json()) as Scores;
}

// --- Pair images ---
export async function analyzePair(frontalUri: string, sideUri: string): Promise<Scores> {
  const form = new FormData();
  form.append("frontal", filePart(frontalUri)); // backend expects 'frontal'
  form.append("side", filePart(sideUri));       // and 'side'

  const res = await fetch(`${API_BASE}/analyze/pair`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`analyze/pair failed: ${res.status} ${text}`);
  }
  return (await res.json()) as Scores;
}
