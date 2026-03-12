import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generateRecoveryCode } from "@/lib/api/recoveryCodes";

type RecoveryCodeState = {
  code: string | null;
  generating: boolean;
  ensureCode: () => Promise<void>;
  setCode: (code: string) => void;
};

export const useRecoveryCodeStore = create<RecoveryCodeState>()(
  persist(
    (set, get) => ({
      code: null,
      generating: false,
      ensureCode: async () => {
        if (get().code || get().generating) return;
        set({ generating: true });
        try {
          const code = await generateRecoveryCode();
          if (code) set({ code });
        } finally {
          set({ generating: false });
        }
      },
      setCode: (code) => set({ code }),
    }),
    {
      name: "sigma_recovery_code_v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ code: state.code }),
    }
  )
);
