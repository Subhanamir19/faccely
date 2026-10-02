// scorer-node/src/services/pushNotifications.ts
//
// Sends push notifications through Expo's push service. No SDK: the API is a
// single JSON POST, and Node 20 ships fetch.
//
// Every send is best-effort. A failed push must never fail the job that
// triggered it, so callers get no exceptions from `sendPushToUser`.

import {
  deletePushTokens,
  getPushTokensForUser,
} from "../supabase/pushTokens.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 10_000;

export type PushMessage = {
  title: string;
  body: string;
  /** Delivered to the app with the notification; drives where a tap lands. */
  data?: Record<string, unknown>;
};

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  try {
    const tokens = await getPushTokensForUser(userId);
    if (tokens.length === 0) return;

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: "default",
        }))
      ),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn("[push] send rejected", { userId, status: res.status });
      return;
    }

    // Tickets come back in the same order as the messages. A device that
    // uninstalled the app reports DeviceNotRegistered; drop its token.
    const payload = (await res.json()) as { data?: ExpoTicket[] };
    const stale = (payload.data ?? [])
      .map((ticket, i) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? tokens[i]
          : null
      )
      .filter((t): t is string => t !== null);
    if (stale.length > 0) {
      await deletePushTokens(stale);
    }
  } catch (err) {
    console.warn("[push] send failed", { userId, error: String((err as Error)?.message ?? err) });
  }
}
