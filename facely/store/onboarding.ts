// stores/onboarding.ts
import { create } from "zustand";
import { getJSON, setJSON } from "@/lib/storage";

type OnboardingData = {
  age?: number;
  ethnicity?: string;
  gender?: string;
  useCase?: string;
  looksmaxxingExperience?: string;
  goals?: string[];
};

type State = {
  data: OnboardingData;
  // canonical flag
  completed: boolean;

  // compatibility alias (some files might read `done`)
  done: boolean;

  hydrate: () => Promise<void>;
  setField: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  finish: () => Promise<void>;

  // optional helper for dev/testing
  reset?: () => Promise<void>;
};

const KEY = "onboarding_state_v1";
const DONE = "onboarding_done_v1";

export const useOnboarding = create<State>((set, get) => ({
  data: {},
  completed: false,
  done: false,

  hydrate: async () => {
    const d = await getJSON<OnboardingData>(KEY, {});
    const done = await getJSON<boolean>(DONE, false);
    set({ data: d, completed: done, done });
  },

  setField: (k, v) => {
    const next = { ...get().data, [k]: v };
    set({ data: next });
    void setJSON(KEY, next);
  },

  finish: async () => {
    await setJSON(DONE, true);
    set({ completed: true, done: true });
  },

  // Handy during development; not used in prod flow
  reset: async () => {
    await setJSON(KEY, {});
    await setJSON(DONE, false);
    set({ data: {}, completed: false, done: false });
  },
}));

// compatibility alias if some code imports `useOnboardingStore`
export const useOnboardingStore = useOnboarding;
