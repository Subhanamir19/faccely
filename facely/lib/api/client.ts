// facely/lib/api/client.ts
// Centralised helpers for talking to the scorer API.
// Keeps timeout/error handling consistent across all endpoints.

export type FetchWithTimeoutOptions = RequestInit & { timeoutMs?: number };

export class ApiResponseError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.body = body;
  }
}

function createTimeoutController(
  timeoutMs: number,
  upstreamSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, Math.max(0, timeoutMs));

  const abortFromUpstream = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener("abort", abortFromUpstream);
    }
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", abortFromUpstream);
    }
  };

  return { signal: controller.signal, cleanup };
}

/** fetch() wrapper that adds an abortable timeout. */
export async function fetchWithTimeout(
  input: RequestInfo,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 30_000, signal, ...rest } = init;
  const upstreamSignal = signal ?? undefined;

  if (timeoutMs <= 0 && !upstreamSignal) {
    return fetch(input, rest);
  }

  if (timeoutMs <= 0) {
    return fetch(input, { ...rest, signal: upstreamSignal });
  }

  const { signal: timeoutSignal, cleanup } = createTimeoutController(
    timeoutMs,
    upstreamSignal
  );

  try {
    return await fetch(input, { ...rest, signal: timeoutSignal });
  } finally {
    cleanup();
  }
}

/**
 * Build an informative ApiResponseError using the response payload (JSON or text).
 */
export async function buildApiError(
  res: Response,
  contextMessage = "Request failed"
): Promise<ApiResponseError> {
  const contentType = res.headers.get("content-type") ?? "";
  let body: unknown = undefined;
  let text: string | null = null;

  try {
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      text = await res.text();
    }
  } catch {
    // Ignore parse errors; we'll fall back to status.
  }

  const detail = (() => {
    if (!body || typeof body !== "object") return undefined;
    const data = body as Record<string, unknown>;
    const maybe = data.detail ?? data.error ?? data.message;
    return typeof maybe === "string" ? maybe : undefined;
  })();

  const statusLine = `HTTP ${res.status}`;
  const suffix = detail || text?.trim();
  const message = suffix
    ? `${contextMessage}: ${statusLine} — ${suffix}`
    : `${contextMessage}: ${statusLine}`;

  return new ApiResponseError(res.status, message, body ?? text ?? undefined);
}

export function toUserFacingError(err: unknown, fallback: string): Error {
  if (err instanceof Error) {
    if (err.message) return err;
    return new Error(fallback);
  }
  if (typeof err === "string" && err.trim().length) {
    return new Error(err);
  }
  return new Error(fallback);
}