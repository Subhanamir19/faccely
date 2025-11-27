import React, { useEffect, useRef } from "react";
import { useAuth, useSession, useUser } from "@clerk/clerk-expo";
import { useAuthStore } from "@/store/auth";
import { syncUserProfile } from "@/lib/api/user";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const { isLoaded: authLoaded } = useAuth();
  const { session } = useSession();
  const { user, isLoaded: userLoaded } = useUser();
  const setAuthFromSession = useAuthStore((state) => state.setAuthFromSession);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);
  const setInitializedFlag = useAuthStore((state) => state.setInitializedFlag);
  const initialized = useAuthStore((state) => state.initialized);
  const lastSyncedSessionId = useRef<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      if (!authLoaded || !userLoaded) {
        return;
      }

      if (session) {
        const token = await session.getToken();
        setAuthFromSession({
          uid: user?.id ?? session.id,
          email: user?.primaryEmailAddress?.emailAddress ?? null,
          idToken: token ?? null,
          status: "authenticated",
          sessionId: session.id ?? null,
        });
        if (session.id && lastSyncedSessionId.current !== session.id) {
          lastSyncedSessionId.current = session.id;
          syncUserProfile().catch(() => {});
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

  if (!initialized) {
    // Root layout keeps the splash visible until initialization completes.
    return null;
  }

  return <>{children}</>;
}
