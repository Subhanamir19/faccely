/**
 * lib/logger.ts
 *
 * Centralised logger — drop-in replacement for `console`.
 *
 * In development:  passes through to the native console so Metro/Flipper
 *                  shows everything as normal.
 * In production:   all methods are no-ops, so no data leaks and no perf cost.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.log('hello', value);
 *   logger.warn('something odd', value);
 *   logger.error('failure', error);
 *
 * Future: replace the no-op bodies with Sentry.captureMessage / Datadog calls
 * without touching any call-site.
 */

type LogLevel = "log" | "warn" | "error" | "info";

function makeLogger() {
  if (__DEV__) {
    return {
      log:   (...args: unknown[]) => console.log(...args),   // eslint-disable-line no-console
      warn:  (...args: unknown[]) => console.warn(...args),  // eslint-disable-line no-console
      error: (...args: unknown[]) => console.error(...args), // eslint-disable-line no-console
      info:  (...args: unknown[]) => console.info(...args),  // eslint-disable-line no-console
    };
  }

  // Production — wire up your error-tracking SDK here in the future:
  //   e.g. error: (...args) => Sentry.captureException(args[0])
  const noop = () => {};
  return {
    log:   noop,
    warn:  noop,
    error: noop,
    info:  noop,
  };
}

export const logger = makeLogger();
