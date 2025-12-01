// facely/lib/api/config.ts
// Single source of truth for the backend base URL.
// Updated for Render deployment and emulator-safe localhost handling.

import * as ExpoConstantsModule from "expo-constants";
import { Platform } from "react-native";

const ExpoConstants =
  (ExpoConstantsModule as { default?: unknown })?.default ?? ExpoConstantsModule;

/** Normalize and validate a base URL without trailing slash. */
function normalizeBase(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return null;
    const origin = url.origin.replace(/\/+$/, "");
    const path = url.pathname.replace(/\/+$/, "");
    const suffix = path.length > 1 ? path : "";
    return `${origin}${suffix}`;
  } catch {
    return null;
  }
}

/** Rewrite localhost-style hosts to Android emulator loopback (10.0.2.2) when needed. */
function rewriteLocalhostForAndroid(base: string): { url: string; rewritten: boolean } {
  try {
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
    if (Platform.OS === "android" && isLocal) {
      u.hostname = "10.0.2.2";
      return { url: u.toString().replace(/\/+$/, ""), rewritten: true };
    }
    return { url: base, rewritten: false };
  } catch {
    return { url: base, rewritten: false };
  }
}

/* -------------------------------------------------------------------------- */
/*   Read env from Expo (prefer EXPO_PUBLIC_API_BASE_URL)                     */
/* -------------------------------------------------------------------------- */

const envBaseRaw =
  (ExpoConstants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ??
  (ExpoConstants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL ??
  (ExpoConstants as any)?.manifest?.extra?.EXPO_PUBLIC_API_BASE_URL ??
  (ExpoConstants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_BASE_URL ??
  // Legacy name (.env.example used to ship it)
  (ExpoConstants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  (ExpoConstants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  (ExpoConstants as any)?.manifest?.extra?.EXPO_PUBLIC_API_URL ??
  (ExpoConstants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL;

const envBase = normalizeBase(envBaseRaw);

/* -------------------------------------------------------------------------- */
/*   Development fallback (for local testing if ever needed)                  */
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
      if (url.hostname) return url.hostname;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const isDevLike =
  typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

function guessDevBase(): string | null {
  if (!isDevLike) return null;

  const host = firstHostCandidate();
  const port = FALLBACK_PORT;
  const toHttp = (hostname: string) => `http://${hostname.replace(/\/+$/, "")}:${port}`;

  if (Platform.OS === "android") {
    if (!host) return `http://10.0.2.2:${port}`;
    const lowered = host.toLowerCase();
    const isLoopback =
      lowered === "localhost" ||
      lowered === "127.0.0.1" ||
      lowered === "::1" ||
      lowered === "0.0.0.0";
    if (isLoopback) return `http://10.0.2.2:${port}`;
    return toHttp(host);
  }

  if (!host) return `http://localhost:${port}`;
  const lowered = host.toLowerCase();
  if (lowered === "0.0.0.0" || lowered === "127.0.0.1") return `http://localhost:${port}`;
  return toHttp(host);
}

const devFallback = guessDevBase();

type BaseSource = "env" | "dev-fallback";

type ResolveResult = {
  base: string;
  source: BaseSource;
  reason: string;
};

function resolveApiBase(): ResolveResult {
  if (envBase) {
    return {
      base: envBase,
      source: "env",
      reason: "env(EXPO_PUBLIC_API_BASE_URL|EXPO_PUBLIC_API_URL)",
    };
  }

  const normalizedDevFallback = devFallback ? normalizeBase(devFallback) : null;
  if (normalizedDevFallback) {
    return {
      base: normalizedDevFallback,
      source: "dev-fallback",
      reason: "dev-fallback(hostUri/inferred)",
    };
  }

  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is required for API calls; it is missing or empty."
  );
}

const resolved = resolveApiBase();

let baseCandidate = resolved.base;
let reason = resolved.reason;

/** Ensure Android emulators never use localhost loopback. */
const { url: sanitizedBase, rewritten } = rewriteLocalhostForAndroid(baseCandidate);
if (rewritten) {
  reason += " + android-localhost->10.0.2.2";
  baseCandidate = sanitizedBase;
}

const configurationHint =
  resolved.source === "env"
    ? "API base provided via EXPO_PUBLIC_API_BASE_URL (or legacy EXPO_PUBLIC_API_URL)."
    : `Using inferred development base (${baseCandidate}).`;

export const API_BASE = baseCandidate;
export const API_BASE_CONFIGURED = Boolean(API_BASE);
export const API_BASE_IS_SECURE = API_BASE.startsWith("https://");
export const API_BASE_REASON = reason;

/** Human readable hint for UI surfaces. */
export const API_BASE_CONFIGURATION_HINT = configurationHint;
export const API_BASE_MISCONFIGURED_MESSAGE = configurationHint;

if (isDevLike) {
  const note =
    resolved.source === "env" ? "(env)" : resolved.source === "dev-fallback" ? "(dev-fallback)" : "";
  // eslint-disable-next-line no-console
  console.log("[API] BASE =", API_BASE, note, "| reason:", API_BASE_REASON);
}

export default API_BASE;
