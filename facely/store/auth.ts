import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthStatus = "checking" | "signedOut" | "authenticated";
export type SubscriptionStatus = "none" | "active" | "grace" | "unknown";

type User = {
  uid: string;
  email?: string | null;
};

type AuthState = {
  status: AuthStatus;
  user: User | null;
  uid: string | null;
  idToken: string | null;
  onboardingCompleted: boolean;
  subscriptionStatus: SubscriptionStatus;
  deviceId: string | null;
  sessionId: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  refreshIdToken: (force?: boolean) => Promise<string | null>;
  getIdTokenOrThrow: () => Promise<string>;
  setOnboardingCompleted: (value: boolean) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  logout: () => Promise<void>;
  setIdToken: (idToken: string | null) => void;
  setAuthFromSession: (input: {
    uid: string;
    email?: string | null;
    idToken?: string | null;
    status: AuthStatus;
    sessionId?: string | null;
  }) => void;
  clearAuthState: () => void;
  setInitializedFlag: (value: boolean) => void;
  setOnboardingCompletedFromOnboarding: (completed: boolean) => void;
};

const STORAGE_KEY = "sigma_auth_v1";

const generateDeviceId = (): string => {
  const segment = () => Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");

  return `${segment()}${segment()}-${segment()}-${segment()}-${segment()}-${segment()}${segment()}${segment()}`;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "checking",
      user: null,
      uid: null,
      idToken: null,
      onboardingCompleted: false,
      subscriptionStatus: "unknown",
      deviceId: null,
      sessionId: null,
      initialized: false,
      initialize: async () => {
        if (!get().deviceId) {
          set({ deviceId: generateDeviceId() });
        }
      },
      refreshIdToken: async (force = false) => {
        void force;
        if (get().status !== "authenticated") {
          set({
            status: "signedOut",
            user: null,
            uid: null,
            idToken: null,
            sessionId: null,
          });
          return null;
        }

        const token = get().idToken;
        const trimmed = typeof token === "string" ? token.trim() : "";
        if (!trimmed || trimmed.split(".").length !== 3) {
          set({
            status: "signedOut",
            user: null,
            uid: null,
            idToken: null,
            sessionId: null,
          });
          return null;
        }
        set({ idToken: trimmed, status: "authenticated" });
        return trimmed;
      },
      getIdTokenOrThrow: async () => {
        if (get().status !== "authenticated" || !get().uid) {
          throw new Error("No idToken available in auth store; user is not authenticated.");
        }
        const token = get().idToken;
        if (typeof token === "string" && token.trim().length > 0) {
          return token;
        }
        throw new Error("No idToken available in auth store; user is not authenticated.");
      },
      setOnboardingCompleted: (value) => {
        set({ onboardingCompleted: value });
      },
      setOnboardingCompletedFromOnboarding: (completed) => {
        set({ onboardingCompleted: completed });
      },
      setSubscriptionStatus: (status) => {
        set({ subscriptionStatus: status });
      },
      setSessionId: (sessionId) => {
        set({ sessionId });
      },
      setIdToken: (idToken) => {
        const trimmed = typeof idToken === "string" ? idToken.trim() : "";
        if (trimmed) {
          set({ idToken: trimmed, status: "authenticated" });
          return;
        }
        set((state) => ({
          idToken: null,
          status: "signedOut",
        }));
      },
      logout: async () => {
        set({
          user: null,
          uid: null,
          idToken: null,
          sessionId: null,
          status: "signedOut",
        });
      },
      setAuthFromSession: ({ uid, email, idToken, status, sessionId }) => {
        const trimmed = typeof idToken === "string" ? idToken.trim() : "";
        const nextStatus: AuthStatus =
          trimmed && trimmed.split(".").length === 3 ? "authenticated" : "signedOut";

        set({
          user: nextStatus === "authenticated" ? { uid, email: email ?? null } : null,
          uid: nextStatus === "authenticated" ? uid : null,
          idToken: nextStatus === "authenticated" ? trimmed : null,
          sessionId: nextStatus === "authenticated" ? sessionId ?? null : null,
          status: nextStatus,
        });
      },
      clearAuthState: () => {
        set({
          user: null,
          uid: null,
          idToken: null,
          sessionId: null,
          status: "signedOut",
        });
      },
      setInitializedFlag: (value) => {
        set({ initialized: value });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        subscriptionStatus: state.subscriptionStatus,
        deviceId: state.deviceId,
        sessionId: state.sessionId,
      }),
    }
  )
);

export const getAuthState = () => useAuthStore.getState();
