// scorer-node/src/validators.ts
import { z } from "zod";

/* ============================================================================
   Metric keys (unchanged)
   ========================================================================== */
export const metricKeys = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
] as const;

export type MetricKey = (typeof metricKeys)[number];

/* ============================================================================
   v1 Scores (unchanged)
   ========================================================================== */
export const ScoresSchema = z.object({
  jawline: z.number().min(0).max(100),
  facial_symmetry: z.number().min(0).max(100),
  skin_quality: z.number().min(0).max(100),
  cheekbones: z.number().min(0).max(100),
  eyes_symmetry: z.number().min(0).max(100),
  nose_harmony: z.number().min(0).max(100),
  sexual_dimorphism: z.number().min(0).max(100),
});
export type Scores = z.infer<typeof ScoresSchema>;

/* ============================================================================
   Explanations
   - Keep v1 (2 strings) for backward compatibility.
   - Add v2 (4 strings) for the new UI.
   ========================================================================== */

// v1: exactly 2 lines per metric
export const ExplanationsSchemaV1 = z.object({
  jawline: z.array(z.string()).length(2),
  facial_symmetry: z.array(z.string()).length(2),
  skin_quality: z.array(z.string()).length(2),
  cheekbones: z.array(z.string()).length(2),
  eyes_symmetry: z.array(z.string()).length(2),
  nose_harmony: z.array(z.string()).length(2),
  sexual_dimorphism: z.array(z.string()).length(2),
});
export type ExplanationsV1 = z.infer<typeof ExplanationsSchemaV1>;

// v2: exactly 4 lines per metric (matches the 2×2 grid)
export const ExplanationsSchemaV2 = z.object({
  jawline: z.array(z.string()).length(4),
  facial_symmetry: z.array(z.string()).length(4),
  skin_quality: z.array(z.string()).length(4),
  cheekbones: z.array(z.string()).length(4),
  eyes_symmetry: z.array(z.string()).length(4),
  nose_harmony: z.array(z.string()).length(4),
  sexual_dimorphism: z.array(z.string()).length(4),
});
export type ExplanationsV2 = z.infer<typeof ExplanationsSchemaV2>;

// Union you can use when parsing inputs/outputs conditionally
export const AnyExplanationsSchema = z.union([
  ExplanationsSchemaV2,
  ExplanationsSchemaV1,
]);
export type AnyExplanations = z.infer<typeof AnyExplanationsSchema>;

/* ============================================================================
   v2 Analysis schema (future-proof; doesn’t break v1 routes)
   - Each feature has 4 submetrics and an overall label/score.
   - Optional legacyScores helps old clients if you want to embed both.
   ========================================================================== */

export const OverallSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string().min(1),
});

export const SubmetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  verdict: z.string().default("").optional(),
  // score is optional for now; you can enable once you compute it
  score: z.number().min(0).max(100).nullable().optional(),
});

export const FeatureBlockSchema = z.object({
  key: z.enum(metricKeys),
  label: z.string().min(1),
  overall: OverallSchema,
  submetrics: z.array(SubmetricSchema).length(4),
});

export const AnalysisV2Schema = z.object({
  version: z.literal("analysis-v2"),
  features: z.array(FeatureBlockSchema).min(1),
  overall: OverallSchema.optional(),
  legacyScores: ScoresSchema.partial().optional(),
});

export type AnalysisV2 = z.infer<typeof AnalysisV2Schema>;

/* ============================================================================
   Recommendations (unchanged from your file)
   ========================================================================== */

export const GenderSchema = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof GenderSchema>;

export const RecommendationItemSchema = z.object({
  metric: z.enum(metricKeys),
  score: z.number().min(0).max(100),
  title: z.string().max(40).optional(),
  finding: z.string().max(120).optional(),
  recommendation: z.string().max(220),
  priority: z.enum(["low", "medium", "high"]),
  expected_gain: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val: number | string | undefined) =>
      typeof val === "string" ? parseFloat(val) : val
    ),
});
export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

export const RecommendationsRequestSchema = z.object({
  age: z.number().int().min(10).max(100),
  gender: GenderSchema.optional(),
  ethnicity: z.string().optional(),
  metrics: z.array(
    z.object({
      key: z.enum(metricKeys),
      score: z.number().min(0).max(100),
      notes: z.string().optional(),
    })
  ),
});
export type RecommendationsRequest = z.infer<
  typeof RecommendationsRequestSchema
>;

export const RecommendationsResponseSchema = z.object({
  summary: z.string(),
  items: z.array(RecommendationItemSchema),
  version: z.literal("v1"),
});
export type RecommendationsResponse = z.infer<
  typeof RecommendationsResponseSchema
>;
 