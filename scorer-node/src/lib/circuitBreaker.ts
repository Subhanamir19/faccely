// src/lib/circuitBreaker.ts
// Circuit breaker pattern for external service calls (OpenAI)

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Number of failures before opening circuit
  successThreshold?: number;      // Number of successes in half-open to close circuit
  timeout?: number;               // Time in ms before attempting to close circuit
  resetTimeout?: number;          // Time in ms to reset failure count in closed state
}

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30_000;          // 30 seconds
    this.resetTimeout = options.resetTimeout ?? 60_000; // 1 minute
  }

  /**
   * Get current circuit state
   */
  getState(): { state: CircuitState; failures: number; successes: number } {
    this.checkStateTransition();
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowed(): boolean {
    this.checkStateTransition();
    return this.state !== "open";
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkStateTransition();

    if (this.state === "open") {
      const error = new Error("Circuit breaker is open");
      (error as any).code = "CIRCUIT_OPEN";
      (error as any).circuitState = this.state;
      throw error;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  onSuccess(): void {
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo("closed");
        console.log("[circuit-breaker] Circuit closed after successful recovery");
      }
    } else if (this.state === "closed") {
      // Reset failure count on success if enough time has passed
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.failures = 0;
      }
    }
  }

  /**
   * Record a failed call
   */
  onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    // Check if this is a rate limit error (should always open circuit)
    const isRateLimited = this.isRateLimitError(error);

    if (this.state === "half-open") {
      // Any failure in half-open state reopens the circuit
      this.transitionTo("open");
      console.warn("[circuit-breaker] Circuit reopened after failure in half-open state");
    } else if (this.state === "closed") {
      // Open circuit if threshold reached or rate limited
      if (this.failures >= this.failureThreshold || isRateLimited) {
        this.transitionTo("open");
        console.warn(`[circuit-breaker] Circuit opened after ${this.failures} failures${isRateLimited ? " (rate limited)" : ""}`);
      }
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo("closed");
    this.failures = 0;
    this.successes = 0;
    console.log("[circuit-breaker] Circuit manually reset");
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();
      this.successes = 0;

      if (newState === "closed") {
        this.failures = 0;
      }
    }
  }

  private checkStateTransition(): void {
    const now = Date.now();

    if (this.state === "open") {
      // Check if timeout has passed to transition to half-open
      if (now - this.lastStateChange >= this.timeout) {
        this.transitionTo("half-open");
        console.log("[circuit-breaker] Circuit transitioned to half-open");
      }
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error) return false;
    const err = error as Record<string, unknown>;
    const status = err.status ?? (err.response as Record<string, unknown>)?.status;
    return status === 429;
  }
}

// Singleton instance for OpenAI calls
export const openaiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes in half-open
  timeout: 30_000,          // Try to close after 30 seconds
  resetTimeout: 60_000,     // Reset failure count after 1 minute of success
});

/**
 * Wrap a function with circuit breaker protection
 * Returns the original error if circuit is closed/half-open
 * Returns a circuit-open error if circuit is open
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  breaker: CircuitBreaker = openaiCircuitBreaker
): Promise<T> {
  return breaker.execute(fn);
}
