import React, { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!initialized) {
    // Root layout keeps the splash visible until initialization completes.
    return null;
  }

  return <>{children}</>;
}
