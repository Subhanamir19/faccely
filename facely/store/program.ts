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

/**
 * Determine program type (1, 2, or 3) from scores using gap calculation
 */
function determineProgramType(scores: Program["scoresSnapshot"]): 1 | 2 | 3 {
  const BENCHMARK = 80;

  const gaps = {
    jawline: Math.max(0, BENCHMARK - scores.jawline),
    cheekbones: Math.max(0, BENCHMARK - scores.cheekbones),
    sexual_dimorphism: Math.max(0, BENCHMARK - scores.sexual_dimorphism),
    eyes_symmetry: Math.max(0, BENCHMARK - scores.eyes_symmetry),
    nose_harmony: Math.max(0, BENCHMARK - scores.nose_harmony),
    facial_symmetry: Math.max(0, BENCHMARK - scores.facial_symmetry),
    skin_quality: Math.max(0, BENCHMARK - scores.skin_quality),
  };

  const bucket1 = gaps.jawline + gaps.cheekbones + gaps.sexual_dimorphism;
  const bucket2 = gaps.eyes_symmetry + gaps.nose_harmony + gaps.facial_symmetry;
  const bucket3 = gaps.skin_quality;

  const max = Math.max(bucket1, bucket2, bucket3);

  // Tiebreaker logic
  if (max === bucket1 && max === bucket2) {
    const max1 = Math.max(gaps.jawline, gaps.cheekbones, gaps.sexual_dimorphism);
    const max2 = Math.max(gaps.eyes_symmetry, gaps.nose_harmony, gaps.facial_symmetry);
    return max1 >= max2 ? 1 : 2;
  }

  if (max === bucket1 && max === bucket3) {
    const max1 = Math.max(gaps.jawline, gaps.cheekbones, gaps.sexual_dimorphism);
    return max1 >= gaps.skin_quality ? 1 : 3;
  }

  if (max === bucket2 && max === bucket3) {
    const max2 = Math.max(gaps.eyes_symmetry, gaps.nose_harmony, gaps.facial_symmetry);
    return max2 >= gaps.skin_quality ? 2 : 3;
  }

  if (max === bucket1) return 1;
  if (max === bucket2) return 2;
  return 3;
}

type ProgramState = {
  program: Program | null;
  programType: 1 | 2 | 3 | null;
  completions: Record<string, boolean>;
  /** Day moods keyed by "programId:dayNumber" */
  moods: Record<string, string>;
  todayIndex: number;
  loading: boolean;
  error: string | null;

  hydrate: (resp: ProgramResponse) => void;
  fetchLatest: () => Promise<ProgramResponse | null>;
  generate: () => Promise<ProgramResponse>;
  toggleCompletion: (day: number, exerciseId: string) => Promise<void>;
  setDayMood: (day: number, mood: string) => void;
  reset: () => void;
  refreshTodayIndex: () => void;
};

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      program: null,
      programType: null,
      completions: {},
      moods: {},
      todayIndex: 0,
      loading: false,
      error: null,

      hydrate: (resp) => {
        const idx = computeTodayIndex(resp.program.createdAt, resp.program.dayCount);
        const completions = (resp.completions ?? {}) as Record<string, boolean>;
        const programType = determineProgramType(resp.program.scoresSnapshot);

        set({
          program: resp.program,
          programType,
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

      setDayMood: (day, mood) => {
        const program = get().program;
        if (!program) return;
        const key = `${program.programId}:${day}`;
        set((prev) => ({ moods: { ...prev.moods, [key]: mood } }));
      },

      reset: () =>
        set({
          program: null,
          programType: null,
          completions: {},
          moods: {},
          todayIndex: 0,
          loading: false,
          error: null,
        }),

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
        programType: state.programType,
        completions: state.completions,
        moods: state.moods,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.program) return;
        state.todayIndex = computeTodayIndex(state.program.createdAt, state.program.dayCount);
        if (!state.programType) {
          state.programType = determineProgramType(state.program.scoresSnapshot);
        }
      },
    }
  )
);
