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

// Synthetic email used to enable magic-link restore for anonymous users.
// The user keeps the same user_id — only their email field changes.
function syntheticEmail(userId: string): string {
  return `${userId}@rc.facely.app`;
}

const restoreRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "too_many_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "too_many_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// POST /recovery-codes/generate — authenticated, rate-limited
// Returns existing code or creates a new one. Idempotent.
// Also ensures the user has a synthetic email so magic-link restore works.
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
    // Still ensure synthetic email exists (in case user generated code before this was added)
    await ensureSyntheticEmail(userId);
    return res.json({ code: existing.code });
  }

  // Ensure user has a synthetic email for future magic-link restore
  await ensureSyntheticEmail(userId);

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

async function ensureSyntheticEmail(userId: string): Promise<void> {
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  if (userData?.user?.email) return; // already has email

  const email = syntheticEmail(userId);
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (error) {
    console.warn("[recovery] Failed to assign synthetic email:", error.message);
  }
}

// POST /recovery-codes/restore — unauthenticated, rate limited
// Looks up recovery code, generates a magic-link OTP, and returns the token hash.
// Client exchanges the token hash for a Supabase session via verifyOtp().
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

  if (error || !data) {
    return res.status(401).json({ error: "invalid_code" });
  }

  // Get the user's email (may be synthetic for anonymous users)
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user_id);
  if (userError || !userData?.user) {
    console.error("[recovery] Failed to get user:", userError?.message);
    return res.status(500).json({ error: "user_not_found" });
  }

  // Assign synthetic email if the user has none (anonymous users)
  let email = userData.user.email;
  if (!email) {
    email = syntheticEmail(data.user_id);
    const { error: updateError } = await supabase.auth.admin.updateUserById(data.user_id, {
      email,
      email_confirm: true,
    });
    if (updateError) {
      console.error("[recovery] Failed to assign email:", updateError.message);
      return res.status(500).json({ error: "session_creation_failed" });
    }
  }

  // Generate a magic-link token. This does NOT send any email —
  // generateLink is an admin-only call that returns the raw token for us to use directly.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[recovery] generateLink failed:", linkError?.message);
    return res.status(500).json({ error: "session_creation_failed" });
  }

  return res.json({
    token_hash: linkData.properties.hashed_token,
    user_id: data.user_id,
  });
});

export default router;
