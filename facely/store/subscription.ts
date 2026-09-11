// store/subscription.ts
// Zustand store for subscription state management
// Access is granted solely by a RevenueCat entitlement backed by an App Store purchase.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PurchasesOfferings, PurchasesPackage } from "react-native-purchases";
import { logger } from '@/lib/logger';

const STORAGE_KEY = "sigma_subscription_v2"; // Bumped version for new fields

// Offline grace period: 7 days in milliseconds
// After this period, cached entitlements are considered expired and must be re-verified
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

type SubscriptionState = {
  // The only source of access
  revenueCatEntitlement: boolean;

  // Timestamp tracking for offline grace period
  lastVerifiedAt: number | null; // Unix timestamp when subscription was last verified

  // UI state
  isLoading: boolean;
  isRevenueCatInitialized: boolean;
  offerings: PurchasesOfferings | null;
  currentPackage: PurchasesPackage | null;
  error: string | null;

  // Actions
  setRevenueCatEntitlement: (entitled: boolean) => void;
  setLoading: (loading: boolean) => void;
  setRevenueCatInitialized: (initialized: boolean) => void;
  setOfferings: (offerings: PurchasesOfferings | null) => void;
  setCurrentPackage: (pkg: PurchasesPackage | null) => void;
  setError: (error: string | null) => void;
  isEntitlementValid: () => boolean;
  reset: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      revenueCatEntitlement: false,
      lastVerifiedAt: null,
      isLoading: false,
      isRevenueCatInitialized: false,
      offerings: null,
      currentPackage: null,
      error: null,

      setRevenueCatEntitlement: (entitled: boolean) => {
        const now = Date.now();
        logger.log("[Subscription] RevenueCat entitlement update:", {
          revenueCat: entitled,
          verifiedAt: new Date(now).toISOString(),
        });
        // Update timestamp whenever we verify with RevenueCat
        set({ revenueCatEntitlement: entitled, lastVerifiedAt: now });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setRevenueCatInitialized: (initialized) => set({ isRevenueCatInitialized: initialized }),

      setOfferings: (offerings) => set({ offerings }),

      setCurrentPackage: (pkg) => set({ currentPackage: pkg }),

      setError: (error) => set({ error }),

      isEntitlementValid: (): boolean => {
        const { revenueCatEntitlement, lastVerifiedAt } = get();

        // No RevenueCat entitlement = no access
        if (!revenueCatEntitlement) return false;

        // No verification timestamp = treat as expired (force re-verify)
        if (!lastVerifiedAt) return false;

        // Check if within grace period
        const elapsed = Date.now() - lastVerifiedAt;
        const isWithinGracePeriod = elapsed < OFFLINE_GRACE_PERIOD_MS;

        if (!isWithinGracePeriod) {
          logger.log("[Subscription] Cached entitlement expired:", {
            lastVerified: new Date(lastVerifiedAt).toISOString(),
            elapsedDays: Math.floor(elapsed / (24 * 60 * 60 * 1000)),
            gracePeriodDays: OFFLINE_GRACE_PERIOD_MS / (24 * 60 * 60 * 1000),
          });
        }

        return isWithinGracePeriod;
      },

      reset: () => {
        set({
          revenueCatEntitlement: false,
          lastVerifiedAt: null,
          isLoading: false,
          isRevenueCatInitialized: false,
          offerings: null,
          currentPackage: null,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Drop any legacy persisted keys (e.g. the removed promo flag) on rehydrate.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SubscriptionState>;
        return {
          ...current,
          revenueCatEntitlement: Boolean(saved.revenueCatEntitlement),
          lastVerifiedAt: typeof saved.lastVerifiedAt === "number" ? saved.lastVerifiedAt : null,
        };
      },
      partialize: (state) => ({
        revenueCatEntitlement: state.revenueCatEntitlement,
        lastVerifiedAt: state.lastVerifiedAt,
      }),
    }
  )
);

export const getSubscriptionState = () => useSubscriptionStore.getState();

// Helper hook for checking access (respects offline grace period)
export const useHasAccess = () => {
  const isEntitlementValid = useSubscriptionStore((state) => state.isEntitlementValid);
  return isEntitlementValid();
};
