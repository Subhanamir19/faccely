// hooks/useTenByTenConsent.tsx
// One-time consent modal for the "You as a 10/10" AI face enhancement feature.
// Apple Guidelines 5.1.1 / 5.1.2 compliance.

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  Text,
  Dimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

import { COLORS, RADII, SP } from "@/lib/tokens";
import { setJSON, getJSON } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONSENT_KEY = "ten_by_ten_consent";
const PRIVACY_URL =
  "https://third-tamarillo-756.notion.site/Privacy-Policy-30266c2b427680a29ba5e586b5913999";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Inner modal component
// ---------------------------------------------------------------------------
interface ModalProps {
  visible: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

export const TenByTenConsentModalInner: React.FC<ModalProps> = ({
  visible,
  onAgree,
  onCancel,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 260 });
      scale.value = withTiming(1, {
        duration: 340,
        easing: Easing.out(Easing.back(1.05)),
      });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.92, { duration: 180 });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const openPrivacyPolicy = useCallback(() => {
    WebBrowser.openBrowserAsync(PRIVACY_URL);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable onPress={() => undefined}>
          <Animated.View style={[styles.card, cardStyle]}>
            {/* Icon badge */}
            <View style={styles.iconBadge}>
              <Text style={styles.iconEmoji}>✨</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>You as a 10/10</Text>

            {/* Description */}
            <Text style={styles.body}>
              Your photo will be securely processed by AI to generate an
              enhanced version of your face.
            </Text>

            {/* Bullet points */}
            <View style={styles.bullets}>
              <View style={styles.bulletRow}>
                <View style={styles.dot} />
                <Text style={styles.bulletText}>
                  For motivational purposes only — not a medical tool
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <View style={styles.dot} />
                <Text style={styles.bulletText}>
                  Results depend on photo quality and lighting
                </Text>
              </View>
            </View>

            {/* Privacy policy link */}
            <Pressable
              onPress={openPrivacyPolicy}
              style={({ pressed }) => [
                styles.privacyLink,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.privacyLinkText}>View Privacy Policy</Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Action buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.agreeBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={onAgree}
                accessibilityRole="button"
                accessibilityLabel="I Agree"
              >
                <Text style={styles.agreeBtnText}>I Agree</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export interface UseTenByTenConsentReturn {
  hasConsent: boolean;
  checkAndPromptConsent: () => Promise<boolean>;
  ConsentModal: React.FC;
}

export function useTenByTenConsent(): UseTenByTenConsentReturn {
  const [hasConsent, setHasConsent] = useState(false);
  const [visible, setVisible] = useState(false);

  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const handleAgree = useCallback(async () => {
    await setJSON(CONSENT_KEY, new Date().toISOString());
    setHasConsent(true);
    setVisible(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setVisible(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const checkAndPromptConsent = useCallback(async (): Promise<boolean> => {
    const stored = await getJSON<string | null>(CONSENT_KEY, null);
    if (stored) {
      setHasConsent(true);
      return true;
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setVisible(true);
    });
  }, []);

  const ConsentModal = useMemo(
    () => () => (
      <TenByTenConsentModalInner
        visible={visible}
        onAgree={handleAgree}
        onCancel={handleCancel}
      />
    ),
    [visible, handleAgree, handleCancel],
  );

  return { hasConsent, checkAndPromptConsent, ConsentModal };
}

// ---------------------------------------------------------------------------
// Styles — identical to useAdvancedAnalysisConsent for visual consistency
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: SCREEN_WIDTH - SP[4] * 2,
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SP[6],
    paddingVertical: SP[6],
    alignItems: "center",
    gap: SP[4],
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.sub,
    textAlign: "center",
  },
  bullets: {
    width: "100%",
    gap: SP[2],
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[3],
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.dim,
    flex: 1,
  },
  privacyLink: {
    paddingVertical: SP[1],
  },
  privacyLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.accent,
    textDecorationLine: "underline",
  },
  divider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: SP[3],
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    color: COLORS.btnGhostText,
  },
  agreeBtn: {
    flex: 1,
    height: 50,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  agreeBtnText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Poppins-SemiBold",
    color: "#0B0B0B",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
