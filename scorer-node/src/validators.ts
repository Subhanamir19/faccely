// C:\SS\scorer-node\src\validators.ts
import { z } from "zod";

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

/** Exactly two short strings per metric */
export const ExplanationsSchema = z.object({
  jawline: z.array(z.string()).length(2),
  facial_symmetry: z.array(z.string()).length(2),
  skin_quality: z.array(z.string()).length(2),
  cheekbones: z.array(z.string()).length(2),
  eyes_symmetry: z.array(z.string()).length(2),
  nose_harmony: z.array(z.string()).length(2),
  sexual_dimorphism: z.array(z.string()).length(2),
});

export type Explanations = z.infer<typeof ExplanationsSchema>;

/* ============================================================================
   NEW: Recommendations schemas (used by /recommendations endpoint)
   - Reuses your MetricKey union so strings stay consistent across app and API
   ============================================================================ */

   export const GenderSchema = z.enum(["male", "female", "other"]);
   export type Gender = z.infer<typeof GenderSchema>;
   
   export const RecommendationItemSchema = z.object({
     metric: z.enum(metricKeys),
     score: z.number().min(0).max(100),
     title: z.string().max(40).optional(),         // NEW: short imperative label
     finding: z.string().max(120).optional(),      // made optional
     recommendation: z.string().max(220),          // main action, concise
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
         notes: z.string().optional(), // optional qualitative note from analysis
       })
     ),
   });
   
   export type RecommendationsRequest = z.infer<
     typeof RecommendationsRequestSchema
   >;
   
   export const RecommendationsResponseSchema = z.object({
     summary: z.string(), // short overall plan
     items: z.array(RecommendationItemSchema), // per-metric actions
     version: z.literal("v1"),
   });
   
   export type RecommendationsResponse = z.infer<
     typeof RecommendationsResponseSchema
   >;
   