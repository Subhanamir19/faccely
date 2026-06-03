// stores/onboarding.ts
import { create } from "zustand";
import { getJSON, setJSON } from "@/lib/storage";

type OnboardingData = {
  age?: number;
  dob?: string; // ISO YYYY-MM-DD, source of truth; `age` is derived
  ethnicity?: string;
  gender?: string;
  looksmaxxingExperience?: string;
  goals?: string[];
  improveFocus?: string[];
  timeDedication?: string;
};

type State = {
  data: OnboardingData;
  // canonical flag
  completed: boolean;

  // compatibility alias (some files might read )
  done: boolean;

  // Temporary scan photo URIs held during onboarding flow
  scanFrontalUri: string | null;
  scanSideUri: string | null;
  setScanPhotos: (frontal: string, side: string) => void;
  clearScanPhotos: () => void;

  hydrate: () => Promise<void>;
  setField: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  finish: () => Promise<void>;

  // optional helper for dev/testing
  reset?: () => Promise<void>;
};

const KEY = "onboarding_state_v1";
const DONE = "onboarding_done_v1";
const SCAN_PHOTOS = "onboarding_scan_photos_v1";

type ScanPhotos = {
  frontal: string | null;
  side: string | null;
};

export const useOnboarding = create<State>((set, get) => ({
  data: {},
  completed: false,
  done: false,
  scanFrontalUri: null,
  scanSideUri: null,
  setScanPhotos: (frontal, side) => {
    set({ scanFrontalUri: frontal, scanSideUri: side });
    void setJSON<ScanPhotos>(SCAN_PHOTOS, { frontal, side });
  },
  clearScanPhotos: () => {
    set({ scanFrontalUri: null, scanSideUri: null });
    void setJSON<ScanPhotos>(SCAN_PHOTOS, { frontal: null, side: null });
  },

  hydrate: async () => {
    const d = await getJSON<OnboardingData>(KEY, {});
    const done = await getJSON<boolean>(DONE, false);
    const scanPhotos = await getJSON<ScanPhotos>(SCAN_PHOTOS, { frontal: null, side: null });
    set({
      data: d,
      completed: done,
      done,
      scanFrontalUri: scanPhotos.frontal ?? null,
      scanSideUri: scanPhotos.side ?? null,
    });
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
    await setJSON<ScanPhotos>(SCAN_PHOTOS, { frontal: null, side: null });
    set({
      data: {},
      completed: false,
      done: false,
      scanFrontalUri: null,
      scanSideUri: null,
    });
  },
}));

// compatibility alias if some code imports export const useOnboardingStore = useOnboarding;
