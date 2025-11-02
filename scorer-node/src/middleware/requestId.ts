// src/middleware/requestId.ts
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Correlates logs and jobs per HTTP request.
 * - Accepts incoming X-Request-Id if present (e.g., from proxies)
 * - Otherwise generates a UUIDv4
 * - Exposes the id on req, res.locals, response header, and via AsyncLocalStorage
 *
 * ESM note: when importing from index.ts use "./middleware/requestId.js"
 */

const REQ_ID_HEADER = "x-request-id";

type Store = { requestId: string };
export const reqContext = new AsyncLocalStorage<Store>();

export function requestId() {
  return function requestIdMiddleware(req: any, res: any, next: () => void) {
    const incoming = (req.headers?.[REQ_ID_HEADER] as string | undefined)?.toString();
    const id = incoming && incoming.length > 0 ? incoming : randomUUID();

    // attach in convenient places
    req.requestId = id;
    res.locals = res.locals || {};
    res.locals.requestId = id;
    res.setHeader("X-Request-Id", id);

    // run the rest of the pipeline within the ALS scope so logs can read it
    reqContext.run({ requestId: id }, () => next());
  };
}

/** Read the current request id from anywhere (logs, helpers, etc.). */
export function getRequestId(): string | undefined {
  return reqContext.getStore()?.requestId;
}
