// src/middleware/idempotency.ts
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { TTL, SERVICE } from "../config/index.js";
import { getRequestId } from "./requestId.js";
import { getRedis, k as kNS } from "../lib/redis.js";

/**
 * Idempotency guard with replay.
 *
 * Behavior:
 * - Key: prefer client "X-Idempotency-Key"; else derive from method|path|query|body.
 * - On hit:
 *    • state=PENDING → 202 with original { job_id, status_url, queue }
 *    • state=COMPLETED → 200 with stored response body
 * - On miss:
 *    • claim the key (NX) with TTL, attach helpers on res.locals to record PENDING/COMPLETED
 *    • proceed to route handler (which enqueues job and calls setPending)
 *
 * Works without Redis via process-local fallback (best effort).
 */

const HEADER = "x-idempotency-key";
const localStore = new Map<
  string,
  {
    state: "PENDING" | "COMPLETED";
    job_id?: string;
    status_url?: string;
    body?: any;
    queue?: string;
    claimedAt: number;
  }
>();

type RecordShape = {
  state: "PENDING" | "COMPLETED";
  job_id?: string;
  status_url?: string;
  body?: any;
  queue?: string;
  claimedAt: number;
};

function stableJson(x: unknown): string {
  try {
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const obj = x as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = obj[k];
      return JSON.stringify(out);
    }
    return JSON.stringify(x);
  } catch {
    return "";
  }
}

type MulterFileLike = {
  fieldname?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

function isMulterFileLike(file: unknown): file is MulterFileLike {
  return Boolean(
    file &&
    typeof file === "object" &&
    Buffer.isBuffer((file as MulterFileLike).buffer)
  );
}

function collectMulterFiles(req: Request): MulterFileLike[] {
  const anyReq = req as Request & {
    file?: MulterFileLike;
    files?:
      | MulterFileLike
      | MulterFileLike[]
      | Record<string, MulterFileLike | MulterFileLike[] | undefined>;
  };
  const found: MulterFileLike[] = [];
  if (isMulterFileLike(anyReq.file)) found.push(anyReq.file);

  const multi = anyReq.files;
  if (!multi) return found;

  if (Array.isArray(multi)) {
    for (const item of multi) if (isMulterFileLike(item)) found.push(item);
    return found;
  }

  if (isMulterFileLike(multi)) {
    found.push(multi);
    return found;
  }

  if (typeof multi === "object") {
    for (const value of Object.values(multi)) {
      if (Array.isArray(value)) {
        for (const item of value) if (isMulterFileLike(item)) found.push(item);
      } else if (isMulterFileLike(value)) {
        found.push(value);
      }
    }
  }

  return found;
}

function filesFingerprint(req: Request): string | undefined {
  const files = collectMulterFiles(req);
  if (!files.length) return undefined;

  const h = createHash("sha256");
  const sorted = files
    .map((file, idx) => ({
      file,
      order: `${file.fieldname ?? ""}:${file.originalname ?? ""}:${idx}`,
    }))
    .sort((a, b) => a.order.localeCompare(b.order));

  for (const { file } of sorted) {
    if (file.fieldname) h.update(file.fieldname);
    if (file.originalname) h.update(file.originalname);
    if (file.mimetype) h.update(file.mimetype);
    h.update(String(file.size ?? file.buffer?.length ?? 0));
    if (file.buffer) h.update(file.buffer);
  }

  return h.digest("hex").slice(0, 32);
}

function deriveKey(req: Request): string {
  const provided = String(req.headers[HEADER] ?? "").trim();
  if (provided) return provided;

  const filesToken = filesFingerprint(req);
  const basis = [
    req.method.toUpperCase(),
    req.path,
    new URLSearchParams(req.query as Record<string, string>).toString(),
    stableJson(req.body ?? {}),
    filesToken ? `files:${filesToken}` : "",
  ]
    .filter(Boolean)
    .join("|");

  const h = createHash("sha256").update(basis).digest("hex").slice(0, 32);
  return `${SERVICE.name}:idem:${h}`;
}

// ==== Redis helpers (ioredis-style positional args) ====

async function redisGet(nsKey: string): Promise<RecordShape | null> {
  const r = await getRedis().catch(() => null);
  if (!r) return null;
  const raw = await (r as any).get(nsKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecordShape;
  } catch {
    return null;
  }
}

async function redisSetNX(nsKey: string, value: RecordShape, ttlS: number): Promise<boolean> {
  const r = await getRedis().catch(() => null);
  if (!r) return false;
  // ioredis: set key value 'EX' ttl 'NX'
  const res = await (r as any).set(nsKey, JSON.stringify(value), "EX", ttlS, "NX");
  return res === "OK";
}

async function redisSet(nsKey: string, value: RecordShape, ttlS: number): Promise<void> {
  const r = await getRedis().catch(() => null);
  if (!r) return;
  // ioredis: set key value 'EX' ttl
  await (r as any).set(nsKey, JSON.stringify(value), "EX", ttlS);
}

// ======================================================

export function idempotency() {
  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = deriveKey(req);
    const nsKey = kNS("idem", key);
    res.setHeader("X-Idempotency-Key", key);
    res.locals.idempotencyKey = key;

    const ttlS = Number(TTL?.idempotencyS ?? 15 * 60);
    const _rid = getRequestId(); // tagging hook if you log per-request

    // 1) Redis path
    try {
      const existing = await redisGet(nsKey);
      if (existing) {
        if (existing.state === "COMPLETED") {
          return res.status(200).json(existing.body);
        }
        if (existing.state === "PENDING") {
          return res.status(202).json({
            job_id: existing.job_id,
            status_url: existing.status_url,
            queue: existing.queue ?? SERVICE.name,
            idempotencyKey: key,
          });
        }
      }

      // Claim NX with TTL
      const claimed: RecordShape = {
        state: "PENDING",
        claimedAt: Date.now(),
        job_id: undefined,
        status_url: undefined,
        queue: SERVICE.name,
      };
      const ok = await redisSetNX(nsKey, claimed, ttlS);
      if (!ok) {
        const again = await redisGet(nsKey);
        if (again?.state === "COMPLETED") {
          return res.status(200).json(again.body);
        }
        return res.status(202).json({
          job_id: again?.job_id,
          status_url: again?.status_url,
          queue: again?.queue ?? SERVICE.name,
          idempotencyKey: key,
        });
      }

      // Attach helpers for route to write-through
      res.locals.idempotency = {
        key,
        async setPending(job_id: string, status_url: string) {
          const cur = (await redisGet(nsKey)) ?? { state: "PENDING", claimedAt: Date.now(), queue: SERVICE.name };
          await redisSet(nsKey, { ...cur, state: "PENDING", job_id, status_url, queue: SERVICE.name }, ttlS);
        },
        async setCompleted(body: any) {
          const cur = (await redisGet(nsKey)) ?? { state: "PENDING", claimedAt: Date.now(), queue: SERVICE.name };
          await redisSet(nsKey, { ...cur, state: "COMPLETED", body, queue: SERVICE.name }, ttlS);
        },
      };

      return next();
    } catch (e) {
      // 2) Local fallback
      console.warn("[idem] Redis unavailable; falling back to local store:", (e as Error)?.message);

      const now = Date.now();
      const local = localStore.get(key);
      if (local) {
        if (local.state === "COMPLETED") {
          return res.status(200).json(local.body);
        }
        if (now - local.claimedAt < ttlS * 1000) {
          return res.status(202).json({
            job_id: local.job_id,
            status_url: local.status_url,
            queue: local.queue ?? SERVICE.name,
            idempotencyKey: key,
          });
        }
      }

      const record: RecordShape = { state: "PENDING", claimedAt: now, queue: SERVICE.name };
      localStore.set(key, record);

      res.locals.idempotency = {
        key,
        async setPending(job_id: string, status_url: string) {
          const cur = localStore.get(key) ?? record;
          localStore.set(key, { ...cur, state: "PENDING", job_id, status_url, queue: SERVICE.name });
        },
        async setCompleted(body: any) {
          const cur = localStore.get(key) ?? record;
          localStore.set(key, { ...cur, state: "COMPLETED", body, queue: SERVICE.name });
        },
      };

      // prune expired
      if (localStore.size > 5000) {
        for (const [k, rec] of localStore) {
          if (now - rec.claimedAt > ttlS * 1000) localStore.delete(k);
        }
      }

      return next();
    }
  };
}
