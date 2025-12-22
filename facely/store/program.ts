import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  fetchCurrentProgram,
  generateProgram,
  updateProgramCompletion,
  type Program,
  type ProgramResponse,
} from "@/lib/api/programs";

const STORAGE_KEY = "sigma_program_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnightMs(value: string | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function computeTodayIndex(createdAt: string | undefined, totalDays: number): number {
  const start = toUtcMidnightMs(createdAt);
  const now = toUtcMidnightMs(new Date().toISOString());
  if (start == null || now == null) return 0;
  const diff = Math.floor((now - start) / DAY_MS);
  return Math.max(0, Math.min(totalDays - 1, diff));
}

function completionKey(programId: string, day: number, exerciseId: string) {
  return `${programId}:${day}:${exerciseId}`;
}

type ProgramState = {
  program: Program | null;
  completions: Record<string, boolean>;
  todayIndex: number;
  loading: boolean;
  error: string | null;

  hydrate: (resp: ProgramResponse) => void;
  fetchLatest: () => Promise<ProgramResponse | null>;
  generate: () => Promise<ProgramResponse>;
  toggleCompletion: (day: number, exerciseId: string) => Promise<void>;
  reset: () => void;
  refreshTodayIndex: () => void;
};

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      program: null,
      completions: {},
      todayIndex: 0,
      loading: false,
      error: null,

      hydrate: (resp) => {
        const idx = computeTodayIndex(resp.program.createdAt, resp.program.dayCount);
        const completions = (resp.completions ?? {}) as Record<string, boolean>;
        set({
          program: resp.program,
          completions,
          todayIndex: idx,
          loading: false,
          error: null,
        });
      },

      fetchLatest: async () => {
        set({ loading: true, error: null });
        try {
          const resp = await fetchCurrentProgram();
          get().hydrate(resp);
          return resp;
        } catch (err: any) {
          const message = err instanceof Error ? err.message : "Program fetch failed";
          set({ error: message, loading: false });
          throw err;
        }
      },

      generate: async () => {
        set({ loading: true, error: null });
        try {
          const resp = await generateProgram();
          get().hydrate(resp);
          return resp;
        } catch (err: any) {
          const message = err instanceof Error ? err.message : "Program generation failed";
          set({ error: message, loading: false });
          throw err;
        }
      },

      toggleCompletion: async (day, exerciseId) => {
        const state = get();
        const program = state.program;
        if (!program) throw new Error("No program loaded");
        const key = completionKey(program.programId, day, exerciseId);
        const nextValue = !state.completions[key];

        // Optimistic update
        set((prev) => ({
          completions: { ...prev.completions, [key]: nextValue },
        }));

        try {
          const resp = await updateProgramCompletion(program.programId, day, exerciseId, nextValue);
          get().hydrate(resp);
        } catch (err) {
          // Revert on failure
          set((prev) => ({
            completions: { ...prev.completions, [key]: !nextValue },
          }));
          throw err;
        }
      },

      reset: () => set({ program: null, completions: {}, todayIndex: 0, loading: false, error: null }),

      refreshTodayIndex: () => {
        const program = get().program;
        if (!program) return;
        const idx = computeTodayIndex(program.createdAt, program.dayCount);
        set({ todayIndex: idx });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        program: state.program,
        completions: state.completions,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.program) return;
        state.todayIndex = computeTodayIndex(state.program.createdAt, state.program.dayCount);
      },
    }
  )
);
