import { Router } from "express";
import { upsertUserProfile, deleteUserWithCascade } from "../supabase/users.js";
import { deleteAllFaceScansForUser } from "../supabase/storage.js";
import { upsertPushToken } from "../supabase/pushTokens.js";

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

// Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]).
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

usersRouter.post("/push-token", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!EXPO_TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "invalid_push_token" });
  }
  const platform =
    req.body?.platform === "ios" || req.body?.platform === "android"
      ? req.body.platform
      : null;

  try {
    // push_tokens.user_id references users.id; make sure the row exists
    // (upserting only the id leaves every other column untouched).
    await upsertUserProfile({ id: userId });
    await upsertPushToken({ userId, token, platform });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[users] push-token upsert failed", { userId, err });
    return res.status(500).json({ error: "push_token_failed" });
  }
});

usersRouter.delete("/me", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    await deleteUserWithCascade(userId);
    await deleteAllFaceScansForUser(userId);
    return res.status(204).send();
  } catch (err) {
    console.error("delete /users/me failed", { userId, err });
    return res.status(500).json({ error: "delete_failed" });
  }
});
