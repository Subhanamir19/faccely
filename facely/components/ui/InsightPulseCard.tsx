// components/ui/InsightPulseCard.tsx
// In-app performance notification banner — "Insight Pulse"

import React, { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  BarChart2,
  Clock,
  X,
  ChevronDown,
} from "lucide-react-native";
import { COLORS, RADII, SP } from "@/lib/tokens";
import T from "@/components/ui/T";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PulseType = "momentum" | "alert" | "milestone" | "insight" | "nudge";

export interface InsightPulseProps {
  type: PulseType;
  message: string;
  detail?: string;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss?: () => void;
  /** Auto-dismiss after N ms. Pass 0 to disable. Default: 6000 */
  autoDismissMs?: number;
}

// ---------------------------------------------------------------------------
// Per-type config
// ---------------------------------------------------------------------------

type TypeConfig = {
  label: string;
  color: string;
  cardTint: string;   // very subtle bg overlay
  border: string;     // card border
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

const CONFIG: Record<PulseType, TypeConfig> = {
  momentum: {
    label: "Improving",
    color: "#22C55E",
    cardTint: "rgba(34,197,94,0.06)",
    border: "rgba(34,197,94,0.22)",
    Icon: TrendingUp,
  },
  alert: {
    label: "Heads Up",
    color: "#F59E0B",
    cardTint: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.22)",
    Icon: TrendingDown,
  },
  milestone: {
    label: "Milestone",
    color: COLORS.accent,
    cardTint: "rgba(180,243,77,0.06)",
    border: "rgba(180,243,77,0.22)",
    Icon: Trophy,
  },
  insight: {
    label: "Insight",
    color: "#60A5FA",
    cardTint: "rgba(96,165,250,0.06)",
    border: "rgba(96,165,250,0.22)",
    Icon: BarChart2,
  },
  nudge: {
    label: "Reminder",
    color: "rgba(160,160,160,0.85)",
    cardTint: "rgba(160,160,160,0.04)",
    border: "rgba(160,160,160,0.18)",
    Icon: Clock,
  },
};

const DETAIL_H = 88;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InsightPulseCard({
  type,
  message,
  detail,
  ctaLabel,
  onCta,
  onDismiss,
  autoDismissMs = 6000,
}: InsightPulseProps) {
  const cfg = CONFIG[type];
  const { Icon } = cfg;

  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Entrance
  const translateY = useSharedValue(-72);
  const opacity    = useSharedValue(0);

  // Expand
  const detailH   = useSharedValue(0);
  const detailOp  = useSharedValue(0);
  const chevronRot = useSharedValue(0);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.9 });
    opacity.value    = withTiming(1, { duration: 180 });

    if (autoDismissMs > 0) {
      const t = setTimeout(dismiss, autoDismissMs);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Expand / collapse ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!detail) return;
    const open = expanded;
    detailH.value    = withTiming(open ? DETAIL_H : 0,  { duration: 260, easing: Easing.inOut(Easing.ease) });
    detailOp.value   = withTiming(open ? 1 : 0,         { duration: open ? 240 : 140 });
    chevronRot.value = withSpring(open ? 1 : 0,         { damping: 18, stiffness: 220 });
  }, [expanded]);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const dismiss = () => {
    translateY.value = withTiming(-72, { duration: 180, easing: Easing.in(Easing.ease) });
    opacity.value    = withTiming(0,   { duration: 160 });
    setTimeout(() => { setDismissed(true); onDismiss?.(); }, 190);
  };

  // ── Animated styles ───────────────────────────────────────────────────────
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const detailStyle = useAnimatedStyle(() => ({
    height:  detailH.value,
    opacity: detailOp.value,
  }));

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value * 180}deg` }],
  }));

  if (dismissed) return null;

  return (
    <Animated.View style={[styles.wrapper, wrapStyle]}>
      {/* ── Card surface ───────────────────────────────────────────────── */}
      <View style={[styles.card, { borderColor: cfg.border }]}>

        {/* White glass blur layer */}
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />

        {/* White base + subtle type tint */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255,255,255,0.92)" }]}
        />

        {/* ── Content ─────────────────────────────────────────────────── */}
        <Pressable
          style={styles.body}
          onPress={() => detail && setExpanded((e) => !e)}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          {/* Row 1: type tag + appname + close */}
          <View style={styles.topRow}>
            {/* Type tag: icon + label */}
            <View style={styles.typeTag}>
              <Icon size={13} color={cfg.color} strokeWidth={2.5} />
              <T variant="small" style={[styles.typeLabel, { color: cfg.color }]}>
                {cfg.label}
              </T>
            </View>

            <View style={styles.topRight}>
              <T variant="small" style={styles.appName}>Sigmamax</T>

              {/* Close button */}
              <Pressable
                onPress={dismiss}
                hitSlop={10}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <X size={12} color="rgba(0,0,0,0.45)" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Row 2: message + expand chevron */}
          <View style={styles.messageRow}>
            <T
              variant="captionMedium"
              style={styles.message}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {message}
            </T>

            {/* Expand chevron — only if detail exists */}
            {detail && (
              <Animated.View style={[styles.chevron, chevStyle]}>
                <ChevronDown size={15} color={cfg.color} strokeWidth={2.5} />
              </Animated.View>
            )}
          </View>
        </Pressable>

        {/* ── Expandable detail ─────────────────────────────────────────── */}
        {detail && (
          <Animated.View style={[styles.detailWrap, detailStyle]}>
            {/* Hairline divider, tinted */}
            <View style={[styles.divider, { backgroundColor: cfg.border }]} />

            <View style={styles.detailBody}>
              <T variant="small" style={styles.detailText}>
                {detail}
              </T>

              {ctaLabel && (
                <Pressable
                  onPress={onCta}
                  hitSlop={6}
                  style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.7 }]}
                >
                  <T variant="small" style={[styles.ctaText, { color: cfg.color }]}>
                    {ctaLabel}  →
                  </T>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: SP[4],
  },

  card: {
    borderRadius: RADII.xl,       // 24 — noticeably rounder
    overflow: "hidden",
    borderWidth: 1,
    // Depth shadow
    shadowColor: "#000",
    shadowOpacity: 0.50,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },

  body: {
    paddingHorizontal: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[3],
    gap: SP[2],
  },

  // ── Top row ──────────────────────────────────────────────────────────────
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typeLabel: {
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 0.2,
    lineHeight: 16,
  },

  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  appName: {
    color: "rgba(0,0,0,0.40)",
    fontFamily: "Poppins-Regular",
  },

  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.92 }],
  },

  // ── Message row ──────────────────────────────────────────────────────────
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SP[3],
  },
  message: {
    flex: 1,
    color: "#0F0F0F",
    fontFamily: "Poppins-Medium",
    fontSize: 14,
    lineHeight: 21,
  },
  chevron: {
    marginBottom: 1,
    opacity: 0.8,
  },

  // ── Detail section ────────────────────────────────────────────────────────
  detailWrap: {
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SP[4],
    opacity: 0.6,
  },
  detailBody: {
    paddingHorizontal: SP[4],
    paddingTop: SP[2],
    paddingBottom: SP[3],
    gap: SP[2],
  },
  detailText: {
    color: "rgba(0,0,0,0.55)",
    fontFamily: "Poppins-Regular",
    lineHeight: 19,
  },
  ctaBtn: {
    alignSelf: "flex-start",
  },
  ctaText: {
    fontFamily: "Poppins-SemiBold",
  },
});
