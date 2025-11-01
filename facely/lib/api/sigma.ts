// facely/lib/api/sigma.ts
import { z } from "zod";
import {
  SigmaThreadSchema,
  CreateThreadResponseSchema,
  SendMessageResponseSchema,
  SigmaErrorSchema,
  type SigmaThread,
  type SigmaMessage,
  type CreateThreadResponse,
  type SendMessageResponse,
} from "../types/sigma";
import { API_BASE } from "./config";

/* ============================================================
 * Sigma API Client
 * ============================================================
 */

const SIGMA_BASE = `${API_BASE}/sigma`;

/** Create a new chat thread */
export async function createSigmaThread(): Promise<CreateThreadResponse> {
  const res = await fetch(`${SIGMA_BASE}/thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(SigmaErrorSchema.parse(json)));
  return CreateThreadResponseSchema.parse(json);
}

/** Fetch an existing thread by ID */
export async function getSigmaThread(id: string): Promise<SigmaThread> {
  const res = await fetch(`${SIGMA_BASE}/thread/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(SigmaErrorSchema.parse(json)));
  return SigmaThreadSchema.parse(json);
}

/** Send a message to Sigma and receive assistant reply */
export async function sendSigmaMessage(args: {
  thread_id: string;
  user_text: string;
  share_scores?: boolean;
  share_routine?: boolean;
}): Promise<SendMessageResponse> {
  const res = await fetch(`${SIGMA_BASE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(SigmaErrorSchema.parse(json)));
  return SendMessageResponseSchema.parse(json);
}

/** Utility: optimistic append on the client */
export function makeLocalUserMessage(content: string): SigmaMessage {
  return {
    id: Math.random().toString(36).slice(2),
    role: "user",
    content,
    created_at: new Date().toISOString(),
  };
}
