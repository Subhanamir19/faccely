// facely/store/tasks.ts
// Zustand store for daily adaptive tasks. Replaces the old 70-day program store.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildDailyRoutine, buildDailyProtocols, type RoutineTaskPick, type ProtocolSelectionInput } from "@/lib/taskBuilder";
import type { ProtocolType } from "@/lib/protocolCatalog";
import { summarizeFocusAreas } from "@/lib/taskSelection";
import { logger } from '@/lib/logger';
import { getLocalDateString } from "@/lib/time/nextMidnight";
import { syncTaskHistory, syncStreak, flushSyncQueue, fetchAndMergeStreak } from "@/lib/supabase/taskSync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "completed" | "skipped";
export type ProtocolStatus = "pending" | "done";

export type DailyTask = RoutineTaskPick & {
  status: TaskStatus;
};

export type ProtocolTask = {
  id: string;
  name: string;
  type: ProtocolType;
  quantity: string;
  reason: string;
  status: ProtocolStatus;
};

export type DayRecord = {
  date: string; // "YYYY-MM-DD" in device local timezone
  tasks: DailyTask[];
  protocols: ProtocolTask[];
  mood: string | null;
  allComplete: boolean;   // true only when EVERY exercise AND protocol is done
  streakEarned: boolean;  // sticky — true once countCompleted >= STREAK_THRESHOLD (2)
  completedOnce: boolean; // sticky version of allComplete — prevents modal showing twice
  focusSummary: string;   // e.g. "jawline & cheekbones"
};

type TasksState = {
  today: DayRecord | null;
  history: DayRecord[]; // last 14 days
  currentStreak: number;
  loading: boolean;
  /**
   * Persisted across app kills. Stores the date string for which the
   * DayCompleteModal has already been shown, so it never re-fires on
   * force-kill + reopen.
   */
  completionModalShownDate: string | null;

  // Actions
  initToday: () => void;
  completeTask: (exerciseId: string) => void;
  uncompleteTask: (exerciseId: string) => void;
  skipTask: (exerciseId: string) => void;
  completeProtocol: (id: string, done: boolean) => void;
  rebuildProtocols: () => void;
  setMood: (mood: string) => void;
  markCompletionModalShown: (date: string) => void;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum combined completions (exercises + protocols) to count as a streak day */
const STREAK_THRESHOLD = 2;

function countCompletedItems(tasks: DailyTask[], protocols: ProtocolTask[]): number {
  return (
    tasks.filter((t) => t.status === "completed").length +
    protocols.filter((p) => p.status === "done").length
  );
}

function getUid(): string | null {
  try {
    return (require("./auth").useAuthStore.getState() as any).uid ?? null;
  } catch {
    return null;
  }
}

function computeStreak(history: DayRecord[]): number {
  // Count consecutive allComplete days from most recent backwards
  let streak = 0;
  // Sort history by date descending
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  const today = getLocalDateString();
  let expectedDate = today;

  for (const record of sorted) {
    // Skip today's record if it exists in history
    if (record.date === today) continue;

    // Walk backwards day by day
    const prevDay = getPreviousDateString(expectedDate);
    if (record.date !== prevDay) break; // gap in dates = streak broken
    if (!record.streakEarned) break; // didn't hit threshold = streak broken
    streak++;
    expectedDate = prevDay;
  }

  return streak;
}

function getPreviousDateString(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  // Construct as local midnight then subtract one day
  const d = new Date(y, m - 1, day - 1);
  return getLocalDateString(d);
}

function getRecentExerciseIds(history: DayRecord[]): string[] {
  const today = getLocalDateString();
  const yesterday = getPreviousDateString(today);
  const dayBefore = getPreviousDateString(yesterday);
  const recentDates = new Set([yesterday, dayBefore]);

  const ids: string[] = [];
  for (const record of history) {
    if (recentDates.has(record.date)) {
      for (const task of record.tasks) {
        if (task.status === "completed") {
          ids.push(task.exerciseId);
        }
      }
    }
  }
  return ids;
}

function getRecentProtocolIds(history: DayRecord[]): string[] {
  const today = getLocalDateString();
  const yesterday = getPreviousDateString(today);
  const dayBefore = getPreviousDateString(yesterday);
  const recentDates = new Set([yesterday, dayBefore]);

  const ids: string[] = [];
  for (const record of history) {
    if (recentDates.has(record.date)) {
      for (const p of record.protocols ?? []) {
        if (p.status === "done") ids.push(p.id);
      }
    }
  }
  return ids;
}

export function getConsecutiveMissed(history: DayRecord[]): number {
  if (!history.length) return 0;

  // Find the most recent completed day — anchor point for missed-day counting
  const lastComplete = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((r) => r.streakEarned);
  if (!lastComplete) return 0;

  // Count days between yesterday and lastComplete that have no completed record
  const today = getLocalDateString();
  let count = 0;
  let checkDate = getPreviousDateString(today);

  for (let i = 0; i < 7; i++) {
    if (checkDate <= lastComplete.date) break; // reached the last completed day — stop
    const record = history.find((r) => r.date === checkDate);
    if (!record || !record.streakEarned) count++;
    else break;
    checkDate = getPreviousDateString(checkDate);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Debounced sync — batches rapid completions (e.g. 5-exercise session) into
// one Supabase write instead of firing on every single tap.
// ---------------------------------------------------------------------------

let _syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingSyncUid: string | null = null;

function scheduleSyncTaskHistory(uid: string): void {
  _pendingSyncUid = uid;
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    _syncDebounceTimer = null;
    // Read latest state at flush time, not stale captured state
    const day = useTasksStore.getState().today;
    if (_pendingSyncUid && day) {
      syncTaskHistory(_pendingSyncUid, day);
    }
    _pendingSyncUid = null;
  }, 2000);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      today: null,
      history: [],
      currentStreak: 0,
      loading: false,
      completionModalShownDate: null,

      initToday: () => {
        const state = get();
        const currentDate = getLocalDateString();

        // Already initialized for today — return early.
        // (v3 migration wipes today when upgrading from old formats, so this
        //  only fires when the user is already on the new architecture.)
        if (state.today?.date === currentDate) {
          if (state.today.completedOnce === undefined) {
            set({ today: { ...state.today, completedOnce: state.today.allComplete } });
          }
          // Backfill protocols if missing or if any protocol is missing quantity (e.g. hot reload after v5/v6 upgrade)
          const needsProtocolBackfill =
            !state.today.protocols ||
            state.today.protocols.some((p) => !p.quantity);
          if (needsProtocolBackfill) {
            const fresh = buildDailyProtocols({ dateStr: currentDate, scores: null, goals: null });
            const protocols: ProtocolTask[] = (state.today.protocols ?? []).map((existing) => {
              const updated = fresh.find((f) => f.id === existing.id);
              return updated ? { ...existing, quantity: updated.quantity } : existing;
            });
            // If protocols array was empty or had different IDs, fall back to fresh set
            const backfilled = protocols.length === fresh.length
              ? protocols
              : fresh.map((p) => ({ ...p, status: "pending" as ProtocolStatus }));
            set({ today: { ...state.today, protocols: backfilled } });
          }
          return;
        }

        set({ loading: true });

        // Archive previous day to history if it exists
        let history = [...state.history];
        if (state.today && state.today.date !== currentDate) {
          history = [state.today, ...history].slice(0, 14); // keep last 14
        }

        // Gather inputs for selection algorithm
        // Import scores and onboarding data at call time to avoid circular deps
        let scores = null;
        let goals: string[] | null = null;
        let experience: string | null = null;

        try {
          const scoresStore = require("./scores").useScores.getState();
          scores = scoresStore.scores ?? null;
        } catch (e) {
          logger.warn("[tasks] Could not read scores store:", e);
        }

        try {
          const onboardingStore = require("./onboarding").useOnboarding.getState();
          const data = onboardingStore.data;
          goals = data?.goals ?? null;
          experience = data?.looksmaxxingExperience ?? null;
        } catch (e) {
          logger.warn("[tasks] Could not read onboarding store:", e);
        }

        const recentExerciseIds = getRecentExerciseIds(history);
        const recentProtocolIds = getRecentProtocolIds(history);
        const currentStreak = computeStreak(history);
        const consecutiveMissed = getConsecutiveMissed(history);
        const isNewUser = history.length === 0;

        // skinScore is already available from the scores read above — no second require needed
        const skinScore: number | null = scores?.skin_quality ?? null;

        const picks = buildDailyRoutine({
          scores,
          goals,
          experience,
          recentExerciseIds,
          currentStreak,
          consecutiveMissed,
          isNewUser,
          skinScore,
        });

        const tasks: DailyTask[] = picks.map((pick) => ({
          ...pick,
          status: "pending" as TaskStatus,
        }));

        const focusSummary = summarizeFocusAreas(picks);

        const protocolInput: ProtocolSelectionInput = {
          dateStr: currentDate,
          scores,
          goals,
          recentProtocolIds,
        };
        const protocols: ProtocolTask[] = buildDailyProtocols(protocolInput).map((p) => ({
          ...p,
          status: "pending" as ProtocolStatus,
        }));

        set({
          today: {
            date: currentDate,
            tasks,
            protocols,
            mood: null,
            allComplete: false,
            streakEarned: false,
            completedOnce: false,
            focusSummary,
          },
          history,
          currentStreak,
          loading: false,
        });

        // Background: flush any offline-queued writes, then pull remote streak
        const uid = getUid();
        if (uid) {
          flushSyncQueue(uid).catch(() => {});
          fetchAndMergeStreak(uid, currentStreak, (n) => set({ currentStreak: n })).catch(() => {});
        }
      },

      completeTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;
        // Idempotency guard — already completed, nothing to do
        if (state.today.tasks.find((t) => t.exerciseId === exerciseId)?.status === "completed") return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "completed" as TaskStatus } : t
        );

        // allComplete = every task is in a terminal state (completed OR skipped)
        // AND every protocol is done. Skipped exercises no longer block the
        // completion flow — a user who resolves all tasks has finished their day.
        const allComplete =
          tasks.every((t) => t.status !== "pending") &&
          state.today.protocols.every((p) => p.status === "done");

        // streakEarned = sticky flag: once ≥ STREAK_THRESHOLD real completions, day counts.
        // Skipped tasks deliberately do NOT count toward the threshold.
        const streakEarned =
          state.today.streakEarned ||
          countCompletedItems(tasks, state.today.protocols) >= STREAK_THRESHOLD;

        // Only increment streak the very first time the threshold is reached today
        const firstStreakEarned = streakEarned && !state.today.streakEarned;

        // completedOnce is sticky and requires BOTH the day being resolved AND
        // real work done (streakEarned). This prevents the completion modal from
        // firing on a day where the user skipped everything.
        const completedOnce = state.today.completedOnce || (allComplete && streakEarned);

        set({
          today: {
            ...state.today,
            tasks,
            allComplete,
            streakEarned,
            completedOnce,
          },
          currentStreak: firstStreakEarned
            ? state.currentStreak + 1
            : state.currentStreak,
        });

        const uid = getUid();
        if (uid) {
          scheduleSyncTaskHistory(uid);
          if (firstStreakEarned) {
            const newState = get();
            syncStreak(uid, newState.currentStreak, newState.today!.date);
          }
        }
      },

      uncompleteTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "pending" as TaskStatus } : t
        );

        // Moving a task back to "pending" always drops allComplete to false —
        // a pending task means the day is not fully resolved.
        // streakEarned is intentionally sticky and stays true (earned is permanent).
        const allComplete =
          tasks.every((t) => t.status !== "pending") &&
          state.today.protocols.every((p) => p.status === "done");
        set({
          today: { ...state.today, tasks, allComplete },
        });
      },

      skipTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "skipped" as TaskStatus } : t
        );

        // Skipped counts as "resolved" — if all tasks are skipped/completed and
        // all protocols done, the day is considered fully resolved.
        // NOTE: Skipping does NOT count toward the STREAK_THRESHOLD — streakEarned
        // is carried forward unchanged. completedOnce only sets if real work was done.
        const allComplete =
          tasks.every((t) => t.status !== "pending") &&
          state.today.protocols.every((p) => p.status === "done");

        const completedOnce =
          state.today.completedOnce || (allComplete && state.today.streakEarned);

        set({
          today: { ...state.today, tasks, allComplete, completedOnce },
        });

        const uid = getUid();
        if (uid) scheduleSyncTaskHistory(uid);
      },

      completeProtocol: (id: string, done: boolean) => {
        const state = get();
        if (!state.today) return;
        const protocols = state.today.protocols.map((p) =>
          p.id === id ? { ...p, status: (done ? "done" : "pending") as ProtocolStatus } : p
        );

        // Same allComplete semantics as completeTask — tasks resolved (not pending)
        // AND all protocols done.
        const allComplete =
          state.today.tasks.every((t) => t.status !== "pending") &&
          protocols.every((p) => p.status === "done");

        // streakEarned = sticky: once threshold hit, stays true
        const streakEarned =
          state.today.streakEarned ||
          countCompletedItems(state.today.tasks, protocols) >= STREAK_THRESHOLD;

        const firstStreakEarned = streakEarned && !state.today.streakEarned;

        // completedOnce requires real work (streakEarned) — prevents modal on zero-effort days
        const completedOnce = state.today.completedOnce || (allComplete && streakEarned);

        set({
          today: {
            ...state.today,
            protocols,
            allComplete,
            streakEarned,
            completedOnce,
          },
          currentStreak: firstStreakEarned ? state.currentStreak + 1 : state.currentStreak,
        });

        const uid = getUid();
        if (uid) {
          scheduleSyncTaskHistory(uid);
          if (firstStreakEarned) {
            const newState = get();
            syncStreak(uid, newState.currentStreak, newState.today!.date);
          }
        }
      },

      rebuildProtocols: () => {
        const state = get();
        if (!state.today) return;
        const currentDate = new Date().toISOString().split("T")[0];
        const recentProtocolIds = getRecentProtocolIds(state.history);
        let scores = null;
        let goals: string[] | null = null;
        try {
          const scoresStore = require("./scores").useScores.getState();
          scores = scoresStore.scores ?? null;
        } catch {}
        try {
          const onboardingStore = require("./onboarding").useOnboarding.getState();
          goals = onboardingStore.data?.goals ?? null;
        } catch {}
        const fresh = buildDailyProtocols({ dateStr: currentDate, scores, goals, recentProtocolIds });
        const protocols: ProtocolTask[] = fresh.map((p) => ({ ...p, status: "pending" as ProtocolStatus }));
        set({ today: { ...state.today, protocols } });
      },

      setMood: (mood: string) => {
        const state = get();
        if (!state.today) return;
        set({ today: { ...state.today, mood } });
        const uid = getUid();
        if (uid) scheduleSyncTaskHistory(uid);
      },

      markCompletionModalShown: (date: string) => {
        set({ completionModalShownDate: date });
      },

      reset: () => {
        set({
          today: null,
          history: [],
          currentStreak: 0,
          loading: false,
          completionModalShownDate: null,
        });
      },
    }),
    {
      name: "sigma_tasks_v1",
      version: 8,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        today: state.today,
        history: state.history,
        currentStreak: state.currentStreak,
        completionModalShownDate: state.completionModalShownDate,
      }),
      migrate: (persisted: any, version: number) => {
        // v0 → v1: add completedOnce to today & history records
        if (version === 0 && persisted) {
          if (persisted.today && persisted.today.completedOnce === undefined) {
            persisted.today.completedOnce = persisted.today.allComplete ?? false;
          }
          if (Array.isArray(persisted.history)) {
            for (const record of persisted.history) {
              if (record.completedOnce === undefined) {
                record.completedOnce = record.allComplete ?? false;
              }
            }
          }
        }
        // v1 → v2: add session, protocolType, overloadTier, overloadLabel to existing tasks
        if (version <= 1 && persisted) {
          const patchTasksV2 = (tasks: any[]) =>
            Array.isArray(tasks)
              ? tasks.map((t: any) => ({
                  ...t,
                  session: t.session ?? "morning",
                  protocolType: t.protocolType ?? "facial_exercise",
                  overloadTier: t.overloadTier ?? 0,
                  overloadLabel: t.overloadLabel ?? "Base",
                }))
              : tasks;
          if (persisted.today?.tasks) {
            persisted.today.tasks = patchTasksV2(persisted.today.tasks);
          }
          if (Array.isArray(persisted.history)) {
            for (const record of persisted.history) {
              if (record.tasks) record.tasks = patchTasksV2(record.tasks);
            }
          }
        }
        // v2 → v3: removed session/morning/evening architecture.
        // Wipe today so initToday regenerates with the new Exercises/Protocols format.
        if (version <= 2 && persisted) {
          persisted.today = null;
        }
        // v3 → v4: replaced 20-exercise catalog with 15 video-based exercises.
        // Wipe today so initToday regenerates with updated exercise IDs.
        if (version <= 3 && persisted) {
          persisted.today = null;
        }
        // v4 → v5: added protocols[] to DayRecord.
        // Wipe today so initToday regenerates with protocol tasks included.
        if (version <= 4 && persisted) {
          persisted.today = null;
        }
        // v5 → v6: added quantity field to ProtocolPick/ProtocolTask.
        // Wipe today so initToday regenerates with quantity populated.
        if (version <= 5 && persisted) {
          persisted.today = null;
        }
        // v6 → v7: protocol selection is now score/goal-aware instead of date-rotation.
        // Wipe today so existing users get a properly personalised protocol set on next open.
        if (version <= 6 && persisted) {
          persisted.today = null;
        }
        // v7 → v8: added streakEarned (separate from allComplete).
        // Backfill from completedOnce (which was the old "hit threshold" flag).
        if (version <= 7 && persisted) {
          const addStreakEarned = (record: any) => {
            if (record && record.streakEarned === undefined) {
              record.streakEarned = record.completedOnce ?? record.allComplete ?? false;
            }
          };
          if (persisted.today) addStreakEarned(persisted.today);
          if (Array.isArray(persisted.history)) {
            for (const record of persisted.history) addStreakEarned(record);
          }
        }
        return persisted as any;
      },
    }
  )
);
