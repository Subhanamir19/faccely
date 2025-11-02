// src/middleware/idempotency.ts
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { TTL, SERVICE } from "../config/index.js";
import { getRequestId } from "./requestId.js";
import { getRedis, redisSetEx, k as kNS } from "../lib/redis.js";

/**
 * Idempotency guard for write-ish or heavy endpoints.
 *
 * Behavior:
 * - If client sends X-Idempotency-Key, we honor it.
 * - Else we derive a key from method + path + query + body snapshot.
 * - We try to "claim" the key in Redis with NX + TTL.
 * - If claim fails, we return 409 Conflict (duplicate_request).
 *
 * Notes:
 * - Works even when Redis is absent: falls back to process-local Map (best effort).
 * - Attach the resolved key to res.locals.idempotencyKey and echo as header.
 * - Place AFTER JSON parser (and, if you want file content in the key, after Multer).
 */

const HEADER = "x-idempotency-key";
const localClaims = new Map<string, number>(); // fallback when Redis is off

function stableJson(x: unknown): string {
  try {
    return JSON.stringify(x, Object.keys(x as object).sort());
  } catch {
    return "";
  }
}

function deriveKey(req: Request): string {
  const provided = String(req.headers[HEADER] ?? "").trim();
  if (provided) return provided;

  // Avoid pulling huge buffers here; keep it cheap and deterministic.
  const basis = [
    req.method.toUpperCase(),
    req.path,
    new URLSearchParams(req.query as Record<string, string>).toString(),
    stableJson(req.body ?? {}),
  ].join("|");

  const h = createHash("sha256").update(basis).digest("hex").slice(0, 32);
  return `${SERVICE.name}:idem:${h}`;
}

export function idempotency() {
  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = deriveKey(req);
    res.setHeader("X-Idempotency-Key", key);
    res.locals.idempotencyKey = key;

    // Tag logs via request id if present
    const rid = getRequestId();
    const nsKey = kNS("idem", key);

    // Prefer Redis when available
    try {
      const r = await getRedis();
      if (r) {
        // SET NX with TTL
        const ok = await r.set(nsKey, rid ?? "1", "EX", TTL.idempotencyS, "NX");
        if (ok !== "OK") {
          return res.status(409).json({
            error: "duplicate_request",
            hint: "An identical request is already being processed. Retry later.",
          });
        }
        return next();
      }
    } catch (e) {
      // fall through to local map
      console.warn("[idem] Redis unavailable, using local fallback:", (e as Error)?.message);
    }

    // Local best-effort fallback
    const now = Date.now();
    const seenAt = localClaims.get(key);
    if (seenAt && now - seenAt < TTL.idempotencyS * 1000) {
      return res.status(409).json({
        error: "duplicate_request",
        hint: "An identical request is already being processed. Retry later.",
      });
    }
    localClaims.set(key, now);
    // lazy cleanup
    if (localClaims.size > 5000) {
      for (const [k, t] of localClaims) if (now - t > TTL.idempotencyS * 1000) localClaims.delete(k);
    }
    next();
  };
}
