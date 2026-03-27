// components/ui/ProGateModal.tsx
// Reusable upgrade prompt — slides up from the bottom as a white card.
// Used whenever a free user taps a locked Pro feature.

import React, { useCallback } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Lock, X, Zap, TrendingUp, ScanLine, Sparkles, Eye } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

/* ─── constants ─────────────────────────────────────────── */
const LIME        = "#B4F34D";
const LIME_DARK   = "#6B9A1E";
const LIME_LIGHT  = "#CCFF6B";
const BLACK       = "#0B0B0B";
const GRAY        = "#6B7280";
const GRAY_LIGHT  = "#F3F4F6";
const DEPTH       = 5;

const FONT_SEMI   = Platform.select({ ios: "Poppins-SemiBold",  android: "Poppins-SemiBold",  default: "Poppins-SemiBold"  }) as string;
const FONT_REG    = Platform.select({ ios: "Poppins-Regular",   android: "Poppins-Regular",   default: "Poppins-Regular"   }) as string;

const { width: SW } = Dimensions.get("window");

/* ─── feature list ──────────────────────────────────────── */
const FEATURES = [
  {
    Icon: Zap,
    label: "AI Aesthetics Score",
    sub:   "Every metric ranked, explained & compared",
  },
  {
    Icon: TrendingUp,
    label: "Progress Tracking",
    sub:   "Watch your glow-up build over time",
  },
  {
    Icon: ScanLine,
    label: "Unlimited Scans",
    sub:   "Re-scan any time to measure improvement",
  },
  {
    Icon: Sparkles,
    label: "10/10 AI Enhancement",
    sub:   "See your best-self rendered by AI",
  },
  {
    Icon: Eye,
    label: "Symmetry & Structure Insights",
    sub:   "Deep facial geometry & ratio breakdown",
  },
] as const;

/* ─── props ─────────────────────────────────────────────── */
interface ProGateModalProps {
  visible:  boolean;
  onClose:  () => void;
}

/* ─── component ─────────────────────────────────────────── */
export default function ProGateModal({ visible, onClose }: ProGateModalProps) {

  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    // Small delay so the modal closes before navigation begins
    setTimeout(() => router.push("/(onboarding)/paywall"), 120);
  }, [onClose]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(220)}
        exiting={FadeOut.duration(180)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Card */}
      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(180)}
        exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.quad))}
        style={styles.card}
        pointerEvents="box-none"
      >
        {/* ── Close button ─────────────────────────────── */}
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <X size={18} color={GRAY} strokeWidth={2.5} />
        </Pressable>

        {/* ── Header ──────────────────────────────────── */}
        <View style={styles.header}>
          {/* Lock badge */}
          <View style={styles.lockRing}>
            <View style={styles.lockInner}>
              <Lock size={22} color={BLACK} strokeWidth={2.5} />
            </View>
          </View>

          <Text style={styles.title}>Sigma Max Pro</Text>
          <Text style={styles.subtitle}>
            Unlock your full potential with AI-powered tools
          </Text>
        </View>

        {/* ── Feature list with connected timeline ────── */}
        <View style={styles.featureList}>
          {FEATURES.map(({ Icon, label, sub }, idx) => {
            const isLast = idx === FEATURES.length - 1;
            return (
              <View key={label} style={styles.featureRow}>
                {/* Timeline column */}
                <View style={styles.timelineCol}>
                  <View style={styles.dot}>
                    <Icon size={11} color={BLACK} strokeWidth={2.5} />
                  </View>
                  {!isLast && <View style={styles.connector} />}
                </View>

                {/* Text */}
                <View style={[styles.featureText, !isLast && styles.featureTextSpacing]}>
                  <Text style={styles.featureLabel}>{label}</Text>
                  <Text style={styles.featureSub}>{sub}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── CTA ─────────────────────────────────────── */}
        <View style={styles.ctaSection}>
          {/* 3-D depth button */}
          <View style={styles.btnDepth}>
            <Pressable
              onPress={handleUpgrade}
              style={({ pressed }) => [
                styles.btnFace,
                { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
              ]}
            >
              <LinearGradient
                colors={[LIME_LIGHT, LIME]}
                locations={[0, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.btnLabel}>Upgrade to Pro</Text>
            </Pressable>
          </View>

          {/* Dismiss */}
          <Pressable onPress={handleClose} style={styles.dismissBtn} hitSlop={8}>
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ─── styles ────────────────────────────────────────────── */
const CARD_RADIUS = 28;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },

  card: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius:  CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    paddingHorizontal:    24,
    paddingTop:           20,
    paddingBottom:        Platform.select({ ios: 36, android: 28 }),
    // subtle lift shadow
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius:  20,
    elevation:     24,
  },

  closeBtn: {
    position:        "absolute",
    top:             18,
    right:           20,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: GRAY_LIGHT,
    alignItems:      "center",
    justifyContent:  "center",
    zIndex:          10,
  },

  /* header */
  header: {
    alignItems:   "center",
    marginBottom: 24,
    marginTop:    4,
  },
  lockRing: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: "rgba(180,243,77,0.15)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    14,
  },
  lockInner: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: LIME,
    alignItems:      "center",
    justifyContent:  "center",
  },
  title: {
    fontFamily:    FONT_SEMI,
    fontSize:      22,
    lineHeight:    28,
    color:         BLACK,
    letterSpacing: -0.4,
    textAlign:     "center",
  },
  subtitle: {
    fontFamily:    FONT_REG,
    fontSize:      13,
    lineHeight:    18,
    color:         GRAY,
    textAlign:     "center",
    marginTop:     4,
    maxWidth:      SW * 0.72,
  },

  /* feature timeline */
  featureList: {
    marginBottom: 24,
    paddingLeft:  4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
  },

  timelineCol: {
    width:      28,
    alignItems: "center",
  },
  dot: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: LIME,
    alignItems:      "center",
    justifyContent:  "center",
  },
  connector: {
    width:           2,
    flex:            1,
    minHeight:       18,
    backgroundColor: "rgba(180,243,77,0.35)",
    marginVertical:  2,
  },

  featureText: {
    flex:      1,
    marginLeft: 12,
    paddingTop: 3,
  },
  featureTextSpacing: {
    marginBottom: 14,
  },
  featureLabel: {
    fontFamily:    FONT_SEMI,
    fontSize:      14,
    color:         BLACK,
    lineHeight:    18,
    letterSpacing: -0.1,
  },
  featureSub: {
    fontFamily: FONT_REG,
    fontSize:   12,
    color:      GRAY,
    lineHeight: 17,
    marginTop:  1,
  },

  /* CTA */
  ctaSection: {
    alignItems: "center",
    gap:        4,
  },
  btnDepth: {
    width:           "100%",
    borderRadius:    26,
    backgroundColor: LIME_DARK,
    paddingBottom:   DEPTH,
    shadowColor:     LIME,
    shadowOpacity:   0.45,
    shadowRadius:    18,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       10,
  },
  btnFace: {
    borderRadius:   26,
    height:         54,
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
  },
  btnLabel: {
    fontFamily:    FONT_SEMI,
    fontSize:      16,
    color:         BLACK,
    letterSpacing: -0.2,
  },

  dismissBtn: {
    marginTop:    8,
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: FONT_REG,
    fontSize:   13,
    color:      GRAY,
  },
});
