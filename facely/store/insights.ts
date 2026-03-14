import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

const STALE_MS = 30_000; // don't re-fetch if data is less than 30s old

type State = {
  data: InsightData | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
};

type Actions = {
  loadInsights: (force?: boolean) => Promise<void>;
  reset: () => void;
};

export const useInsights = create<State & Actions>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastFetchedAt: null,

  loadInsights: async (force = false) => {
    const { loading, lastFetchedAt } = get();
    if (loading) return; // already in-flight
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < STALE_MS) return; // fresh

    set({ loading: true, error: null });
    try {
      const data = await fetchInsights();
      set({ data, loading: false, lastFetchedAt: Date.now() });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  reset: () => set({ data: null, loading: false, error: null, lastFetchedAt: null }),
}));
