import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { supabase } from "@/lib/supabase/client";
import { syncUserProfile } from "@/lib/api/user";
import { useAuthStore } from "@/store/auth";

type Props = {
  children: React.ReactNode;
};

function isValidJwt(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return trimmed.length > 0 && trimmed.split(".").length === 3;
}

function getIsAnonymous(user: any): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  const provider = user.app_metadata?.provider;
  if (provider === "anonymous") return true;
  const providers: unknown = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("anonymous");
}

export function AuthProvider({ children }: Props) {
  const setAuthFromSession = useAuthStore((state) => state.setAuthFromSession);
  const clearAuthState = useAuthStore((state) => state.clearAuthState);
  const setInitializedFlag = useAuthStore((state) => state.setInitializedFlag);
  const initialized = useAuthStore((state) => state.initialized);
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: any, reason: string) => {
      const userId = session?.user?.id;
      const token = session?.access_token;

      if (typeof userId === "string" && isValidJwt(token)) {
        setAuthFromSession({
          uid: userId,
          email: session?.user?.email ?? null,
          idToken: token,
          status: "authenticated",
          sessionId: null,
          isAnonymous: getIsAnonymous(session?.user),
        });

        // Ensure DB user row exists before any scan insert (FK depends on it)
        if (lastSyncedUserId.current !== userId) {
          lastSyncedUserId.current = userId;
          syncUserProfile().catch(() => {});
        } else if (reason === "user_updated") {
          syncUserProfile().catch(() => {});
        }
        return;
      }

      console.warn("[auth] supabase session missing user/token", { reason });
      lastSyncedUserId.current = null;
      clearAuthState();
    };

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          await applySession(data.session, "bootstrap_existing");
          return;
        }

        const res = await supabase.auth.signInAnonymously();
        if (res.error) throw res.error;
        if (!cancelled) {
          await applySession(res.data.session, "bootstrap_anonymous");
        }
      } catch (err: any) {
        console.warn("[auth] supabase bootstrap failed", err?.message || err);
        lastSyncedUserId.current = null;
        clearAuthState();
      } finally {
        if (!cancelled) setInitializedFlag(true);
      }
    };

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          lastSyncedUserId.current = null;
          clearAuthState();
          const res = await supabase.auth.signInAnonymously();
          if (res.error) {
            console.warn("[auth] failed to re-enter anonymous session", res.error.message);
            return;
          }
          await applySession(res.data.session, "signed_out_to_anonymous");
          return;
        }

        if (session) {
          const reason = event === "USER_UPDATED" ? "user_updated" : "state_change";
          await applySession(session, reason);
          return;
        }

        // No session but not explicitly SIGNED_OUT: treat as unauthenticated and rely on bootstrap.
        lastSyncedUserId.current = null;
        clearAuthState();
      }
    );

    return () => {
      cancelled = true;
      subscription?.subscription?.unsubscribe();
    };
  }, [clearAuthState, setAuthFromSession, setInitializedFlag]);

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
