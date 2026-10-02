// app/analysis-reveal.tsx
// The payoff of the pre-paywall "locked findings" screen. Same ground, same
// scanner frame, same callouts: after one sweep the callouts sit on the
// user's real problems, their blurred lines come into focus one by one, and
// the selected problem is traced on the face (spotlit when detection could
// not place it). A detail card below explains it and how it improves.
//
// Flow: loading → here → /analysis (full breakdown) → plan-intro.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";
import { Eye, TrendingUp } from "lucide-react-native";

import T from "@/components/ui/T";
import ScreenBackground from "@/components/onboarding/ScreenBackground";
import { ORANGE_ONBOARDING, OrangePrimaryButton } from "@/components/onboarding/OrangeOnboardingLayout";
import { CornerBrackets, Reticle } from "@/components/onboarding/WeakPointsScanScreen";
import FaceStage, { REVEAL_MINT, toStagePoint } from "@/components/analysisReveal/FaceStage";
import RevealShareCard, { SHARE_CARD_H, SHARE_CARD_W } from "@/components/analysisReveal/RevealShareCard";
import { getAdvancedAnalysisIcon, getAdvancedAnalysisIconStyle } from "@/lib/advancedAnalysisIcons";
import { pickHighlights, severityOf, type Highlight, type Shape } from "@/lib/analysisHighlights";
import { faceGeometryWithin, type FaceGeometry, type Point } from "@/lib/faceLandmarks";
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { captureAndShare } from "@/lib/shareCard";
import { ms, sh, sw } from "@/lib/responsive";
import { BG_MOODS } from "@/lib/tokens";
import { useAdvancedAnalysis } from "@/store/advancedAnalysis";
import { useOnboarding } from "@/store/onboarding";
import { useScores } from "@/store/scores";

const ORANGE = ORANGE_ONBOARDING.orange;
const INK = ORANGE_ONBOARDING.text;
const MUTED = ORANGE_ONBOARDING.muted;
const ALERT = "#E5484D";
const MINT_INK = "#2E8B57";

/* Timing — mirrors the locked screen, then adds the unblur. */
// The whole reveal settles in about three seconds: the sweep runs while the
// headline types, and the callouts unblur in quick succession.
const TYPE_MS = 18;
const SCAN_START = 250;
const SCAN_MS = 1000;
const PILL_STAGGER = 130;
const UNBLUR_GAP = 240;
// Longest the screen waits for face detection before drawing with estimates.
const DETECT_WAIT_MS = 700;
const AUTO_CYCLE_MS = 3600;

const PILL_H = ms(50);
const PILL_GAP = ms(8);
const EDGE = ms(8);

type Item = { h: Highlight; tone: "problem" | "strength" };

/* ── Anchors: one distinct point per shape, so two jaw problems don't
      share a dot. Image-left/right, not the subject's. ───────────────── */

function anchorFor(shape: Shape, g: FaceGeometry): Point {
  const b = g.faceBox;
  const at = (fx: number, fy: number): Point => ({ x: b.x + b.w * fx, y: b.y + b.h * fy });
  const rightOf = (pair?: [Point, Point]) => (pair ? (pair[0].x > pair[1].x ? pair[0] : pair[1]) : undefined);
  const leftOf = (pair?: [Point, Point]) => (pair ? (pair[0].x < pair[1].x ? pair[0] : pair[1]) : undefined);
  const mean = (pts?: Point[]) =>
    pts?.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : undefined;
  const eyesByX = g.leftEye && g.rightEye ? [mean(g.leftEye)!, mean(g.rightEye)!].sort((a, c) => a.x - c.x) : undefined;
  const browsByX = g.leftBrow && g.rightBrow ? [mean(g.leftBrow)!, mean(g.rightBrow)!].sort((a, c) => a.x - c.x) : undefined;

  switch (shape) {
    case "jawTrace":
      return g.chin ?? at(0.5, 0.97);
    case "jawCorners":
      return rightOf(g.jawCorners) ?? at(0.84, 0.78);
    case "lowerFace":
    case "profile":
      return leftOf(g.jawCorners) ?? at(0.18, 0.8);
    case "eyeTilt":
      return eyesByX?.[1] ?? at(0.7, 0.4);
    case "eyes":
      return eyesByX?.[0] ?? at(0.3, 0.4);
    case "brows":
      return browsByX?.[0] ?? at(0.3, 0.29);
    case "cheekWidth":
      return rightOf(g.cheekbones) ?? at(0.9, 0.53);
    case "faceRatio":
      return leftOf(g.cheekbones) ?? at(0.1, 0.53);
    case "midface": {
      const cheek = leftOf(g.cheekbones);
      return cheek && g.noseBottom ? { x: (cheek.x + g.noseBottom.x) / 2, y: (cheek.y + g.noseBottom.y) / 2 } : at(0.32, 0.62);
    }
    case "skin":
      return at(0.64, 0.14);
    case "hairline":
      return mean(g.hairline) ?? at(0.5, 0.02);
  }
}

/* ── Callout layout: pills hug the frame edges, stacked without overlap,
      each joined to its anchor by a thin line. ───────────────────────── */

type Placed = { item: Item; anchor: Point; side: "left" | "right"; top: number };

function layoutPills(items: Item[], g: FaceGeometry, fw: number, fh: number): Placed[] {
  const placed = items.map((item) => {
    const raw = toStagePoint(anchorFor(item.h.shape, g), g, fw, fh);
    // The frame crops the photo; keep every dot inside it.
    const anchor = { x: Math.min(fw - 10, Math.max(10, raw.x)), y: Math.min(fh - 10, Math.max(10, raw.y)) };
    return { item, anchor, side: (anchor.x < fw / 2 ? "left" : "right") as "left" | "right", top: 0 };
  });
  // Balance: no side carries more than three.
  for (const side of ["left", "right"] as const) {
    const onSide = placed.filter((p) => p.side === side).sort((a, b) => Math.abs(a.anchor.x - fw / 2) - Math.abs(b.anchor.x - fw / 2));
    while (onSide.length > 3) onSide.shift()!.side = side === "left" ? "right" : "left";
  }
  for (const side of ["left", "right"] as const) {
    const col = placed.filter((p) => p.side === side).sort((a, b) => a.anchor.y - b.anchor.y);
    let cursor = EDGE;
    for (const p of col) {
      // Sit above the dot; near the top of the frame, sit below it instead.
      const above = p.anchor.y - PILL_H - ms(14);
      const preferred = above >= EDGE ? above : p.anchor.y + ms(14);
      p.top = Math.max(cursor, Math.min(preferred, fh - PILL_H - EDGE));
      cursor = p.top + PILL_H + PILL_GAP;
    }
    // Pushed off the bottom: settle the column upwards.
    let floor = fh - EDGE;
    for (const p of [...col].reverse()) {
      if (p.top + PILL_H > floor) p.top = floor - PILL_H;
      floor = p.top - PILL_GAP;
    }
  }
  return placed;
}

/* ── Subtitle: written from this user's results, not one fixed line ── */

const GOAL_LABELS: Record<string, string> = {
  jawline: "jawline",
  cheekbones: "cheekbones",
  eyes: "eyes",
  skin: "skin",
  symmetry: "symmetry",
};

function subtitleFor(
  highlights: ReturnType<typeof pickHighlights> | null,
  goals: string[] | undefined,
): string {
  const top = highlights?.problems[0];
  if (!top) return "Tap a problem to see it on your face.";
  const biggest = top.label.toLowerCase();
  // The top problem sits in an area they said they want to fix.
  const goalHit = (goals ?? []).find((g) => GOAL_LABELS[g] && top.group === (g === "symmetry" ? "eyes" : g));
  if (goalHit) return `Your ${GOAL_LABELS[goalHit]} goal was right: ${biggest} is the biggest one. Tap any to see it.`;
  if (highlights?.strength) {
    return `Biggest: ${biggest}. Your ${highlights.strength.label.toLowerCase()} is already a strength. Tap any to see it.`;
  }
  if (top.score < 40) return `${top.label} needs the most work. Tap any problem to see it on your face.`;
  return `Biggest: ${biggest}. Tap any problem to see it on your face.`;
}

/* ── Headline ──────────────────────────────────────────────────────── */

function TypedHeadline({ parts, reduceMotion }: { parts: { text: string; accent?: boolean }[]; reduceMotion: boolean }) {
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  const [shown, setShown] = useState(reduceMotion ? total : 0);
  useEffect(() => {
    if (reduceMotion) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i % 3 === 0) hapticSelection();
      if (i >= total) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [reduceMotion, total]);

  let left = shown;
  return (
    <T variant="h2" style={styles.title} accessibilityRole="header" accessibilityLabel={parts.map((p) => p.text).join("").replace("\n", " ")}>
      {parts.map((part, i) => {
        const take = Math.max(0, Math.min(part.text.length, left));
        left -= take;
        return take ? (
          <T key={i} variant="h2" style={[styles.title, part.accent && styles.accent]}>
            {part.text.slice(0, take)}
          </T>
        ) : null;
      })}
    </T>
  );
}

/* ── Pill ──────────────────────────────────────────────────────────── */

function Pill({
  placed,
  width,
  selected,
  popAt,
  clearAt,
  onPress,
}: {
  placed: Placed;
  width: number;
  selected: boolean;
  popAt: number;
  clearAt: number;
  onPress: () => void;
}) {
  const { item, side, top } = placed;
  const pop = useSharedValue(0);
  const clear = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(popAt, withSpring(1, { damping: 14, stiffness: 160, mass: 0.7 }));
    clear.value = withDelay(clearAt, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    const t1 = setTimeout(hapticLight, popAt);
    const t2 = setTimeout(hapticSelection, clearAt + 120);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimation(pop);
      cancelAnimation(clear);
    };
  }, [clear, clearAt, pop, popAt]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.7 + 0.3 * pop.value }],
  }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: 1 - clear.value }));

  const strength = item.tone === "strength";
  const dot = strength ? REVEAL_MINT : ALERT;
  const line2 = item.h.verdict || severityOf(item.h.score);

  return (
    <Animated.View style={[styles.pillWrap, { top, width }, side === "left" ? { left: EDGE } : { right: EDGE }, popStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.h.label}, ${item.h.score} out of 100. ${line2}`}
        style={[styles.pill, selected && (strength ? styles.pillSelectedMint : styles.pillSelected)]}
      >
        <View style={styles.pillHead}>
          <View style={[styles.pillDot, { backgroundColor: dot }]} />
          <T style={styles.pillLabel} numberOfLines={1}>
            {item.h.label}
          </T>
          <T style={[styles.pillScore, { color: strength ? MINT_INK : ALERT }]}>{item.h.score}</T>
        </View>
        <View style={styles.pillLine}>
          <T style={styles.pillLineText} numberOfLines={1}>
            {line2}
          </T>
          <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
            <BlurView tint="light" intensity={30} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ── Detail card ───────────────────────────────────────────────────── */

// The body keeps one height per screen, hidden or revealed, so the face frame
// above (flex: 1) never resizes and the callouts never re-place. Without AI
// comments it only has to fit the two-line lever text.
const REMARK_LINE = ms(20);
const REMARK_LINES = 3;
const LEVER_ROW_H = ms(32);
const DETAIL_BODY_H = REMARK_LINE * REMARK_LINES + LEVER_ROW_H;
const DETAIL_BODY_COMPACT_H = REMARK_LINE * 2;

function DetailCard({
  item,
  eyebrow,
  compact,
  revealed,
  reduceMotion,
  onReveal,
}: {
  item: Item;
  compact: boolean;
  eyebrow: string;
  revealed: boolean;
  reduceMotion: boolean;
  onReveal: () => void;
}) {
  const { h } = item;
  const strength = item.tone === "strength";
  const accent = strength ? MINT_INK : ALERT;
  const icon = getAdvancedAnalysisIcon(h.id);
  const [lineCount, setLineCount] = useState(0);
  // A one-line comment has nothing to hide.
  const open = revealed || !h.remark || (lineCount > 0 && lineCount <= 1);
  const body = h.remark || h.lever;
  const showLever = !strength && !!h.remark && open;

  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <View style={[styles.detailIconTile, { backgroundColor: strength ? "#E7F5EC" : "#FDECEC" }]}>
          {icon ? (
            <Image source={icon} style={[styles.detailIcon, getAdvancedAnalysisIconStyle(h.id)]} resizeMode="contain" />
          ) : null}
        </View>
        <View style={styles.detailHeadCopy}>
          <T style={styles.detailTitle} numberOfLines={1}>
            {h.label}
          </T>
          <View style={styles.severityRow}>
            <View style={[styles.severityDot, { backgroundColor: accent }]} />
            <T style={[styles.severityText, { color: accent }]}>{eyebrow}</T>
          </View>
        </View>
        <T style={[styles.detailScore, { color: accent }]}>
          {h.score}
          <T style={styles.detailScoreMax}>/100</T>
        </T>
      </View>

      <View style={{ height: compact ? DETAIL_BODY_COMPACT_H : DETAIL_BODY_H }}>
        {open ? (
          <>
            <ScrollView
              style={styles.remarkScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <T style={styles.remarkText}>{body}</T>
            </ScrollView>
            {showLever ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.delay(120).duration(260)}
                style={styles.leverRow}
              >
                <TrendingUp size={ms(15)} color={MINT_INK} strokeWidth={2.6} />
                <T style={styles.leverText} numberOfLines={1}>
                  {h.lever}
                </T>
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={onReveal}
            accessibilityRole="button"
            accessibilityLabel={`Read the full comment on your ${h.label.toLowerCase()}`}
            style={StyleSheet.absoluteFill}
          >
            <T
              style={styles.remarkText}
              numberOfLines={REMARK_LINES + 1}
              onTextLayout={(e) => setLineCount(e.nativeEvent.lines.length)}
            >
              {body}
            </T>
          </Pressable>
        )}
        {!open ? (
          <Animated.View
            exiting={reduceMotion ? undefined : FadeOut.duration(220)}
            pointerEvents="none"
            style={[styles.remarkVeil, { top: REMARK_LINE }]}
          >
            <BlurView tint="light" intensity={28} style={StyleSheet.absoluteFill} />
            <View style={styles.revealPill}>
              <Eye size={ms(14)} color={INK} strokeWidth={2.6} />
              <T style={styles.revealPillText}>Tap to read</T>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/* ── Screen ────────────────────────────────────────────────────────── */

export default function AnalysisRevealScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ onboardingFlow?: string }>();
  const onboardingFlow = params.onboardingFlow === "1";

  const data = useAdvancedAnalysis((s) => s.data);
  const frontUri = useScores((s) => s.imageUri);
  const sideUri = useScores((s) => s.sideImageUri);
  const goals = useOnboarding((s) => s.data.goals);

  const [geometry, setGeometry] = useState<FaceGeometry | null | "missing">(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [hideFace, setHideFace] = useState(false);
  const [sharing, setSharing] = useState(false);
  const userPicked = useRef(false);
  const shareRef = useRef<View>(null);

  const finish = useCallback(() => {
    router.replace({ pathname: "/analysis", params: onboardingFlow ? { onboardingFlow: "1" } : {} });
  }, [onboardingFlow]);

  useEffect(() => {
    let alive = true;
    if (!frontUri) {
      setGeometry("missing");
      return;
    }
    void faceGeometryWithin(frontUri, DETECT_WAIT_MS).then((g) => alive && setGeometry(g ?? "missing"));
    return () => {
      alive = false;
    };
  }, [frontUri]);

  const highlights = useMemo(
    () => (data ? pickHighlights(data, { goals, hasSidePhoto: !!sideUri }) : null),
    [data, goals, sideUri],
  );
  const items = useMemo<Item[]>(() => {
    if (!highlights) return [];
    const list: Item[] = highlights.problems.map((h) => ({ h, tone: "problem" }));
    if (highlights.strength) list.push({ h: highlights.strength, tone: "strength" });
    return list;
  }, [highlights]);

  // Nothing to reveal: go straight to the full analysis.
  useEffect(() => {
    if (geometry === "missing" || (geometry && (!highlights || highlights.problems.length === 0))) finish();
  }, [geometry, highlights, finish]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, []),
  );

  const count = highlights?.problems.length ?? 0;
  const subtitle = useMemo(() => subtitleFor(highlights, goals), [highlights, goals]);
  const headline = useMemo(
    () => [{ text: "We found " }, { text: `${count} problems`, accent: true }, { text: "\nholding your face back." }],
    [count],
  );
  const sweepEnd = SCAN_START + SCAN_MS;
  const popAt = (i: number) => (reduceMotion ? 0 : sweepEnd - 250 + i * PILL_STAGGER);
  const clearAt = (i: number) => (reduceMotion ? 0 : sweepEnd + items.length * PILL_STAGGER + 250 + i * UNBLUR_GAP);
  const revealDone = clearAt(items.length - 1) + 400;

  // Once every line is readable, select the first problem, then walk the
  // problems until the user taps one themselves.
  useEffect(() => {
    if (!items.length || geometry === null || geometry === "missing") return;
    const start = setTimeout(() => {
      if (userPicked.current) return;
      hapticMedium();
      setSelected(0);
    }, revealDone);
    return () => clearTimeout(start);
  }, [geometry, items.length, revealDone]);

  useEffect(() => {
    if (selected === null || userPicked.current || reduceMotion) return;
    const next = setTimeout(() => {
      if (userPicked.current) return;
      setSelected((s) => (s === null ? 0 : (s + 1) % items.length));
    }, AUTO_CYCLE_MS);
    return () => clearTimeout(next);
  }, [selected, items.length, reduceMotion]);

  // Comments the user has unblurred; they stay open when switching callouts.
  const [revealed, setRevealed] = useState<Record<string, true>>({});
  const reveal = useCallback((id: string) => {
    userPicked.current = true;
    hapticLight();
    setRevealed((prev) => ({ ...prev, [id]: true }));
  }, []);

  const pick = useCallback((i: number) => {
    userPicked.current = true;
    hapticSelection();
    setSelected(i);
  }, []);

  // Scan sweep, once.
  const scan = useSharedValue(0);
  const frameIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  useEffect(() => {
    frameIn.value = withTiming(1, { duration: 320 });
    if (!reduceMotion) {
      scan.value = withDelay(SCAN_START, withTiming(1, { duration: SCAN_MS, easing: Easing.inOut(Easing.cubic) }));
    }
    // The button is usable as soon as the callouts are up; nobody waits for
    // the unblur to finish.
    ctaIn.value = withDelay(reduceMotion ? 0 : sweepEnd, withTiming(1, { duration: 360 }));
    const done = reduceMotion ? undefined : setTimeout(hapticSuccess, revealDone - 300);
    return () => {
      if (done) clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

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
  const frameStyle = useAnimatedStyle(() => ({ opacity: frameIn.value, transform: [{ translateY: (1 - frameIn.value) * 18 }] }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaIn.value, transform: [{ translateY: (1 - ctaIn.value) * 12 }] }));

  const onShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await captureAndShare(shareRef, { dialogTitle: "Share your glow-up plan" });
    } catch {
      // Dismissed or unavailable: nothing to do.
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  if (geometry === null || geometry === "missing" || !highlights || !items.length || !frontUri) {
    return (
      <View style={[styles.root, styles.center]}>
        <ScreenBackground mood="amber" />
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  const placed = frame.w ? layoutPills(items, geometry, frame.w, frame.h) : [];
  const pillW = Math.min(frame.w * 0.46, ms(188));
  const current = selected !== null ? items[selected] : null;
  const hasRemarks = items.some((item) => !!item.h.remark);
  const shareScale = Math.min((screenW - 64) / SHARE_CARD_W, 0.9);

  return (
    <View style={styles.root}>
      <ScreenBackground mood="amber" />

      <View style={[styles.header, { paddingTop: insets.top + sh(18) }]}>
        <TypedHeadline parts={headline} reduceMotion={reduceMotion} />
        <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(400).duration(360)}>
          <T variant="body" style={styles.subtitle}>
            {subtitle}
          </T>
        </Animated.View>
      </View>

      <Animated.View style={[styles.stageSlot, frameStyle]}>
        <View
          style={styles.frame}
          onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {frame.w > 0 ? (
            <>
              <FaceStage
                uri={frontUri}
                geometry={geometry}
                width={frame.w}
                height={frame.h}
                focus={current ? { shape: current.h.shape, tone: current.tone } : null}
                playToken={selected ?? -1}
                camera={false}
                grade={false}
              />
              <Reticle w={frame.w} h={frame.h} />
              {!reduceMotion ? (
                <>
                  <Animated.View style={[styles.band, { height: bandH }, bandStyle]} pointerEvents="none">
                    <LinearGradient
                      colors={["rgba(242,106,19,0)", "rgba(242,106,19,0.22)", "rgba(242,106,19,0.02)"]}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  <Animated.View style={[styles.scanLine, lineStyle]} pointerEvents="none" />
                </>
              ) : null}
              <CornerBrackets />

              {/* Leader lines and anchor dots */}
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {placed.map((p, i) => {
                  // The stem leaves the pill edge nearest the dot, so it
                  // never crosses the pill itself.
                  const pillLeft = p.side === "left" ? EDGE : frame.w - EDGE - pillW;
                  const x = Math.min(pillLeft + pillW - 14, Math.max(pillLeft + 14, p.anchor.x));
                  const y = p.anchor.y > p.top + PILL_H / 2 ? p.top + PILL_H : p.top;
                  const active = selected === i;
                  const color = p.item.tone === "strength" ? REVEAL_MINT : ALERT;
                  return (
                    <React.Fragment key={p.item.h.id}>
                      <Line x1={x} y1={y} x2={p.anchor.x} y2={p.anchor.y} stroke="#FFFFFF" strokeOpacity={active ? 0.95 : 0.6} strokeWidth={active ? 1.5 : 1} />
                      <Circle cx={p.anchor.x} cy={p.anchor.y} r={active ? 7 : 5.5} fill={color} fillOpacity={0.3} />
                      <Circle cx={p.anchor.x} cy={p.anchor.y} r={3.5} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
                    </React.Fragment>
                  );
                })}
              </Svg>

              {placed.map((p, i) => (
                <Pill
                  key={p.item.h.id}
                  placed={p}
                  width={pillW}
                  selected={selected === i}
                  popAt={popAt(i)}
                  clearAt={clearAt(i)}
                  onPress={() => pick(i)}
                />
              ))}
            </>
          ) : null}
        </View>
      </Animated.View>

      {/* Detail for the selected callout */}
      <View style={styles.detailSlot}>
        {current ? (
          <Animated.View key={current.h.id} entering={reduceMotion ? undefined : FadeInDown.duration(320)}>
            <DetailCard
              item={current}
              eyebrow={current.tone === "strength" ? "Your strongest feature" : severityOf(current.h.score)}
              compact={!hasRemarks}
              revealed={!!revealed[current.h.id]}
              reduceMotion={reduceMotion}
              onReveal={() => reveal(current.h.id)}
            />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + sh(12) }, ctaStyle]}>
        <OrangePrimaryButton
          label="See Full Breakdown"
          onPress={() => {
            hapticSuccess();
            finish();
          }}
          fontFamily={ORANGE_ONBOARDING.fontBold}
        />
        <Pressable
          onPress={() => {
            hapticLight();
            setShareOpen(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <T style={styles.shareLink}>Share my glow-up plan</T>
        </Pressable>
      </Animated.View>

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={{ width: SHARE_CARD_W * shareScale, height: SHARE_CARD_H * shareScale }}>
            <View style={{ transform: [{ scale: shareScale }], transformOrigin: "top left" }}>
              <RevealShareCard
                ref={shareRef}
                uri={frontUri}
                geometry={geometry}
                problems={highlights.problems}
                hideFace={hideFace}
              />
            </View>
          </View>
          <Pressable
            onPress={() => {
              hapticSelection();
              setHideFace((v) => !v);
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: hideFace }}
            style={styles.toggleRow}
          >
            <View style={[styles.toggle, hideFace && styles.toggleOn]}>
              <View style={[styles.knob, hideFace && styles.knobOn]} />
            </View>
            <T style={styles.toggleText}>Hide my face</T>
          </Pressable>
          <View style={styles.modalActions}>
            <OrangePrimaryButton label={sharing ? "Sharing…" : "Share"} onPress={onShare} fontFamily={ORANGE_ONBOARDING.fontBold} />
            <Pressable onPress={() => setShareOpen(false)} hitSlop={8} accessibilityRole="button">
              <T style={styles.modalClose}>Close</T>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_MOODS.amber.bottom },
  center: { alignItems: "center", justifyContent: "center" },

  header: { paddingHorizontal: sw(24), gap: sh(6) },
  title: { fontFamily: ORANGE_ONBOARDING.fontBold, color: INK, letterSpacing: -0.6 },
  accent: { color: ORANGE },
  subtitle: { fontFamily: ORANGE_ONBOARDING.fontRegular, color: MUTED, lineHeight: ms(20) },

  stageSlot: { flex: 1, marginTop: sh(16), marginBottom: sh(12), paddingHorizontal: sw(16) },
  frame: {
    flex: 1,
    borderRadius: ms(28),
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    overflow: "hidden",
    backgroundColor: ORANGE_ONBOARDING.surface,
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

  pillWrap: { position: "absolute", height: PILL_H },
  pill: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: ms(10),
    borderRadius: ms(14),
    backgroundColor: ORANGE_ONBOARDING.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: ms(3),
    shadowColor: "#050505",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  pillSelected: { borderColor: ALERT },
  pillSelectedMint: { borderColor: REVEAL_MINT },
  pillHead: { flexDirection: "row", alignItems: "center", gap: ms(6) },
  pillDot: { width: ms(7), height: ms(7), borderRadius: ms(7) },
  pillLabel: { flex: 1, fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(12.5), lineHeight: ms(15), color: INK },
  pillScore: { fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(13), lineHeight: ms(15) },
  pillLine: { borderRadius: ms(5), overflow: "hidden" },
  pillLineText: { fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: ms(11.5), lineHeight: ms(15), color: MUTED },

  detailSlot: { minHeight: ms(150), paddingHorizontal: sw(16) },
  detail: {
    padding: ms(16),
    borderRadius: ms(22),
    backgroundColor: ORANGE_ONBOARDING.surface,
    borderWidth: 1,
    borderColor: ORANGE_ONBOARDING.border,
    gap: ms(12),
  },
  detailHead: { flexDirection: "row", alignItems: "center", gap: ms(12) },
  detailIconTile: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(14),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  detailIcon: { width: "88%", height: "88%" },
  detailHeadCopy: { flex: 1, minWidth: 0, gap: ms(2) },
  detailTitle: { fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(20), lineHeight: ms(24), color: INK },
  severityRow: { flexDirection: "row", alignItems: "center", gap: ms(6) },
  severityDot: { width: ms(7), height: ms(7), borderRadius: ms(7) },
  severityText: { fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(12.5) },
  detailScore: { fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(22) },
  detailScoreMax: { fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: ms(13), color: MUTED },
  remarkScroll: { flex: 1 },
  remarkText: { fontFamily: ORANGE_ONBOARDING.fontRegular, fontSize: ms(14.5), lineHeight: REMARK_LINE, color: INK },
  remarkVeil: {
    position: "absolute",
    left: -ms(4),
    right: -ms(4),
    bottom: 0,
    borderRadius: ms(12),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  revealPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(6),
    paddingHorizontal: ms(14),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  revealPillText: { fontFamily: ORANGE_ONBOARDING.fontBold, fontSize: ms(13.5), color: INK },
  leverRow: {
    height: LEVER_ROW_H,
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ORANGE_ONBOARDING.border,
  },
  leverText: { flex: 1, fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: ms(13), color: MINT_INK },
  footer: { paddingHorizontal: sw(24), paddingTop: sh(12), gap: sh(12), alignItems: "center" },
  shareLink: { fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: ms(14), color: MUTED, textDecorationLine: "underline" },

  modal: { flex: 1, backgroundColor: "rgba(11,11,12,0.94)", alignItems: "center", justifyContent: "center", gap: 16 },
  modalActions: { alignSelf: "stretch", paddingHorizontal: 32, gap: 14, alignItems: "center" },
  modalClose: { fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: 15, color: "rgba(255,255,255,0.8)" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggle: { width: 40, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", padding: 3 },
  toggleOn: { backgroundColor: ORANGE },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFFFFF" },
  knobOn: { transform: [{ translateX: 16 }] },
  toggleText: { fontFamily: ORANGE_ONBOARDING.fontSemibold, fontSize: 14, color: "#FFFFFF" },
});
