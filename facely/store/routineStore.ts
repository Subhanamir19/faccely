// src/store/routineStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import { Routine } from "@/lib/api/routine";

/* ----------------------------- Helpers ----------------------------- */
function isoMidnight(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function computeTodayIndex(startDate: string, totalDays: number): number {
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    return Math.min(Math.max(diffDays, 0), totalDays - 1);
  } catch {
    return 0;
  }
}

/* --------------------------- Store Types --------------------------- */
export type RoutineStore = {
  routine: Routine | null;
  todayIndex: number;
  hydrateFromAPI: (data: Routine) => void;
  toggleTask: (dayIndex: number, taskIndex: number) => void;
  resetRoutine: () => void;
  refreshDayIndex: () => void;
};

/* --------------------------- Zustand Store -------------------------- */
export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      routine: null,
      todayIndex: 0,

      hydrateFromAPI(data) {
        const now = new Date();
        const startDate = data.startDate ?? isoMidnight(now);
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
            const day = state.routine?.days?.[dayIndex];
            if (!day) return;
            const comp = day.components?.[taskIndex];
            if (!comp) return;
            // add done flag if missing
            (comp as any).done = !(comp as any).done;
          })
        );
      },

      resetRoutine() {
        set({ routine: null, todayIndex: 0 });
      },

      refreshDayIndex() {
        const r = get().routine;
        if (!r) return;
        const newIndex = computeTodayIndex(
          r.startDate ?? isoMidnight(),
          r.days.length
        );
        if (newIndex !== get().todayIndex) {
          set({ todayIndex: newIndex });
          console.log("[ROUTINE_STORE] rolled to next day:", newIndex);
        }
      },
    }),
    {
      name: "sigma_routine_v1",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state?.routine) return;
        const idx = computeTodayIndex(
          state.routine.startDate ?? isoMidnight(),
          state.routine.days.length
        );
        state.todayIndex = idx;
        console.log("[ROUTINE_STORE] rehydrated", { todayIndex: idx });
      },
    }
  )
);
