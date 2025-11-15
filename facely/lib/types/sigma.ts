// facely/lib/types/sigma.ts
import { z } from "zod";

/* ============================================================
 * Core types for the Sigma chatbot
 * Mirrors backend schemas but simplified for client usage
 * ============================================================
 */

export const SigmaAttachmentSchema = z.object({
  type: z.enum(["image", "scores", "routine_context"]),
  url: z.string().url().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type SigmaAttachment = z.infer<typeof SigmaAttachmentSchema>;

/** Single message exchanged in chat */
export const SigmaMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
  attachments: z.array(SigmaAttachmentSchema).max(8).optional(),
  suggested_next_steps: z.array(z.string().min(1)).max(8).optional(),
});

export type SigmaMessage = z.infer<typeof SigmaMessageSchema>;

const SigmaThreadMetaSchema = z.object({
  latest_scores: z.record(z.string(), z.number().min(0).max(100)).optional(),
  active_routine_day: z.number().int().nonnegative().optional(),
});

/** Thread representing a full conversation */
export const SigmaThreadSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  messages: z.array(SigmaMessageSchema),
  last_summary: z.string().optional(),
  meta: SigmaThreadMetaSchema.optional(),
});

export type SigmaThread = z.infer<typeof SigmaThreadSchema>;

/** Create thread response */
export const CreateThreadResponseSchema = z.object({
  id: z.string(),
});
export type CreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

/** Send message response */
export const SendMessageResponseSchema = z.object({
  assistant_message: SigmaMessageSchema,
});
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/** Error payload shape from backend */
export const SigmaErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
});
export type SigmaError = z.infer<typeof SigmaErrorSchema>;

/* ============================================================
 * Client helpers
 * ============================================================
 */

export type SigmaThreadMap = Record<string, SigmaThread>;

/** Quick discriminated union for convenience */
export type SigmaRole = SigmaMessage["role"];
