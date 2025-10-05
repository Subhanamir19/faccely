// facely/lib/api/config.ts
import { Platform } from "react-native";
import Constants from "expo-constants";


const fromEnv =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  (process.env.API_BASE as string | undefined) ||
  "";

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
export const API_BASE = fromEnv || guessLocal();

if (__DEV__) {
  // one-time visibility so you know what the app is using
  console.log("[API] BASE =", API_BASE);
}
