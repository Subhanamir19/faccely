// facely/lib/api/recommendations.ts
import { API_BASE } from "./config";

/** Metric keys (kept consistent with backend) */
const METRIC_KEYS = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricInput = {
  key: MetricKey;
  score: number;
  notes?: string;
};

export type RecommendationsReq = {
  age: number;
  gender?: "male" | "female" | "other";
  ethnicity?: string;
  metrics: MetricInput[];
};

/** Shape is intentionally flexible; the store/consumers will normalize. */
export type RecommendationsRes = unknown;

/** Build a typed request body from loose inputs. */
export function buildRecommendationsReq(input: {
  age: number;
  gender?: "male" | "female" | "other";
  ethnicity?: string;
  scores: Record<MetricKey, number | undefined>;
  notes?: Partial<Record<MetricKey, string>>;
}): RecommendationsReq {
  const metrics: MetricInput[] = (Object.keys(input.scores) as MetricKey[])
    .filter((k) => typeof input.scores[k] === "number")
    .map((k) => ({
      key: k,
      score: clamp(Math.round(input.scores[k] as number), 0, 100),
      notes: input.notes?.[k],
    }));

  return {
    age: input.age,
    gender: input.gender,
    ethnicity: input.ethnicity,
    metrics,
  };
}

/**
 * POST /recommendations
 * Body: { age, gender?, ethnicity?, metrics: [{ key, score, notes? }] }
 * Returns: whatever the server sends; the store will normalize it.
 */
export async function fetchRecommendations(
  body: RecommendationsReq,
  signal?: AbortSignal
): Promise<RecommendationsRes> {
  const res = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${msg}`);
  }

  // Do NOT enforce a rigid shape here. Let the store normalize.
  return (await res.json()) as RecommendationsRes;
}

/* --------------------------- utils --------------------------- */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
