import { Router } from "express";
import { upsertUserProfile } from "../supabase/users.js";

export const usersRouter = Router();

usersRouter.post("/sync", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const onboardingCompleted =
    typeof req.body?.onboardingCompleted === "boolean"
      ? req.body.onboardingCompleted
      : undefined;
  const deviceId = res.locals.deviceId;

  try {
    await upsertUserProfile({
      id: userId,
      onboardingCompleted,
      deviceId,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[users] sync failed", err);
    return res.status(500).json({ error: "user_sync_failed" });
  }
});
