// src/lib/retry.ts
// Retry utility with exponential backoff for transient failures

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "shouldRetry">> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Determines if an error is retryable based on HTTP status codes.
 * Retries on: 429 (rate limit), 5xx (server errors), network errors
 * Does NOT retry on: 4xx client errors (except 429)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;
  const status = err.status ?? (err.response as Record<string, unknown>)?.status;

  // Rate limited - always retry
  if (status === 429) return true;

  // Server errors - retry
  if (typeof status === "number" && status >= 500 && status <= 599) return true;

  // Client errors (4xx except 429) - don't retry
  if (typeof status === "number" && status >= 400 && status < 500) return false;

  // Network errors (no status) - retry
  const message = String(err.message ?? "").toLowerCase();
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    message.includes("network")
  ) {
    return true;
  }

  // Timeout errors - retry
  if (message.includes("timeout")) return true;

  // Unknown errors - don't retry by default
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @example
 * const result = await withRetry(
 *   () => openai.chat.completions.create({ ... }),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error, delay);
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[retry] attempt ${attempt}/${maxAttempts} failed: ${errMsg}, retrying in ${Math.round(delay)}ms`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Execute a function with retry, falling back to an alternative function on failure.
 *
 * @example
 * const result = await withRetryAndFallback(
 *   () => callPrimaryModel(),
 *   () => callFallbackModel(),
 *   { maxAttempts: 2 }
 * );
 */
export async function withRetryAndFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; usedFallback: boolean }> {
  try {
    const result = await withRetry(primary, options);
    return { result, usedFallback: false };
  } catch (primaryError) {
    console.warn("[retry] primary failed after retries, trying fallback:",
      primaryError instanceof Error ? primaryError.message : String(primaryError)
    );

    try {
      const result = await withRetry(fallback, options);
      return { result, usedFallback: true };
    } catch (fallbackError) {
      // Re-throw the original error if fallback also fails
      console.error("[retry] fallback also failed:",
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      );
      throw primaryError;
    }
  }
}
