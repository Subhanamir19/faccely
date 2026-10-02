// components/onboarding/WeakPointsScanScreen.tsx
// "Know your weak points" — a scanner-framed face on paper white. A scan line
// sweeps the face, then weak-metric pills open outward from the centre.
// Palette: white surfaces, black ink, orange accent (no lime).
//
// Two exports:
//   WeakPointsScanStage  — just the scanner frame, for the onboarding sequence
//                          which supplies its own heading, copy and CTA.
//   WeakPointsScanScreen — the full standalone screen (dev preview).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { ORANGE_ONBOARDING, OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";
import ScreenBackground from "@/components/onboarding/ScreenBackground";
import { BG_MOODS } from "@/lib/tokens";
import { hapticRigid, hapticTick } from "@/lib/haptics";
import { ms, sh, sw } from "@/lib/responsive";

const FACE = require("../../advanced-analysis-icons/newer-version/skin-quality.png");

const ORANGE = ORANGE_ONBOARDING.orange;
const INK = ORANGE_ONBOARDING.text;
const ALERT = "#E5484D";

/* Sequence timing — every element lands top-to-bottom. */
const TYPE_MS = 45;           // per character of the title
const TYPE_HAPTIC_EVERY = 3;  // characters between selection ticks
const SUBTITLE_IN = 140;      // after the title finishes
const FRAME_IN = 300;
const SCAN_START = 420;
const SCAN_MS = 1800;
const REVEAL_LEAD = 340;      // pills start just before the sweep ends
const STAGGER = 120;
const FADE_MS = 420;

export type WeakPoint = {
  id: string;
  label: string;
  /** Anchor inside the scanner frame, normalised 0..1. */
  x: number;
  y: number;
  /** Which edge the pill hugs — decides how the label grows. */
  side: "left" | "right";
};

export const DEFAULT_WEAK_POINTS: WeakPoint[] = [
  { id: "bone", label: "Bone Structure", x: 0.06, y: 0.12, side: "left" },
  { id: "cheekbone", label: "Cheekbone Width", x: 0.94, y: 0.24, side: "right" },
  { id: "maxilla", label: "Maxilla", x: 0.06, y: 0.4, side: "left" },
  { id: "skin", label: "Skin Quality", x: 0.94, y: 0.52, side: "right" },
  { id: "jaw", label: "Jaw Development", x: 0.06, y: 0.7, side: "left" },
  { id: "facefat", label: "Face Fat", x: 0.94, y: 0.82, side: "right" },
];

type Diagnostics = {
  /** Skip every haptic call. */
  noHaptics?: boolean;
  /** Skip the face bitmap. */
  noImage?: boolean;
  /** Render the end state with no spring or pulse. */
  staticMode?: boolean;
  /** Skip the alert pills. */
  noPills?: boolean;
  /** Skip the corner brackets and grid. */
  noChrome?: boolean;
  /** Skip the scan band and line. */
  noSweep?: boolean;
};

/* ── Alert pill ────────────────────────────────────────────────────── */

function AlertPill({
  point,
  order,
  startAt,
  frameW,
  frameH,
  playToken,
  reduceMotion,
  noHaptics,
}: {
  point: WeakPoint;
  order: number;
  startAt: number;
  frameW: number;
  frameH: number;
  playToken: number;
  reduceMotion: boolean;
  noHaptics: boolean;
}) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  const left = point.x * frameW;
  const top = point.y * frameH;
  // Vector pointing from the face centre out to this anchor.
  const fromX = (frameW / 2 - left) * 0.6;
  const fromY = (frameH / 2 - top) * 0.6;

  useEffect(() => {
    const delay = startAt + order * STAGGER;
    progress.value = 0;
    pulse.value = 0;
    progress.value = withDelay(
      delay,
      reduceMotion
        ? withTiming(1, { duration: FADE_MS })
        : withSpring(1, { damping: 15, stiffness: 150, mass: 0.7 })
    );
    if (!reduceMotion) {
      pulse.value = withDelay(
        delay + 240,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) })
          ),
          -1,
          false
        )
      );
    }
    const tick = noHaptics ? undefined : setTimeout(hapticRigid, delay);
    return () => {
      if (tick) clearTimeout(tick);
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [noHaptics, order, playToken, progress, pulse, reduceMotion, startAt]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: fromX * (1 - progress.value) },
      { translateY: fromY * (1 - progress.value) },
      { scale: 0.55 + 0.45 * progress.value },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 - 0.4 * pulse.value,
    transform: [{ scale: 1 + 0.9 * pulse.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.pillWrap,
        { top },
        point.side === "left" ? { left } : { right: frameW - left },
        pillStyle,
      ]}
    >
      <View style={s.pill}>
        <View style={s.dotWrap}>
          <Animated.View style={[s.dotHalo, haloStyle]} />
          <View style={s.dot} />
        </View>
        <T style={s.pillLabel}>{point.label}</T>
      </View>
    </Animated.View>
  );
}

/* ── Scanner chrome ────────────────────────────────────────────────── */

// Each bracket is two plain bars. No per-side border widths and no corner
// radius: asymmetric borders combined with a radius are the one construct
// iOS border drawing handles badly.
export function CornerBrackets() {
  const arm = ms(30);
  const bar = 3;
  const inset = ms(14);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[s.bar, { top: inset, left: inset, width: arm, height: bar }]} />
      <View style={[s.bar, { top: inset, left: inset, width: bar, height: arm }]} />

      <View style={[s.bar, { top: inset, right: inset, width: arm, height: bar }]} />
      <View style={[s.bar, { top: inset, right: inset, width: bar, height: arm }]} />

      <View style={[s.bar, { bottom: inset, left: inset, width: arm, height: bar }]} />
      <View style={[s.bar, { bottom: inset, left: inset, width: bar, height: arm }]} />

      <View style={[s.bar, { bottom: inset, right: inset, width: arm, height: bar }]} />
      <View style={[s.bar, { bottom: inset, right: inset, width: bar, height: arm }]} />
    </View>
  );
}

export function Reticle({ w, h }: { w: number; h: number }) {
  const cols = 5;
  const rows = 7;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[1, 2, 3, 4].map((i) => (
        <View key={`c${i}`} style={[s.gridV, { left: Math.round((i * w) / cols) }]} />
      ))}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={`r${i}`} style={[s.gridH, { top: Math.round((i * h) / rows) }]} />
      ))}
    </View>
  );
}

/* ── Stage: the scanner frame on its own ───────────────────────────── */

export function WeakPointsScanStage({
  points = DEFAULT_WEAK_POINTS,
  width,
  height,
  style,
  startDelay = 0,
  noHaptics = false,
  noImage = false,
  staticMode = false,
  noPills = false,
  noChrome = false,
  noSweep = false,
  playToken: externalPlayToken,
}: Diagnostics & {
  points?: WeakPoint[];
  width?: number;
  height?: number;
  style?: ViewStyle;
  /** Delay the whole sweep, so a host screen can land its copy first. */
  startDelay?: number;
  /** Change this to replay without remounting. */
  playToken?: number;
}) {
  const reduceMotion = useReducedMotion() || staticMode;
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [localToken, setLocalToken] = useState(0);
  const playToken = externalPlayToken ?? localToken;

  const scan = useSharedValue(0);
  const veil = useSharedValue(1);

  const ordered = useMemo(
    () =>
      points
        .map((point) => ({ point }))
        .sort((a, b) => a.point.y - b.point.y)
        .map((entry, order) => ({ ...entry, order })),
    [points]
  );

  const revealAt = startDelay + SCAN_START + SCAN_MS - REVEAL_LEAD;

  useEffect(() => {
    scan.value = 0;
    veil.value = 1;
    scan.value = withDelay(
      startDelay + SCAN_START,
      withTiming(1, { duration: SCAN_MS, easing: Easing.inOut(Easing.cubic) })
    );
    veil.value = withDelay(
      startDelay + SCAN_START + SCAN_MS - 500,
      withTiming(0, { duration: 600 })
    );
    return () => {
      cancelAnimation(scan);
      cancelAnimation(veil);
    };
  }, [playToken, scan, startDelay, veil]);

  const bandH = ms(120);

  const bandStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : 0,
    transform: [{ translateY: -bandH + scan.value * (frame.h + bandH) }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : 0,
    transform: [{ translateY: scan.value * frame.h }],
  }));

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value * 0.55 }));

  return (
    <View
      style={[s.frame, width ? { width } : null, height ? { height } : null, style]}
      onLayout={(e) =>
        setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {!noImage && <Image source={FACE} style={s.face} resizeMode="contain" />}
      <Animated.View style={[StyleSheet.absoluteFill, s.veil, veilStyle]} pointerEvents="none" />

      {frame.w > 0 && (
        <>
          {!noChrome && <Reticle w={frame.w} h={frame.h} />}

          {!noSweep && (
            <>
              <Animated.View style={[s.band, { height: bandH }, bandStyle]} pointerEvents="none">
                <LinearGradient
                  colors={["rgba(242,106,19,0)", "rgba(242,106,19,0.16)", "rgba(242,106,19,0.02)"]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View style={[s.scanLine, lineStyle]} pointerEvents="none" />
            </>
          )}

          {!noChrome && <CornerBrackets />}

          {!noPills &&
            ordered.map(({ point, order }) => (
              <AlertPill
                key={point.id}
                point={point}
                order={order}
                startAt={revealAt}
                frameW={frame.w}
                frameH={frame.h}
                playToken={playToken}
                reduceMotion={reduceMotion}
                noHaptics={noHaptics}
              />
            ))}
        </>
      )}
    </View>
  );
}

/* ── Typewriter title ──────────────────────────────────────────────── */

function TypewriterTitle({
  text,
  playToken,
  reduceMotion,
  noHaptics,
}: {
  text: string;
  playToken: number;
  reduceMotion: boolean;
  noHaptics: boolean;
}) {
  const [shown, setShown] = useState(reduceMotion ? text.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (!noHaptics && i % TYPE_HAPTIC_EVERY === 0 && text[i - 1] !== " ") hapticTick();
      if (i >= text.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [noHaptics, playToken, reduceMotion, text]);

  return (
    <T variant="h2" style={s.title}>
      {text.slice(0, shown)}
      {shown < text.length ? (
        <T variant="h2" style={s.caret}>
          |
        </T>
      ) : null}
    </T>
  );
}

/* ── Full screen (dev preview) ─────────────────────────────────────── */

export default function WeakPointsScanScreen({
  points = DEFAULT_WEAK_POINTS,
  title = "Know your weak points",
  subtitle = "One scan maps 40+ facial metrics and flags exactly what is holding your score back.",
  ctaLabel = "Got it",
  onContinue,
  showReplay = false,
  ...diagnostics
}: Diagnostics & {
  points?: WeakPoint[];
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  onContinue?: () => void;
  showReplay?: boolean;
}) {
  const reduceMotion = useReducedMotion() || !!diagnostics.staticMode;
  const [playToken, setPlayToken] = useState(0);

  const subtitleIn = useSharedValue(0);
  const frameIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);

  const titleMs = reduceMotion ? 0 : title.length * TYPE_MS;
  const ctaAt = titleMs + SCAN_START + SCAN_MS - REVEAL_LEAD + points.length * STAGGER + 200;

  const play = useCallback(() => {
    const fade = { duration: FADE_MS, easing: Easing.out(Easing.cubic) };
    subtitleIn.value = 0;
    frameIn.value = 0;
    ctaIn.value = 0;

    subtitleIn.value = withDelay(titleMs + SUBTITLE_IN, withTiming(1, fade));
    frameIn.value = withDelay(titleMs + FRAME_IN, withTiming(1, fade));
    ctaIn.value = withDelay(ctaAt, withTiming(1, fade));

    setPlayToken((t) => t + 1);
  }, [ctaAt, ctaIn, frameIn, subtitleIn, titleMs]);

  useEffect(() => {
    play();
    return () => {
      cancelAnimation(subtitleIn);
      cancelAnimation(frameIn);
      cancelAnimation(ctaIn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scale the rise distances on the JS thread. `ms` is a plain JS function, so
  // calling it inside a worklet runs it on the UI thread and crashes the app.
  const subtitleRise = ms(10);
  const frameRise = ms(18);
  const ctaRise = ms(12);

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleIn.value,
    transform: [{ translateY: (1 - subtitleIn.value) * subtitleRise }],
  }));

  const frameStyle = useAnimatedStyle(() => ({
    opacity: frameIn.value,
    transform: [{ translateY: (1 - frameIn.value) * frameRise }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: (1 - ctaIn.value) * ctaRise }],
  }));

  return (
    <View style={s.root}>
      <ScreenBackground mood="amber" />
      <View style={s.header}>
        <TypewriterTitle
          text={title}
          playToken={playToken}
          reduceMotion={reduceMotion}
          noHaptics={!!diagnostics.noHaptics}
        />
        <Animated.View style={subtitleStyle}>
          <T variant="body" style={s.subtitle}>
            {subtitle}
          </T>
        </Animated.View>
      </View>

      <Animated.View style={[s.stageSlot, frameStyle]}>
        <WeakPointsScanStage
          points={points}
          playToken={playToken}
          startDelay={titleMs}
          style={s.stageInScreen}
          {...diagnostics}
        />
      </Animated.View>

      <View style={s.footer}>
        {showReplay && (
          <Pressable onPress={play} hitSlop={12} style={s.replay}>
            <T variant="caption" style={s.replayText}>
              ↻  Replay scan
            </T>
          </Pressable>
        )}
        <Animated.View style={[s.ctaWrap, ctaStyle]}>
          <OrangePrimaryButton
            label={ctaLabel}
            onPress={() => onContinue?.()}
            fontFamily={ORANGE_ONBOARDING.fontBold}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_MOODS.amber.bottom },

  header: { paddingHorizontal: sw(24), paddingTop: sh(44), gap: sh(10) },
  title: {
    fontFamily: ORANGE_ONBOARDING.fontBold,
    color: INK,
    letterSpacing: -0.6,
  },
  caret: { color: ORANGE, fontFamily: ORANGE_ONBOARDING.fontBold },
  subtitle: {
    fontFamily: ORANGE_ONBOARDING.fontRegular,
    color: ORANGE_ONBOARDING.muted,
    lineHeight: ms(20),
  },

  stageSlot: { flex: 1, marginTop: sh(36), marginBottom: sh(28) },
  stageInScreen: { flex: 1, marginHorizontal: sw(20) },

  frame: {
    borderRadius: ms(30),
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    overflow: "hidden",
    backgroundColor: ORANGE_ONBOARDING.surface,
  },
  face: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.16 }],
  },
  veil: { backgroundColor: ORANGE_ONBOARDING.surface },

  band: { position: "absolute", left: 0, right: 0, top: 0 },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  bar: { position: "absolute", backgroundColor: ORANGE, borderRadius: 2 },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(5,5,5,0.05)" },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(5,5,5,0.05)" },

  pillWrap: { position: "absolute", maxWidth: "62%" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(7),
    paddingVertical: ms(7),
    paddingHorizontal: ms(11),
    borderRadius: ms(999),
    backgroundColor: ORANGE_ONBOARDING.surface,
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    shadowColor: "#050505",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  pillLabel: {
    fontFamily: ORANGE_ONBOARDING.fontSemibold,
    fontSize: ms(12.5),
    lineHeight: ms(15),
    color: INK,
    letterSpacing: -0.2,
  },
  dotWrap: { width: ms(9), height: ms(9), alignItems: "center", justifyContent: "center" },
  dotHalo: {
    position: "absolute",
    width: ms(9),
    height: ms(9),
    borderRadius: ms(9),
    backgroundColor: ALERT,
  },
  dot: { width: ms(7), height: ms(7), borderRadius: ms(7), backgroundColor: ALERT },

  footer: {
    paddingHorizontal: sw(24),
    paddingTop: sh(6),
    paddingBottom: sh(36),
    gap: sh(14),
    alignItems: "center",
  },
  ctaWrap: { width: "100%" },
  replay: { paddingVertical: sh(4) },
  replayText: {
    fontFamily: ORANGE_ONBOARDING.fontSemibold,
    color: ORANGE_ONBOARDING.muted,
  },
});
