// facely/store/routineStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import { Routine } from "@/lib/api/routine";

/* ----------------------------- Helpers ----------------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
let skewWarnLogged = false;

function toUtcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function computeTodayIndex(startDate: string | undefined, totalDays: number): number {
  if (!startDate) {
    console.warn("[ROUTINE_STORE] missing createdAt; defaulting to day 0");
    return 0;
  }

  try {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      console.warn("[ROUTINE_STORE] invalid createdAt; defaulting to day 0", startDate);
      return 0;
    }

    const now = new Date();
    const rawDiff = now.getTime() - start.getTime();
    if (!skewWarnLogged && Math.abs(rawDiff) > HALF_DAY_MS) {
      console.warn("[ROUTINE_STORE] device/server time skew detected", {
        createdAt: start.toISOString(),
        now: now.toISOString(),
      });
      skewWarnLogged = true;
    }

    const startMidnight = toUtcMidnightMs(start);
    const nowMidnight = toUtcMidnightMs(now);
    const diffDays = Math.floor((nowMidnight - startMidnight) / DAY_MS);
    if (!Number.isFinite(diffDays)) return 0;

    const maxIndex = Math.max(totalDays - 1, 0);
    return Math.min(Math.max(diffDays, 0), maxIndex);
  } catch {
    console.warn("[ROUTINE_STORE] failed to parse createdAt; defaulting to day 0");
    return 0;
  }
}

function keyFor(routineId: string, dayIndex: number, taskIndex: number): string {
  return `${routineId}:${dayIndex}:${taskIndex}`;
}

/* --------------------------- Store Types --------------------------- */
export type RoutineStore = {
  routine: Routine | null;
  todayIndex: number;
  completionMap: Record<string, boolean>;
  hydrateFromAPI: (data: Routine) => void;
  toggleTask: (dayIndex: number, taskIndex: number) => void;
  resetRoutine: () => void;
  refreshDayIndex: () => void;
  setStartDate: (iso: string) => void;
  completionPercent: () => number;
};

/* --------------------------- Zustand Store -------------------------- */
export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      routine: null,
      todayIndex: 0,
      completionMap: {},

      hydrateFromAPI(data) {
        const now = new Date();
        const startDate = data.createdAt;
        const totalDays = data.days?.length ?? 0;
        const todayIndex = computeTodayIndex(startDate, totalDays);

        set(
          produce((state: RoutineStore) => {
            state.routine = {
              ...data,
              startDate,
              fetchedAt: data.fetchedAt ?? now.toISOString(),
            };
            state.todayIndex = todayIndex;
            state.completionMap = {};
          })
        );

        console.log("[ROUTINE_STORE] hydrated", {
          days: totalDays,
          todayIndex,
          startDate,
        });
      },

      toggleTask(dayIndex, taskIndex) {
        const routine = get().routine;
        if (!routine) return;

        const isReadOnly = dayIndex < get().todayIndex;
        if (isReadOnly) {
          console.warn("[ROUTINE_STORE] read-only day, ignoring toggle");
          return;
        }

        set(
          produce((state: RoutineStore) => {
            if (!state.routine) return;
            const key = keyFor(state.routine.routineId, dayIndex, taskIndex);
            state.completionMap[key] = !state.completionMap[key];
          })
        );
      },

      resetRoutine() {
        set({ routine: null, todayIndex: 0, completionMap: {} });
      },

      refreshDayIndex() {
        const r = get().routine;
        if (!r) return;
        const startSource = r.startDate ?? r.createdAt;
        const newIndex = computeTodayIndex(startSource, r.days.length);
        if (newIndex !== get().todayIndex) {
          set({ todayIndex: newIndex });
          console.log("[ROUTINE_STORE] rolled to next day:", newIndex);
        }
      },

      setStartDate(iso) {
        set(
          produce((state: RoutineStore) => {
            if (state.routine) state.routine.startDate = iso;
          })
        );
        get().refreshDayIndex();
        console.log("[ROUTINE_STORE] dev set start date:", iso);
      },

      completionPercent() {
        const r = get().routine;
        if (!r) return 0;
        const total = r.days.length;
        const idx = get().todayIndex + 1;
        return Math.round((idx / total) * 100);
      },
    }),
    {
      name: "sigma_routine_v1",
      version: 3,
      migrate: (persistedState, version) => {
        if (persistedState == null) return persistedState;
        if (version === undefined || version < 3) {
          try {
            const next = persistedState as RoutineStore & {
              routine?: Routine | null;
              completionMap?: Record<string, boolean>;
            };
            if (next?.routine?.days) {
              for (const day of next.routine.days) {
                if (!day?.components) continue;
                for (const comp of day.components as Array<
                  Routine["days"][number]["components"][number] & { done?: never }
                >) {
                  if (comp && Object.prototype.hasOwnProperty.call(comp, "done")) {
                    delete (comp as Record<string, unknown>).done;
                  }
                }
              }
            }
            next.completionMap = {};
            return next as RoutineStore;
          } catch (err) {
            console.error("[ROUTINE_STORE] migrate failed", err);
            return { routine: null, todayIndex: 0, completionMap: {} } as RoutineStore;
          }
        }
        return persistedState as RoutineStore;
      },
      onRehydrateStorage: () => (state) => {
        if (!state?.routine) return;
        state.completionMap = state.completionMap ?? {};
        const startSource = state.routine.startDate ?? state.routine.createdAt;
        const idx = computeTodayIndex(startSource, state.routine.days.length);
        state.todayIndex = idx;
        console.log("[ROUTINE_STORE] rehydrated", { todayIndex: idx });
        try {
          useRoutineStore.getState().refreshDayIndex();
        } catch (err) {
          console.warn("[ROUTINE_STORE] refresh after rehydrate failed", err);
        }
      },
    }
  )
);
