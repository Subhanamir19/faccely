// lib/api/protocols.ts
import { z } from "zod";
import { API_BASE } from "./config";
import { requestJSON, DEFAULT_REQUEST_TIMEOUT_MS } from "./client";
import type { Scores } from "./scores";
import { getAuthState } from "@/store/auth";

export type ProtocolBucketKey =
  | "glass_skin"
  | "debloating"
  | "facial_symmetry"
  | "maxilla"
  | "hunter_eyes"
  | "cheekbones"
  | "nose"
  | "jawline";

export type ProtocolsResponse = z.infer<typeof ProtocolsResponseSchema>;

const ProtocolsBuckets = [
  "glass_skin",
  "debloating",
  "facial_symmetry",
  "maxilla",
  "hunter_eyes",
  "cheekbones",
  "nose",
  "jawline",
] as const satisfies ProtocolBucketKey[];

const ProtocolsResponseSchema = z
  .object({
    scanId: z.string().min(1).nullable(),
    source: z.enum(["history", "payload"]),
    modelVersion: z.string().nullable(),
    createdAt: z.string().datetime(),
    protocols: z.object(
      ProtocolsBuckets.reduce(
        (shape, key) => {
          shape[key] = z.string().min(1);
          return shape;
        },
        {} as Record<(typeof ProtocolsBuckets)[number], z.ZodString>
      )
    ),
  })
  .strict();

function buildAuthHeaders(): Record<string, string> {
  const state = getAuthState();
  const headers: Record<string, string> = {};
  const userId = state.uid ?? state.user?.uid ?? undefined;
  const email = state.user?.email ?? undefined;
  const deviceId = state.deviceId ?? undefined;
  const idToken = state.idToken ?? undefined;

  if (userId) headers["x-user-id"] = userId;
  if (email) headers["x-email"] = email;
  if (deviceId) headers["x-device-id"] = deviceId;
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  return headers;
}

async function postProtocols(body: Record<string, unknown>): Promise<ProtocolsResponse> {
  return requestJSON<ProtocolsResponse>(`${API_BASE}/protocols`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: JSON.stringify(body),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    context: "Protocols request failed",
    schema: ProtocolsResponseSchema,
  });
}

export async function generateProtocolsFromScan(scanId: string): Promise<ProtocolsResponse> {
  return postProtocols({ scanId });
}

export async function generateProtocolsFromPayload(
  scores: Scores,
  explanations?: Record<string, string[]> | null
): Promise<ProtocolsResponse> {
  const payload: Record<string, unknown> = { scores };
  if (explanations !== undefined) {
    payload.explanations = explanations;
  }
  return postProtocols(payload);
}
