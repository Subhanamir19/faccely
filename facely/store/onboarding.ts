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
  timeCommitment?: string;
};

type State = {
  data: OnboardingData;
  // canonical flag
  completed: boolean;

  // compatibility alias (some files might read )
  done: boolean;

  // transient scan photos — not persisted, cleared after analysis
  scanFrontalUri: string | null;
  scanSideUri: string | null;

  // dev-only: preview onboarding without paywall/login
  devPreview: boolean;

  hydrate: () => Promise<void>;
  setField: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  finish: () => Promise<void>;
  setScanPhotos: (frontalUri: string, sideUri: string) => void;
  clearScanPhotos: () => void;
  setDevPreview: (v: boolean) => void;
  // Clears form selections for a fresh dev preview WITHOUT touching completed/done
  resetForDevPreview: () => Promise<void>;

  // optional helper for dev/testing
  reset?: () => Promise<void>;
};

const KEY = "onboarding_state_v1";
const DONE = "onboarding_done_v1";

export const useOnboarding = create<State>((set, get) => ({
  data: {},
  completed: false,
  done: false,
  scanFrontalUri: null,
  scanSideUri: null,
  devPreview: false,

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

  setScanPhotos: (frontalUri, sideUri) => {
    set({ scanFrontalUri: frontalUri, scanSideUri: sideUri });
  },

  clearScanPhotos: () => {
    set({ scanFrontalUri: null, scanSideUri: null });
  },

  setDevPreview: (v) => {
    set({ devPreview: v });
  },

  resetForDevPreview: async () => {
    await setJSON(KEY, {});
    // Intentionally keeps completed/done true so the user stays authenticated
    set({ data: {}, scanFrontalUri: null, scanSideUri: null });
  },

  // Handy during development; not used in prod flow
  reset: async () => {
    await setJSON(KEY, {});
    await setJSON(DONE, false);
    set({ data: {}, completed: false, done: false });
  },
}));

// compatibility alias if some code imports export const useOnboardingStore = useOnboarding;
