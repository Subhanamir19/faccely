import { create } from "zustand";
import { fetchInsights, type InsightData } from "../lib/api/insights";

type State = {
  data: InsightData | null;
  loading: boolean;
  error: string | null;
};

type Actions = {
  loadInsights: () => Promise<void>;
  reset: () => void;
};

export const useInsights = create<State & Actions>((set) => ({
  data: null,
  loading: false,
  error: null,

  loadInsights: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchInsights();
      set({ data, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? "Failed to load insights" });
    }
  },

  reset: () => set({ data: null, loading: false, error: null }),
}));
