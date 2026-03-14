import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

type State = {
  data: InsightData | null;
  loading: boolean;
  error: string | null;
  /** True when a new explanation has completed — next load will re-fetch */
  isDirty: boolean;
};

type Actions = {
  /** Fetch insights if data is missing or dirty. No-op if already fresh. */
  loadInsights: () => Promise<void>;
  /** Mark insights as stale — called after a new explanation completes. */
  invalidate: () => void;
  reset: () => void;
};

export const useInsights = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  isDirty: true, // start dirty so first mount always fetches

  loadInsights: async () => {
    const { loading, data, isDirty } = get();
    if (loading) return;           // already in-flight
    if (data && !isDirty) return;  // fresh — nothing changed since last fetch

    set({ loading: true, error: null });
    try {
      const result = await fetchInsights();
      set({ data: result, loading: false, isDirty: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  invalidate: () => set({ isDirty: true }),

  reset: () => set({ data: null, loading: false, error: null, isDirty: true }),
}));
