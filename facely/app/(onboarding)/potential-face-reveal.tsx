// app/(onboarding)/potential-face-reveal.tsx
//
// Stage-1 Potential Face reveal — the emotional climax of onboarding.
// Slotted between /(tabs)/analysis and /(tabs)/program.
//
// State machine (driven by potentialFace.data.status + isPolling):
//   pending     → "polishing" loader, polls /current every 2s for up to 30s
//   ready       → reveal: Current ↔ Potential side-by-side, improvements list
//                  Primary CTA → /(tabs)/program (sets revealSeen = true)
//                  Secondary "doesn't look like me" → swap to alternate (one-shot)
//   failed      → fallback: "we'll have it ready" + Continue
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

      // Already-graduated user reaching this screen — bounce.
      if (fresh?.status === "unlocked") {
        navigatedRef.current = true;
        router.replace("/(tabs)/program");
        return;
      }

      // Pending → poll until ready/failed or timeout (30s default).
      if (fresh?.status === "pending" || !fresh) {
        const settled = await pollUntilReady(30_000);
        if (cancelled) return;
        // Still pending after timeout → show fallback path.
        if (!settled || settled.status === "pending") {
          setPollTimedOut(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // We deliberately depend on nothing — this is the on-mount bootstrap.
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
  //                       ready soon") and the unlocked-bounce path. The
  //                       user hasn't actually *seen* a face here, so we
  //                       leave revealSeen alone — they'll get another
  //                       chance next time the row is ready.
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

  // Treat polling timeout, hard failure, and "no data after load" as the same fallback.
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
    // Pending or loading — cinematic-style spinner.
    return (
      <PolishingView
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        polling={isPolling}
        error={error}
      />
    );
  }

  // Ready — the actual reveal.
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
      <View style={styles.polishingCenter}>
        <ActivityIndicator color={COLORS.accent} size="large" />
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
    <View style={[styles.screen, { paddingTop: insetsTop + SP[5], paddingBottom: insetsBottom + SP[5] }]}>
      <View style={styles.fallbackCenter}>
        <Animated.View entering={FadeInDown.duration(420)}>
          <T style={styles.fallbackTitle}>We'll have it ready soon</T>
          <T style={styles.fallbackBody}>{message}</T>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.footer}>
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
  const cardHeight = Math.round(cardWidth * 1.45);

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
          paddingBottom: insetsBottom + SP[5],
          paddingHorizontal: horizontalPad,
        },
      ]}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <T style={styles.eyebrow}>STAGE 1</T>
        <T style={styles.title}>This is who you could become</T>
        <T style={styles.subtitle}>
          A believable 6-month version of you, generated from your scan.
        </T>
      </Animated.View>

      {/* Two-up image comparison */}
      <View style={[styles.compareRow, { gap }]}>
        <Animated.View entering={FadeIn.duration(500).delay(150)} style={styles.compareCol}>
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
          <View style={[styles.imageCard, styles.imageCardAccent, { width: cardWidth, height: cardHeight }]}>
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

      {/* Improvements chip list */}
      <Animated.View entering={FadeInUp.duration(420).delay(480)} style={styles.improvementsBlock}>
        <T style={styles.improvementsTitle}>What changed</T>
        <View style={styles.chipRow}>
          {improvements.map((label, idx) => (
            <Animated.View
              key={`${label}-${idx}`}
              entering={FadeInUp.duration(360).delay(540 + idx * 80)}
              style={styles.chip}
            >
              <T style={styles.chipText}>{label}</T>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Footer CTAs */}
      <Animated.View entering={FadeInDown.duration(420).delay(700)} style={styles.footer}>
        <PrimaryPill label="Build my program" onPress={onPrimary} />
        {canSwap ? (
          <Pressable
            onPress={onAlternate}
            disabled={swapping}
            style={({ pressed }) => [
              styles.secondary,
              pressed && !swapping && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            {swapping ? (
              <ActivityIndicator color={COLORS.muted} />
            ) : (
              <T style={styles.secondaryText}>This doesn't look like me</T>
            )}
          </Pressable>
        ) : (
          <View style={styles.secondaryPlaceholder} />
        )}
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*   Bits                                                                     */
/* -------------------------------------------------------------------------- */

function PrimaryPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryPill, pressed && { opacity: 0.92 }]}
    >
      <T style={styles.primaryPillText}>{label.toUpperCase()}</T>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*   Styles                                                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bgTop,
  },

  /* Header */
  header: {
    gap: sh(6),
    marginBottom: SP[5],
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: ms(11),
    color: COLORS.accent,
    letterSpacing: 2,
  },
  title: {
    fontFamily: FONT,
    fontSize: ms(26),
    color: COLORS.text,
    lineHeight: ms(30),
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.sub,
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
    gap: sh(8),
  },
  imageCard: {
    borderRadius: RADII.lg,
    overflow: "hidden",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  imageCardAccent: {
    borderColor: COLORS.accentBorder,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.whiteGlass,
  },
  imageLabel: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.sub,
    letterSpacing: 1,
  },
  imageLabelAccent: {
    color: COLORS.accent,
  },

  /* Improvements */
  improvementsBlock: {
    marginTop: SP[5],
    gap: sh(10),
  },
  improvementsTitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
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
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentGlow,
  },
  chipText: {
    fontFamily: FONT,
    fontSize: ms(12),
    color: COLORS.text,
  },

  /* Footer */
  footer: {
    marginTop: "auto",
    gap: sh(12),
  },
  primaryPill: {
    minHeight: sh(54),
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
  },
  primaryPillText: {
    fontFamily: FONT,
    fontSize: ms(14),
    color: "#0B0B0B",
    letterSpacing: 0.6,
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
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
  secondaryPlaceholder: {
    height: sh(34),
  },

  /* Polishing state */
  polishingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sh(16),
    paddingHorizontal: SP[5],
  },
  polishingTitle: {
    fontFamily: FONT,
    fontSize: ms(20),
    color: COLORS.text,
    textAlign: "center",
  },
  polishingSubtitle: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.sub,
    textAlign: "center",
    maxWidth: ms(260),
  },

  /* Fallback state */
  fallbackCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
    gap: sh(8),
  },
  fallbackTitle: {
    fontFamily: FONT,
    fontSize: ms(22),
    color: COLORS.text,
    textAlign: "center",
  },
  fallbackBody: {
    fontFamily: FONT,
    fontSize: ms(13),
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: ms(18),
    maxWidth: ms(280),
  },
});
