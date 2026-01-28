import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { supabase } from "@/lib/supabase/client";
import { syncUserProfile } from "@/lib/api/user";
import { useAuthStore } from "@/store/auth";
import { useSubscriptionStore } from "@/store/subscription";
import { checkSubscriptionStatus, identifyUser, logoutUser } from "@/lib/revenuecat";

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

          // CRITICAL: Sync RevenueCat user ID on login
          // This ensures subscriptions are tied to the correct user and can be recovered
          const isRevenueCatInitialized = useSubscriptionStore.getState().isRevenueCatInitialized;
          if (isRevenueCatInitialized) {
            identifyUser(userId).catch((error) => {
              if (__DEV__) {
                console.warn("[AuthProvider] Failed to sync RevenueCat user ID:", error);
              }
            });
          }
        } else if (reason === "user_updated") {
          syncUserProfile().catch(() => {});
        }

        // Check and sync subscription status with RevenueCat (only if initialized)
        // Note: This only updates revenueCatEntitlement, never touches promoActivated
        const isRevenueCatInitialized = useSubscriptionStore.getState().isRevenueCatInitialized;
        if (isRevenueCatInitialized) {
          checkSubscriptionStatus()
            .then((hasEntitlement) => {
              useSubscriptionStore.getState().setRevenueCatEntitlement(hasEntitlement);
              if (__DEV__) {
                const state = useSubscriptionStore.getState();
                console.log("[AuthProvider] Subscription synced:", {
                  revenueCat: hasEntitlement,
                  promo: state.promoActivated,
                  hasAccess: hasEntitlement || state.promoActivated,
                });
              }
            })
            .catch((error) => {
              // On network error, keep existing persisted state
              // Don't kick out users who might just be offline
              if (__DEV__) {
                console.warn("[AuthProvider] Subscription check failed, keeping cached state:", error);
              }
            });
        } else {
          if (__DEV__) {
            console.log("[AuthProvider] Skipping subscription check - RevenueCat not initialized yet");
          }
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

        // No existing session - user needs to sign in via auth screen
        // We no longer auto-create anonymous sessions
        lastSyncedUserId.current = null;
        clearAuthState();
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
          // User signed out - stay signed out, index.tsx will redirect to auth screen
          lastSyncedUserId.current = null;
          clearAuthState();

          // Also logout from RevenueCat to prevent subscription mixing between accounts
          const isRevenueCatInitialized = useSubscriptionStore.getState().isRevenueCatInitialized;
          if (isRevenueCatInitialized) {
            logoutUser().catch(() => {});
          }
          return;
        }

        if (session) {
          const reason = event === "USER_UPDATED" ? "user_updated" : "state_change";
          await applySession(session, reason);
          return;
        }

        // No session but not explicitly SIGNED_OUT: treat as unauthenticated
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
