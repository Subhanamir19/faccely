import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/* ============================================================================
 * Keyboard visibility.
 *
 * Coach's composer normally carries clearance for the floating tab bar, which
 * sits over content rather than reserving space. Once the keyboard is up that
 * clearance is wrong twice over: the tab bar is hidden behind the keyboard, and
 * KeyboardAvoidingView has already padded the screen by the keyboard's height,
 * so the extra space strands the input in the middle of the screen.
 *
 * `will*` events on iOS fire before the animation starts, so the layout moves
 * with the keyboard rather than a frame behind it. Android only has `did*`.
 * ========================================================================== */

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
