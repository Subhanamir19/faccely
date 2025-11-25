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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogleIdToken: (googleIdToken: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  refreshIdToken: (force?: boolean) => Promise<string | null>;
  getIdTokenOrThrow: () => Promise<string>;
  setOnboardingCompleted: (value: boolean) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  logout: () => Promise<void>;
  setAuthFromSession: (input: {
    uid: string;
    email?: string | null;
    idToken?: string | null;
    status: AuthStatus;
    sessionId?: string | null;
  }) => void;
  clearAuthState: () => void;
  setInitializedFlag: (value: boolean) => void;
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

      loginWithEmail: async (email, password) => {
        const normalizedEmail = email.trim();
        void password;

        const uid = get().uid ?? generateDeviceId();
        set({
          user: { uid, email: normalizedEmail || null },
          uid,
          idToken: "dummy-token",
          status: "authenticated",
        });
      },
      loginWithGoogleIdToken: async (googleIdToken) => {
        const uid = get().uid ?? generateDeviceId();
        void googleIdToken;
        set({
          user: { uid, email: null },
          uid,
          idToken: "dummy-google-token",
          status: "authenticated",
        });
      },
      signUpWithEmail: async (email, password) => {
        const normalizedEmail = email.trim();
        void password;

        const uid = get().uid ?? generateDeviceId();
        set({
          user: { uid, email: normalizedEmail || null },
          uid,
          idToken: "dummy-token",
          status: "authenticated",
        });
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

        const token = get().idToken ?? "dummy-token";
        set({ idToken: token, status: "authenticated" });
        return token;
      },
      getIdTokenOrThrow: async () => {
        if (get().status !== "authenticated" || !get().uid) {
          throw new Error("User is not authenticated.");
        }

        return get().idToken ?? "dummy-token";
      },
      setOnboardingCompleted: (value) => {
        set({ onboardingCompleted: value });
      },
      setSubscriptionStatus: (status) => {
        set({ subscriptionStatus: status });
      },
      setSessionId: (sessionId) => {
        set({ sessionId });
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
        set({
          user: { uid, email: email ?? null },
          uid,
          idToken: idToken ?? null,
          sessionId: sessionId ?? null,
          status,
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
