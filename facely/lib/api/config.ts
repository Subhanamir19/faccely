// C:\SS\facely\lib\api\config.ts
import { Platform } from "react-native";

const fromEnv =
  (process.env.EXPO_PUBLIC_API_URL as string) ||
  (process.env.API_BASE as string) ||
  "";

function guessLocal(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:8080"; // Android emulator
  return "http://localhost:8080";                               // iOS simulator / web
}

export const API_BASE = fromEnv || guessLocal();
