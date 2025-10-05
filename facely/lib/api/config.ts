// facely/lib/api/config.ts
import { Platform } from "react-native";
import Constants from "expo-constants";

const PLACEHOLDER_HOST_SUBSTRINGS = [
  "your-remote-api.example.com",
  "example.com/your-remote-api",
];


function isPlaceholder(raw: string): boolean {
  const lower = raw.toLowerCase();
  return PLACEHOLDER_HOST_SUBSTRINGS.some((needle) => lower.includes(needle));
}

function normalizeBase(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return null;

    const host = url.hostname?.trim();
    if (!host) return null;
    if (isPlaceholder(host) || isPlaceholder(withScheme)) return null;

    const origin = url.origin.replace(/\/$/, "");
    const path = url.pathname.replace(/\/$/, "");

    // Allow advanced users to include a stable path prefix, e.g. https://api/foo
    const suffix = path.length > 1 ? path : "";
    return `${origin}${suffix}`;
  } catch {
    return null;
  }

}

function sanitizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/^https?:\/\//, "");
  const [host] = clean.split(":");
  if (!host) return null;
  return host.trim();
}
function isLoopback(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower.startsWith("127.") ||
    lower === "::1"
  );
}

function isWildcard(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "0.0.0.0" || lower === "[::]";
}
/**
 * Resolve a sane local default for dev builds.
 *
 * Prefer the LAN host advertised by Metro so virtual devices can reach a
 * remote backend. Fall back to emulator/simulator loopback shims when Metro is
 * bound to localhost/0.0.0.0.
 */
function guessLocal(): string {
  const expoHost =
    sanitizeHost((Constants as any)?.expoConfig?.hostUri) ||
    sanitizeHost((Constants as any)?.expoGoConfig?.hostUri) ||
    sanitizeHost((Constants as any)?.manifest?.debuggerHost) ||
    sanitizeHost((Constants as any)?.manifest2?.extra?.expoClient?.hostUri);

  const isRunningOnDevice = Boolean((Constants as any)?.isDevice);

  if (expoHost && !isLoopback(expoHost) && !isWildcard(expoHost) && isRunningOnDevice) {
    return `http://${expoHost}:8080`;
  }

  if (Platform.OS === "android") {
    // Android emulator cannot reach "localhost" on your PC.
    // 10.0.2.2 maps to the dev machine.
    return "http://10.0.2.2:8080";
  }

  // iOS simulator and web can reach the host machine via localhost.
  return "http://localhost:8080";
}

const envBase =
  normalizeBase((Constants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_URL) ??
  normalizeBase((Constants as any)?.expoGoConfig?.extra?.EXPO_PUBLIC_API_URL) ??
  normalizeBase((Constants as any)?.manifest?.extra?.EXPO_PUBLIC_API_URL) ??
  normalizeBase(
    (Constants as any)?.manifest2?.extra?.expoClient?.extra?.EXPO_PUBLIC_API_URL
  ) ??
  normalizeBase(process.env.EXPO_PUBLIC_API_URL);
const appOwnership = (Constants as any)?.appOwnership;
const ALLOW_LOCAL_GUESS =
  __DEV__ ||
  appOwnership === "expo" ||
  appOwnership === "guest" ||
  appOwnership == null;

const resolvedBase = envBase ?? (ALLOW_LOCAL_GUESS ? guessLocal() : null);

const FALLBACK_INVALID = "http://127.0.0.1.invalid";
/** Single source of truth for the API host. */
export const API_BASE = resolvedBase ?? FALLBACK_INVALID;

/** Flag so call-sites can surface a helpful error when no backend is configured. */
export const API_BASE_CONFIGURED = Boolean(resolvedBase);

const MISCONFIGURED_HINT =
  "Backend base URL missing. Set EXPO_PUBLIC_API_URL before building production bundles.";

/** Human readable hint that can be surfaced in the UI. */
export const API_BASE_CONFIGURATION_HINT = API_BASE_CONFIGURED
  ? ""
  : `${MISCONFIGURED_HINT} (appOwnership=${appOwnership ?? "unknown"}).`;

export const API_BASE_MISCONFIGURED_MESSAGE = MISCONFIGURED_HINT;

if (__DEV__) {
  const note = envBase
    ? ""
    : "[API] Falling back to inferred dev server host. Set EXPO_PUBLIC_API_URL for production.";
  console.log("[API] BASE =", API_BASE, note);
}

if (!API_BASE_CONFIGURED) {
  console.error("[API]", MISCONFIGURED_HINT, {
    appOwnership: appOwnership ?? "unknown",
    envProvided: Boolean(envBase),
  });
}
