// lib/api/promo.ts
// Server-side promo code validation

import { API_BASE } from "@/lib/api/config";
import { buildAuthHeadersAsync } from "./authHeaders";

type ValidatePromoResponse = {
  valid: boolean;
  message?: string;
};

/**
 * Validates a promo code via server-side API
 * Returns { valid: true } if code is valid, { valid: false, message } otherwise
 */
export async function validatePromoCode(code: string): Promise<ValidatePromoResponse> {
  const authHeaders = await buildAuthHeadersAsync({ includeLegacy: false });

  const response = await fetch(`${API_BASE}/promo/validate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { valid: false, message: "Please sign in to use promo codes" };
    }
    return { valid: false, message: "Unable to validate promo code" };
  }

  const data = await response.json();
  return {
    valid: Boolean(data.valid),
    message: data.message,
  };
}
