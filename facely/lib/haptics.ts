// lib/haptics.ts
// Centralized haptic feedback utilities
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Light haptic feedback - for button presses, selections
 */
export function hapticLight() {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Medium haptic feedback - for confirmations, state changes
 */
export function hapticMedium() {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silently fail
  }
}

/**
 * Heavy haptic feedback - for important actions
 */
export function hapticHeavy() {
  if (Platform.OS === "web") return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Silently fail
  }
}

/**
 * Selection feedback - for picker/selection changes
 */
export function hapticSelection() {
  if (Platform.OS === "web") return;
  try {
    Haptics.selectionAsync();
  } catch {
    // Silently fail
  }
}

/**
 * Success notification feedback
 */
export function hapticSuccess() {
  if (Platform.OS === "web") return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silently fail
  }
}

/**
 * Error notification feedback
 */
export function hapticError() {
  if (Platform.OS === "web") return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silently fail
  }
}

/**
 * Warning notification feedback
 */
export function hapticWarning() {
  if (Platform.OS === "web") return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Silently fail
  }
}
