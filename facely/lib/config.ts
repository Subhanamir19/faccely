// facely/lib/config.ts
import { Platform } from "react-native";

// Prefer env if present
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080");

// Optional: sanity
if (__DEV__) console.log("API_BASE_URL ->", API_BASE_URL);
