import type { NextFunction, Request, Response } from "express";
import { jwtVerify, type JWTPayload } from "jose";
import { AUTH, IS_DEV } from "../config/index.js";

/**
 * Auth middleware for Supabase JWT validation.
 *
 * In production: Requires valid Supabase JWT token
 * In development: Falls back to consistent dev user if no JWT secret configured
 */

// Pre-encode JWT secret once at startup (null if not configured)
const jwtSecret = AUTH.jwtSecret ? new TextEncoder().encode(AUTH.jwtSecret) : null;

// Consistent dev user ID - use a valid UUID format so it can exist in DB if needed
const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

function extractBearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function setIdentityFromClaims(res: Response, payload: JWTPayload): void {
  const userId = typeof payload.sub === "string" ? payload.sub : undefined;
  const email = typeof (payload as Record<string, unknown>).email === "string"
    ? (payload as Record<string, unknown>).email as string
    : undefined;

  if (userId) res.locals.userId = userId;
  if (email) res.locals.email = email;
}

export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);

  // Case 1: Token provided - validate it
  if (token) {
    // If JWT validation is not configured
    if (!jwtSecret) {
      if (IS_DEV) {
        // Development: use consistent dev user
        console.log("[auth] dev mode: JWT not configured, using dev user");
        res.locals.userId = DEV_USER_ID;
        return next();
      }
      // Production without JWT secret is a misconfiguration
      console.error("[auth] FATAL: No SUPABASE_JWT_SECRET in production");
      return res.status(500).json({ error: "server_misconfigured" });
    }

    // Validate the JWT
    try {
      const { payload } = await jwtVerify(token, jwtSecret, {
        issuer: AUTH.issuer ?? undefined,
        audience: AUTH.audience ?? undefined,
        algorithms: ["HS256"],
      });

      setIdentityFromClaims(res, payload);

      if (!res.locals.userId) {
        return res.status(401).json({ error: "invalid_token", reason: "missing_sub" });
      }

      return next();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      console.warn("[auth] JWT verification failed:", message);
      return res.status(401).json({ error: "invalid_token" });
    }
  }

  // Case 2: No token provided
  if (IS_DEV) {
    // Development: allow requests without auth using dev user
    console.log("[auth] dev mode: no token, using dev user");
    res.locals.userId = DEV_USER_ID;
    return next();
  }

  // Production: require authentication
  return res.status(401).json({ error: "missing_token" });
}
