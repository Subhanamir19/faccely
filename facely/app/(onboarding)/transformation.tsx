// app/(onboarding)/transformation.tsx
// Pre-paywall transformation pitch: before/after slider, social proof, and a
// per-metric improvement breakdown. Light system; sage accents replace lime;
// the dark photos do the visual heavy-lifting against a calm white shell.

import React, { useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Pressable,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import T from "@/components/ui/T";
import { COLORS, RADII, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";

const FONT_BOLD = "ProximaNova-Bold";
const LIME = "#B4F34D";        // bright fill — progress bar
const SAGE = "#3F7A2A";        // dark readable — icon strokes & text on white/lime-soft
const SAGE_SOFT = "#ECFCCB";   // pale lime — metric icon chip bg, AFTER badge label tone

const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: ms(20),
  shadowOffset: { width: 0, height: ms(8) },
  elevation: 4,
} as const;

const BEFORE_IMG = require("@/assets/before.jpeg");
const AFTER_IMG  = require("@/assets/after.jpeg");

const METRICS: ReadonlyArray<{ icon: string; label: string; a: number; b: number }> = [
  { icon: "face-man-outline", label: "Jawline",     a: 44, b: 80 },
  { icon: "swap-horizontal",  label: "Symmetry",    a: 56, b: 88 },
  { icon: "ruler",            label: "Proportions", a: 49, b: 84 },
  { icon: "eye-outline",      label: "Eyes",        a: 51, b: 82 },
  { icon: "rhombus-outline",  label: "Cheekbones",  a: 47, b: 83 },
  { icon: "heart-outline",    label: "Lips",        a: 53, b: 85 },
];

/* ─── score badge — sits over the photo ──────────────────────────── */
function ScoreBadge({ side, score }: { side: "before" | "after"; score: number }) {
  const isAfter = side === "after";
  return (
    <View style={[styles.badge, isAfter ? styles.badgeRight : styles.badgeLeft]}>
      <LinearGradient
        colors={
          isAfter
            ? ["rgba(180,243,77,0.32)", "rgba(0,0,0,0.55)"]
            : ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.50)"]
        }
        style={StyleSheet.absoluteFill}
        borderRadius={10}
      />
      <T style={[styles.badgeLabel, isAfter && { color: SAGE_SOFT }]}>
        {side.toUpperCase()}
      </T>
      <View style={styles.badgeScoreRow}>
        <T style={[styles.badgeNum, isAfter && { color: "#FFFFFF" }]}>{score}</T>
        <T style={[styles.badgeDenom, isAfter && { color: "rgba(255,255,255,0.7)" }]}>/100</T>
      </View>
    </View>
  );
}

/* ─── per-metric card ─────────────────────────────────────────────── */
function MetricCard({ icon, label, a, b, width }: {
  icon: string; label: string; a: number; b: number; width: number;
}) {
  const iconName: any = icon;
  return (
    <View style={[styles.metricCard, { width }]}>
      <View style={styles.metricIconWrap}>
        <MaterialCommunityIcons name={iconName} size={ms(20)} color={SAGE} />
      </View>
      <T style={styles.metricLabel}>{label}</T>
      <View style={styles.metricScoreRow}>
        <T style={styles.metricA}>{a}</T>
        <T style={styles.metricArrow}>{"  →  "}</T>
        <T style={styles.metricB}>{b}</T>
      </View>
    </View>
  );
}

/* ─── screen ─────────────────────────────────────────────────────── */
export default function TransformationScreen() {
  const { width: W } = useWindowDimensions();
  const H_PAD   = SP[5];
  const CARD_W  = W - H_PAD * 2;
  const IMG_H   = Math.round(CARD_W * 1.0);
  const HANDLE_R = ms(20);

  const initX = CARD_W / 2;
  const sliderXRef = useRef(initX);
  const gestureStartX = useRef(initX);
  const [sliderX, setSliderX] = useState(initX);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        gestureStartX.current = sliderXRef.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const next = Math.max(0, Math.min(CARD_W, gestureStartX.current + dx));
        sliderXRef.current = next;
        setSliderX(next);
      },
    }),
  ).current;

  const metricCardWidth = (CARD_W - sw(12)) / 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.safeArea, { paddingHorizontal: H_PAD }]}>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "96%" }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <T style={styles.title}>Your face can change too</T>
          <T style={styles.subtitle}>
            See what's possible with consistent effort and a personalised routine.
          </T>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Before / After Slider */}
          <View
            style={[styles.sliderContainer, { width: CARD_W, height: IMG_H }]}
            {...pan.panHandlers}
          >
            <Image source={AFTER_IMG} style={{ width: CARD_W, height: IMG_H }} resizeMode="cover" />
            <View style={[styles.beforeClip, { width: sliderX, height: IMG_H }]}>
              <Image
                source={BEFORE_IMG}
                style={{ width: CARD_W, height: IMG_H }}
                resizeMode="cover"
              />
            </View>

            <ScoreBadge side="before" score={47} />
            <ScoreBadge side="after"  score={83} />

            <View style={[styles.divider, { left: sliderX - 1, height: IMG_H }]} />
            <View
              style={[
                styles.handle,
                {
                  width: HANDLE_R * 2,
                  height: HANDLE_R * 2,
                  borderRadius: HANDLE_R,
                  left: sliderX - HANDLE_R,
                  top: IMG_H / 2 - HANDLE_R,
                },
              ]}
            >
              <MaterialCommunityIcons name="chevron-left"  size={ms(13)} color={COLORS.lightText} />
              <MaterialCommunityIcons name="chevron-right" size={ms(13)} color={COLORS.lightText} />
            </View>
          </View>

          {/* Testimonial */}
          <View style={[styles.testimonialCard, { width: CARD_W }]}>
            <T style={styles.quote}>
              "Didn't expect to see a difference this fast. Week after week my score kept climbing — it pushed me to stay consistent. The routine they built me actually delivered."
            </T>
            <View style={styles.dividerLine} />
            <View style={styles.testimonialFooter}>
              <T style={styles.testimonialName}>Ibrahim, 23</T>
              <View style={styles.stars}>
                {[...Array(5)].map((_, i) => (
                  <MaterialCommunityIcons key={i} name="star" size={ms(13)} color="#F59E0B" />
                ))}
              </View>
            </View>
          </View>

          {/* Metrics */}
          <View style={styles.metricsSection}>
            <T style={styles.metricsTitle}>How Ibrahim's face improved</T>
            <T style={styles.metricsSub}>Score changes across key areas</T>
            <View style={styles.metricsGrid}>
              {METRICS.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  a={m.a}
                  b={m.b}
                  width={metricCardWidth}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push("/(onboarding)/paywall")}
            style={({ pressed }) => [
              styles.cta,
              pressed && { backgroundColor: COLORS.ctaBlackPressed },
            ]}
          >
            <T style={styles.ctaText}>BUILD MY PLAN</T>
          </Pressable>
        </View>

      </SafeAreaView>
    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightBg },
  safeArea:  { flex: 1 },

  // Progress — slim, sage fill
  progressTrack: {
    height: sh(5),
    width: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.lightHairline,
    overflow: "hidden",
    marginTop: SP[2],
    marginBottom: SP[4],
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 999,
  },

  // Header
  header: { marginBottom: SP[3] },
  title: {
    fontFamily: FONT_BOLD,
    fontSize: ms(28),
    lineHeight: ms(34),
    color: COLORS.lightText,
    letterSpacing: -0.5,
    marginBottom: SP[2],
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(20),
    color: COLORS.lightSub,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SP[2] },

  // Slider — dark photos sit inside a soft-shadow rounded container
  sliderContainer: {
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: "#111",
    alignSelf: "center",
    ...SOFT_SHADOW,
  },
  beforeClip: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },

  // Score badges
  badge: {
    position: "absolute",
    top: SP[3],
    paddingHorizontal: 9,
    paddingVertical: SP[1] + 2,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  badgeLeft:  { left: SP[2] + 2 },
  badgeRight: { right: SP[2] + 2, borderColor: "rgba(180,243,77,0.40)" },
  badgeLabel: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT_BOLD,
    fontSize: ms(9),
    lineHeight: ms(13),
    letterSpacing: 0.9,
  },
  badgeScoreRow: { flexDirection: "row", alignItems: "flex-end" },
  badgeNum: {
    fontFamily: FONT_BOLD,
    fontSize: ms(20),
    lineHeight: ms(24),
    color: "#FFFFFF",
  },
  badgeDenom: {
    fontFamily: FONT_BOLD,
    fontSize: ms(10),
    lineHeight: ms(16),
    color: "rgba(255,255,255,0.55)",
    marginLeft: 1,
    marginBottom: 1,
  },

  // Slider divider + handle
  divider: {
    position: "absolute",
    top: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  handle: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  // Testimonial — white card, soft shadow
  testimonialCard: {
    marginTop: SP[4],
    alignSelf: "center",
    borderRadius: RADII.lg,
    backgroundColor: COLORS.lightCard,
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    overflow: "hidden",
    ...SOFT_SHADOW,
  },
  quote: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(14),
    lineHeight: ms(21),
    color: COLORS.lightText,
    marginBottom: SP[3],
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightHairline,
    marginBottom: SP[3],
  },
  testimonialFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  testimonialName: {
    fontFamily: FONT_BOLD,
    fontSize: ms(13),
    color: COLORS.lightText,
    letterSpacing: -0.1,
  },
  stars: { flexDirection: "row", gap: 2 },

  // Metrics section
  metricsSection: { marginTop: SP[5] },
  metricsTitle: {
    fontFamily: FONT_BOLD,
    fontSize: ms(18),
    color: COLORS.lightText,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metricsSub: {
    fontFamily: "Poppins-Regular",
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginBottom: SP[3],
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(12),
  },
  metricCard: {
    backgroundColor: COLORS.lightCard,
    borderRadius: RADII.lg,
    paddingHorizontal: SP[3] + 2,
    paddingVertical: SP[3] + 2,
    ...SOFT_SHADOW,
  },
  metricIconWrap: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    backgroundColor: SAGE_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[2] + 2,
  },
  metricLabel: {
    fontFamily: FONT_BOLD,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0.4,
    marginBottom: SP[1],
  },
  metricScoreRow: { flexDirection: "row", alignItems: "center" },
  metricA: {
    fontFamily: FONT_BOLD,
    fontSize: ms(15),
    lineHeight: ms(20),
    color: COLORS.lightMuted,
  },
  metricArrow: {
    fontFamily: FONT_BOLD,
    color: COLORS.lightSub,
    fontSize: ms(13),
  },
  metricB: {
    fontFamily: FONT_BOLD,
    fontSize: ms(18),
    lineHeight: ms(22),
    color: SAGE,
    letterSpacing: -0.2,
  },

  // Footer
  footer: { paddingTop: SP[3], paddingBottom: SP[2] },
  cta: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sh(14),
  },
  ctaText: {
    fontFamily: FONT_BOLD,
    fontSize: ms(14),
    color: "#FFFFFF",
    letterSpacing: 1.0,
  },
});
