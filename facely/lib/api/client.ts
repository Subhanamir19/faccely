// facely/lib/api/client.ts
import { z } from "zod";
// Centralised helpers for talking to the scorer API.
// Keeps timeout/error handling consistent and observable.

export type FetchWithTimeoutOptions = RequestInit & { timeoutMs?: number };

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    const seconds = Math.max(1, Math.round(timeoutMs / 1000));
    super(`Request timed out after ${seconds} ${seconds === 1 ? "second" : "seconds"}`);
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export const LONG_REQUEST_TIMEOUT_MS = 180_000; // 3 min for large uploads
export const SHORT_REQUEST_TIMEOUT_MS = 15_000; // legacy quick call
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000; // general default
export const DEFAULT_UPLOAD_TIMEOUT_MS = __DEV__ ? 45_000 : 30_000; // emulator is slower

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

/* -------------------------------------------------------------------------- */
/*   Internal: build AbortController with timeout                             */
/* -------------------------------------------------------------------------- */

function createTimeoutController(
  timeoutMs: number,
  upstreamSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) controller.abort();
  }, Math.max(0, timeoutMs));

  const abortFromUpstream = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) abortFromUpstream();
    else upstreamSignal.addEventListener("abort", abortFromUpstream);
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (upstreamSignal) upstreamSignal.removeEventListener("abort", abortFromUpstream);
  };

  return { signal: controller.signal, cleanup, didTimeout: () => timedOut };
}

/* -------------------------------------------------------------------------- */
/*   fetch() wrapper with structured logging + timeout                        */
/* -------------------------------------------------------------------------- */

export async function fetchWithTimeout(
  input: RequestInfo,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...rest } = init;
  const upstreamSignal = signal ?? undefined;

  // short-circuit: no timeout
  if (timeoutMs <= 0 && !upstreamSignal) return fetch(input, rest);
  if (timeoutMs <= 0) return fetch(input, { ...rest, signal: upstreamSignal });

  const { signal: timeoutSignal, cleanup, didTimeout } = createTimeoutController(
    timeoutMs,
    upstreamSignal
  );

  const start = Date.now();
  const url = typeof input === "string" ? input : (input as Request).url;
  const method =
    (typeof input === "object" && "method" in input ? (input as any).method : rest.method) ||
    "GET";

  try {
    const res = await fetch(input, { ...rest, signal: timeoutSignal });
    const duration = Date.now() - start;

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[net] ${method} ${url} → ${res.status} (${duration} ms)`);
    }

    return res;
  } catch (err) {
    const duration = Date.now() - start;
    if (didTimeout()) {
      // eslint-disable-next-line no-console
      console.error(`[net] ${method} ${url} timed out after ${timeoutMs} ms`);
      throw new RequestTimeoutError(timeoutMs);
    }

    // eslint-disable-next-line no-console
    console.error(`[net] ${method} ${url} failed after ${duration} ms:`, err);
    throw err;
  } finally {
    cleanup();
  }
}

/* -------------------------------------------------------------------------- */
/*   Retry wrapper for flaky mobile networks & big uploads                    */
/* -------------------------------------------------------------------------- */

function isRetryableNetworkError(e: unknown) {
  // AbortError, our RequestTimeoutError, or generic fetch TypeError
  const name = (e as any)?.name;
  const msg = String((e as any)?.message || "").toLowerCase();
  return (
    name === "AbortError" ||
    e instanceof RequestTimeoutError ||
    msg.includes("network") ||
    (e as any)?.type === "system"
  );
}

/**
 * Retries fetchWithTimeout with expo-friendly backoff.
 * Default: 3 attempts, 800ms base backoff with jitter.
 */
export async function fetchWithRetry(
  input: RequestInfo,
  init: FetchWithTimeoutOptions = {},
  attempts = 3,
  backoffMs = 800
): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchWithTimeout(input, init);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1 && isRetryableNetworkError(e)) {
        const sleep = backoffMs * Math.pow(2, i) + Math.floor(Math.random() * 200);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(`[net] retrying (${i + 1}/${attempts - 1}) in ${sleep}ms`);
        }
        await new Promise((r) => setTimeout(r, sleep));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/* -------------------------------------------------------------------------- */
/*   Build informative ApiResponseError from payload                          */
/* -------------------------------------------------------------------------- */

export async function buildApiError(
  res: Response,
  contextMessage = "Request failed"
): Promise<ApiResponseError> {
  const contentType = res.headers.get("content-type") ?? "";
  let body: unknown;
  let text: string | null = null;

  try {
    if (contentType.includes("application/json")) body = await res.json();
    else text = await res.text();
  } catch {
    // swallow parse issues
  }

  const detail = (() => {
    if (!body || typeof body !== "object") return undefined;
    const data = body as Record<string, unknown>;
    const maybe = data.detail ?? data.error ?? data.message ?? data.hint;
    return typeof maybe === "string" ? maybe : undefined;
  })();

  const statusLine = `HTTP ${res.status}`;
  const suffix = detail || text?.trim();
  const message = suffix
    ? `${contextMessage}: ${statusLine} — ${suffix}`
    : `${contextMessage}: ${statusLine}`;

  return new ApiResponseError(res.status, message, body ?? text ?? undefined);
}

/* -------------------------------------------------------------------------- */
/*   Convert any thrown junk into a clean Error for UI                        */
/* -------------------------------------------------------------------------- */

export function toUserFacingError(err: unknown, fallback: string): Error {
  if (err instanceof Error && err.message) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  return new Error(fallback);
}

type ErrorContext = "analyze" | "explain";

const BACKEND_ERROR_MAP: Record<
  ErrorContext,
  Partial<Record<string, string>>
> = {
  analyze: {
    invalid_scores_json:
      "There was an internal issue with your last scan. Please retake your photos and try again.",
    invalid_scores_payload:
      "There was an internal issue with your last scan. Please retake your photos and try again.",
    unsupported_media_type:
      "Use a clear JPEG or PNG photo instead of HEIC or unsupported formats.",
    payload_too_large:
      "Your image is too large. Try a smaller or cropped photo.",
    explanation_failed:
      "Face scoring failed unexpectedly. Please retry with a clear frontal and side photo.",
    server_overloaded:
      "Servers are busy at the moment. Please try again in a few minutes.",
  },
  explain: {
    invalid_scores_json:
      "There was an internal issue with your last scan. Please retake your photos and try again.",
    invalid_scores_payload:
      "There was an internal issue with your last scan. Please retake your photos and try again.",
    unsupported_media_type:
      "Use a clear JPEG or PNG photo instead of HEIC or unsupported formats.",
    payload_too_large:
      "Your image is too large. Try a smaller or cropped photo.",
    explanation_provider_malformed:
      "We couldn't generate detailed insights right now. Your scores are safe; please try again later.",
    explanation_failed:
      "We couldn't generate detailed insights right now. Your scores are safe; please try again later.",
    server_overloaded:
      "Servers are busy at the moment. Please try again in a few minutes.",
  },
};

function extractBackendErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiResponseError && typeof err.body === "object" && err.body) {
    const body = err.body as Record<string, unknown>;
    const code = body.errorCode ?? body.error ?? body.code;
    if (typeof code === "string") return code;
  }
  const message = (err as any)?.message;
  if (typeof message === "string") {
    const match = message.match(/\b([a-z_]+)\b/);
    return match?.[1];
  }
  return undefined;
}

export function mapBackendErrorToUserMessage(
  err: unknown,
  context: ErrorContext
): string {
  const defaultMessages: Record<ErrorContext, string> = {
    analyze: "Face scoring failed unexpectedly. Please retry with a clear frontal and side photo.",
    explain: "Advanced analysis failed unexpectedly. Please try again.",
  };

  const message = (err as any)?.message;
  const normalizedMessage = typeof message === "string" ? message : "";

  if (err instanceof RequestTimeoutError || normalizedMessage.toLowerCase().includes("timed out")) {
    return "The server took too long to respond. Please try again in a moment.";
  }

  const code = extractBackendErrorCode(err);
  if (code) {
    const mapped = BACKEND_ERROR_MAP[context][code];
    if (mapped) return mapped;
  }

  if (normalizedMessage.includes("NETWORK_LAYER_FAIL") || normalizedMessage.includes("Backend unreachable")) {
    return "We couldn't reach the Sigma Max servers. Check your internet connection and try again.";
  }

  return defaultMessages[context];
}

/* -------------------------------------------------------------------------- */
/*   Typed JSON requester with shared retry/error handling                    */
/* -------------------------------------------------------------------------- */

export type RequestJSONOptions<T> = FetchWithTimeoutOptions & {
  schema?: z.ZodType<T>;
  context?: string;
  parse?: (res: Response) => Promise<unknown>;
};

export async function requestJSON<T = unknown>(
  input: RequestInfo,
  options: RequestJSONOptions<T> = {}
): Promise<T> {
  const { schema, context = "Request failed", parse, ...fetchOptions } = options;

  const res = await fetchWithRetry(input, fetchOptions);
  if (!res.ok) throw await buildApiError(res, context);

  let payload: unknown;
  try {
    payload = parse ? await parse(res) : await res.json();
  } catch (err) {
    throw new ApiResponseError(
      res.status,
      `${context}: invalid_payload - ${err instanceof Error ? err.message : String(err)}`,
      undefined
    );
  }

  if (!schema) return payload as T;

  try {
    return schema.parse(payload);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ApiResponseError(
        res.status,
        `${context}: invalid_payload - ${err.message}`,
        payload
      );
    }
    throw err;
  }
}
