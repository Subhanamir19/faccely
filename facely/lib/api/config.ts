// facely/lib/api/config.ts
import { Platform } from "react-native";

const fromEnv =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  (process.env.API_BASE as string | undefined) ||
  "";

/** Resolve a sane local default for dev builds. */
function guessLocal(): string {
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
