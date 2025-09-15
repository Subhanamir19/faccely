import { API_BASE_URL } from "../config";

/** Single source of truth for score shape */
export type Scores = {
  jawline:number;
  facial_symmetry:number;
  skin_quality:number;
  cheekbones:number;
  eyes_symmetry:number;
  nose_harmony:number;
  sexual_dimorphism:number;
  youthfulness:number;
};

const KEYS = [
  "jawline","facial_symmetry","skin_quality","cheekbones",
  "eyes_symmetry","nose_harmony","sexual_dimorphism","youthfulness"
] as const;

/**
 * POST /analyze
 * multipart/form-data:
 *   - image: file
 */
export async function analyzeImage(
  uri:string,
  mime: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<Scores> {
  const name = uri.split("/").pop() || (mime === "image/png" ? "selfie.png" : "selfie.jpg");

  const form = new FormData();
  // React Native fetch file shape
  form.append("image" as any, { uri, name, type: mime } as any);

  const res = await fetch(`${API_BASE_URL}/analyze`, { method: "POST", body: form });

  if (!res.ok) {
    const msg = await res.text().catch(()=> "");
    throw new Error(`HTTP ${res.status} ${msg}`);
  }

  const data = await res.json();

  // minimal validation so the UI doesn’t blow up later
  for (const k of KEYS) {
    if (typeof (data as any)[k] !== "number") {
      throw new Error("Bad payload from server");
    }
  }

  return data as Scores;
}
