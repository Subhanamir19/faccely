// scorer-node/src/schemas/SigmaSchema.ts
import { z } from "zod";

/* ============================================================
 * Sigma Chat: Shared Schemas & Types (backend contracts)
 * Pure Zod. No side effects. No external imports.
 * ============================================================
 */

/* ------------------------- Primitives ------------------------- */

export const SigmaRoleSchema = z.enum(["user", "assistant", "system"]);
export type SigmaRole = z.infer<typeof SigmaRoleSchema>;

export const SigmaAttachmentSchema = z.object({
  type: z.enum(["image", "scores", "routine_context"]),
  url: z.string().url().optional(), // presigned URL if image
  meta: z.record(z.unknown()).optional(),
});
export type SigmaAttachment = z.infer<typeof SigmaAttachmentSchema>;

/* --------------------------- Message -------------------------- */

export const SigmaMessageSchema = z.object({
  id: z.string().min(1), // server-generated
  role: SigmaRoleSchema,
  content: z.string().min(1), // plain text; structured parts live in fields below
  created_at: z.string().datetime({ offset: true }), // ISO timestamp
  attachments: z.array(SigmaAttachmentSchema).max(8).optional(),
  suggested_next_steps: z.array(z.string().min(1)).max(8).optional(),
});
export type SigmaMessage = z.infer<typeof SigmaMessageSchema>;

/* ---------------------------- Thread -------------------------- */

export const SigmaThreadMetaSchema = z.object({
  latest_scores: z.record(z.number().min(0).max(100)).optional(),
  active_routine_day: z.number().int().nonnegative().optional(),
});

export const SigmaThreadSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  messages: z.array(SigmaMessageSchema),
  last_summary: z.string().optional(), // server-maintained rolling summary
  meta: SigmaThreadMetaSchema.optional(),
});
export type SigmaThread = z.infer<typeof SigmaThreadSchema>;

/* ------------------------- API: Requests ----------------------- */

export const CreateThreadRequestSchema = z.object({
  // reserved for future seed options; currently empty payload is allowed
});
export type CreateThreadRequest = z.infer<typeof CreateThreadRequestSchema>;

export const SendMessageRequestSchema = z.object({
  thread_id: z.string().min(1),
  user_text: z
    .string()
    .min(1, "Message cannot be empty")
    .max(16_000, "Message too long (max 16KB)"),
  share_scores: z.boolean().optional(),
  share_routine: z.boolean().optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/* ------------------------- API: Responses ---------------------- */

export const CreateThreadResponseSchema = z.object({
  id: z.string().min(1),
});
export type CreateThreadResponse = z.infer<typeof CreateThreadResponseSchema>;

export const GetThreadResponseSchema = SigmaThreadSchema;
export type GetThreadResponse = z.infer<typeof GetThreadResponseSchema>;

export const AssistantMessageResponseSchema = z.object({
  assistant_message: SigmaMessageSchema,
});
export type AssistantMessageResponse = z.infer<
  typeof AssistantMessageResponseSchema
>;

/* ---------------------- Utility Validators --------------------- */

// Lightweight guard used by routers to check path params
export const ThreadIdParamSchema = z.object({
  id: z.string().min(1),
});

// Simple pagination (reserved for future thread history endpoints)
export const PageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;
