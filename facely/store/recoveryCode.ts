import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type RecoveryCodeState = {
  code: string | null;
  generating: boolean;
  hasSeenCodeHint: boolean;
  ensureCode: () => Promise<void>;
  setCode: (code: string) => void;
  markHintSeen: () => void;
};

export const useRecoveryCodeStore = create<RecoveryCodeState>()(
  persist(
    (set, get) => ({
      code: null,
      generating: false,
      hasSeenCodeHint: false,
      markHintSeen: () => set({ hasSeenCodeHint: true }),
      ensureCode: async () => {
        if (get().code || get().generating) return;
        const { useAuthStore } = await import("@/store/auth");
        const auth = useAuthStore.getState();
        if (auth.status !== "authenticated") return;
        set({ generating: true });
        try {
          const { generateRecoveryCode } = await import("@/lib/api/recoveryCodes");
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
      partialize: (state) => ({ code: state.code, hasSeenCodeHint: state.hasSeenCodeHint }),
    }
  )
);
