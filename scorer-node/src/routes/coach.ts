import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";

import { COACH } from "../config/index.js";
import {
  CoachHistoryQuerySchema,
  CoachSendRequestSchema,
  encodeStreamEvent,
  type CoachStreamEvent,
} from "../schemas/CoachSchema.js";
import { buildCoachContext } from "../services/coachContext.js";
import { suggestOpeningChips } from "../services/coachPrompt.js";
import { CoachTurnError, runCoachTurn } from "../services/coachTurn.js";
import {
  getActiveThread,
  getMessagePage,
  getOrCreateActiveThread,
  getThreadForUser,
  markThreadSeen,
} from "../supabase/coachThreads.js";
import { checkQuota } from "../supabase/coachUsage.js";

/* ============================================================================
 * Coach routes
 *
 *   GET  /coach/opening        what to show when the button is tapped
 *   POST /coach/stream         send a message, stream the reply as NDJSON
 *   GET  /coach/history        page back through the conversation
 *   POST /coach/seen           clear the unread badge
 *
 * Mounted behind verifyAuth, so `res.locals.userId` is always present.
 * ========================================================================== */

export const coachRouter = Router();

/** Every route is inert until the feature flag is on. */
function coachDisabled(res: Response): boolean {
  if (!COACH.enabled) {
    res.status(503).json({ error: "coach_disabled" });
    return true;
  }
  return false;
}

function userIdOf(res: Response): string {
  return res.locals.userId as string;
}

/* -------------------------------------------------------------------------- */
/*   GET /coach/opening                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the sheet shows before the user types anything.
 *
 * Deliberately free of any model call. Opening Coach is the most common action
 * in the feature and the one least likely to turn into a question, so it must
 * not cost a request. The chips come from the user's own data.
 */
coachRouter.get("/opening", async (req: Request, res: Response) => {
  if (coachDisabled(res)) return;

  try {
    const userId = userIdOf(res);
    const screen = typeof req.query.screen === "string" ? req.query.screen : null;

    const [context, quota, thread] = await Promise.all([
      buildCoachContext(userId, screen),
      checkQuota(userId),
      getActiveThread(userId),
    ]);

    res.json({
      thread_id: thread?.id ?? null,
      chips: suggestOpeningChips(context),
      has_scans: context.scanCount > 0,
      quota: {
        messagesLeft: quota.messagesLeft,
        imagesLeft: quota.imagesLeft,
        resetsAt: quota.resetsAt,
      },
    });
  } catch (err) {
    console.error("[coach] opening failed", err);
    res.status(500).json({ error: "coach_opening_failed" });
  }
});

/* -------------------------------------------------------------------------- */
/*   POST /coach/stream                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Send a message and stream the reply.
 *
 * NDJSON, one event per line. The response headers matter as much as the body:
 *
 *   Content-Type       application/x-ndjson, which the compression filter in
 *                      index.ts uses to leave this response alone. Compressed,
 *                      the stream would sit in a buffer and arrive all at once.
 *   Cache-Control      no-transform, telling proxies not to rewrite it either.
 *   X-Accel-Buffering  no, for the same reason at the ingress layer.
 *
 * Errors after the first byte cannot use a status code, so they are sent as an
 * `error` event and the stream is closed normally.
 */
coachRouter.post("/stream", async (req: Request, res: Response) => {
  if (coachDisabled(res)) return;

  let parsed;
  try {
    parsed = CoachSendRequestSchema.parse(req.body);
  } catch (err) {
    const message =
      err instanceof ZodError ? err.issues[0]?.message ?? "invalid request" : "invalid request";
    res.status(400).json({ error: "invalid_request", reason: message });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event: CoachStreamEvent): void => {
    if (res.writableEnded) return;
    res.write(encodeStreamEvent(event));
  };

  // The user closing the sheet should stop the model call, not leave it
  // running and billable with nobody reading the answer.
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    await runCoachTurn(
      {
        userId: userIdOf(res),
        userText: parsed.user_text,
        threadId: parsed.thread_id,
        screen: parsed.screen ?? null,
        signal: abort.signal,
      },
      emit
    );
  } catch (err) {
    if (abort.signal.aborted) {
      // The client hung up; there is nobody to tell.
    } else if (err instanceof CoachTurnError) {
      emit({ t: "error", code: err.code });
    } else {
      console.error("[coach] turn failed", err);
      emit({ t: "error", code: "upstream_failed" });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

/* -------------------------------------------------------------------------- */
/*   GET /coach/history                                                       */
/* -------------------------------------------------------------------------- */

coachRouter.get("/history", async (req: Request, res: Response) => {
  if (coachDisabled(res)) return;

  let query;
  try {
    query = CoachHistoryQuerySchema.parse(req.query);
  } catch {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  try {
    const userId = userIdOf(res);

    const thread = query.thread_id
      ? await getThreadForUser(userId, query.thread_id)
      : await getActiveThread(userId);

    if (!thread) {
      res.json({ thread_id: null, messages: [], next_before: null });
      return;
    }

    const messages = await getMessagePage(userId, thread.id, {
      before: query.before,
      limit: query.limit,
    });

    res.json({
      thread_id: thread.id,
      // Stored newest first for paging; returned oldest first for rendering.
      messages: [...messages].reverse(),
      next_before:
        messages.length === query.limit
          ? messages[messages.length - 1].created_at
          : null,
    });
  } catch (err) {
    console.error("[coach] history failed", err);
    res.status(500).json({ error: "coach_history_failed" });
  }
});

/* -------------------------------------------------------------------------- */
/*   POST /coach/seen                                                         */
/* -------------------------------------------------------------------------- */

coachRouter.post("/seen", async (_req: Request, res: Response) => {
  if (coachDisabled(res)) return;

  try {
    const userId = userIdOf(res);
    const thread = await getOrCreateActiveThread(userId);
    await markThreadSeen(userId, thread.id);
    res.json({ ok: true, thread_id: thread.id });
  } catch (err) {
    console.error("[coach] seen failed", err);
    res.status(500).json({ error: "coach_seen_failed" });
  }
});

export default coachRouter;
