import { create } from "zustand";

// ----- Metrics catalogue (typed, frozen) -----
export const ALL_METRICS = [
  { key: "jawline",             label: "Jawline",            scheme: "green"  },
  { key: "facial_symmetry",     label: "Facial symmetry",    scheme: "green"  },
  { key: "skin_quality",        label: "Skin quality",       scheme: "green"  },
  { key: "cheekbones",          label: "Cheekbones",         scheme: "orange" },
  { key: "eyes_symmetry",       label: "Eyes symmetry",      scheme: "green"  },
  { key: "nose_harmony",        label: "Nose harmony",       scheme: "orange" },
  { key: "sexual_dimorphism",   label: "Sexual dimorphism",  scheme: "green"  },
  { key: "youthfulness",        label: "Youthfulness",       scheme: "orange" },
] as const;

export type MetricKey = typeof ALL_METRICS[number]["key"];
export type MetricScheme = typeof ALL_METRICS[number]["scheme"];

type Scores = Partial<Record<MetricKey, number>>;

type State = {
  imageUri?: string;

  scores: Scores;

  // keep your old API
  setImage: (uri?: string) => void;

  // new name, same behavior
  setImageUri: (uri?: string) => void;

  setScore: (key: MetricKey, value: number) => void;
  setScores: (patch: Scores) => void;
  resetScores: () => void;
  fillDemo: () => void;
};

export const useAppStore = create<State>((set) => {
  const setImageUri = (uri?: string) => set({ imageUri: uri });

  return {
    imageUri: undefined,
    scores: {},

    // keep both names working
    setImage: setImageUri,
    setImageUri,

    setScore: (key, value) =>
      set((s) => ({
        scores: { ...s.scores, [key]: Math.max(0, Math.min(100, value)) },
      })),
    setScores: (patch) => set((s) => ({ scores: { ...s.scores, ...patch } })),
    resetScores: () => set({ scores: {} }),

    fillDemo: () =>
      set({
        scores: {
          jawline: 69,
          facial_symmetry: 94,
          skin_quality: 83,
          cheekbones: 56,
          eyes_symmetry: 79,
          nose_harmony: 96,
          sexual_dimorphism: 69,
          youthfulness: 62,
        },
      }),
  };
});
