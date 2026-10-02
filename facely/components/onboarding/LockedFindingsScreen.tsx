// components/onboarding/LockedFindingsScreen.tsx
// The last beat before the paywall. The user's own scan photo sits in the
// scanner frame, a sweep runs once, then callouts pop out of specific facial
// regions. Each callout names the region and blurs the finding underneath.
//
// This screen runs no analysis. Regions come from the goals the user picked,
// topped up from a default set. The blurred lines are placeholder shapes; the
// real findings arrive after purchase.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import T from "@/components/ui/T";
import {
  ORANGE_ONBOARDING,
  OnboardingSequenceHeader,
  OrangePrimaryButton,
} from "@/components/onboarding/OrangeOnboardingLayout";
import ScreenBackground from "@/components/onboarding/ScreenBackground";
import { CornerBrackets, Reticle } from "@/components/onboarding/WeakPointsScanScreen";
import { BG_MOODS } from "@/lib/tokens";
import { useOnboarding } from "@/store/onboarding";
import { hapticCrescendo, hapticRigid, hapticSuccess, hapticTick, hapticWarning } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";

const FALLBACK_FACE = require("../../advanced-analysis-icons/newer-version/skin-quality.png");

const ORANGE = ORANGE_ONBOARDING.orange;
const INK = ORANGE_ONBOARDING.text;
const ALERT = "#E5484D";

const HEADLINE: { text: string; accent?: boolean }[] = [
  { text: "We found a few " },
  { text: "problems", accent: true },
  { text: "\nholding your face back." },
];
const HEADLINE_LEN = HEADLINE.reduce((n, part) => n + part.text.length, 0);

/* Timing — the headline lands, then the sweep, then one callout at a time. */
const TYPE_MS = 30;
const TYPE_HAPTIC_EVERY = 3;
const FRAME_IN = 180;
const SCAN_START = 380;
const SCAN_MS = 1400;
const REVEAL_LEAD = 260;   // first callout lands just before the sweep ends
const CALLOUT_STAGGER = 420;
const FADE_MS = 420;

const MAX_CALLOUTS = 4;

export type LockedRegion = "skin" | "eyes" | "cheekbones" | "symmetry" | "jawline";

type Finding = {
  label: string;
  /** Placeholder with the length of a real finding. Only its shape shows. */
  hidden: string;
  /** Anchor on the face, normalised 0..1 inside the frame. */
  x: number;
  y: number;
  /** Which way the callout reaches out from the anchor. */
  side: "left" | "right";
};

// Anchors assume the frontal capture guide: face centred, chin near the
// bottom fifth. Sides alternate by height so no two callouts collide.
export const FINDINGS: Record<LockedRegion, Finding> = {
  skin: { label: "Skin quality", hidden: "Uneven texture across T-zone", x: 0.62, y: 0.27, side: "right" },
  eyes: { label: "Eye area", hidden: "Under-eye support below ideal", x: 0.38, y: 0.42, side: "left" },
  cheekbones: { label: "Cheekbones", hidden: "Projection under ideal ratio", x: 0.69, y: 0.55, side: "right" },
  symmetry: { label: "Symmetry", hidden: "Midface balance off-centre", x: 0.42, y: 0.65, side: "left" },
  jawline: { label: "Jawline", hidden: "Lower third lacks definition", x: 0.64, y: 0.8, side: "right" },
};

const DEFAULT_ORDER: LockedRegion[] = ["jawline", "eyes", "cheekbones", "skin", "symmetry"];

/** The user's goals first, then defaults, capped. Returned top-to-bottom. */
export function pickRegions(goals: string[] | undefined): LockedRegion[] {
  const fromGoals = (goals ?? []).filter((g): g is LockedRegion => g in FINDINGS);
  const unique = Array.from(new Set<LockedRegion>([...fromGoals, ...DEFAULT_ORDER]));
  return unique.slice(0, MAX_CALLOUTS).sort((a, b) => FINDINGS[a].y - FINDINGS[b].y);
}

/* ── Callout ───────────────────────────────────────────────────────── */

function Callout({
  finding,
  frameW,
  frameH,
  revealAt,
  reduceMotion,
  onPress,
}: {
  finding: Finding;
  frameW: number;
  frameH: number;
  revealAt: number;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const pop = useSharedValue(0);
  const pulse = useSharedValue(0);
  const shake = useSharedValue(0);

  const ax = finding.x * frameW;
  const ay = finding.y * frameH;
  const dot = ms(11);
  const stem = ms(16);
  const edge = ms(10);
  const pillW = Math.min(frameW * 0.5, ms(184));
  const reach = ms(28);
  const pillLeft =
    finding.side === "left"
      ? Math.max(edge, Math.min(ax - pillW + reach, frameW - pillW - edge))
      : Math.max(edge, Math.min(ax - reach, frameW - pillW - edge));
  // Pinned by its bottom edge, so the pill can size to its content.
  const pillBottom = frameH - (ay - dot / 2 - stem);
  const rise = ms(10);

  useEffect(() => {
    pop.value = withDelay(
      revealAt,
      reduceMotion
        ? withTiming(1, { duration: FADE_MS })
        : withSpring(1, { damping: 14, stiffness: 160, mass: 0.7 })
    );
    if (!reduceMotion) {
      pulse.value = withDelay(
        revealAt + 300,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 750, easing: Easing.in(Easing.quad) })
          ),
          -1,
          false
        )
      );
    }
    const tick = setTimeout(hapticRigid, revealAt);
    return () => {
      clearTimeout(tick);
      cancelAnimation(pop);
      cancelAnimation(pulse);
    };
  }, [pop, pulse, reduceMotion, revealAt]);

  const handlePress = useCallback(() => {
    hapticWarning();
    if (!reduceMotion) {
      shake.value = withSequence(
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    }
    onPress();
  }, [onPress, reduceMotion, shake]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: pop.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - 0.45 * pulse.value,
    transform: [{ scale: 1 + 1.1 * pulse.value }],
  }));
  const stemStyle = useAnimatedStyle(() => ({ opacity: pop.value }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [
      { translateX: shake.value },
      { translateY: (1 - pop.value) * rise },
      { scale: 0.7 + 0.3 * pop.value },
    ],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          s.stem,
          { left: ax - 0.75, top: ay - dot / 2 - stem, height: stem },
          stemStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[s.dotWrap, { left: ax - dot / 2, top: ay - dot / 2, width: dot, height: dot }, dotStyle]}
      >
        <Animated.View style={[s.halo, { borderRadius: dot }, haloStyle]} />
        <View style={[s.dot, { borderRadius: dot }]} />
      </Animated.View>

      <Animated.View style={[s.pillWrap, { left: pillLeft, bottom: pillBottom, width: pillW }, pillStyle]}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${finding.label}: finding locked`}
          accessibilityHint="Unlock to see this finding"
          style={s.pill}
        >
          <View style={s.pillHead}>
            <View style={s.pillDot} />
            <T style={s.pillLabel} numberOfLines={1}>
              {finding.label}
            </T>
            <Ionicons name="lock-closed" size={ms(11)} color={ORANGE_ONBOARDING.muted} />
          </View>
          <View style={s.hiddenRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <T style={s.hiddenText} numberOfLines={1}>
              {finding.hidden}
            </T>
            <BlurView
              tint="light"
              intensity={30}
              blurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}

/* ── Scanner frame with the user's photo ───────────────────────────── */

function FindingsStage({
  regions,
  startDelay,
  reduceMotion,
  onCalloutPress,
}: {
  regions: LockedRegion[];
  startDelay: number;
  reduceMotion: boolean;
  onCalloutPress: () => void;
}) {
  const photoUri = useOnboarding((st) => st.scanFrontalUri);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const usePhoto = !!photoUri && !photoFailed;

  const scan = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    scan.value = withDelay(
      startDelay + SCAN_START,
      withTiming(1, { duration: SCAN_MS, easing: Easing.inOut(Easing.cubic) })
    );
    return () => cancelAnimation(scan);
  }, [reduceMotion, scan, startDelay]);

  const bandH = ms(110);
  const frameH = frame.h;

  const bandStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : 0,
    transform: [{ translateY: -bandH + scan.value * (frameH + bandH) }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : 0,
    transform: [{ translateY: scan.value * frameH }],
  }));

  const firstReveal = reduceMotion ? 0 : startDelay + SCAN_START + SCAN_MS - REVEAL_LEAD;

  return (
    <View
      style={s.frame}
      onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {usePhoto ? (
        <Image
          source={{ uri: photoUri }}
          style={s.photo}
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Image source={FALLBACK_FACE} style={s.fallbackFace} resizeMode="contain" />
      )}
      {/* Cool, low vignette: the face reads as a subject under review. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(5,5,5,0.18)", "rgba(5,5,5,0)", "rgba(5,5,5,0.28)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      {frame.w > 0 && (
        <>
          <Reticle w={frame.w} h={frame.h} />
          {!reduceMotion && (
            <>
              <Animated.View style={[s.band, { height: bandH }, bandStyle]} pointerEvents="none">
                <LinearGradient
                  colors={["rgba(242,106,19,0)", "rgba(242,106,19,0.22)", "rgba(242,106,19,0.02)"]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View style={[s.scanLine, lineStyle]} pointerEvents="none" />
            </>
          )}
          <CornerBrackets />
          {regions.map((region, i) => (
            <Callout
              key={region}
              finding={FINDINGS[region]}
              frameW={frame.w}
              frameH={frame.h}
              revealAt={firstReveal + i * (reduceMotion ? 0 : CALLOUT_STAGGER)}
              reduceMotion={reduceMotion}
              onPress={onCalloutPress}
            />
          ))}
        </>
      )}
    </View>
  );
}

/* ── Headline ──────────────────────────────────────────────────────── */

function TypedHeadline({ reduceMotion }: { reduceMotion: boolean }) {
  const [shown, setShown] = useState(reduceMotion ? HEADLINE_LEN : 0);

  useEffect(() => {
    if (reduceMotion) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i % TYPE_HAPTIC_EVERY === 0) hapticTick();
      if (i >= HEADLINE_LEN) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  let left = shown;
  return (
    <T
      variant="h2"
      style={s.title}
      accessibilityRole="header"
      accessibilityLabel={HEADLINE.map((p) => p.text).join("").replace("\n", " ")}
    >
      {HEADLINE.map((part, i) => {
        const take = Math.max(0, Math.min(part.text.length, left));
        left -= take;
        if (take === 0) return null;
        return (
          <T key={i} variant="h2" style={[s.title, part.accent && s.accent]}>
            {part.text.slice(0, take)}
          </T>
        );
      })}
      {shown < HEADLINE_LEN ? (
        <T variant="h2" style={[s.title, s.accent]}>
          |
        </T>
      ) : null}
    </T>
  );
}

/* ── Screen ────────────────────────────────────────────────────────── */

export default function LockedFindingsScreen() {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const goals = useOnboarding((st) => st.data.goals);
  const regions = useMemo(() => pickRegions(goals), [goals]);

  const titleMs = reduceMotion ? 0 : HEADLINE_LEN * TYPE_MS;
  const lastReveal = titleMs + SCAN_START + SCAN_MS - REVEAL_LEAD + (regions.length - 1) * CALLOUT_STAGGER;
  const ctaAt = reduceMotion ? 300 : lastReveal + 380;

  const subIn = useSharedValue(0);
  const frameIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const nudge = useSharedValue(1);

  useEffect(() => {
    const fade = { duration: FADE_MS, easing: Easing.out(Easing.cubic) };
    subIn.value = withDelay(titleMs + 120, withTiming(1, fade));
    frameIn.value = withDelay(reduceMotion ? 0 : FRAME_IN, withTiming(1, fade));
    ctaIn.value = withDelay(ctaAt, withTiming(1, fade));
    const done = reduceMotion ? undefined : setTimeout(hapticCrescendo, lastReveal + 240);
    return () => {
      if (done) clearTimeout(done);
      cancelAnimation(subIn);
      cancelAnimation(frameIn);
      cancelAnimation(ctaIn);
      cancelAnimation(nudge);
    };
  }, [ctaAt, ctaIn, frameIn, lastReveal, nudge, reduceMotion, subIn, titleMs]);

  // A tapped callout points the user at the button that unlocks it.
  const nudgeCta = useCallback(() => {
    if (reduceMotion) return;
    nudge.value = withSequence(
      withTiming(1.045, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 220 })
    );
  }, [nudge, reduceMotion]);

  const handleContinue = useCallback(() => {
    hapticSuccess();
    router.push("/(onboarding)/paywall");
  }, []);

  // `ms` is a plain JS function; resolve distances here, never in a worklet.
  const subRise = ms(10);
  const frameRise = ms(18);
  const ctaRise = ms(12);

  const subStyle = useAnimatedStyle(() => ({
    opacity: subIn.value,
    transform: [{ translateY: (1 - subIn.value) * subRise }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    opacity: frameIn.value,
    transform: [{ translateY: (1 - frameIn.value) * frameRise }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: (1 - ctaIn.value) * ctaRise }, { scale: nudge.value }],
  }));

  return (
    <View style={s.root}>
      <ScreenBackground mood="amber" />
      <OnboardingSequenceHeader stepKey="weak-points-locked" />

      <View style={s.header}>
        <TypedHeadline reduceMotion={reduceMotion} />
        <Animated.View style={subStyle}>
          <T variant="body" style={s.subtitle}>
            Based on your scan and the goals you picked.
          </T>
        </Animated.View>
      </View>

      <Animated.View style={[s.stageSlot, frameStyle]}>
        <FindingsStage
          regions={regions}
          startDelay={titleMs}
          reduceMotion={reduceMotion}
          onCalloutPress={nudgeCta}
        />
      </Animated.View>

      <Animated.View style={[s.footer, { paddingBottom: insets.bottom + sh(14) }, ctaStyle]}>
        <OrangePrimaryButton
          label="Reveal My Problems"
          onPress={handleContinue}
          fontFamily={ORANGE_ONBOARDING.fontBold}
        />
        <T variant="caption" style={s.microcopy}>
          Full breakdown + a plan to fix each one.
        </T>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_MOODS.amber.bottom },

  header: { paddingHorizontal: sw(24), paddingTop: sh(10), gap: sh(8) },
  title: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    color: INK,
    letterSpacing: -0.6,
  },
  accent: { color: ORANGE },
  subtitle: {
    fontFamily: ORANGE_ONBOARDING.fontRegular,
    color: ORANGE_ONBOARDING.muted,
    lineHeight: ms(20),
  },

  stageSlot: { flex: 1, marginTop: sh(20), marginBottom: sh(18), paddingHorizontal: sw(20) },
  frame: {
    flex: 1,
    borderRadius: ms(28),
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    overflow: "hidden",
    backgroundColor: ORANGE_ONBOARDING.surface,
  },
  photo: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  fallbackFace: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.16 }],
  },

  band: { position: "absolute", left: 0, right: 0, top: 0 },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  stem: { position: "absolute", width: 1.5, backgroundColor: "#FFFFFF" },
  dotWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  halo: { ...StyleSheet.absoluteFill, backgroundColor: ALERT },
  dot: {
    width: "100%",
    height: "100%",
    backgroundColor: ALERT,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  pillWrap: { position: "absolute" },
  pill: {
    paddingVertical: ms(8),
    paddingHorizontal: ms(11),
    borderRadius: ms(14),
    backgroundColor: ORANGE_ONBOARDING.surface,
    gap: ms(5),
    shadowColor: "#050505",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pillHead: { flexDirection: "row", alignItems: "center", gap: ms(6) },
  pillDot: { width: ms(7), height: ms(7), borderRadius: ms(7), backgroundColor: ALERT },
  pillLabel: {
    flex: 1,
    fontFamily: ORANGE_ONBOARDING.fontBold,
    fontSize: ms(13),
    lineHeight: ms(16),
    color: INK,
    letterSpacing: -0.2,
  },
  hiddenRow: { borderRadius: ms(6), overflow: "hidden" },
  hiddenText: {
    fontFamily: ORANGE_ONBOARDING.fontSemibold,
    fontSize: ms(12),
    lineHeight: ms(16),
    color: ORANGE_ONBOARDING.muted,
  },

  footer: { paddingHorizontal: sw(24), paddingTop: sh(4), gap: sh(10), alignItems: "center" },
  microcopy: {
    fontFamily: ORANGE_ONBOARDING.fontSemibold,
    color: ORANGE_ONBOARDING.muted,
  },
});
