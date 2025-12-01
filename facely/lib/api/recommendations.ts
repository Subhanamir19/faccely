// facely/lib/api/recommendations.ts
import { z } from "zod";
import { API_BASE } from "./config";
import { requestJSON } from "./client";
import { buildAuthHeaders } from "./authHeaders";

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

const RecommendationItemSchema = z.object({
  metric: z.enum(METRIC_KEYS),
  score: z.number().min(0).max(100),
  title: z.string().max(40).optional(),
  finding: z.string().max(120).optional(),
  recommendation: z.string().max(220),
  priority: z.enum(["low", "medium", "high"]),
  expected_gain: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (typeof val === "string" ? Number.parseFloat(val) : val))
    .refine(
      (val) => val === undefined || Number.isFinite(val),
      "expected_gain must be numeric"
    ),
});

const RecommendationsResponseSchema = z.object({
  summary: z.string(),
  items: z.array(RecommendationItemSchema),
  version: z.literal("v1"),
});

export type RecommendationsRes = z.infer<typeof RecommendationsResponseSchema>;

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
  return requestJSON<RecommendationsRes>(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders({ includeLegacy: true }),
    },
    body: JSON.stringify(body),
    signal,
    context: "Recommendations request failed",
    schema: RecommendationsResponseSchema,
  });
}

/* --------------------------- utils --------------------------- */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
