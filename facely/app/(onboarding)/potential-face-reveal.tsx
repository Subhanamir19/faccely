// app/(onboarding)/potential-face-reveal.tsx
//
// Stage-1 Potential Face reveal — the emotional climax of onboarding.
// Slotted between /(tabs)/analysis and /(tabs)/program.
//
// Visual language: matches the light-theme treatment used by the dashboard
// and the redesigned advanced-analysis tab — soft white surfaces, sage-green
// "what changed" chips, lime accent on the right-hand "potential" card,
// black pill CTA at the bottom. The reveal is meant to feel like a calm,
// confident handoff, not a dark-mode hype moment.
//
// State machine (driven by potentialFace.data.status + isPolling):
//   pending     → "polishing" loader, polls /current every 2s for up to 30s
//   ready       → reveal layout
//                  Primary CTA → /(tabs)/program (sets revealSeen = true)
//                  Secondary "doesn't look like me" → swap to alternate (one-shot)
//   failed      → fallback: friendly message + Continue
//   unlocked    → user has graduated; bounce straight to program
//   poll timeout (still pending) → fallback message + Continue

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from "react-native";
import { ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import T from "@/components/ui/T";
import { COLORS, SP, RADII } from "@/lib/tokens";
import { ms, sh, sw } from "@/lib/responsive";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

import {
  usePotentialFace,
  type PotentialFace,
} from "@/store/potentialFace";
import { useScores } from "@/store/scores";
import { labelForMetric } from "@/lib/potentialFaceLabels";

const FONT = "ProximaNova-Bold";

// Sage palette mirrored from the analysis tab's "WORKING" treatment so the
// chip language is identical to what the user just saw.
const CHIP = {
  bg: "#E2F1D8",
  border: "#C7E2B4",
  text: "#1F3D1F",
};

// Soft drop shadow recipe used across the dashboard / score / analysis cards.
const SOFT_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/* -------------------------------------------------------------------------- */
/*   Screen                                                                   */
/* -------------------------------------------------------------------------- */

export default function PotentialFaceRevealScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW } = useWindowDimensions();

  const data = usePotentialFace((s) => s.data);
  const error = usePotentialFace((s) => s.error);
  const isPolling = usePotentialFace((s) => s.isPolling);
  const load = usePotentialFace((s) => s.load);
  const pollUntilReady = usePotentialFace((s) => s.pollUntilReady);
  const stopPolling = usePotentialFace((s) => s.stopPolling);
  const useAlternate = usePotentialFace((s) => s.useAlternate);
  const markRevealSeen = usePotentialFace((s) => s.markRevealSeen);

  const currentImageUri = useScores((s) => s.imageUri);

  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const navigatedRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /*   On mount: refresh state and start polling if pending                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await load();
      if (cancelled) return;

      if (fresh?.status === "unlocked") {
        navigatedRef.current = true;
        router.replace("/(tabs)/program");
        return;
      }

      if (fresh?.status === "pending" || !fresh) {
        const settled = await pollUntilReady(30_000);
        if (cancelled) return;
        if (!settled || settled.status === "pending") {
          setPollTimedOut(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------------ */
  /*   Handlers                                                               */
  /* ------------------------------------------------------------------------ */

  // Two distinct exits from this screen:
  //
  //   acknowledgeReveal — fires from the *successful* reveal's primary CTA.
  //                       Marks the reveal as seen so the analysis-tab CTA
  //                       routes future visits straight to the program.
  //
  //   bypassToProgram   — fires from the fallback screen ("we'll have it
  //                       ready soon"). The user hasn't actually *seen* a
  //                       face here, so we leave revealSeen alone — they'll
  //                       get another chance next time the row is ready.
  const acknowledgeReveal = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    markRevealSeen();
    hapticSuccess();
    router.replace("/(tabs)/program");
  }, [markRevealSeen]);

  const bypassToProgram = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    hapticSuccess();
    router.replace("/(tabs)/program");
  }, []);

  const onPressAlternate = useCallback(async () => {
    if (swapping) return;
    setSwapping(true);
    hapticLight();
    try {
      await useAlternate();
    } catch (err: any) {
      Alert.alert(
        "Couldn't swap image",
        err?.message ?? "Please try again in a moment."
      );
    } finally {
      setSwapping(false);
    }
  }, [swapping, useAlternate]);

  /* ------------------------------------------------------------------------ */
  /*   Render branches                                                        */
  /* ------------------------------------------------------------------------ */

  const isFailed = data?.status === "failed";
  const isReady = data?.status === "ready";
  const showFallback = isFailed || (pollTimedOut && !isReady);

  if (showFallback) {
    return (
      <FallbackView
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        message={
          isFailed
            ? "We hit a snag generating your potential face. We'll have it ready on your dashboard shortly."
            : "Your potential face is taking a little longer than expected. We'll have it ready on your dashboard shortly."
        }
        onContinue={bypassToProgram}
      />
    );
  }

  if (!isReady) {
    return (
      <PolishingView
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        polling={isPolling}
        error={error}
      />
    );
  }

  return (
    <RevealView
      insetsTop={insets.top}
      insetsBottom={insets.bottom}
      screenWidth={SW}
      potentialFace={data}
      currentImageUri={currentImageUri}
      onPrimary={acknowledgeReveal}
      onAlternate={onPressAlternate}
      swapping={swapping}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*   Subviews                                                                 */
/* -------------------------------------------------------------------------- */

function PolishingView({
  insetsTop,
  insetsBottom,
  polling,
  error,
}: {
  insetsTop: number;
  insetsBottom: number;
  polling: boolean;
  error: string | null;
}) {
  return (
    <View style={[styles.screen, { paddingTop: insetsTop, paddingBottom: insetsBottom }]}>
      <View style={styles.centerColumn}>
        <ActivityIndicator color={COLORS.lightText} size="large" />
        <Animated.View entering={FadeIn.duration(400).delay(120)}>
          <T style={styles.polishingTitle}>Polishing your potential face</T>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(400).delay(240)}>
          <T style={styles.polishingSubtitle}>
            {polling
              ? "Almost there — this only takes a few seconds."
              : error ?? "One moment…"}
          </T>
        </Animated.View>
      </View>
    </View>
  );
}

function FallbackView({
  insetsTop,
  insetsBottom,
  message,
  onContinue,
}: {
  insetsTop: number;
  insetsBottom: number;
  message: string;
  onContinue: () => void;
}) {
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insetsTop + SP[5],
          paddingBottom: insetsBottom + SP[5],
          paddingHorizontal: SP[5],
        },
      ]}
    >
      <View style={styles.fallbackCenter}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.fallbackInner}>
          <T style={styles.eyebrow}>STAGE 1</T>
          <T style={styles.fallbackTitle}>We'll have it ready soon</T>
          <T style={styles.fallbackBody}>{message}</T>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.duration(420).delay(120)}>
        <PrimaryPill label="Continue to your program" onPress={onContinue} />
      </Animated.View>
    </View>
  );
}

function RevealView({
  insetsTop,
  insetsBottom,
  screenWidth,
  potentialFace,
  currentImageUri,
  onPrimary,
  onAlternate,
  swapping,
}: {
  insetsTop: number;
  insetsBottom: number;
  screenWidth: number;
  potentialFace: PotentialFace;
  currentImageUri: string | null | undefined;
  onPrimary: () => void;
  onAlternate: () => void;
  swapping: boolean;
}) {
  const horizontalPad = SP[5];
  const gap = sw(10);
  const cardWidth = (screenWidth - horizontalPad * 2 - gap) / 2;
  const cardHeight = Math.round(cardWidth * 1.32);

  const improvements = useMemo(
    () => potentialFace.targetedMetrics.map(labelForMetric),
    [potentialFace.targetedMetrics]
  );

  const canSwap =
    potentialFace.regeneratedCount === 0 &&
    Boolean(potentialFace.alternateImageUrl) &&
    !swapping;

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insetsTop + SP[4],
          paddingBottom: insetsBottom + SP[4],
          paddingHorizontal: horizontalPad,
        },
      ]}
    >
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <T style={styles.eyebrow}>STAGE 1</T>
        <T style={styles.title}>This is who you could become</T>
        <T style={styles.subtitle}>
          A believable 6-month version of you, generated from your scan.
        </T>
      </Animated.View>

      {/* ── Two-up image comparison ── */}
      <View style={[styles.compareRow, { gap }]}>
        <Animated.View entering={FadeIn.duration(500).delay(160)} style={styles.compareCol}>
          <View style={[styles.imageCard, { width: cardWidth, height: cardHeight }]}>
            {currentImageUri ? (
              <Image
                source={{ uri: currentImageUri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.imagePlaceholder]} />
            )}
          </View>
          <T style={styles.imageLabel}>You today</T>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(500).delay(320)} style={styles.compareCol}>
          <View
            style={[
              styles.imageCard,
              styles.imageCardAccent,
              { width: cardWidth, height: cardHeight },
            ]}
          >
            {potentialFace.primaryImageUrl ? (
              <Image
                source={{ uri: potentialFace.primaryImageUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.imagePlaceholder]} />
            )}
          </View>
          <T style={[styles.imageLabel, styles.imageLabelAccent]}>Your potential</T>
        </Animated.View>
      </View>

      {/* ── What changed ── */}
      <Animated.View
        entering={FadeInUp.duration(420).delay(480)}
        style={styles.improvementsBlock}
      >
        <T style={styles.improvementsLabel}>WHAT CHANGED</T>
        <View style={styles.chipRow}>
          {improvements.map((label, idx) => (
            <Animated.View
              key={`${label}-${idx}`}
              entering={FadeInUp.duration(360).delay(560 + idx * 70)}
              style={styles.chip}
            >
              <T style={styles.chipText}>{label}</T>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* ── Footer CTAs ── */}
      <View style={styles.footer}>
        <Animated.View entering={FadeInDown.duration(420).delay(820)}>
          <PrimaryPill label="Build my program" onPress={onPrimary} withChevron />
        </Animated.View>
        {canSwap ? (
          <Pressable
            onPress={onAlternate}
            disabled={swapping}
            style={({ pressed }) => [
              styles.secondary,
              pressed && !swapping && { opacity: 0.6 },
            ]}
            hitSlop={8}
          >
            {swapping ? (
              <ActivityIndicator color={COLORS.lightSub} />
            ) : (
              <T style={styles.secondaryText}>This doesn't look like me</T>
            )}
          </Pressable>
        ) : (
          <View style={styles.secondaryPlaceholder} />
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Bits                                                                     */
/* -------------------------------------------------------------------------- */

function PrimaryPill({
  label,
  onPress,
  withChevron = false,
}: {
  label: string;
  onPress: () => void;
  withChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryPill, pressed && { opacity: 0.92 }]}
    >
      <T style={styles.primaryPillText}>{label.toUpperCase()}</T>
      {withChevron && (
        <ChevronRight size={ms(16)} color="#FFFFFF" strokeWidth={2.5} />
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*   Styles                                                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },

  /* Header */
  header: {
    gap: sh(6),
    marginBottom: SP[5],
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.accentDepth,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(26),
    color: COLORS.lightText,
    lineHeight: ms(30),
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    lineHeight: ms(18),
    marginTop: sh(4),
  },

  /* Two-up compare */
  compareRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  compareCol: {
    alignItems: "center",
    gap: sh(10),
  },
  imageCard: {
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: COLORS.lightCard,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
    ...SOFT_SHADOW,
  },
  imageCardAccent: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.lightSurfaceAlt,
  },
  imageLabel: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0.6,
  },
  imageLabelAccent: {
    color: COLORS.accentDepth,
  },

  /* What changed */
  improvementsBlock: {
    marginTop: SP[5],
    gap: sh(12),
  },
  improvementsLabel: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.lightMuted,
    letterSpacing: 1.4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sw(8),
  },
  chip: {
    paddingHorizontal: SP[3],
    paddingVertical: sh(8),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP.border,
    backgroundColor: CHIP.bg,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: CHIP.text,
    letterSpacing: 0.2,
  },

  /* Footer */
  footer: {
    marginTop: "auto",
    gap: sh(14),
  },
  primaryPill: {
    minHeight: sh(56),
    borderRadius: 999,
    backgroundColor: COLORS.ctaBlack,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sw(6),
    paddingVertical: sh(16),
    paddingHorizontal: sw(20),
  },
  primaryPillText: {
    fontFamily: FONT,
    fontSize: ms(15, 0.3),
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  secondary: {
    alignSelf: "center",
    paddingVertical: sh(8),
    paddingHorizontal: SP[3],
    minHeight: sh(34),
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.lightSub,
    letterSpacing: 0.3,
  },
  secondaryPlaceholder: {
    height: sh(34),
  },

  /* Polishing state */
  centerColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
    paddingHorizontal: SP[5],
  },
  polishingTitle: {
    fontFamily: FONT,
    fontSize: ms(20),
    color: COLORS.lightText,
    textAlign: "center",
  },
  polishingSubtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
    maxWidth: ms(280),
    lineHeight: ms(18),
  },

  /* Fallback state */
  fallbackCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackInner: {
    alignItems: "center",
    gap: sh(8),
    maxWidth: ms(300),
  },
  fallbackTitle: {
    fontFamily: FONT,
    fontSize: ms(24),
    color: COLORS.lightText,
    textAlign: "center",
    lineHeight: ms(28),
    letterSpacing: -0.3,
  },
  fallbackBody: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.lightSub,
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: sh(4),
  },
});
