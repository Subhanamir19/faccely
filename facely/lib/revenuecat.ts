// lib/revenuecat.ts
// RevenueCat SDK integration for subscription management

import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import { useSubscriptionStore } from "@/store/subscription";

// Read API keys from environment variables
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
const ENTITLEMENT_ID = "Sigma-max Pro";

// Validate API keys are configured
if (!REVENUECAT_API_KEY_IOS || !REVENUECAT_API_KEY_ANDROID) {
  console.error(
    "[RevenueCat] API keys not found in environment variables. " +
    "Please ensure EXPO_PUBLIC_REVENUECAT_API_KEY_IOS and EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID are set in .env"
  );
}

/**
 * Initialize RevenueCat SDK
 * Call this once on app start, after auth is ready
 */
export async function initializeRevenueCat(appUserId?: string): Promise<void> {
  try {
    // Initialize with the appropriate API key
    const apiKey =
      Platform.OS === "ios" ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
      throw new Error(
        `RevenueCat API key not configured for ${Platform.OS}. ` +
        "Please check your .env file."
      );
    }

    // Configure SDK
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    Purchases.configure({
      apiKey,
      appUserID: appUserId, // Can be undefined for anonymous users
    });

    // Mark as initialized in the store
    useSubscriptionStore.getState().setRevenueCatInitialized(true);

    if (__DEV__) {
      console.log("[RevenueCat] Initialized successfully");
    }
  } catch (error) {
    console.error("[RevenueCat] Failed to initialize:", error);
    // Mark as not initialized on error
    useSubscriptionStore.getState().setRevenueCatInitialized(false);
    throw error;
  }
}

/**
 * Check if user has active subscription
 * @returns true if user has "Sigma-max Pro" entitlement
 */
export async function checkSubscriptionStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasEntitlement =
      typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";

    if (__DEV__) {
      console.log("[RevenueCat] Subscription status:", {
        hasEntitlement,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });
    }

    return hasEntitlement;
  } catch (error) {
    console.error("[RevenueCat] Failed to check subscription status:", error);
    // Return false on error to be safe
    return false;
  }
}

/**
 * Get available offerings (packages to purchase)
 * @returns PurchasesOfferings object with all available packages
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();

    if (__DEV__) {
      console.log("[RevenueCat] Fetched offerings:", {
        current: offerings.current?.identifier,
        availablePackages: offerings.current?.availablePackages.length,
      });
    }

    return offerings;
  } catch (error) {
    console.error("[RevenueCat] Failed to get offerings:", error);
    return null;
  }
}

/**
 * Purchase a package
 * @param pkg The package to purchase
 * @returns CustomerInfo if successful, null if cancelled or error
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    if (__DEV__) {
      console.log("[RevenueCat] Purchase successful:", {
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });
    }

    return customerInfo;
  } catch (error: any) {
    // User cancelled the purchase
    if (error.userCancelled) {
      if (__DEV__) {
        console.log("[RevenueCat] Purchase cancelled by user");
      }
      return null;
    }

    console.error("[RevenueCat] Purchase failed:", error);
    throw error;
  }
}

/**
 * Restore previous purchases
 * @returns CustomerInfo with restored entitlements
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();

    if (__DEV__) {
      console.log("[RevenueCat] Purchases restored:", {
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });
    }

    return customerInfo;
  } catch (error) {
    console.error("[RevenueCat] Failed to restore purchases:", error);
    throw error;
  }
}

/**
 * Get customer info (includes entitlements and purchase history)
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error("[RevenueCat] Failed to get customer info:", error);
    return null;
  }
}

/**
 * Update user ID (for linking anonymous user to authenticated user)
 */
export async function identifyUser(newAppUserId: string): Promise<void> {
  try {
    await Purchases.logIn(newAppUserId);

    if (__DEV__) {
      console.log("[RevenueCat] User identified:", newAppUserId);
    }
  } catch (error) {
    console.error("[RevenueCat] Failed to identify user:", error);
    throw error;
  }
}

/**
 * Log out current user (for switching accounts)
 */
export async function logoutUser(): Promise<void> {
  try {
    await Purchases.logOut();

    if (__DEV__) {
      console.log("[RevenueCat] User logged out");
    }
  } catch (error) {
    console.error("[RevenueCat] Failed to log out user:", error);
    throw error;
  }
}

/**
 * Adds a listener for customer info updates (subscription changes)
 * This handles real-time subscription changes: renewals, expiry, refunds
 * Returns an unsubscribe function
 */
export function addCustomerInfoUpdateListener(): () => void {
  const listenerResult = Purchases.addCustomerInfoUpdateListener((customerInfo: CustomerInfo) => {
    const hasEntitlement = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";

    if (__DEV__) {
      console.log("[RevenueCat] Customer info updated:", {
        hasEntitlement,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });
    }

    // Update store with new entitlement status (never touches promoActivated)
    useSubscriptionStore.getState().setRevenueCatEntitlement(hasEntitlement);
  });

  // Handle both SDK versions: newer returns a function, older returns { remove: () => void }
  return () => {
    if (typeof listenerResult === "function") {
      listenerResult();
    } else if (listenerResult && typeof listenerResult.remove === "function") {
      listenerResult.remove();
    }
  };
}
