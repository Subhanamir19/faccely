// facely/store/exerciseSettings.ts
// Per-exercise duration customisation. Persisted to AsyncStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getExerciseDuration } from "@/lib/exerciseDurations";

export const DURATION_STEP = 15;
export const DURATION_MIN  = 15;
export const DURATION_MAX  = 90; // 1:30

type ExerciseSettingsState = {
  customDurations: Record<string, number>;

  /** Effective duration for an exercise — custom override or library default */
  getDuration: (exerciseId: string) => number;
  incrementDuration: (exerciseId: string) => void;
  decrementDuration: (exerciseId: string) => void;
};

export const useExerciseSettings = create<ExerciseSettingsState>()(
  persist(
    (set, get) => ({
      customDurations: {},

      getDuration: (exerciseId: string) => {
        const custom = get().customDurations[exerciseId];
        return custom ?? getExerciseDuration(exerciseId);
      },

      incrementDuration: (exerciseId: string) => {
        const next = Math.min(DURATION_MAX, get().getDuration(exerciseId) + DURATION_STEP);
        set((s) => ({ customDurations: { ...s.customDurations, [exerciseId]: next } }));
      },

      decrementDuration: (exerciseId: string) => {
        const next = Math.max(DURATION_MIN, get().getDuration(exerciseId) - DURATION_STEP);
        set((s) => ({ customDurations: { ...s.customDurations, [exerciseId]: next } }));
      },
    }),
    {
      name: "exercise-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ customDurations: s.customDurations }),
    }
  )
);
