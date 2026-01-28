// routes/promo.ts
// Server-side promo code validation endpoint

import { Router, type Request, type Response } from "express";
import { z } from "zod";

const router = Router();

// Promo codes stored server-side (can later be moved to database)
// Format: CODE -> { maxUses: number, description: string }
// Set via PROMO_CODES env var as JSON, e.g.: {"SIGMABOSS":{"maxUses":-1,"description":"Beta tester code"}}
const PROMO_CODES: Record<string, { maxUses: number; description: string }> = (() => {
  try {
    const raw = process.env.PROMO_CODES;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    console.warn("[promo] Failed to parse PROMO_CODES env var");
    return {};
  }
})();

const ValidatePromoSchema = z.object({
  code: z.string().min(1).max(50),
});

/**
 * POST /promo/validate
 * Validates a promo code server-side
 *
 * Request body: { code: string }
 * Response: { valid: boolean, message?: string }
 */
router.post("/validate", async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const parsed = ValidatePromoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      valid: false,
      message: "Invalid request"
    });
  }

  const { code } = parsed.data;
  const normalizedCode = code.trim().toUpperCase();

  // Check if code exists
  const promoConfig = PROMO_CODES[normalizedCode];
  if (!promoConfig) {
    console.log("[promo] Invalid code attempt:", { userId, code: normalizedCode });
    return res.json({
      valid: false,
      message: "Invalid promo code"
    });
  }

  // TODO: If maxUses > 0, track usage in database and enforce limit
  // For now, codes with maxUses = -1 have unlimited uses

  console.log("[promo] Code validated:", { userId, code: normalizedCode });
  return res.json({
    valid: true,
    message: "Promo code activated!"
  });
});

export default router;
