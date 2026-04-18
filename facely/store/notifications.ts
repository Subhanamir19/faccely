// store/notifications.ts
// Manages which Insight Pulse notification is currently active,
// and persists per-type dismissal timestamps so the same notification
// doesn't reappear too soon.

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { evaluateNotification, type NotificationPayload } from "@/lib/notifications/engine";
import type { InsightData } from "@/lib/api/insights";

// ---------------------------------------------------------------------------
// Cooldown config — how long after dismiss before the same TYPE can reappear.
// ---------------------------------------------------------------------------

const COOLDOWN_MS: Record<string, number> = {
  momentum:  12 * 60 * 60 * 1000,  // 12 h  — scan-triggered, stays fresh
  alert:     12 * 60 * 60 * 1000,  // 12 h
  milestone: 48 * 60 * 60 * 1000,  // 48 h  — milestone is a one-time moment
  insight:   24 * 60 * 60 * 1000,  // 24 h
  nudge:     24 * 60 * 60 * 1000,  // 24 h  — one reminder per day max
};

const STORAGE_PREFIX = "notification_dismissed_";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type State = {
  /** The notification currently being shown, or null. */
  active: NotificationPayload | null;
  /** True while reading cooldown timestamps from AsyncStorage. */
  ready: boolean;
};

type Actions = {
  /**
   * Feed fresh InsightData in. The store evaluates what to show (if anything),
   * checks cooldowns, and updates `active`.
   */
  evaluate: (data: InsightData | null) => Promise<void>;

  /**
   * Called when the user dismisses (or auto-dismiss fires).
   * Writes the cooldown so the same type won't reappear for N hours.
   */
  dismiss: () => Promise<void>;

  /**
   * Called when the screen loses focus before the notification was dismissed.
   * Clears the active card WITHOUT writing a cooldown — it will reappear next visit.
   */
  hide: () => void;

  /** Clear all stored cooldowns — useful for dev/testing. */
  resetCooldowns: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cooldownKey(type: string): string {
  return `${STORAGE_PREFIX}${type}`;
}

async function getDismissedAt(type: string): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(cooldownKey(type));
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

async function setDismissedAt(type: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cooldownKey(type), String(Date.now()));
  } catch {
    // non-critical — worst case the notification re-shows
  }
}

async function isCooledDown(type: string): Promise<boolean> {
  const dismissedAt = await getDismissedAt(type);
  if (dismissedAt === null) return false;
  const cooldown = COOLDOWN_MS[type] ?? 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < cooldown;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotifications = create<State & Actions>((set, get) => ({
  active: null,
  ready: false,

  evaluate: async (data: InsightData | null) => {
    const candidate = evaluateNotification(data);

    if (!candidate) {
      set({ active: null, ready: true });
      return;
    }

    // Check if this type is still within its cooldown window
    const cooled = await isCooledDown(candidate.type);
    if (cooled) {
      set({ active: null, ready: true });
      return;
    }

    // Don't re-trigger if the exact same key is already showing
    const current = get().active;
    if (current?.key === candidate.key) {
      set({ ready: true });
      return;
    }

    set({ active: candidate, ready: true });
  },

  dismiss: async () => {
    const current = get().active;
    if (!current) return;
    await setDismissedAt(current.type);
    set({ active: null });
  },

  hide: () => set({ active: null }),

  resetCooldowns: async () => {
    const types = Object.keys(COOLDOWN_MS);
    await Promise.all(
      types.map((t) => AsyncStorage.removeItem(cooldownKey(t)).catch(() => {}))
    );
    set({ active: null });
  },
}));
