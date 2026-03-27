// app/(onboarding)/score-teaser.tsx
// Score reveal screen. Shows blurred placeholder scores for free users with a
// "Subscribe to unlock" overlay. Post-purchase: shows real scores after analyzePair.

import React, { useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ImageBackground,
  Platform,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { Lock } from "lucide-react-native";
import { useSubscriptionStore } from "@/store/subscription";

import CinematicLoader from "@/components/ui/CinematicLoader";
import MetricCardShell from "@/components/layout/MetricCardShell";
import ScoresSummaryCard from "@/components/scores/ScoresSummaryCard";
import useMetricSizing from "@/components/layout/useMetricSizing";
import T from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { useScores } from "../../store/scores";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

// ---------------------------------------------------------------------------
// Metric definitions — identical to score.tsx
// ---------------------------------------------------------------------------
const METRIC_DEFINITIONS = [
  { apiKey: "jawline",           label: "Jawline",                defaultScore: 64 },
  { apiKey: "facial_symmetry",   label: "Facial Symmetry",        defaultScore: 72 },
  { apiKey: "cheekbones",        label: "Cheekbones",             defaultScore: 58 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity",  defaultScore: 81 },
  { apiKey: "skin_quality",      label: "Skin Quality",           defaultScore: 69 },
  { apiKey: "eyes_symmetry",     label: "Eye Symmetry",           defaultScore: 62 },
  { apiKey: "nose_harmony",      label: "Nose Balance",           defaultScore: 74 },
] as const;

type MetricScore = { key: string; label: string; score: number };

function applyApiScores(api: any): MetricScore[] {
  const raw = api?.scores ?? api;
  return METRIC_DEFINITIONS.map(({ apiKey, label, defaultScore }) => {
    const v = Number(raw?.[apiKey]);
    return {
      key: label,
      label,
      score: Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : defaultScore,
    };
  });
}

function calculateTotal(metrics: MetricScore[]): number {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((acc, m) => acc + m.score, 0) / metrics.length);
}

// Button depth constant — same as take-picture.tsx
const DEPTH = 5;
const FONT = Platform.select({
  ios: "Poppins-SemiBold",
  android: "Poppins-SemiBold",
  default: "Poppins-SemiBold",
}) as string;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function ScoreTeaserScreen() {
  const insets   = useSafeAreaInsets();
  const { imageUri, scores, loading } = useScores();
  const sizing   = useMetricSizing();

  const revenueCatEntitlement = useSubscriptionStore((s) => s.revenueCatEntitlement);
  const promoActivated = useSubscriptionStore((s) => s.promoActivated);
  const hasAccess = revenueCatEntitlement || promoActivated;

  // If user is paid and scores just arrived → real reveal.
  // Otherwise → blurred placeholder (free path through onboarding).
  const isRevealed = hasAccess && !!scores;

  // Extra bottom clearance so the card scrolls fully clear of the button
  const footerH  = insets.bottom + 88;

  const metrics = useMemo<MetricScore[]>(() => {
    if (scores) return applyApiScores(scores);
    return METRIC_DEFINITIONS.map(({ label, defaultScore }) => ({
      key: label, label, score: defaultScore,
    }));
  }, [scores]);

  const totalScore = useMemo(() => calculateTotal(metrics), [metrics]);

  // Post-purchase: enter the app after seeing real scores.
  // Pre-purchase (free path): continue through onboarding to improve-areas.
  const handleCTA = useCallback(() => {
    hapticSuccess();
    if (isRevealed) {
      router.replace("/(tabs)/program");
    } else {
      router.push("/(onboarding)/improve-areas");
    }
  }, [isRevealed]);

  const handleSkip = useCallback(() => {
    hapticLight();
    router.push("/(onboarding)/improve-areas");
  }, []);

  // Only show cinematic loader post-purchase (when we expect real scores to arrive)
  if (loading && hasAccess) return <CinematicLoader loading />;

  return (
    <View style={styles.screen}>

      {/* Background — same as score.tsx */}
      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <View style={[styles.inner, { paddingTop: insets.top + SP[4] }]}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <T variant="h2" color="text">Your Results</T>
          <T variant="caption" color="sub" style={styles.subtitle}>
            Based on your facial scan
          </T>
        </Animated.View>

        {/* Card scrolls freely; padding-bottom clears the sticky button */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.scrollWrap}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: footerH },
            ]}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {/* Score card — always rendered but blurred when not revealed */}
            <View style={styles.cardWrapper}>
              <MetricCardShell
                withOuterPadding={false}
                renderSurface={false}
                sizing={sizing}
              >
                {(usableWidth) => (
                  <ScoresSummaryCard
                    metrics={metrics}
                    totalScore={totalScore}
                    width={usableWidth}
                    active={true}
                    imageUri={imageUri}
                  />
                )}
              </MetricCardShell>

              {/* Blur overlay — shown only for free users (no subscription) */}
              {!isRevealed && (
                <View style={styles.blurOverlay} pointerEvents="none">
                  <View style={styles.lockBadge}>
                    <Lock size={20} color="#0B0B0B" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.blurTitle}>Your Score Is Ready</Text>
                  <Text style={styles.blurSub}>
                    Subscribe to reveal your exact score and unlock all features
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      {/* ── Sticky CTA — absolutely positioned, always visible ─── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(500)}
        style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}
        pointerEvents="box-none"
      >
        {/* Gradient fades content into the footer */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={styles.footerFade}
          pointerEvents="none"
        />

        {/* Raised 3D button */}
        <View style={styles.btnDepth}>
          <Pressable
            onPress={handleCTA}
            onPressIn={() => hapticLight()}
            style={({ pressed }) => [
              styles.btnFace,
              { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
            ]}
          >
            <Text style={styles.btnText}>
              {isRevealed ? "Enter App" : "Continue"}
            </Text>
          </Pressable>
        </View>

        {/* Skip link — only shown on free path */}
        {!isRevealed && (
          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        )}
      </Animated.View>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // Full-height wrapper for scrollable content
  inner: {
    flex: 1,
    paddingHorizontal: SP[4],
  },
  header: {
    marginBottom: SP[4],
  },
  subtitle: {
    marginTop: SP[1],
  },

  // Scroll area fills remaining space above the sticky footer
  scrollWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: SP[2],
  },

  // Sticky footer — absolute, full width, always on top
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingTop: 32, // space for the fade gradient
  },
  footerFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  // 3D depth button — identical to take-picture.tsx
  btnDepth: {
    alignSelf: "center",
    width: "88%",          // percentage → adapts to every screen width
    borderRadius: 26,
    backgroundColor: "#6B9A1E",
    paddingBottom: DEPTH,
  },
  btnFace: {
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  btnText: {
    fontFamily: FONT,
    fontSize: 16,
    color: "#0B0B0B",
    letterSpacing: -0.1,
  },

  // Skip link
  skipBtn: {
    alignSelf: "center",
    marginTop: SP[3],
    paddingVertical: SP[2],
  },
  skipText: {
    fontFamily: FONT,
    fontSize: 13,
    color: "rgba(255,255,255,0.38)",
    letterSpacing: -0.1,
  },

  // Card wrapper — needed to position the blur overlay over the score card
  cardWrapper: {
    width: "100%",
    alignItems: "center",
  },

  // Blur overlay — sits on top of the score card for free users
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,11,11,0.72)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
    gap: SP[3],
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[1],
  },
  blurTitle: {
    fontFamily: FONT,
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  blurSub: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 19,
  },
});
