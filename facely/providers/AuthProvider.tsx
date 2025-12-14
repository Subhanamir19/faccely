import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth, useSession, useUser } from "@clerk/clerk-expo";
import { useAuthStore } from "@/store/auth";
import { syncUserProfile } from "@/lib/api/user";

type Props = {
  children: React.ReactNode;
};

const JWT_TEMPLATE =
  process.env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE && process.env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE.trim().length > 0
    ? process.env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE.trim()
    : "scorer-node";

function isValidJwt(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return trimmed.length > 0 && trimmed.split(".").length === 3;
}

export function AuthProvider({ children }: Props) {
  const { isLoaded: authLoaded } = useAuth();
  const { session } = useSession();
  const { user, isLoaded: userLoaded } = useUser();
  const setAuthFromSession = useAuthStore((state) => state.setAuthFromSession);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);
  const setIdToken = useAuthStore((state) => state.setIdToken);
  const setInitializedFlag = useAuthStore((state) => state.setInitializedFlag);
  const initialized = useAuthStore((state) => state.initialized);
  const lastSyncedSessionId = useRef<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      if (!authLoaded || !userLoaded) {
        return;
      }

      if (session) {
        try {
          const token = await session.getToken({ template: JWT_TEMPLATE });
          if (isValidJwt(token)) {
            setAuthFromSession({
              uid: user?.id ?? session.id,
              email: user?.primaryEmailAddress?.emailAddress ?? null,
              idToken: token,
              status: "authenticated",
              sessionId: session.id ?? null,
            });
            if (session.id && lastSyncedSessionId.current !== session.id) {
              lastSyncedSessionId.current = session.id;
              syncUserProfile().catch(() => {});
            }
          } else {
            console.warn("[auth] Missing/invalid Clerk JWT", {
              template: JWT_TEMPLATE,
              sessionId: session.id,
            });
            clearAuthState();
          }
        } catch (error: any) {
          console.warn("[auth] Failed to acquire Clerk JWT", {
            template: JWT_TEMPLATE,
            sessionId: session.id,
            error: error?.message || error,
          });
          clearAuthState();
        }
      } else {
        lastSyncedSessionId.current = null;
        clearAuthState();
      }

      setInitializedFlag(true);
    };

    void sync();
  }, [
    authLoaded,
    userLoaded,
    session,
    user,
    setAuthFromSession,
    clearAuthState,
    setInitializedFlag,
    syncUserProfile,
  ]);

  useEffect(() => {
    if (!session) return;
    const intervalMs = 45_000;
    const refresh = async () => {
      try {
        const token = await session.getToken({ template: JWT_TEMPLATE });
        if (isValidJwt(token)) {
          setIdToken(token);
        } else {
          console.warn("[auth] token refresh returned empty/invalid token", { template: JWT_TEMPLATE });
        }
      } catch (err: any) {
        console.warn("[auth] token refresh failed", {
          template: JWT_TEMPLATE,
          error: err?.message || err,
        });
      }
    };
    const interval = setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [session, setIdToken]);

  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return <>{children}</>;
}
