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
  type SigmaError,
} from "../types/sigma";
import { API_BASE } from "./config";
import { ApiResponseError, requestJSON } from "./client";

const SIGMA_BASE = `${API_BASE}/sigma`;

const NETWORK_ERROR: SigmaError = {
  code: "NETWORK_ERROR",
  message: "You appear to be offline. Check your connection and try again.",
};

const BAD_PAYLOAD_ERROR: SigmaError = {
  code: "BAD_PAYLOAD",
  message: "Sigma returned an unexpected response.",
};

const statusToError = (status: number): SigmaError => {
  if (status === 401 || status === 403) {
    return {
      code: "UNAUTHORIZED",
      message: "Your session expired. Please sign in again.",
    };
  }

  if (status === 404) {
    return {
      code: "THREAD_NOT_FOUND",
      message: "That conversation is no longer available.",
    };
  }

  if (status >= 500) {
    return {
      code: "SERVER_ERROR",
      message: "Sigma is warming up. Try again in a moment.",
    };
  }

  if (status >= 400) {
    return {
      code: "BAD_REQUEST",
      message: "Sigma couldn't understand that request.",
    };
  }

  return {
    code: "UNKNOWN",
    message: "Unexpected Sigma error.",
  };
};

const mapErrorPayload = (payload: unknown, status: number): SigmaError => {
  if (payload) {
    try {
      return SigmaErrorSchema.parse(payload);
    } catch {
      if (typeof payload === "string" && payload.length > 0) {
        return {
          code: `HTTP_${status}`,
          message: payload,
        };
      }
    }
  }

  return statusToError(status);
};

const requestSigma = async <T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>
): Promise<T> => {
  try {
    return await requestJSON<T>(path, {
      ...init,
      schema,
      context: "Sigma request failed",
    });
  } catch (err) {
    if (err instanceof ApiResponseError) {
      if (err.status === 200) throw BAD_PAYLOAD_ERROR;
      throw mapErrorPayload(err.body, err.status);
    }
    throw NETWORK_ERROR;
  }
};

/** Create a new chat thread */
export async function createSigmaThread(): Promise<CreateThreadResponse> {
  return requestSigma(`${SIGMA_BASE}/thread`, { method: "POST" }, CreateThreadResponseSchema);
}

/** Fetch an existing thread by ID */
export async function getSigmaThread(id: string): Promise<SigmaThread> {
  return requestSigma(`${SIGMA_BASE}/thread/${id}`, { method: "GET" }, SigmaThreadSchema);
}

/** Send a message to Sigma and receive assistant reply */
export async function sendSigmaMessage(args: {
  thread_id: string;
  user_text: string;
  share_scores?: boolean;
  share_routine?: boolean;
}): Promise<SendMessageResponse> {
  return requestSigma(
    `${SIGMA_BASE}/message`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
    SendMessageResponseSchema
  );
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
