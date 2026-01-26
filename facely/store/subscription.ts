// store/subscription.ts
// Zustand store for subscription state management
// Architecture: Two independent sources of access (RevenueCat + Promo Code)

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PurchasesOfferings, PurchasesPackage } from "react-native-purchases";

const PROMO_CODE = "SIGMABOSS";
const STORAGE_KEY = "sigma_subscription_v1";

type SubscriptionState = {
  // Two independent sources of access
  revenueCatEntitlement: boolean;
  promoActivated: boolean;

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
  activatePromoCode: (code: string) => boolean;
  reset: () => void;
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      revenueCatEntitlement: false,
      promoActivated: false,
      isLoading: false,
      isRevenueCatInitialized: false,
      offerings: null,
      currentPackage: null,
      error: null,

      setRevenueCatEntitlement: (entitled: boolean) => {
        if (__DEV__) {
          const { promoActivated } = get();
          console.log("[Subscription] RevenueCat entitlement update:", {
            revenueCat: entitled,
            promo: promoActivated,
            effectiveAccess: entitled || promoActivated,
          });
        }
        set({ revenueCatEntitlement: entitled });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setRevenueCatInitialized: (initialized) => set({ isRevenueCatInitialized: initialized }),

      setOfferings: (offerings) => set({ offerings }),

      setCurrentPackage: (pkg) => set({ currentPackage: pkg }),

      setError: (error) => set({ error }),

      activatePromoCode: (code: string): boolean => {
        const trimmed = code.trim().toUpperCase();
        if (trimmed === PROMO_CODE) {
          set({ promoActivated: true, error: null });
          if (__DEV__) {
            console.log("[Subscription] Promo code activated");
          }
          return true;
        }
        set({ error: "Invalid promo code" });
        return false;
      },

      reset: () => {
        set({
          revenueCatEntitlement: false,
          promoActivated: false,
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
      }),
    }
  )
);

export const getSubscriptionState = () => useSubscriptionStore.getState();

// Helper hook for checking access
export const useHasAccess = () => {
  const revenueCatEntitlement = useSubscriptionStore((state) => state.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((state) => state.promoActivated);
  return revenueCatEntitlement || promoActivated;
};
