// app/(onboarding)/score-teaser.tsx
// Post-purchase score reveal. Shows CinematicLoader while analyzePair runs,
// then reveals real scores. CTA takes user to their daily routine.

import React, { useEffect, useCallback, useMemo } from "react";
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
  { apiKey: "jawline",           label: "Jawline",                defaultScore: 0 },
  { apiKey: "facial_symmetry",   label: "Facial Symmetry",        defaultScore: 0 },
  { apiKey: "cheekbones",        label: "Cheekbones",             defaultScore: 0 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity",  defaultScore: 0 },
  { apiKey: "skin_quality",      label: "Skin Quality",           defaultScore: 0 },
  { apiKey: "eyes_symmetry",     label: "Eye Symmetry",           defaultScore: 0 },
  { apiKey: "nose_harmony",      label: "Nose Balance",           defaultScore: 0 },
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
  const insets  = useSafeAreaInsets();
  const { imageUri, scores, loading } = useScores();
  const sizing  = useMetricSizing();

  // Fallback: if analysis finished but scores didn't arrive (network/server
  // error), skip the teaser and enter the app so the user isn't stuck.
  useEffect(() => {
    if (!loading && !scores) {
      router.replace("/(tabs)/program");
    }
  }, [loading, scores]);

  const footerH = insets.bottom + 88;

  const metrics = useMemo<MetricScore[]>(() => {
    if (scores) return applyApiScores(scores);
    return METRIC_DEFINITIONS.map(({ label, defaultScore }) => ({
      key: label, label, score: defaultScore,
    }));
  }, [scores]);

  const totalScore = useMemo(() => calculateTotal(metrics), [metrics]);

  const handleCTA = useCallback(() => {
    hapticSuccess();
    router.replace("/(tabs)/program");
  }, []);

  // Show cinematic loader while analyzePair is in flight
  if (loading) return <CinematicLoader loading />;

  return (
    <View style={styles.screen}>

      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      <View style={[styles.inner, { paddingTop: insets.top + SP[4] }]}>

        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <T variant="h2" color="text">Your Results</T>
          <T variant="caption" color="sub" style={styles.subtitle}>
            Based on your facial scan
          </T>
        </Animated.View>

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
          </ScrollView>
        </Animated.View>
      </View>

      {/* Sticky CTA */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(500)}
        style={[styles.footer, { paddingBottom: insets.bottom + SP[3] }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={styles.footerFade}
          pointerEvents="none"
        />
        <View style={styles.btnDepth}>
          <Pressable
            onPress={handleCTA}
            onPressIn={() => hapticLight()}
            style={({ pressed }) => [
              styles.btnFace,
              { transform: [{ translateY: pressed ? DEPTH - 1 : 0 }] },
            ]}
          >
            <Text style={styles.btnText}>Start Your Routine</Text>
          </Pressable>
        </View>
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
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SP[4],
    paddingTop: 32,
  },
  footerFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },
  btnDepth: {
    alignSelf: "center",
    width: "88%",
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
});
