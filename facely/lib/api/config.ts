// facely/lib/api/config.ts
// Single source of truth for the backend base URL.
// No emulator guessing, no localhost bingo, no magic fallbacks.

import Constants from "expo-constants";

/** Normalize and validate a base URL without trailing slash. */
function normalizeBase(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Ensure scheme
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return null;
    const origin = url.origin.replace(/\/+$/, "");
    const path = url.pathname.replace(/\/+$/, "");
    // Allow optional fixed path prefix (e.g., https://api.example.com/v1)
    const suffix = path.length > 1 ? path : "";
    return `${origin}${suffix}`;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*   Read env from Expo (prefer EXPO_PUBLIC_API_BASE_URL)                     */
/* -------------------------------------------------------------------------- */

const envBase =
  normalizeBase((Constants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
  normalizeBase((Constants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
  normalizeBase((Constants as any)?.manifest?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
  normalizeBase(
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_BASE_URL
  ) ??
  // Node-style fallback when bundlers inject process.env
  normalizeBase(process.env.EXPO_PUBLIC_API_BASE_URL);

/* -------------------------------------------------------------------------- */
/*   Final base: env or production default                                    */
/* -------------------------------------------------------------------------- */

// Hard default to your deployed backend.
// Change this constant only if you move domains.
const PROD_DEFAULT = "https://faccely-production.up.railway.app";

export const API_BASE = envBase || PROD_DEFAULT;
export const API_BASE_CONFIGURED = Boolean(envBase);

const MISCONFIGURED_HINT = API_BASE_CONFIGURED
  ? "API base provided via EXPO_PUBLIC_API_BASE_URL."
  : "Using production default. Set EXPO_PUBLIC_API_BASE_URL to override.";

/** Human readable hint for UI surfaces. */
export const API_BASE_CONFIGURATION_HINT = MISCONFIGURED_HINT;

/** Kept for backwards compatibility with existing imports. */
export const API_BASE_MISCONFIGURED_MESSAGE = MISCONFIGURED_HINT;

// Boot log: helpful but quiet.
if (__DEV__) {
  const note = API_BASE_CONFIGURED ? "(env)" : "(default)";
  // eslint-disable-next-line no-console
  console.log("[API] BASE =", API_BASE, note);
}

export default API_BASE;
