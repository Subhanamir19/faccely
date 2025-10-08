// facely/lib/api/client.ts
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
export const SHORT_REQUEST_TIMEOUT_MS = 15_000; // standard quick call

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
  const { timeoutMs = 30_000, signal, ...rest } = init;
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

/* -------------------------------------------------------------------------- */
/*   Convert any thrown junk into a clean Error for UI                        */
/* -------------------------------------------------------------------------- */

export function toUserFacingError(err: unknown, fallback: string): Error {
  if (err instanceof Error && err.message) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  return new Error(fallback);
}
