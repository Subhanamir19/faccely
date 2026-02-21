// store/subscription.ts
// Zustand store for subscription state management
// Architecture: Two independent sources of access (RevenueCat + Promo Code)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PurchasesOfferings, PurchasesPackage } from "react-native-purchases";
import { validatePromoCode } from "@/lib/api/promo";
import { logger } from '@/lib/logger';

const STORAGE_KEY = "sigma_subscription_v2"; // Bumped version for new fields

// Offline grace period: 7 days in milliseconds
// After this period, cached entitlements are considered expired and must be re-verified
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

type SubscriptionState = {
  // Two independent sources of access
  revenueCatEntitlement: boolean;
  promoActivated: boolean;

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
  activatePromoCode: (code: string) => Promise<boolean>;
  isEntitlementValid: () => boolean;
  reset: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      revenueCatEntitlement: false,
      promoActivated: false,
      lastVerifiedAt: null,
      isLoading: false,
      isRevenueCatInitialized: false,
      offerings: null,
      currentPackage: null,
      error: null,

      setRevenueCatEntitlement: (entitled: boolean) => {
        const now = Date.now();
        const { promoActivated } = get();
        logger.log("[Subscription] RevenueCat entitlement update:", {
          revenueCat: entitled,
          promo: promoActivated,
          effectiveAccess: entitled || promoActivated,
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

      activatePromoCode: async (code: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        try {
          const result = await validatePromoCode(code);
          if (result.valid) {
            set({ promoActivated: true, error: null, isLoading: false });
            logger.log("[Subscription] Promo code activated via server");
            return true;
          }
          set({ error: result.message || "Invalid promo code", isLoading: false });
          return false;
        } catch (error) {
          set({ error: "Failed to validate promo code", isLoading: false });
          return false;
        }
      },

      isEntitlementValid: (): boolean => {
        const { revenueCatEntitlement, promoActivated, lastVerifiedAt } = get();

        // Promo codes don't expire (validated server-side on activation)
        if (promoActivated) return true;

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
          promoActivated: false,
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
      partialize: (state) => ({
        promoActivated: state.promoActivated,
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
