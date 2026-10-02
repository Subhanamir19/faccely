// lib/pushNotifications.ts
// Push notification plumbing: permission, Expo push token registration with
// the backend, and routing a tapped notification to the right screen.
//
// The only push today is "potential face ready", sent by the backend worker
// when generation finishes. Everything here is best-effort: a failure to
// register must never block a screen.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { create } from "zustand";

import { API_BASE } from "@/lib/api/config";
import { fetchWithRetry } from "@/lib/api/client";
import { buildAuthHeadersAsync } from "@/lib/api/authHeaders";
import { getAuthState } from "@/store/auth";
import { logger } from "@/lib/logger";

export type PushPermission = "granted" | "undetermined" | "denied";

const ANDROID_CHANNEL_ID = "default";

// Foreground: the in-app banner already announces a ready face, but a system
// banner is harmless and covers screens where the in-app banner is not shown.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";
    return canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

/** Ask the OS for permission (once), then register. Returns the final state. */
export async function requestPushPermission(): Promise<PushPermission> {
  try {
    await ensureAndroidChannel();
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return canAskAgain ? "undetermined" : "denied";
    await registerPushToken();
    return "granted";
  } catch (err) {
    logger.warn("[push] permission request failed", err);
    return "denied";
  }
}

/**
 * Send this device's token to the backend. Safe to call on every launch:
 * tokens can rotate, and the backend upserts by token.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (!getAuthState().uid) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await ensureAndroidChannel();
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const auth = await buildAuthHeadersAsync({ includeLegacy: true });
    await fetchWithRetry(`${API_BASE}/users/push-token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch (err) {
    // Simulators have no push token; offline launches retry next time.
    logger.warn("[push] token registration failed", err);
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Updates",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * A reveal requested by a notification tap on a cold start. Navigation is not
 * settled yet then (the index gate still has to route the user), so the tabs
 * layout opens the reveal once it mounts instead.
 */
export const usePendingPushReveal = create<{ pending: boolean; setPending: (v: boolean) => void }>(
  (set) => ({ pending: false, setPending: (pending) => set({ pending }) }),
);

function isPotentialFaceReady(response: Notifications.NotificationResponse | null): boolean {
  return response?.notification.request.content.data?.type === "potential_face_ready";
}

/**
 * Route taps on notifications, including the one that cold-started the app.
 * Call once, after navigation and auth are ready. Returns an unsubscribe.
 */
export function listenForNotificationTaps(): () => void {
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    if (isPotentialFaceReady(lastResponse)) usePendingPushReveal.getState().setPending(true);
    Notifications.clearLastNotificationResponse();
  }
  // Warm tap: the app is already running and routed, so open it directly.
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (isPotentialFaceReady(response)) router.push("/potential-face");
    Notifications.clearLastNotificationResponse();
  });
  return () => sub.remove();
}
