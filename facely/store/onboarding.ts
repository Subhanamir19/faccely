// stores/onboarding.ts
import { create } from "zustand";
import { getJSON, setJSON } from "@/lib/storage";

type OnboardingData = { age?: number; ethnicity?: string; gender?: string };
type State = {
  data: OnboardingData;
  completed: boolean;
  hydrate: () => Promise<void>;
  setField: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  finish: () => Promise<void>;
};

const KEY = "onboarding_state_v1";
const DONE = "onboarding_done_v1";

export const useOnboarding = create<State>((set, get) => ({
  data: {},
  completed: false,
  hydrate: async () => {
    const d = await getJSON<OnboardingData>(KEY, {});
    const done = await getJSON<boolean>(DONE, false);
    set({ data: d, completed: done });
  },
  setField: (k, v) => {
    const next = { ...get().data, [k]: v };
    set({ data: next });
    setJSON(KEY, next);
  },
  finish: async () => {
    await setJSON(DONE, true);
    set({ completed: true });
  },
}));
