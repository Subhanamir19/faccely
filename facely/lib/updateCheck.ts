// lib/updateCheck.ts
// Checks Supabase for a newer app version and returns update info.

import { supabase } from "./supabase/client";
import Constants from "expo-constants";

export type UpdateStatus =
  | { available: false }
  | { available: true; latestVersion: string; forced: boolean; message: string };

/** Compare two semver strings. Returns true if `a` is strictly less than `b`. */
function isOlderThan(a: string, b: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return aPatch < bPatch;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const currentVersion = Constants.expoConfig?.version ?? "1.0.0";

    const { data, error } = await supabase
      .from("app_config")
      .select("latest_version, force_update, update_message")
      .eq("id", "main")
      .single();

    if (error || !data) return { available: false };

    const { latest_version, force_update, update_message } = data;

    if (!latest_version || !isOlderThan(currentVersion, latest_version)) {
      return { available: false };
    }

    return {
      available: true,
      latestVersion: latest_version,
      forced: force_update ?? false,
      message:
        update_message ??
        "A new version of SigmaMax is available with improvements and new features.",
    };
  } catch {
    return { available: false };
  }
}
