// facely/store/tasks.ts
// Zustand store for daily adaptive tasks. Replaces the old 70-day program store.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildDailyRoutine, buildDailyProtocols, type RoutineTaskPick, type ProtocolSelectionInput } from "@/lib/taskBuilder";
import type { ProtocolType } from "@/lib/protocolCatalog";
import { summarizeFocusAreas } from "@/lib/taskSelection";
import { logger } from '@/lib/logger';

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
  date: string; // "YYYY-MM-DD" UTC
  tasks: DailyTask[];
  protocols: ProtocolTask[];
  mood: string | null;
  allComplete: boolean;
  completedOnce: boolean; // true once all tasks are checked off for the first time today
  focusSummary: string; // e.g. "jawline & cheekbones"
};

type TasksState = {
  today: DayRecord | null;
  history: DayRecord[]; // last 14 days
  currentStreak: number;
  loading: boolean;

  // Actions
  initToday: () => void;
  completeTask: (exerciseId: string) => void;
  uncompleteTask: (exerciseId: string) => void;
  skipTask: (exerciseId: string) => void;
  completeProtocol: (id: string, done: boolean) => void;
  setMood: (mood: string) => void;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum combined completions (exercises + protocols) to count as a streak day */
const STREAK_THRESHOLD = 3;

function countCompletedItems(tasks: DailyTask[], protocols: ProtocolTask[]): number {
  return (
    tasks.filter((t) => t.status === "completed").length +
    protocols.filter((p) => p.status === "done").length
  );
}

function getUtcDateString(d?: Date): string {
  const now = d ?? new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(history: DayRecord[]): number {
  // Count consecutive allComplete days from most recent backwards
  let streak = 0;
  // Sort history by date descending
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  const today = getUtcDateString();
  let expectedDate = today;

  for (const record of sorted) {
    // Skip today's record if it exists in history
    if (record.date === today) continue;

    // Walk backwards day by day
    const prevDay = getPreviousDateString(expectedDate);
    if (record.date !== prevDay) break; // gap in dates = streak broken
    if (!record.allComplete) break; // incomplete day = streak broken
    streak++;
    expectedDate = prevDay;
  }

  return streak;
}

function getPreviousDateString(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return getUtcDateString(d);
}

function getRecentExerciseIds(history: DayRecord[]): string[] {
  const today = getUtcDateString();
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
  const today = getUtcDateString();
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

function getConsecutiveMissed(history: DayRecord[]): number {
  if (!history.length) return 0;

  // Find the most recent completed day — anchor point for missed-day counting
  const lastComplete = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((r) => r.allComplete);
  if (!lastComplete) return 0;

  // Count days between yesterday and lastComplete that have no completed record
  const today = getUtcDateString();
  let count = 0;
  let checkDate = getPreviousDateString(today);

  for (let i = 0; i < 7; i++) {
    if (checkDate <= lastComplete.date) break; // reached the last completed day — stop
    const record = history.find((r) => r.date === checkDate);
    if (!record || !record.allComplete) count++;
    else break;
    checkDate = getPreviousDateString(checkDate);
  }
  return count;
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

      initToday: () => {
        const state = get();
        const currentDate = getUtcDateString();

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

        let skinScore: number | null = null;
        try {
          const scoresStore = require("./scores").useScores.getState();
          skinScore = scoresStore.scores?.skin_quality ?? null;
        } catch (e) {
          logger.warn("[tasks] Could not read skin score:", e);
        }

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
            completedOnce: false,
            focusSummary,
          },
          history,
          currentStreak,
          loading: false,
        });
      },

      completeTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "completed" as TaskStatus } : t
        );

        // Day is complete once ≥ STREAK_THRESHOLD items (exercises + protocols) are done
        const allComplete = countCompletedItems(tasks, state.today.protocols) >= STREAK_THRESHOLD;

        // Only increment streak the very first time the threshold is reached today
        const alreadyCounted = state.today.completedOnce;
        const firstCompletion = allComplete && !alreadyCounted;

        set({
          today: {
            ...state.today,
            tasks,
            allComplete,
            completedOnce: state.today.completedOnce || allComplete,
          },
          currentStreak: firstCompletion
            ? state.currentStreak + 1
            : state.currentStreak,
        });
      },

      uncompleteTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "pending" as TaskStatus } : t
        );

        const allComplete = countCompletedItems(tasks, state.today.protocols) >= STREAK_THRESHOLD;
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

        const allComplete = countCompletedItems(tasks, state.today.protocols) >= STREAK_THRESHOLD;
        set({
          today: { ...state.today, tasks, allComplete },
        });
      },

      completeProtocol: (id: string, done: boolean) => {
        const state = get();
        if (!state.today) return;
        const protocols = state.today.protocols.map((p) =>
          p.id === id ? { ...p, status: (done ? "done" : "pending") as ProtocolStatus } : p
        );

        // Protocols also count toward the streak threshold
        const allComplete = countCompletedItems(state.today.tasks, protocols) >= STREAK_THRESHOLD;
        const alreadyCounted = state.today.completedOnce;
        const firstCompletion = allComplete && !alreadyCounted;

        set({
          today: {
            ...state.today,
            protocols,
            allComplete,
            completedOnce: state.today.completedOnce || allComplete,
          },
          currentStreak: firstCompletion ? state.currentStreak + 1 : state.currentStreak,
        });
      },

      setMood: (mood: string) => {
        const state = get();
        if (!state.today) return;
        set({ today: { ...state.today, mood } });
      },

      reset: () => {
        set({
          today: null,
          history: [],
          currentStreak: 0,
          loading: false,
        });
      },
    }),
    {
      name: "sigma_tasks_v1",
      version: 7,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        today: state.today,
        history: state.history,
        currentStreak: state.currentStreak,
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
        return persisted as any;
      },
    }
  )
);
