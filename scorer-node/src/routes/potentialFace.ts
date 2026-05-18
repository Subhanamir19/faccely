// scorer-node/src/routes/potentialFace.ts
//
// REST surface for the Potential Face feature. Mounted under `/potential-face`
// behind `verifyAuth`, so every handler can rely on `res.locals.userId`.
//
// Endpoint contract (Phase 1):
//   POST /potential-face/generate       — ensure a Stage 1 row exists for the user; enqueue generation if needed
//   GET  /potential-face/current        — return the user's active stage row (with signed image URLs)
//   POST /potential-face/use-alternate  — swap primary↔alternate ("doesn't look like me"); one-shot
//   POST /potential-face/check-unlock   — evaluate the unlock gate; if passed, enqueue stage+1
//
// Phase 1 ships endpoints + state transitions only. The worker that actually
// produces the image lands in Phase 2; until then, /generate enqueues a job
// that has no consumer and the row stays in `pending`.

import { Router, type Request, type Response } from "express";
import { z, ZodError, type ZodIssue } from "zod";

import { getScanById } from "../supabase/scans.js";
import {
  getActivePotentialFace,
  getPotentialFaceForUserStage,
  createPendingPotentialFace,
  getWeeklyGenerationQuota,
  resetForRegeneration,
  resetForRetry,
  recordGenerationAttempt,
  swapToAlternate,
  markUnlocked,
  type PotentialFaceRecord,
} from "../supabase/potentialFaces.js";
import { signPotentialFaceImage } from "../supabase/potentialFaceStorage.js";
import { enqueuePotentialFace } from "../queue/jobs.js";
import { evaluateUnlock } from "../services/potentialFaceUnlock.js";

export const potentialFaceRouter = Router();

/* -------------------------------------------------------------------------- */
/*   Helpers                                                                  */
/* -------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GenerateBody = z.object({
  scanId: z.string().regex(UUID_RE, "scanId must be a UUID"),
  force: z.boolean().optional().default(false),
});

const UseAlternateBody = z.object({
  potentialFaceId: z.string().regex(UUID_RE, "potentialFaceId must be a UUID"),
});

function requireUserId(res: Response): string | null {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ errorCode: "missing_user_id", message: "Unauthorized." });
    return null;
  }
  return userId;
}

function mapZod(err: ZodError) {
  return err.issues.map((i: ZodIssue) => ({
    path: i.path.join(".") || i.code,
    message: i.message,
  }));
}

interface SerializedPotentialFace {
  id: string;
  stage: number;
  status: PotentialFaceRecord["status"];
  baselineScanId: string;
  primaryImageUrl: string | null;
  alternateImageUrl: string | null;
  promptVersion: string;
  targetedMetrics: PotentialFaceRecord["targeted_metrics"];
  regeneratedCount: number;
  errorReason: string | null;
  generatedAt: string | null;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  weeklyQuota?: {
    used: number;
    limit: number;
    remaining: number;
    weekStart: string;
  };
}

/**
 * Convert a DB row into the client-facing shape, minting signed URLs for
 * whichever image paths are populated. Failures to mint a URL are non-fatal —
 * the field comes back null and the client shows a placeholder.
 */
async function serialize(row: PotentialFaceRecord): Promise<SerializedPotentialFace> {
  // We only sign when there is something to sign; this also protects /current
  // calls during the `pending` window from doing any storage work.
  const [primaryImageUrl, alternateImageUrl] = await Promise.all([
    signPotentialFaceImage(row.primary_image_path),
    // Alternate URL is only useful while a regeneration is still available.
    row.regenerated_count === 0
      ? signPotentialFaceImage(row.alternate_image_path)
      : Promise.resolve(null),
  ]);

  return {
    id: row.id,
    stage: row.stage,
    status: row.status,
    baselineScanId: row.baseline_scan_id,
    primaryImageUrl,
    alternateImageUrl,
    promptVersion: row.prompt_version,
    targetedMetrics: row.targeted_metrics ?? [],
    regeneratedCount: row.regenerated_count,
    errorReason: row.error_reason,
    generatedAt: row.generated_at,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/*   POST /potential-face/generate                                            */
/* -------------------------------------------------------------------------- */
//
// Ensures a Stage-1 row exists for the user and that a worker job is in flight.
// This endpoint is the explicit "kick generation" path used for retries and
// for clients that don't trust the post-scan auto-trigger. The hook that fires
// generation automatically after advanced-explain lives in Phase 2.
//
// Idempotency rules per existing row state:
//   none       → create pending, enqueue                       → 202
//   pending    → re-enqueue (BullMQ dedupes by jobId)           → 202
//   ready      → no-op, return current state                    → 200
//   failed     → reset to pending, force-requeue                → 202
//   unlocked   → caller is targeting a superseded stage         → 409
//
// Body: { scanId: uuid }  — caller specifies which scan to generate from.

potentialFaceRouter.post("/generate", async (req: Request, res: Response) => {
  const userId = requireUserId(res);
  if (!userId) return;

  const t0 = Date.now();
  try {
    const parsed = GenerateBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        errorCode: "invalid_payload",
        message: "scanId is required.",
        issues: mapZod(parsed.error),
      });
    }
    const { scanId, force } = parsed.data;

    // Verify the scan belongs to this user — also guards against the "stale
    // scanId from a different account" footgun on shared devices.
    const scan = await getScanById(userId, scanId);
    if (!scan) {
      return res.status(404).json({
        errorCode: "scan_not_found",
        message: "No scan with that id for this user.",
      });
    }

    // Stage 1 is the only stage this endpoint creates. Stage 2+ is created
    // server-side by /check-unlock when the gate passes.
    const TARGET_STAGE = 1;
    const existing = await getPotentialFaceForUserStage(userId, TARGET_STAGE);

    if (existing?.status === "unlocked") {
      // The user has already moved past Stage 1 — that's a /current concern,
      // not a /generate one.
      return res.status(409).json({
        errorCode: "stage_already_unlocked",
        message: "Stage 1 has been unlocked; query /potential-face/current for the active stage.",
      });
    }

    if (existing?.status === "ready" && !force) {
      const out = await serialize(existing);
      return res.status(200).json({ enqueued: false, potentialFace: out });
    }

    const quota = await getWeeklyGenerationQuota(userId);
    if (quota.remaining <= 0) {
      return res.status(429).json({
        errorCode: "weekly_quota_exceeded",
        message: "You've used both potential face generations for this week.",
        quota,
      });
    }

    let row: PotentialFaceRecord;
    let forceRequeue = false;

    if (!existing) {
      row = await createPendingPotentialFace({
        userId,
        baselineScanId: scanId,
        stage: TARGET_STAGE,
      });
    } else if (existing.status === "failed") {
      row = await resetForRetry(existing.id);
      forceRequeue = true;
    } else if (existing.status === "ready" && force) {
      row = await resetForRegeneration(existing.id);
      forceRequeue = true;
    } else {
      // status === 'pending' — the row already exists; just refresh the queue.
      row = existing;
    }

    await enqueuePotentialFace(
      {
        potentialFaceId: row.id,
        baselineScanId: row.baseline_scan_id,
        userId,
        stage: row.stage,
      },
      { forceRequeue }
    );

    const out = await serialize(row);
    return res.status(202).json({ enqueued: true, potentialFace: out });
  } catch (err) {
    console.error("[/potential-face/generate] error:", err);
    return res.status(500).json({
      errorCode: "potential_face_generate_failed",
      message: "Failed to enqueue potential face generation.",
    });
  } finally {
    console.log("[/potential-face/generate] ms =", Date.now() - t0);
  }
});

/* -------------------------------------------------------------------------- */
/*   GET /potential-face/current                                              */
/* -------------------------------------------------------------------------- */
//
// Returns the user's active stage row. "Active" = highest stage with a status
// other than `unlocked`. The client polls this during the reveal window and
// reads it on every dashboard render.

potentialFaceRouter.get("/current", async (_req, res) => {
  const userId = requireUserId(res);
  if (!userId) return;

  try {
    const row = await getActivePotentialFace(userId);
    if (!row) {
      return res.json({ potentialFace: null });
    }
    const out = await serialize(row);
    const quota = await getWeeklyGenerationQuota(userId).catch(() => null);
    return res.json({ potentialFace: quota ? { ...out, weeklyQuota: quota } : out });
  } catch (err) {
    console.error("[/potential-face/current] error:", err);
    return res.status(500).json({
      errorCode: "potential_face_fetch_failed",
      message: "Failed to fetch potential face.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*   POST /potential-face/use-alternate                                       */
/* -------------------------------------------------------------------------- */
//
// "This doesn't look like me" — swap to the pre-generated alternate candidate.
// Capped at one swap per row (DB enforces via the regenerated_count check).
// Body: { potentialFaceId: uuid }

potentialFaceRouter.post("/use-alternate", async (req, res) => {
  const userId = requireUserId(res);
  if (!userId) return;

  try {
    const parsed = UseAlternateBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        errorCode: "invalid_payload",
        message: "potentialFaceId is required.",
        issues: mapZod(parsed.error),
      });
    }

    const quota = await getWeeklyGenerationQuota(userId);
    if (quota.remaining <= 0) {
      return res.status(429).json({
        errorCode: "weekly_quota_exceeded",
        message: "You've used both potential face generations for this week.",
        quota,
      });
    }

    const updated = await swapToAlternate(userId, parsed.data.potentialFaceId);
    await recordGenerationAttempt({
      userId,
      potentialFaceId: updated.id,
      promptVersion: `${updated.prompt_version}:alternate`,
      model: "stored-alternate",
      candidateCount: 0,
      latencyMs: 0,
      costCents: 0,
      success: true,
    });
    const out = await serialize(updated);
    return res.json({ potentialFace: out });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    switch (code) {
      case "POTENTIAL_FACE_NOT_FOUND":
        return res.status(404).json({
          errorCode: "potential_face_not_found",
          message: "No potential face with that id for this user.",
        });
      case "POTENTIAL_FACE_NOT_READY":
        return res.status(409).json({
          errorCode: "potential_face_not_ready",
          message: "Potential face is not ready yet.",
        });
      case "POTENTIAL_FACE_NO_ALTERNATE":
        return res.status(409).json({
          errorCode: "no_alternate_available",
          message: "No alternate candidate is stored for this row.",
        });
      case "POTENTIAL_FACE_REGEN_EXHAUSTED":
        return res.status(409).json({
          errorCode: "regeneration_exhausted",
          message: "Alternate has already been used for this potential face.",
        });
      default:
        console.error("[/potential-face/use-alternate] error:", err);
        return res.status(500).json({
          errorCode: "potential_face_swap_failed",
          message: "Failed to swap potential face.",
        });
    }
  }
});

/* -------------------------------------------------------------------------- */
/*   POST /potential-face/check-unlock                                        */
/* -------------------------------------------------------------------------- */
//
// Runs the unlock gate. If all conditions pass, marks the active stage as
// `unlocked` and enqueues a `pending` row + worker job for stage+1. Always
// returns the evaluation snapshot so the client can render diagnostics.

potentialFaceRouter.post("/check-unlock", async (_req, res) => {
  const userId = requireUserId(res);
  if (!userId) return;

  const t0 = Date.now();
  try {
    const evaluation = await evaluateUnlock(userId);

    if (!evaluation.shouldUnlock || !evaluation.active) {
      return res.json({
        unlocked: false,
        evaluation,
        nextStage: null,
      });
    }

    // Transition active row → unlocked. The conditional update inside
    // markUnlocked guards against a race where another caller raced us.
    let unlockedRow: PotentialFaceRecord;
    try {
      unlockedRow = await markUnlocked(evaluation.active.id);
    } catch (err) {
      console.error("[/potential-face/check-unlock] markUnlocked race:", err);
      // Re-evaluate so the client gets an accurate snapshot.
      const recheck = await evaluateUnlock(userId);
      return res.json({
        unlocked: false,
        evaluation: recheck,
        nextStage: null,
      });
    }

    // Create the next stage row + enqueue it. Anchor it to the ORIGINAL
    // baseline scan, not a newer one, to keep identity stable across stages
    // (avoids compounding model drift). createPendingPotentialFace is
    // idempotent on (user_id, stage).
    const nextRow = await createPendingPotentialFace({
      userId,
      baselineScanId: unlockedRow.baseline_scan_id,
      stage: unlockedRow.stage + 1,
    });

    await enqueuePotentialFace({
      potentialFaceId: nextRow.id,
      baselineScanId: nextRow.baseline_scan_id,
      userId,
      stage: nextRow.stage,
    });

    return res.json({
      unlocked: true,
      evaluation,
      nextStage: await serialize(nextRow),
    });
  } catch (err) {
    console.error("[/potential-face/check-unlock] error:", err);
    return res.status(500).json({
      errorCode: "check_unlock_failed",
      message: "Failed to evaluate unlock.",
    });
  } finally {
    console.log("[/potential-face/check-unlock] ms =", Date.now() - t0);
  }
});

export default potentialFaceRouter;
