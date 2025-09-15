import { z } from "zod";

export const metricKeys = [
  "jawline",
  "facial_symmetry",
  "skin_quality",
  "cheekbones",
  "eyes_symmetry",
  "nose_harmony",
  "sexual_dimorphism",
  "youthfulness",
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
  youthfulness: z.number().min(0).max(100),
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
  youthfulness: z.array(z.string()).length(2),
});

export type Explanations = z.infer<typeof ExplanationsSchema>;
