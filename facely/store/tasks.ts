// facely/store/tasks.ts
// Zustand store for daily adaptive tasks. Replaces the old 70-day program store.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  selectDailyTasks,
  summarizeFocusAreas,
  type TaskPick,
} from "@/lib/taskSelection";
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "completed" | "skipped";

export type DailyTask = TaskPick & {
  status: TaskStatus;
};

export type DayRecord = {
  date: string; // "YYYY-MM-DD" UTC
  tasks: DailyTask[];
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
  setMood: (mood: string) => void;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getConsecutiveMissed(history: DayRecord[]): number {
  const today = getUtcDateString();
  let count = 0;
  let checkDate = getPreviousDateString(today);

  for (let i = 0; i < 7; i++) {
    const record = history.find((r) => r.date === checkDate);
    if (!record) {
      count++; // no record = missed day
    } else if (!record.allComplete) {
      count++;
    } else {
      break; // found a complete day, stop counting
    }
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

        // Already initialized for today — patch completedOnce if missing from old data
        if (state.today?.date === currentDate) {
          if (state.today.completedOnce === undefined) {
            set({
              today: {
                ...state.today,
                completedOnce: state.today.allComplete,
              },
            });
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
          // Access other stores via their getState (works outside React)
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
        const currentStreak = computeStreak(history);
        const consecutiveMissed = getConsecutiveMissed(history);
        const isNewUser = history.length === 0;

        const picks = selectDailyTasks({
          scores,
          goals,
          experience,
          recentExerciseIds,
          currentStreak,
          consecutiveMissed,
          isNewUser,
        });

        const tasks: DailyTask[] = picks.map((pick) => ({
          ...pick,
          status: "pending" as TaskStatus,
        }));

        const focusSummary = summarizeFocusAreas(picks);

        set({
          today: {
            date: currentDate,
            tasks,
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

        // Check if all non-skipped tasks are completed
        const allComplete = tasks
          .filter((t) => t.status !== "skipped")
          .every((t) => t.status === "completed");

        // Only increment streak the very first time all tasks are completed today
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

        set({
          today: { ...state.today, tasks, allComplete: false },
        });
      },

      skipTask: (exerciseId: string) => {
        const state = get();
        if (!state.today) return;

        const tasks = state.today.tasks.map((t) =>
          t.exerciseId === exerciseId ? { ...t, status: "skipped" as TaskStatus } : t
        );

        set({
          today: { ...state.today, tasks, allComplete: false },
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
      version: 1,
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
        return persisted as any;
      },
    }
  )
);
