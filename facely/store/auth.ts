import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  GoogleAuthProvider,
  type User,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthStatus = "checking" | "signedOut" | "authenticated";
export type SubscriptionStatus = "none" | "active" | "grace" | "unknown";

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
  refreshIdToken: (force?: boolean) => Promise<string | null>;
  getIdTokenOrThrow: () => Promise<string>;
  setOnboardingCompleted: (value: boolean) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  logout: () => Promise<void>;
};

const STORAGE_KEY = "sigma_auth_v1";

let initializationPromise: Promise<void> | null = null;

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
        if (get().initialized) {
          return;
        }

        if (!get().deviceId) {
          set({ deviceId: generateDeviceId() });
        }

        try {
          const auth = getFirebaseAuth();

          if (!initializationPromise) {
            initializationPromise = new Promise<void>((resolve) => {
              let resolved = false;

              onAuthStateChanged(
                auth,
                (firebaseUser) => {
                  const applyState = async () => {
                    if (!firebaseUser) {
                      set({
                        user: null,
                        uid: null,
                        idToken: null,
                        sessionId: null,
                        status: "signedOut",
                        initialized: true,
                      });
                    } else {
                      let token: string | null = null;
                      try {
                        token = await firebaseUser.getIdToken();
                      } catch {
                        token = null;
                      }

                      set({
                        user: firebaseUser,
                        uid: firebaseUser.uid,
                        idToken: token,
                        status: "authenticated",
                        initialized: true,
                      });
                    }

                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  };

                  void applyState();
                },
                (error) => {
                  console.error("[auth] onAuthStateChanged error", error);
                  set({
                    user: null,
                    uid: null,
                    idToken: null,
                    sessionId: null,
                    status: "signedOut",
                    initialized: true,
                  });
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                }
              );
            });
          }

          await initializationPromise;
        } catch (error) {
          console.error("[auth] initialize error", error);
          set({
            user: null,
            uid: null,
            idToken: null,
            sessionId: null,
            status: "signedOut",
            initialized: true,
          });
        } finally {
          initializationPromise = null;
        }
      },

      loginWithEmail: async (email, password) => {
        const normalizedEmail = email.trim();
        if (normalizedEmail.length === 0) {
          throw new Error("Email is required to sign in.");
        }
        if (!password) {
          throw new Error("Password is required to sign in.");
        }

        const auth = getFirebaseAuth();
        try {
          await signInWithEmailAndPassword(auth, normalizedEmail, password);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Unable to sign in with email and password: ${reason}`);
        }
      },
      loginWithGoogleIdToken: async (googleIdToken) => {
        if (!googleIdToken) {
          throw new Error("Google ID token is required.");
        }

        const auth = getFirebaseAuth();
        const credential = GoogleAuthProvider.credential(googleIdToken);

        try {
          await signInWithCredential(auth, credential);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Unable to sign in with Google: ${reason}`);
        }
      },
      refreshIdToken: async (force = false) => {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          set({
            status: "signedOut",
            user: null,
            uid: null,
            idToken: null,
            sessionId: null,
          });
          return null;
        }

        try {
          const token = await currentUser.getIdToken(force);
          set({
            user: currentUser,
            uid: currentUser.uid,
            idToken: token,
            status: "authenticated",
          });
          return token;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Unable to refresh ID token: ${reason}`);
        }
      },
      getIdTokenOrThrow: async () => {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;

        if (!currentUser || !get().uid) {
          throw new Error("User is not authenticated.");
        }

        const token = await get().refreshIdToken(false);
        if (!token) {
          throw new Error("Unable to retrieve Firebase ID token.");
        }

        return token;
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
        const auth = getFirebaseAuth();
        try {
          await signOut(auth);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Unable to sign out: ${reason}`);
        } finally {
          set({
            user: null,
            uid: null,
            idToken: null,
            sessionId: null,
            status: "signedOut",
          });
        }
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
