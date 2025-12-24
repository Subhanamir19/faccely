import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

/**
 * Gate premium-only actions behind an upgrade to email/password.
 * Returns `true` if the user is already upgraded; otherwise routes to `/(auth)/login` and returns `false`.
 */
export function requireUpgrade(redirectTo: string): boolean {
  const { isAnonymous } = useAuthStore.getState();
  if (!isAnonymous) return true;

  router.push({
    pathname: "/(auth)/login",
    params: { redirectTo } as any,
  });
  return false;
}

