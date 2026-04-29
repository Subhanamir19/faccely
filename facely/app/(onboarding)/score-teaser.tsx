// app/(onboarding)/score-teaser.tsx
// Post-purchase score reveal. Shows CinematicLoader while analyzePair runs,
// then reveals real scores in the same swipeable carousel layout as
// (tabs)/score.tsx so the teaser and the in-app screen are visually identical.
// CTA enters the advanced-analysis flow; "Skip" enters the app directly.

import React, { useEffect, useCallback, useMemo } from "react";
import {
  View,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";

import CinematicLoader from "@/components/ui/CinematicLoader";
import ScoringCarousel, { type ScoringMetric } from "@/components/scores/ScoringCarousel";
import Text from "@/components/ui/T";
import { COLORS, SP } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { useScores } from "../../store/scores";
import { hapticSuccess, hapticLight } from "@/lib/haptics";
import { useAdvancedAnalysisConsent } from "@/hooks/useAdvancedAnalysisConsent";

const FONT = "ProximaNova-Bold";

// ─── Metric definitions — identical to (tabs)/score.tsx ──────────────────────
const METRIC_DEFS = [
  { apiKey: "jawline",           label: "Jawline",                defaultScore: 0 },
  { apiKey: "facial_symmetry",   label: "Facial Symmetry",        defaultScore: 0 },
  { apiKey: "cheekbones",        label: "Cheekbones",             defaultScore: 0 },
  { apiKey: "sexual_dimorphism", label: "Masculinity/Femininity", defaultScore: 0 },
  { apiKey: "skin_quality",      label: "Skin Quality",           defaultScore: 0 },
  { apiKey: "eyes_symmetry",     label: "Eye Symmetry",           defaultScore: 0 },
  { apiKey: "nose_harmony",      label: "Nose Balance",           defaultScore: 0 },
] as const;

function buildMetrics(apiScores: Record<string, number> | null | undefined): ScoringMetric[] {
  return METRIC_DEFS.map(({ apiKey, label, defaultScore }) => {
    const raw = Number(apiScores?.[apiKey]);
    const score = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : defaultScore;
    return { label, score };
  });
}

function computeOverall(metrics: ScoringMetric[]): number {
  if (!metrics.length) return 0;
  return Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
}

// ─── Local pill button — mirrors LightPillButton in (tabs)/score.tsx ─────────
function LightPillButton({
  label,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  fill = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
  fill?: boolean;
}) {
  const isPrimary = variant === "primary";
  const bg = disabled
    ? COLORS.lightSurfaceAlt
    : isPrimary
      ? COLORS.ctaBlack
      : COLORS.lightSurfaceAlt;
  const fg = disabled
    ? COLORS.lightSub
    : isPrimary
      ? "#FFFFFF"
      : COLORS.lightText;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        ...(fill ? { flex: 1 } : {}),
        minHeight: sh(54),
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: sw(8),
        paddingVertical: sh(14),
        paddingHorizontal: SP[5],
        opacity: pressed && !disabled ? 0.85 : 1,
      })}
    >
      {loading && <ActivityIndicator color={fg} />}
      <Text style={{ color: fg, fontFamily: FONT, fontSize: ms(13), letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ScoreTeaserScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();
  const { imageUri, scores, loading } = useScores();
  const { checkAndPromptConsent, ConsentModal } = useAdvancedAnalysisConsent();

  // Fallback: if analysis finished but scores didn't arrive (network/server
  // error), skip the teaser and enter the app so the user isn't stuck.
  useEffect(() => {
    if (!loading && !scores) {
      router.replace("/(tabs)/program");
    }
  }, [loading, scores]);

  // Safety net: if backend hangs, send user into the app after 20s.
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      router.replace("/(tabs)/program");
    }, 20_000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const metrics = useMemo<ScoringMetric[]>(() => buildMetrics(scores as any), [scores]);
  const totalScore = useMemo(() => computeOverall(metrics), [metrics]);

  const HORIZONTAL_PAD = SP[5];
  const viewportWidth = SW - HORIZONTAL_PAD * 2;

  const handleSkip = useCallback(() => {
    hapticLight();
    router.replace("/(tabs)/program");
  }, []);

  const handleAdvanced = useCallback(async () => {
    hapticSuccess();
    const agreed = await checkAndPromptConsent();
    if (!agreed) return;
    router.push({ pathname: "/loading", params: { mode: "advanced", phase: "analysis" } });
  }, [checkAndPromptConsent]);

  // Show cinematic loader while analyzePair is in flight
  if (loading) return <CinematicLoader loading />;

  return (
    <View style={styles.screen}>
      <ConsentModal />

      <View
        style={[
          styles.content,
          {
            paddingTop:    insets.top    + SP[5],
            paddingBottom: insets.bottom + SP[5],
          },
        ]}
      >
        {/* Header — top */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <Text style={styles.title}>Your Scores</Text>
          <Text style={styles.subtitle}>Facial analysis breakdown — all 8 metrics</Text>
        </Animated.View>

        {/* Centered stack: avatar + carousel */}
        <View style={styles.centerStack}>
          <Animated.View entering={FadeInDown.duration(420).delay(160)}>
            <View style={styles.avatarRing}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]} />
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(220)} style={{ width: "100%" }}>
            <ScoringCarousel
              metrics={metrics}
              totalScore={totalScore}
              dashboardMetrics={[]}
              overallDelta={null}
              viewportWidth={viewportWidth}
            />
          </Animated.View>
        </View>

        {/* Action buttons — docked at bottom */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={styles.buttonRow}>
          <LightPillButton label="Skip" onPress={handleSkip} />
          <LightPillButton
            label="Advanced Analysis"
            variant="primary"
            onPress={handleAdvanced}
            fill
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles — mirror (tabs)/score.tsx ────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: SP[5],
  },
  header: {
    gap: sh(4),
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(28),
    color: COLORS.lightText,
    lineHeight: ms(32),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    marginTop: sh(2),
  },

  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SP[5],
  },
  avatarRing: {
    width:  ms(128),
    height: ms(128),
    borderRadius: ms(64),
    padding: ms(4),
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatarImg: {
    width:  "100%",
    height: "100%",
    borderRadius: ms(60),
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.iconTileLavender,
  },

  buttonRow: {
    flexDirection: "row",
    gap: SP[3],
  },
});
