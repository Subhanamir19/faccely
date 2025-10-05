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

/**
 * Resolve a sane local default for dev builds.
 *
 * When running inside Expo Go on a physical device there is no localhost/10.0.2.2
 * bridge. Instead we derive the LAN IP from the Metro debugger host so the
 * device can reach the Node backend running on the same machine.
 */
function guessLocal(): string {
  const expoHost =
  sanitizeHost((Constants as any)?.expoConfig?.hostUri) ||
    sanitizeHost((Constants as any)?.expoGoConfig?.hostUri) ||
    sanitizeHost((Constants as any)?.manifest?.debuggerHost) ||
    sanitizeHost((Constants as any)?.manifest2?.extra?.expoClient?.hostUri);

    if (expoHost) {
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

/** Single source of truth for the API host. */
export const API_BASE = envBase || guessLocal();

if (__DEV__) {
  const note = envBase
    ? ""
    : "[API] Falling back to inferred dev server host. Set EXPO_PUBLIC_API_URL for production.";
  console.log("[API] BASE =", API_BASE, note);
}

if (!envBase && process.env.NODE_ENV === "production") {
  // Surface a visible warning in release builds so a misconfigured bundle is caught early.
  console.warn(
    "[API] No EXPO_PUBLIC_API_URL provided. Bundle will default to local dev host which is unreachable in production."
  );
}
