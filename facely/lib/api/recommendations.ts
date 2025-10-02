// facely/lib/api/recommendations.ts
import { API_BASE_URL } from "../config";

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

/**
 * Server may evolve. We keep the response type loose and let the store normalize it.
 * Examples the backend SHOULD aim to return:
 *
 * Preferred (task-like):
 * {
 *   "summary": "Focus on SPF and hydration.",
 *   "items": [
 *     {
 *       "metric": "skin_quality",
 *       "title": "Apply SPF 30",
 *       "recommendation": "Use a broad-spectrum SPF 30+ each morning.",
 *       "finding": "Mild uneven tone and texture.",
 *       "priority": "high",
 *       "expected_gain": 6,
 *       "score": 62
 *     }
 *   ],
 *   "version": "v1"
 * }
 *
 * Legacy tolerated:
 * { "summary": "...", "recommendations": [ /* same item shape */ /* ] }
 * OR even an array of strings/items.
 */
export type RecommendationsRes = unknown;

/**
 * Helper to build a well-formed request from a flat scores object.
 * Useful if you ever call this lib from places other than Recommendations screen.
 */
export function buildRecommendationsReq(input: {
  age: number;
  gender?: "male" | "female" | "other";
  ethnicity?: string;
  scores: Partial<Record<MetricKey, number>>;
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
  const res = await fetch(`${API_BASE_URL}/recommendations`, {
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
  return (await res.json()) as unknown as RecommendationsRes;
}

/* --------------------------- utils --------------------------- */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
