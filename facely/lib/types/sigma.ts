// facely/lib/types/sigma.ts
import { z } from "zod";

/* ============================================================
 * Core types for the Sigma chatbot
 * Mirrors backend schemas but simplified for client usage
 * ============================================================
 */

/** Single message exchanged in chat */
export const SigmaMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string(),
  suggested_next_steps: z.array(z.string()).optional(),
});

export type SigmaMessage = z.infer<typeof SigmaMessageSchema>;

/** Thread representing a full conversation */
export const SigmaThreadSchema = z.object({
  id: z.string(),
  user_id: z.string().optional(),
  messages: z.array(SigmaMessageSchema),
  last_summary: z.string().optional(),
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
  error: z.string(),
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
