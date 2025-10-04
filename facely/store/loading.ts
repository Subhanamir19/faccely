// C:\SS\facely\store\loading.ts
import { create } from "zustand";

type LoadingStore = {
  count: number;
  show: () => void;
  hide: () => void;
  reset: () => void;
};

export const useLoading = create<LoadingStore>((set, get) => ({
  count: 0,
  show: () => set((s) => ({ count: s.count + 1 })),
  hide: () => {
    const next = Math.max(0, get().count - 1);
    set({ count: next });
  },
  reset: () => set({ count: 0 }),
}));

/**
 * Wrap any async task and drive the global overlay without boilerplate.
 * Overlay stays up until the promise settles. Ref-count prevents flicker
 * if multiple tasks overlap.
 */
export async function withLoading<T>(task: () => Promise<T>): Promise<T> {
  const { show, hide } = useLoading.getState();
  show();
  try {
    return await task();
  } finally {
    hide();
  }
}
