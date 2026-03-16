// app/(onboarding)/transformation.tsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Platform,
  PanResponder,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LimeButton from "@/components/ui/LimeButton";
import { COLORS, RADII, SP } from "@/lib/tokens";

/* ─── layout constants ───────────────────────────────────────── */
const { width: W } = Dimensions.get("window");
const H_PAD    = 24;
const CARD_W   = W - H_PAD * 2;
const IMG_H    = Math.round(CARD_W * 1.0);  // square — matches reference
const HANDLE_R = 20;
const ACCENT   = COLORS.accent;
const BG       = "#0B0B0B";

const BEFORE_IMG = require("@/assets/before.jpeg");
const AFTER_IMG  = require("@/assets/after.jpeg");

const METRICS = [
  { icon: "face-man-outline", label: "Jawline",     a: 44, b: 80 },
  { icon: "swap-horizontal",  label: "Symmetry",    a: 56, b: 88 },
  { icon: "ruler",            label: "Proportions", a: 49, b: 84 },
  { icon: "eye-outline",      label: "Eyes",        a: 51, b: 82 },
  { icon: "rhombus-outline",  label: "Cheekbones",  a: 47, b: 83 },
  { icon: "heart-outline",    label: "Lips",        a: 53, b: 85 },
];

function MetricCard(props: { icon: string; label: string; a: number; b: number }) {
  const iconName: any = props.icon;
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconWrap}>
        <MaterialCommunityIcons name={iconName} size={20} color={COLORS.accent} />
      </View>
      <Text style={styles.metricLabel}>{props.label}</Text>
      <View style={styles.metricScoreRow}>
        <Text style={styles.metricA}>{props.a}</Text>
        <Text style={styles.metricArrow}>  {">"}  </Text>
        <Text style={styles.metricB}>{props.b}</Text>
      </View>
    </View>
  );
}

/* ─── score badge ────────────────────────────────────────────── */
function ScoreBadge({ side, score }: { side: "before" | "after"; score: number }) {
  const isAfter = side === "after";
  return (
    <View style={[styles.badge, isAfter ? styles.badgeRight : styles.badgeLeft]}>
      <LinearGradient
        colors={
          isAfter
            ? ["rgba(180,243,77,0.20)", "rgba(0,0,0,0.60)"]
            : ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.50)"]
        }
        style={StyleSheet.absoluteFill}
        borderRadius={10}
      />
      <Text style={[styles.badgeLabel, isAfter && { color: ACCENT }]}>
        {side.toUpperCase()}
      </Text>
      <View style={styles.badgeScoreRow}>
        <Text style={[styles.badgeNum, isAfter && { color: ACCENT }]}>{score}</Text>
        <Text style={[styles.badgeDenom, isAfter && { color: ACCENT }]}>/100</Text>
      </View>
    </View>
  );
}

/* ─── screen ─────────────────────────────────────────────────── */
export default function TransformationScreen() {
  const initX         = CARD_W / 2;
  const sliderXRef    = useRef(initX);
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
    })
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView style={styles.safeArea}>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "6%" }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Face Can Change Too</Text>
          <Text style={styles.subtitle}>
            See what's possible with consistent effort and a personalized routine.
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>


          {/* Before / After Slider */}
          <View style={styles.sliderContainer} {...pan.panHandlers}>
            <Image source={AFTER_IMG} style={styles.fullImg} resizeMode="cover" />
            <View style={[styles.beforeClip, { width: sliderX }]}>
              <Image
                source={BEFORE_IMG}
                style={[styles.fullImg, { width: CARD_W }]}
                resizeMode="cover"
              />
            </View>
            <ScoreBadge side="before" score={47} />
            <ScoreBadge side="after"  score={83} />
            <View style={[styles.divider, { left: sliderX - 1 }]} />
            <View style={[styles.handle, { left: sliderX - HANDLE_R, top: IMG_H / 2 - HANDLE_R }]}>
              <MaterialCommunityIcons name="chevron-left"  size={13} color={BG} />
              <MaterialCommunityIcons name="chevron-right" size={13} color={BG} />
            </View>
          </View>

          {/* Testimonial — glued right below the slider */}
          <View style={styles.testimonialCard}>
            <LinearGradient
              colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: RADII.lg }]}
            />
            <Text style={styles.quote}>
              "Didn't expect to see a difference this fast. Week after week my score kept climbing — it pushed me to stay consistent. The routine they built me actually delivered."
            </Text>
            <View style={styles.dividerLine} />
            <View style={styles.testimonialFooter}>
              <Text style={styles.testimonialName}>Ibrahim, 23</Text>
              <View style={styles.stars}>
                {[...Array(5)].map((_, i) => (
                  <MaterialCommunityIcons key={i} name="star" size={13} color="#F59E0B" />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.metricsSection}>
            <Text style={styles.metricsTitle}>How Ibrahim's Face Improved</Text>
            <Text style={styles.metricsSub}>Score changes across key areas</Text>
            <View style={styles.metricsGrid}>
              {METRICS.map(function(m) { return <MetricCard key={m.label} icon={m.icon} label={m.label} a={m.a} b={m.b} />; })}
            </View>
          </View>

        </ScrollView>

        {/* Button — pinned to very bottom */}
        <View style={styles.footer}>
          <LimeButton
            label="Begin My Ascension"
            onPress={() => router.replace("/(onboarding)/use-case")}
          />
        </View>

      </SafeAreaView>
    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safeArea:  { flex: 1, paddingHorizontal: H_PAD },

  // progress — matches reference: very thin, minimal margin
  progressTrack: {
    height: 4,
    width: "100%",
    borderRadius: 99,
    backgroundColor: COLORS.track,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 99,
  },

  // header
  header: { marginBottom: 14 },
  title: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.sub,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 16,
    lineHeight: 23,
  },

  sliderContainer: {
    width: CARD_W,
    height: IMG_H,
    borderRadius: RADII.xl,
    overflow: "hidden",
    backgroundColor: "#111",
    alignSelf: "center",
  },
  fullImg: {
    width: CARD_W,
    height: IMG_H,
  },
  beforeClip: {
    position: "absolute",
    left: 0,
    top: 0,
    height: IMG_H,
    overflow: "hidden",
  },

  // badges
  badge: {
    position: "absolute",
    top: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  badgeLeft:  { left: 10 },
  badgeRight: { right: 10, borderColor: "rgba(180,243,77,0.22)" },
  badgeLabel: {
    color: "rgba(255,255,255,0.70)",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.9,
  },
  badgeScoreRow: { flexDirection: "row", alignItems: "flex-end" },
  badgeNum: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 20,
    lineHeight: 24,
  },
  badgeDenom: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 11,
    lineHeight: 18,
    marginLeft: 1,
    marginBottom: 1,
  },

  // divider + handle
  divider: {
    position: "absolute",
    top: 0,
    width: 2,
    height: IMG_H,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_R * 2,
    height: HANDLE_R * 2,
    borderRadius: HANDLE_R,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  // ── testimonial ───────────────────────────────────────────────
  testimonialCard: {
    width: CARD_W,
    marginTop: 14,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: SP[5],
    paddingTop: SP[4],
    paddingBottom: SP[4],
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  quote: {
    color: COLORS.textHigh,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: 12,
  },
  testimonialFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  testimonialName: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 14,
    lineHeight: 18,
  },
  stars: { flexDirection: "row", gap: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },

  metricsSection: { marginTop: 20 },
  metricsTitle: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  metricsSub: {
    color: COLORS.sub,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: (CARD_W - 10) / 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(180,243,77,0.10)",
    borderWidth: 1,
    borderColor: "rgba(180,243,77,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricLabel: {
    color: COLORS.sub,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  metricScoreRow: { flexDirection: "row", alignItems: "center" },
  metricA: {
    color: "rgba(255,255,255,0.40)",
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 16,
    lineHeight: 20,
  },
  metricArrow: { color: "rgba(255,255,255,0.25)", fontSize: 13 },
  metricB: {
    color: COLORS.accent,
    fontFamily: Platform.select({ ios: "Poppins-SemiBold", android: "Poppins-SemiBold", default: "Poppins-SemiBold" }),
    fontSize: 18,
    lineHeight: 22,
  },

  // footer
  footer: { paddingTop: SP[3], paddingBottom: SP[4] },
});
