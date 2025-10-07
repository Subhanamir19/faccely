// facely/lib/api/config.ts
// Single source of truth for the backend base URL.
// No emulator guessing, no localhost bingo, no magic fallbacks.

import * as ExpoConstantsModule from "expo-constants";
import { Platform } from "react-native";

// Expo publishes both a default export and named members. Some toolchains only
// surface one or the other (e.g., Jest without Babel interop), so normalize it
// into a single object.
const ExpoConstants =
  (ExpoConstantsModule as { default?: unknown })?.default ?? ExpoConstantsModule;

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
normalizeBase((ExpoConstants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
normalizeBase((ExpoConstants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
normalizeBase((ExpoConstants as any)?.manifest?.extra?.EXPO_PUBLIC_API_BASE_URL) ??
normalizeBase(
  (ExpoConstants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_BASE_URL
) ??
// Legacy name supported for backwards compatibility (.env.example used to ship it)
normalizeBase((ExpoConstants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ??
normalizeBase((ExpoConstants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_URL) ??
normalizeBase((ExpoConstants as any)?.manifest?.extra?.EXPO_PUBLIC_API_URL) ??
(ExpoConstants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_URL
 ??
  // Node-style fallback when bundlers inject process.env
  normalizeBase(process.env.EXPO_PUBLIC_API_BASE_URL) ??
  normalizeBase(process.env.EXPO_PUBLIC_API_URL);

/* -------------------------------------------------------------------------- */
/*   Development fallback: infer Metro host or simulator defaults             */
/* -------------------------------------------------------------------------- */

const DEV_PORT = Number.parseInt(String(process.env.EXPO_PUBLIC_API_PORT ?? ""), 10);
const FALLBACK_PORT = Number.isFinite(DEV_PORT) ? DEV_PORT : 8080;

function firstHostCandidate(): string | null {
  const candidates = [
    (ExpoConstants as any)?.expoConfig?.hostUri,
    (ExpoConstants as any)?.expoGoConfig?.hostUri,
    (ExpoConstants as any)?.manifest?.debuggerHost,
    (ExpoConstants as any)?.manifest?.hostUri,
    (ExpoConstants as any)?.manifest2?.extra?.expoClient?.hostUri,
    (ExpoConstants as any)?.manifest2?.debuggerHost,
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const withScheme = /:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
    try {
      const url = new URL(withScheme);
      if (url.hostname) {
        return url.hostname;
      }
    } catch {
      // ignore parse errors and continue
    }
  }

  return null;
}

const isDevLike = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

function guessDevBase(): string | null {
  if (!isDevLike) return null;

  const host = firstHostCandidate();

  const port = FALLBACK_PORT;

  const toHttp = (hostname: string) => `http://${hostname.replace(/\/+$/, "")}:${port}`;

  if (Platform.OS === "android") {
    // Android emulators cannot reach the host loopback directly; map to 10.0.2.2.
    if (!host) {
      return `http://10.0.2.2:${port}`;
    }

    const lowered = host.toLowerCase();
    const isLoopback =
      lowered === "localhost" ||
      lowered === "127.0.0.1" ||
      lowered === "::1" ||
      lowered === "0.0.0.0";

    if (isLoopback) {
      return `http://10.0.2.2:${port}`;
    }

    // For LAN hosts (physical devices), use the LAN IP as-is.
    return toHttp(host);
  }

  if (!host) {
    return `http://localhost:${port}`;
  }

  const lowered = host.toLowerCase();
  if (lowered === "0.0.0.0" || lowered === "127.0.0.1") {
    return `http://localhost:${port}`;
  }

  return toHttp(host);
}

const devFallback = guessDevBase();

/* -------------------------------------------------------------------------- */
/*   Final base: env, dev fallback, or production default                      */
/* -------------------------------------------------------------------------- */

// Hard default to your deployed backend.
// Change this constant only if you move domains.
const PROD_DEFAULT = "https://faccely-production.up.railway.app";

export const API_BASE = envBase || devFallback || PROD_DEFAULT;
export const API_BASE_CONFIGURED = Boolean(envBase || devFallback);

const MISCONFIGURED_HINT = envBase
  ? "API base provided via EXPO_PUBLIC_API_BASE_URL."
  : devFallback
  ? `Using inferred development base (${devFallback}). Set EXPO_PUBLIC_API_BASE_URL to override.`
  : "Using production default. Set EXPO_PUBLIC_API_BASE_URL to override.";

/** Human readable hint for UI surfaces. */
export const API_BASE_CONFIGURATION_HINT = MISCONFIGURED_HINT;

/** Kept for backwards compatibility with existing imports. */
export const API_BASE_MISCONFIGURED_MESSAGE = MISCONFIGURED_HINT;

// Boot log: helpful but quiet.
if (isDevLike) {
  const note = envBase ? "(env)" : devFallback ? "(dev-fallback)" : "(default)";
  // eslint-disable-next-line no-console
  console.log("[API] BASE =", API_BASE, note);
}

export default API_BASE;
