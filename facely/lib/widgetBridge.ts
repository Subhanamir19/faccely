// lib/widgetBridge.ts
// Bridge to write data to the iOS home screen widget via a native module
// and shared App Group UserDefaults.
//
// SETUP REQUIRED (post `expo prebuild --platform ios`):
//   1. Add WidgetBridgeModule.swift + WidgetBridgeModule.m to main app target (see docs/)
//   2. Add App Group capability: group.com.sigmamax.app to both app + widget targets
//   3. Add the SigmaxWidgetExtension target in Xcode
//   4. Register the App Group in Apple Developer portal
//
// On Android this is a no-op — Platform.OS check prevents any native call.

import { NativeModules, Platform } from "react-native";

export type WidgetData = {
  score: number;
  streak: number;
  topMetric: string;
  topMetricScore: number;
  updatedAt: string;
};

/**
 * Writes widget data to the shared App Group UserDefaults and triggers
 * an immediate widget timeline refresh via WidgetCenter.
 *
 * Safe to call from any screen — no-ops silently if the native module
 * is unavailable (e.g. before prebuild, on Android, in Expo Go).
 */
export async function updateWidgetData(data: WidgetData): Promise<void> {
  if (Platform.OS !== "ios") return;

  const bridge = NativeModules.WidgetBridge;
  if (!bridge?.updateWidgetData) return;

  try {
    bridge.updateWidgetData(JSON.stringify(data));
  } catch {
    // Silent fail — widget update is non-critical
  }
}
