// components/analysis/MetricDetailCard.tsx
// Pop-out detail card modal — springs up when a metric card is tapped.
// Displays: hero image, label + category, verdict pill, score bar, ideal range, AI commentary.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/ui/T";
import { ms, sh, sw } from "@/lib/responsive";

// ---------------------------------------------------------------------------
// Public type — callers pass a FlatMetric-compatible object
// ---------------------------------------------------------------------------

export type DetailMetric = {
  id:         string;
  label:      string;
  category:   string;
  score:      number;
  verdict:    string;
  commentary: string;
  idealRange: string;
  status:     "fine" | "neutral" | "alarming";
  section:    "working" | "okay" | "needs_work";
  icon:       number | null | undefined;
  emoji:      string;
};

type Props = {
  metric:    DetailMetric | null;
  onDismiss: () => void;
};

// ---------------------------------------------------------------------------
// Design tokens — local to this component
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  fine: {
    bar:       "#B4F34D",
    barGlow:   "rgba(180,243,77,0.40)",
    scrimHex:  "#B4F34D",
    pillBg:    "#B4F34D",
    pillBrd:   "#8ECA45",
    pillText:  "#2D3B1F",
    idealDot:  "#B4F34D",
    cursor:    "#B4F34D",
  },
  neutral: {
    bar:       "#D0D0D0",
    barGlow:   "rgba(208,208,208,0.28)",
    scrimHex:  "#C8C8C8",
    pillBg:    "#E8E8E8",
    pillBrd:   "#C8C8C8",
    pillText:  "#1A1A1A",
    idealDot:  "#A0A0A0",
    cursor:    "#D0D0D0",
  },
  alarming: {
    bar:       "#FF6B6B",
    barGlow:   "rgba(255,107,107,0.40)",
    scrimHex:  "#FF6B6B",
    pillBg:    "#FF6B6B",
    pillBrd:   "#D94A4A",
    pillText:  "#4A0D0D",
    idealDot:  "#FF6B6B",
    cursor:    "#FF6B6B",
  },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CHEEKS: { bg: "#1C1500", text: "#F59E0B", border: "#3A2E00" },
  JAW:    { bg: "#001C14", text: "#10B981", border: "#003024" },
  EYES:   { bg: "#00121C", text: "#38BDF8", border: "#001E30" },
  SKIN:   { bg: "#1C001C", text: "#E879F9", border: "#300030" },
};

const CARD_BG      = "#111111";
const CARD_DEPTH   = "#080808";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_MUTED   = "#606060";
const TEXT_BODY    = "#9A9A9A";
const DIVIDER      = "rgba(255,255,255,0.07)";
const IDEAL_BG     = "rgba(255,255,255,0.04)";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricDetailCard({ metric, onDismiss }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets    = useSafeAreaInsets();
  const cardWidth = Math.min(screenW * 0.90, 420);

  // ── Animation shared values ──────────────────────────────────────────────
  const backdropOpacity = useSharedValue(0);
  const cardScale       = useSharedValue(0.86);
  const cardTranslateY  = useSharedValue(56);
  const cardOpacity     = useSharedValue(0);
  const scoreBarPct     = useSharedValue(0);

  // ── Local state ──────────────────────────────────────────────────────────
  const [visible,    setVisible]    = useState(false);
  const [typedText,  setTypedText]  = useState("");
  const dismissing   = useRef(false);
  const typeTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTyped     = useRef(false);

  // ── Open ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!metric) return;

    // Reset
    dismissing.current  = false;
    hasTyped.current    = false;
    setTypedText("");
    scoreBarPct.value   = 0;
    cardScale.value     = 0.86;
    cardTranslateY.value = 56;
    cardOpacity.value   = 0;
    backdropOpacity.value = 0;

    setVisible(true);

    const t = setTimeout(() => {
      backdropOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
      cardOpacity.value     = withTiming(1, { duration: 180 });
      cardScale.value       = withSpring(1,  { damping: 16, stiffness: 170, mass: 0.85 });
      cardTranslateY.value  = withSpring(0,  { damping: 18, stiffness: 175, mass: 0.85 });

      // Score bar fills after card lands (~350ms)
      setTimeout(() => {
        scoreBarPct.value = withTiming(metric.score, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        });
      }, 350);
    }, 20);

    return () => clearTimeout(t);
  }, [metric]);

  // ── Typewriter ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!metric?.commentary || !visible) return;
    if (typeTimer.current) clearInterval(typeTimer.current);

    if (hasTyped.current) { setTypedText(metric.commentary); return; }

    // Start after card + bar settle
    const delay = setTimeout(() => {
      let i = 0;
      const mpc = Math.min(15, Math.max(5, Math.round(3000 / metric.commentary.length)));
      typeTimer.current = setInterval(() => {
        i += 1;
        setTypedText(metric.commentary.slice(0, i));
        if (i >= metric.commentary.length) {
          clearInterval(typeTimer.current!);
          typeTimer.current = null;
          hasTyped.current  = true;
        }
      }, mpc);
    }, 600);

    return () => {
      clearTimeout(delay);
      if (typeTimer.current) clearInterval(typeTimer.current);
    };
  }, [metric, visible]);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const handleHide = useCallback(() => {
    setVisible(false);
    setTypedText("");
    if (typeTimer.current) { clearInterval(typeTimer.current); typeTimer.current = null; }
    onDismiss();
  }, [onDismiss]);

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;

    backdropOpacity.value = withTiming(0,    { duration: 210 });
    cardOpacity.value     = withTiming(0,    { duration: 210 });
    cardScale.value       = withSpring(0.88, { damping: 24, stiffness: 220 });
    cardTranslateY.value  = withSpring(48,   { damping: 24, stiffness: 220 }, (finished) => {
      if (finished) runOnJS(handleHide)();
    });
  }, [handleHide]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [
      { scale:      cardScale.value      },
      { translateY: cardTranslateY.value },
    ],
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${scoreBarPct.value}%` as any,
  }));

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!visible || !metric) return null;

  const sc      = STATUS_COLORS[metric.status];
  const catClr  = CATEGORY_COLORS[metric.category] ?? { bg: "#1A1A1A", text: TEXT_MUTED, border: "#2A2A2A" };
  const hasIdeal = metric.idealRange.length > 0;
  const hasCommentary = metric.commentary.length > 0;

  const maxCardH = screenH * 0.82;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {/* ── Backdrop ── */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
        accessibilityLabel="Close detail"
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, sx.backdrop, backdropStyle]}
          pointerEvents="none"
        />
      </Pressable>

      {/* ── Card centering shell ── */}
      <View style={sx.shell} pointerEvents="box-none">
        <Animated.View
          style={[sx.card, { width: cardWidth, maxHeight: maxCardH }, cardAnimStyle]}
          // absorb touches so they don't bubble to backdrop
          onStartShouldSetResponder={() => true}
        >

          {/* ══ HERO IMAGE ══════════════════════════════════════════════════ */}
          <View style={sx.heroWrap}>
            {metric.icon ? (
              <Image
                source={metric.icon}
                style={sx.heroImage}
                resizeMode="contain"
              />
            ) : (
              <View style={sx.heroPlaceholder}>
                <Text style={sx.heroEmoji}>{metric.emoji}</Text>
              </View>
            )}

            {/* Gradient scrim — status-colored at bottom, ties image to card bg */}
            <LinearGradient
              colors={[
                `${sc.scrimHex}00`,
                `${sc.scrimHex}14`,
                CARD_BG + "F0",
                CARD_BG,
              ]}
              locations={[0, 0.5, 0.85, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Top dark scrim — makes close button always legible */}
            <LinearGradient
              colors={["rgba(0,0,0,0.60)", "rgba(0,0,0,0.00)"]}
              locations={[0, 1]}
              style={sx.heroTopScrim}
              pointerEvents="none"
            />

            {/* Close button */}
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                sx.closeBtn,
                pressed && { opacity: 0.55, transform: [{ scale: 0.88 }] },
              ]}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={ms(15)} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
          </View>

          {/* ══ SCROLLABLE CONTENT ══════════════════════════════════════════ */}
          <ScrollView
            style={sx.scrollArea}
            contentContainerStyle={[
              sx.content,
              { paddingBottom: Math.max(insets.bottom + sh(16), sh(24)) },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Title row: label + category chip ── */}
            <View style={sx.titleRow}>
              <Text style={sx.metricLabel} numberOfLines={2}>{metric.label}</Text>
              <View style={[sx.catChip, { backgroundColor: catClr.bg, borderColor: catClr.border }]}>
                <Text style={[sx.catChipText, { color: catClr.text }]}>{metric.category}</Text>
              </View>
            </View>

            {/* ── Verdict pill + caption ── */}
            <View style={sx.verdictRow}>
              <View style={[sx.verdictDepth, { backgroundColor: sc.pillBrd }]}>
                <View style={[sx.verdictFace, { backgroundColor: sc.pillBg }]}>
                  <Text style={[sx.verdictText, { color: sc.pillText }]} numberOfLines={1}>
                    {metric.verdict}
                  </Text>
                </View>
              </View>
              <Text style={sx.verdictCaption}>Your value</Text>
            </View>

            {/* ── Score bar ── */}
            <View style={sx.scoreSection}>
              <View style={sx.scoreLabelRow}>
                <Text style={sx.scoreLabel}>SCORE</Text>
                <Text style={[sx.scoreValue, { color: sc.bar }]}>{metric.score}<Text style={sx.scoreMax}>/100</Text></Text>
              </View>
              <View style={sx.barTrack}>
                <Animated.View style={[sx.barFill, barFillStyle, { backgroundColor: sc.bar }]}>
                  {/* Inner glow edge */}
                  <View
                    style={[sx.barGlowEdge, { shadowColor: sc.bar, backgroundColor: sc.bar }]}
                  />
                </Animated.View>
              </View>
            </View>

            {/* ── AI Commentary ── */}
            <View style={sx.commentarySection}>
              <Text style={sx.commentaryLabel}>YOUR ANALYSIS</Text>
              {hasCommentary ? (
                <Text style={sx.commentaryText}>
                  {typedText}
                  {typedText.length < metric.commentary.length && (
                    <Text style={[sx.cursor, { color: sc.cursor }]}>|</Text>
                  )}
                </Text>
              ) : (
                <View style={sx.shimmerGroup}>
                  {[1, 0.75, 0.55].map((w, i) => (
                    <View
                      key={i}
                      style={[sx.shimmerLine, { width: `${w * 100}%` as any }]}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* ── Divider ── */}
            <View style={sx.divider} />

            {/* ── Ideal range ── */}
            {hasIdeal && (
              <View style={sx.idealSection}>
                <View style={sx.idealHeaderRow}>
                  <View style={[sx.idealDot, { backgroundColor: sc.idealDot }]} />
                  <Text style={[sx.idealLabel, { color: sc.idealDot }]}>IDEAL</Text>
                </View>
                <View style={sx.idealBody}>
                  <Text style={sx.idealText}>{metric.idealRange}</Text>
                </View>
              </View>
            )}

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const HERO_H      = sh(195);
const CARD_RADIUS = ms(26);
const CLOSE_SIZE  = ms(30);

const sx = StyleSheet.create({
  // ── Backdrop ──
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.84)",
  },

  // ── Centering shell ──
  shell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Card ──
  card: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    borderBottomWidth: 6,
    borderBottomColor: CARD_DEPTH,
    overflow: "hidden",
    // Elevation / shadow
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.70,
    shadowRadius: 36,
    elevation: 30,
  },

  // ── Hero ──
  heroWrap: {
    width: "100%",
    height: HERO_H,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#181818",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: {
    fontSize: ms(52),
    lineHeight: ms(60),
  },
  heroTopScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: sh(70),
  },

  // ── Close button ──
  closeBtn: {
    position: "absolute",
    top: sh(14),
    right: sw(14),
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  // ── Scroll / content ──
  scrollArea: { flexGrow: 0 },
  content: {
    paddingHorizontal: sw(18),
    paddingTop: sh(14),
    gap: sh(14),
  },

  // ── Title row ──
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sw(10),
  },
  metricLabel: {
    flex: 1,
    fontSize: ms(19, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
    lineHeight: ms(24),
  },
  catChip: {
    borderRadius: ms(8),
    borderWidth: 1,
    paddingHorizontal: sw(9),
    paddingVertical: sh(4),
    flexShrink: 0,
  },
  catChipText: {
    fontSize: ms(10, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: 1.1,
  },

  // ── Verdict ──
  verdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(10),
  },
  verdictDepth: {
    borderRadius: ms(999),
    paddingBottom: 4,
  },
  verdictFace: {
    borderRadius: ms(999),
    paddingHorizontal: sw(14),
    paddingVertical: sh(6),
    minWidth: sw(64),
    alignItems: "center",
    justifyContent: "center",
  },
  verdictText: {
    fontSize: ms(13, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: 0.1,
  },
  verdictCaption: {
    fontSize: ms(11.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: TEXT_MUTED,
  },

  // ── Score bar ──
  scoreSection: {
    gap: sh(8),
  },
  scoreLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreLabel: {
    fontSize: ms(9.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },
  scoreValue: {
    fontSize: ms(15, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: -0.3,
  },
  scoreMax: {
    fontSize: ms(11, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: TEXT_MUTED,
  },
  barTrack: {
    height: sh(9),
    backgroundColor: "#222222",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  barGlowEdge: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: sw(12),
    borderRadius: ms(999),
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Ideal range ──
  idealSection: {
    backgroundColor: IDEAL_BG,
    borderRadius: ms(14),
    paddingHorizontal: sw(14),
    paddingVertical: sh(12),
    gap: sh(7),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  idealHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sw(6),
  },
  idealDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    opacity: 0.85,
  },
  idealLabel: {
    fontSize: ms(9.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    letterSpacing: 1.4,
    opacity: 0.85,
  },
  idealBody: {},
  idealText: {
    fontSize: ms(12.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: "rgba(255,255,255,0.58)",
    lineHeight: ms(19),
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginHorizontal: sw(2),
  },

  // ── Commentary ──
  commentarySection: {
    gap: sh(8),
  },
  commentaryLabel: {
    fontSize: ms(9.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },
  commentaryText: {
    fontSize: ms(13.5, 0.3),
    fontFamily: Platform.select({ ios: "Poppins-Regular", android: "Poppins-Regular", default: "Poppins-Regular" }),
    color: TEXT_BODY,
    lineHeight: ms(21),
  },
  cursor: {
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
  },

  // ── Shimmer (commentary loading) ──
  shimmerGroup: { gap: sh(7) },
  shimmerLine: {
    height: sh(11),
    backgroundColor: "#242424",
    borderRadius: ms(6),
  },
});
