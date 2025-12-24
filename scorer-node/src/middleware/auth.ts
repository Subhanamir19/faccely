import type { NextFunction, Request, Response } from "express";
import { jwtVerify, type JWTPayload } from "jose";
import { AUTH, FEATURES } from "../config/index.js";

const jwtSecret = AUTH.supabaseJwtSecret ? new TextEncoder().encode(AUTH.supabaseJwtSecret) : null;

function bearerFrom(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function setIdentityFromClaims(res: Response, payload: JWTPayload) {
  const userId = typeof payload.sub === "string" ? payload.sub : undefined;
  const email = typeof (payload as any)?.email === "string" ? (payload as any).email : undefined;
  const deviceId =
    typeof (payload as any)?.device_id === "string"
      ? (payload as any).device_id
      : typeof (payload as any)?.deviceId === "string"
      ? (payload as any).deviceId
      : undefined;

  if (userId) res.locals.userId = userId;
  if (email) res.locals.email = email;
  if (deviceId) res.locals.deviceId = deviceId;
}

function setIdentityFromHeaders(req: Request, res: Response) {
  const userId = req.header("x-user-id")?.trim();
  const email = req.header("x-email")?.trim();
  const deviceId = req.header("x-device-id")?.trim();

  if (userId) res.locals.userId = userId;
  if (email) res.locals.email = email;
  if (deviceId) res.locals.deviceId = deviceId;
}

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  console.log("[auth] verifyAuth start", { hasAuthHeader: !!req.headers.authorization });
  const token = bearerFrom(req);
  if (token) {
    if (!jwtSecret) {
      console.log("[auth] invalid_token: no SUPABASE_JWT_SECRET configured");
      return res.status(401).json({ error: "invalid_token" });
    }
    try {
      const { payload } = await jwtVerify(token, jwtSecret, {
        issuer: AUTH.supabaseIssuer ?? undefined,
        audience: AUTH.supabaseAudience ?? undefined,
        algorithms: ["HS256"],
      });
      console.log("[auth] jwtVerify success", {
        hasSub: typeof payload.sub === "string",
        issuer: payload.iss,
      });
      setIdentityFromClaims(res, payload);
      if (!res.locals.userId) {
        console.log("[auth] invalid_token: missing sub in payload");
        return res.status(401).json({ error: "invalid_token" });
      }
      return next();
    } catch (err: any) {
      console.log("[auth] jwtVerify error", { name: err?.name, message: err?.message });
      return res.status(401).json({ error: "invalid_token" });
    }
  }

  if (FEATURES.allowHeaderIdentity) {
    console.log("[auth] header fallback", {
      allowHeaderIdentity: true,
      userId: req.headers["x-user-id"],
    });
    setIdentityFromHeaders(req, res);
    return next();
  }

  console.log("[auth] missing_token: no bearer and no header fallback");
  return res.status(401).json({ error: "missing_token" });
}
