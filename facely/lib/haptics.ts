// lib/haptics.ts
// Centralized haptic feedback utilities
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Two triggers this close together read as one mushy buzz, so drop the second.
const MIN_GAP_MS = 40;
let lastFiredAt = 0;

function fire(run: () => Promise<void>, bypassGap = false) {
  if (Platform.OS === "web") return;
  const now = Date.now();
  if (!bypassGap && now - lastFiredAt < MIN_GAP_MS) return;
  lastFiredAt = now;
  try {
    run().catch(() => {
      // Silently fail if haptics not available
    });
  } catch {
    // Silently fail if haptics not available
  }
}

// Android's vibrator turns light taps into a soft buzz; the system haptic
// engine gives a crisp click instead. Strong impacts stay on the vibrator,
// which is what makes them feel heavy.
function crisp(android: Haptics.AndroidHaptics, ios: () => Promise<void>) {
  return Platform.OS === "android"
    ? () => Haptics.performAndroidHapticsAsync(android)
    : ios;
}

const impact = (style: Haptics.ImpactFeedbackStyle) => () => Haptics.impactAsync(style);
const notify = (type: Haptics.NotificationFeedbackType) => () => Haptics.notificationAsync(type);

/**
 * Light haptic feedback - for back buttons, minor taps
 */
export function hapticLight() {
  fire(crisp(Haptics.AndroidHaptics.Virtual_Key, impact(Haptics.ImpactFeedbackStyle.Light)));
}

/**
 * Medium haptic feedback - for confirmations, state changes
 */
export function hapticMedium() {
  fire(impact(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * Heavy haptic feedback - for primary actions (Continue, capture)
 */
export function hapticHeavy() {
  fire(impact(Haptics.ImpactFeedbackStyle.Heavy));
}

/**
 * Rigid haptic feedback - a sharp, solid tap for choosing an answer
 */
export function hapticRigid() {
  fire(impact(Haptics.ImpactFeedbackStyle.Rigid));
}

/**
 * Selection feedback - for picker/wheel changes
 */
export function hapticSelection() {
  fire(crisp(Haptics.AndroidHaptics.Clock_Tick, () => Haptics.selectionAsync()));
}

/**
 * Tick feedback - for counters and progress steps
 */
export function hapticTick() {
  fire(crisp(Haptics.AndroidHaptics.Clock_Tick, impact(Haptics.ImpactFeedbackStyle.Light)));
}

/**
 * Success notification feedback
 */
export function hapticSuccess() {
  fire(notify(Haptics.NotificationFeedbackType.Success));
}

/**
 * Error notification feedback
 */
export function hapticError() {
  fire(notify(Haptics.NotificationFeedbackType.Error));
}

/**
 * Warning notification feedback
 */
export function hapticWarning() {
  fire(notify(Haptics.NotificationFeedbackType.Warning));
}

/**
 * Thud - heavy then rigid, for "this matters" actions (Start scan, buy)
 */
export function hapticThud() {
  fire(impact(Haptics.ImpactFeedbackStyle.Heavy));
  setTimeout(() => fire(impact(Haptics.ImpactFeedbackStyle.Rigid), true), 60);
}

/**
 * Crescendo - builds light, medium, heavy, then success, for reveals
 */
export function hapticCrescendo() {
  fire(impact(Haptics.ImpactFeedbackStyle.Light));
  setTimeout(() => fire(impact(Haptics.ImpactFeedbackStyle.Medium), true), 90);
  setTimeout(() => fire(impact(Haptics.ImpactFeedbackStyle.Heavy), true), 180);
  setTimeout(() => fire(notify(Haptics.NotificationFeedbackType.Success), true), 320);
}
