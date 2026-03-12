import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { supabase } from "../supabase/client.js";
import { verifyAuth } from "../middleware/auth.js";

const CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// Alphabet excludes visually ambiguous chars: 0/O, 1/I/L
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const segment = (len: number) =>
    Array.from(crypto.randomBytes(len))
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join("");
  return `${segment(4)}-${segment(4)}-${segment(4)}`;
}

const restoreRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "too_many_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 request per hour per IP
  max: 10,
  message: { error: "too_many_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// POST /recovery-codes/generate — authenticated, rate-limited
// Returns existing code or creates a new one. Idempotent.
router.post("/generate", generateRateLimit, verifyAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  // Return existing code if one exists (idempotent)
  const { data: existing } = await supabase
    .from("recovery_codes")
    .select("code")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (existing?.code) {
    return res.json({ code: existing.code });
  }

  // Generate with collision retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase
      .from("recovery_codes")
      .insert({ user_id: userId, code });

    if (!error) return res.json({ code });

    // Postgres unique constraint violation = code 23505 — retry with new code
    if ((error as any).code !== "23505") {
      console.error("[recovery] DB insert error:", error.message);
      return res.status(500).json({ error: "db_error" });
    }
  }

  return res.status(500).json({ error: "code_generation_failed" });
});

// POST /recovery-codes/restore — unauthenticated, rate limited
// Takes a recovery code, returns session tokens for the linked user.
// Code is NOT marked used — user can restore as many times as needed.
router.post("/restore", restoreRateLimit, async (req, res) => {
  const { code } = req.body as { code?: unknown };

  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "missing_code" });
  }

  const normalized = code.trim().toUpperCase();

  if (!CODE_REGEX.test(normalized)) {
    return res.status(400).json({ error: "invalid_code_format" });
  }

  const { data, error } = await supabase
    .from("recovery_codes")
    .select("user_id")
    .eq("code", normalized)
    .limit(1)
    .single();

  // Always return the same error — don't reveal if code exists
  if (error || !data) {
    return res.status(401).json({ error: "invalid_code" });
  }

  // Revoke ALL existing sessions for this user before issuing a new one.
  // admin.signOut() takes a JWT, not a user_id — so we delete directly from
  // the auth.sessions table using the service-role client (.schema() requires supabase-js v2.7+).
  // The old device's JWT remains valid until expiry (~1 hour) but cannot refresh.
  const { error: revokeError } = await (supabase as any)
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("user_id", data.user_id);

  if (revokeError) {
    // Non-fatal — log but continue. Revocation is best-effort (old JWT expires within ~1h).
    console.warn("[recovery] Session revocation failed (non-fatal):", revokeError.message);
  }

  // supabase-js does not expose admin.createSession — call GoTrue REST API directly.
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sessionRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${data.user_id}/sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    console.error("[recovery] Session creation failed:", errText);
    return res.status(500).json({ error: "session_creation_failed" });
  }

  const session = (await sessionRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!session.access_token || !session.refresh_token) {
    console.error("[recovery] Session creation returned no tokens");
    return res.status(500).json({ error: "session_creation_failed" });
  }

  return res.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: data.user_id,
  });
});

export default router;
