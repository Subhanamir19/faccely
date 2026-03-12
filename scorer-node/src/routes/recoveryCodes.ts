import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { supabase } from "../supabase/client.js";
import { verifyAuth } from "../middleware/auth.js";

// Alphabet excludes visually ambiguous chars: 0/O, 1/I/L
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const segment = (len: number) =>
    Array.from(crypto.randomBytes(len))
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join("");
  return `${segment(4)}-${segment(4)}-${segment(4)}`;
}

// Strict rate limit on restore: 5 attempts per 15 min per IP
const restoreRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "too_many_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// POST /recovery-codes/generate — authenticated
// Returns existing code or creates a new one. Idempotent.
router.post("/generate", verifyAuth, async (req, res) => {
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

    // Only retry on unique constraint violation
    if (!error.message.includes("unique")) {
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

  const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
    user_id: data.user_id,
  });

  if (sessionError || !sessionData?.session) {
    console.error("[recovery] Session creation failed:", sessionError?.message);
    return res.status(500).json({ error: "session_creation_failed" });
  }

  return res.json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    user_id: data.user_id,
  });
});

export default router;
