import { Platform } from "react-native";

const fromEnv =
  (process.env.EXPO_PUBLIC_API_URL as string) ||
  (process.env.API_BASE as string) ||
  "";

// Android emulator cannot reach "localhost" on your PC.
// 10.0.2.2 is the magic host that maps to the dev machine.
function guessLocal(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:8080";
  return "http://localhost:8080";
}

export const API_BASE = fromEnv || guessLocal();

// one-time visibility so you know what the app is using
console.log("[API] BASE =", API_BASE);
