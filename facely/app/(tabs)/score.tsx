// C:\SS\facely\app\(tabs)\score.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
} from "react-native";

// ✅ default Text (Poppins)
import Text from "@/components/ui/T";

import { useScores } from "../../store/scores";
import { router, useLocalSearchParams } from "expo-router";
import { ImageBackground } from "react-native";
import { BlurView } from "expo-blur";

import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Text as SvgText,
  G,
} from "react-native-svg";

/* ============================================================================
   score.tsx — Swipeable metric graphs with glassmorphism score ring,
   percentile insight, tier milestone mini-bar, and Gumroad-style controls
   ========================================================================== */

// Animated SVG bits
const AnimatedCircle: any = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  pageBg: "#0A0B0C",                 // fallback under the image
  card: "rgba(0,0,0,0.22)",          // tint under blur
  cardBorder: "rgba(255,255,255,0.08)",

  textDark: "rgba(255,255,255,0.92)",
  textSubtle: "rgba(255,255,255,0.64)",

  grid: "rgba(255,255,255,0.06)",

  curveStart: "#8FA31E",
  curveEnd:   "#8FA31E",
  glow: "rgba(143,163,30,0.28)",
  ringTrack: "rgba(255,255,255,0.16)",

  chipBg: "rgba(0,0,0,0.28)",
  divider: "rgba(255,255,255,0.08)",
  progressTrack: "rgba(255,255,255,0.12)",
  progressFill:  "#8FA31E",
  lock: "#9AA2A9",
};

import { Platform } from "react-native";

const POP = Platform.select({
  ios: "Poppins-SemiBold",
  android: "Poppins-SemiBold",
  default: "Poppins-SemiBold",
});

type MetricItem = {
  key: string;
  score: number;         // 0..100
  percentile?: number;   // defaults to score
  icon?: 'jaw' | 'sym' | 'cheek' | 'dimorph' | 'skin' | 'eyesym' | 'nose' | 'sex';
  locked?: boolean;      // future gating if needed
};

// Full 8 metrics
const DEFAULT_METRICS: MetricItem[] = [
  { key: "Jawline", score: 64, percentile: 64, icon: "jaw" },
  { key: "Facial Symmetry", score: 72, percentile: 72, icon: "sym" },
  { key: "Cheekbones", score: 58, percentile: 58, icon: "cheek" },
  { key: "Masculinity/Femininity", score: 81, percentile: 83, icon: "dimorph" },
  { key: "Skin Quality", score: 69, percentile: 71, icon: "skin" },
  { key: "Eye Symmetry", score: 62, percentile: 60, icon: "eyesym" },
  { key: "Nose Balance", score: 74, percentile: 76, icon: "nose" },
];

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const roundPct = (n: number) => Math.round(n);
// Consistent percent text everywhere
const fmtPct = (n: number) => `${roundPct(n)}%`;

// ---- Per-metric anchors + neutral tier bounds ----
const TIER_BOUNDS = [
  { min: 0,  max: 30 },
  { min: 31, max: 60 },
  { min: 61, max: 80 },
  { min: 81, max: 100 },
] as const;

function tierIndexFor(score: number) {
  const s = clamp(score, 0, 100);
  if (s <= 30) return 0;
  if (s <= 60) return 1;
  if (s <= 80) return 2;
  return 3;
}

const ANCHORS: Record<string, [string, string, string, string]> = {
  "Jawline": ["Soft", "Average", "Sharp", "Elite"],
  "Cheekbones": ["Flat", "Moderate", "Projected", "Sculpted"],
  "Facial Symmetry": ["Tilted", "Slight offset", "Balanced", "Mirror-clean"],
  "Eye Symmetry": ["Uneven", "Slight offset", "Aligned", "Highly aligned"],
  "Skin Quality": ["Textured", "Mixed", "Clear", "Glassy"],
  "Nose Balance": ["Off-scale", "Acceptable", "Proportionate", "Seamless"],
  "Masculinity/Femininity": ["Subtle", "Mixed", "Clear", "Strong"],
};

function anchorsFor(title: string): [string, string, string, string] {
  return ANCHORS[title] ?? ["Developing", "Emerging", "Strong", "Elite"];
}

function tierLabelFor(metricTitle: string, score: number) {
  return anchorsFor(metricTitle)[tierIndexFor(score)];
}

function computeMilestone(score: number) {
  const i = tierIndexFor(score);
  const current = TIER_BOUNDS[i];
  const nextIndex = Math.min(3, i + 1);
  const next = TIER_BOUNDS[nextIndex];
  const remaining = Math.max(0, next.min - score);
  const pctToNext =
    next.min === current.min ? 1 : Math.min(1, (score - current.min) / (next.min - current.min));
  return { currentIndex: i, nextIndex, remaining, pctToNext };
}

// ---------------------------------------------------------------------------
// Geometry helpers — Catmull–Rom to Bezier
// ---------------------------------------------------------------------------
// NEW: simple polyline, no overshoot
function buildPolyline(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
}

function buildAnchors({
  innerW, innerH, x0, yTop, yBase, score,
}: { innerW: number; innerH: number; x0: number; yTop: number; yBase: number; score: number }) {
  const s = clamp(score, 0, 100);
  const A = s / 100;

  const xAt = (t: number) => x0 + t * innerW;
  const yForVal = (val: number) => yTop + (1 - clamp(val, 0, 100) / 100) * innerH;

  // draft values (may wiggle)
  const rough = [
    { t: 0.00, v: 2 },
    { t: 0.18, v: 28 + 16 * A },
    { t: 0.36, v: 38 + 10 * A },
    { t: A,    v: s },
    { t: 0.70, v: 60 + 30 * A },
    { t: 1.00, v: Math.max(s, 86 + 10 * A) },
  ].sort((a, b) => a.t - b.t);

  // enforce monotonic increase to kill any backward pivot
  let maxSoFar = 0;
  const mono = rough.map(p => {
    const nv = Math.max(maxSoFar, clamp(p.v, 0, 100));
    maxSoFar = nv;
    return { t: p.t, v: nv };
  });

  // to SVG points
  return mono.map(({ t, v }) => ({ x: xAt(t), y: yForVal(v) }));
}

// ---------------------------------------------------------------------------
// Header row: tiny icon chip + title + info button
// ---------------------------------------------------------------------------
function HeaderRow({ title, icon = 'jaw', onInfo }: { title: string; icon?: MetricItem['icon']; onInfo?: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.iconChip}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          {/* minimalist jaw icon */}
          <Path d="M4 9c0-3.5 3.2-6 8-6s8 2.5 8 6c0 4.5-3.5 9-8 9s-8-4.5-8-9z" fill="#DCE6EF"/>
          <Path d="M7 11c1.8 2.2 4 3.3 5 3.3S15.2 13.2 17 11" stroke="#0F0F0F" strokeWidth={1.4} strokeLinecap="round"/>
        </Svg>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Pressable hitSlop={8} onPress={onInfo} style={styles.infoBtn}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" fill="rgba(255,255,255,0.1)" />
          <Path d="M12 8.2a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z" fill="#FFFFFF"/>
          <Path d="M11.1 10.7h1.8v6.1h-1.8z" fill="#FFFFFF"/>
        </Svg>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// GlassRing: animated circular score
// ---------------------------------------------------------------------------
function GlassRing({ value, active }: { value: number; active: boolean }) {
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 850 : 250,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [active, value]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c, c * (1 - clamp(value, 0, 100) / 100)],
  });

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={COLORS.curveStart} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} />
          </LinearGradient>
        </Defs>

        {/* frosted inner puck */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 2}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1}
        />

        {/* track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />

        {/* animated stroke */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>

      {/* percent label */}
      <Animated.Text style={styles.ringText as any}>
        {`${roundPct(clamp(value, 0, 100))}%`}
      </Animated.Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// InsightBlock: percentile sentence + mini milestone progress bar
// ---------------------------------------------------------------------------
function InsightBlock({
  metricLabel,
  score,
  percentile = score,
  active,
}: { metricLabel: string; score: number; percentile?: number; active: boolean }) {
  const { remaining } = computeMilestone(score);

  const pct = Math.max(0, Math.min(100, percentile)) / 100;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? pct : 0,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    // lifted up slightly so it doesn’t collide with the card bottom
    <View style={styles.insightCol}>
      <Text style={styles.insightLead}>
        Your {metricLabel.toLowerCase()} is{" "}
        <Text style={styles.bold}>
          {tierLabelFor(metricLabel, score)} · {roundPct(percentile)}%
        </Text>
      </Text>

      {/* tiny milestone/progress bar */}
      <View style={styles.miniBar}>
        <Animated.View style={[styles.miniFill, { width }]} />
        <View style={styles.miniLockWrap}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M7 10V8a5 5 0 0 1 10 0v2" stroke={COLORS.lock} strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <Path d="M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z" fill={COLORS.lock} opacity={0.35} />
          </Svg>
        </View>
      </View>

      <Text style={styles.miniLabel}>
        Next:{" "}
        <Text style={styles.bold}>
          {anchorsFor(metricLabel)[Math.min(3, tierIndexFor(score) + 1)]}
        </Text>{" "}
        (-{Math.max(0, Math.round(remaining))})
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MetricCard: full card with header, graph, ring + insight, milestone bar
// ---------------------------------------------------------------------------
function MetricCard({ item, width, active }: { item: MetricItem; width: number; active: boolean }) {
  const { key: title, score, percentile, icon } = item;

  const graphH = 280;
  const leftPad = 36;
  const rightPad = 16;
  const topPad = 24;
  const bottomPad = 56;

  const innerW = width - leftPad - rightPad;
  const innerH = graphH - topPad - bottomPad;
  const yBase = graphH - bottomPad;

  const anchors = useMemo(
    () => buildAnchors({ innerW, innerH, x0: leftPad, yTop: topPad, yBase, score }),
    [innerW, innerH, leftPad, topPad, yBase, score]
  );
  const strokePath = useMemo(() => buildPolyline(anchors), [anchors]);
  const fillPath = useMemo(() => {
    const first = anchors[0];
    const last  = anchors[anchors.length - 1];
    return [
      `M ${first.x} ${yBase}`,
      `L ${first.x} ${first.y}`,
      ...anchors.slice(1).map(p => `L ${p.x} ${p.y}`),
      `L ${last.x} ${yBase}`,
      "Z",
    ].join(" ");
  }, [anchors, yBase]);

  // Marker coordinates
  const markerX = leftPad + (clamp(score, 0, 100) / 100) * innerW;
  const markerY = useMemo(() => {
    let y = anchors[0].y;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (markerX >= a.x && markerX <= b.x) {
        const t = (markerX - a.x) / (b.x - a.x);
        y = a.y + t * (b.y - a.y);
        break;
      }
    }
    return y;
  }, [anchors, markerX]);

  // Pulsing glow for active dot
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (active) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ])
      );
      loop.start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
    return () => loop?.stop();
  }, [active, pulse]);
  const glowR = pulse.interpolate({ inputRange: [0, 1], outputRange: [14, 18] });
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.35] });

  // -------- Animated curve + area (draws from zero, only once) --------
  const AnimatedPath: any = Animated.createAnimatedComponent(Path);
  const pathRef = useRef<any>(null);
  const [pathLength, setPathLength] = useState(0);        // 0 so we gate animation until measured
  const drawAnim = useRef(new Animated.Value(0)).current; // 0 → 1 draws the line
  const fillOpacity = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);                      // never replay for this card

  // measure total length after path exists
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (pathRef.current?.getTotalLength) {
        try {
          const len = pathRef.current.getTotalLength();
          if (len && len !== pathLength) setPathLength(len);
        } catch {}
      } else {
        // fallback if RN-SVG can't measure on some devices
        const fallback = Math.max(1, innerW + innerH);
        if (fallback !== pathLength) setPathLength(fallback);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokePath, innerW, innerH]);

  // start animation only once when active and measured
  useEffect(() => {
    if (active && pathLength > 1 && !hasAnimated.current) {
      hasAnimated.current = true;
      drawAnim.setValue(0);
      fillOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(drawAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(fillOpacity, {
          toValue: 1,
          duration: 600,
          delay: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [active, pathLength, drawAnim, fillOpacity]);

  const dashOffset = drawAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [pathLength || 0, 0], // start fully hidden at left → fully drawn
  });

  return (
    <BlurView intensity={60} tint="dark" style={[styles.cardOuter, { width }]}>
      <View style={styles.cardOverlay} pointerEvents="none" />
      <HeaderRow title={title} icon={icon} onInfo={() => {}} />

      <Svg width={width} height={graphH}>
        <Defs>
          <LinearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={COLORS.curveStart} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} />
          </LinearGradient>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COLORS.curveEnd} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={COLORS.curveEnd} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Axes */}
        <Line x1={leftPad} y1={topPad} x2={leftPad} y2={yBase} stroke={COLORS.grid} strokeWidth={1} />
        <Line x1={leftPad} y1={yBase} x2={width - rightPad} y2={yBase} stroke={COLORS.grid} strokeWidth={1} />

        {/* Y ticks */}
        {[0, 50, 100].map((val, i) => {
          const y = topPad + (1 - val / 100) * innerH;
          return (
            <G key={`yt-${i}`}>
              {i !== 0 && (
                <Line
                  x1={leftPad}
                  y1={y}
                  x2={width - rightPad}
                  y2={y}
                  stroke={COLORS.grid}
                  strokeWidth={0.75}
                  opacity={0.32}
                />
              )}
              <SvgText
                x={leftPad - 8}
                y={y + 4}
                fontSize={11}
                fill="rgba(255,255,255,0.6)"
                textAnchor="end"
                fontFamily={POP}
              >
                {val}
              </SvgText>
            </G>
          );
        })}

        {/* Area + animated stroke */}
        <AnimatedPath
          d={fillPath}
          fill="url(#areaGrad)"
          opacity={pathLength > 1 ? fillOpacity : 0}
        />
        <AnimatedPath
          ref={pathRef}
          d={strokePath}
          fill="none"
          stroke="url(#strokeGrad)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(pathLength > 1
            ? { strokeDasharray: pathLength, strokeDashoffset: dashOffset }
            : null)}
        />

        {/* Marker guide + pulsing dot */}
        <Line x1={markerX} y1={topPad} x2={markerX} y2={yBase} stroke={COLORS.curveEnd} strokeWidth={1.2} strokeDasharray="6 6" opacity={0.9} />
        <AnimatedCircle cx={markerX} cy={markerY} r={glowR} fill={COLORS.glow} opacity={glowOp as any} />
        <Circle cx={markerX} cy={markerY} r={9} fill="#fff" />
        <Circle cx={markerX} cy={markerY} r={7} fill="#fff" stroke={COLORS.curveEnd} strokeWidth={2.5} />

        {/* Labels under the graph */}
        {anchorsFor(title).map((label, i) => {

          const x = leftPad + (i / 3) * innerW;
          const y = yBase + 14;
          return (
            <SvgText
              key={label}
              x={x}
              y={y}
              fontSize={11}
              fill="rgba(255,255,255,0.65)"
              textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
              fontFamily={POP}
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Score + insight row */}
      <View style={styles.scoreRow}>
        <GlassRing value={score} active={active} />
        <InsightBlock
          metricLabel={title}
          score={score}
          percentile={percentile}
          active={active}
        />
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Main screen with FlatList + prev/next gum buttons
// ---------------------------------------------------------------------------
function applyApiScores(api: any): MetricItem[] {
  const scores = api?.scores ?? api;

  // normalize keys from snake_case to Title Case
  const keyMap: Record<string, string> = {
    jawline: "Jawline",
    facial_symmetry: "Facial Symmetry",
    cheekbones: "Cheekbones",
    sexual_dimorphism: "Masculinity",
    skin_quality: "Skin Quality",
    eyes_symmetry: "Eye Symmetry",
    nose_harmony: "Nose Balance",
  };

  return DEFAULT_METRICS.map(m => {
    // try API key directly OR via keyMap
    const apiKey = Object.entries(keyMap).find(([, v]) => v === m.key)?.[0];
    const sc = Number(scores?.[apiKey ?? ""]);
    return {
      ...m,
      score: Number.isFinite(sc) ? Math.max(0, Math.min(100, sc)) : m.score,
      percentile: Number.isFinite(sc) ? sc : (m.percentile ?? m.score),
    };
  });
}

export default function ScoreScreen() {
  const { width } = useWindowDimensions();
  const { imageUri, scores, explain, explLoading, explError } = useScores();

  const itemWidth = Math.min(760, Math.max(320, width * 0.82));
  const spacer = Math.max(12, width * 0.02);
  const snap = itemWidth + spacer;

  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState<MetricItem[]>(DEFAULT_METRICS.slice(0, 7));

  const params = useLocalSearchParams<{ scoresPayload?: string }>();

  useEffect(() => {
    if (!params.scoresPayload) return;
    try {
      const payload = JSON.parse(params.scoresPayload as string);
      setMetrics(applyApiScores(payload).slice(0, 7));
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      (applyApiScores(payload).slice(0, 7));
    } catch {
      // ignore bad payloads
    }
  }, [params.scoresPayload]);

  const listRef = useRef<FlatList>(null);

  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: snap, offset: snap * i, index: i }),
    [snap]
  );

  const renderItem = useCallback(
    ({ item, index: i }: { item: MetricItem; index: number }) => (
      <View style={{ width: snap }}>
        <MetricCard item={item} width={itemWidth} active={i === index} />
      </View>
    ),
    [index, itemWidth, snap]
  );

  const scrollTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(metrics.length - 1, i));
      listRef.current?.scrollToOffset({ offset: clamped * snap, animated: true });
      setIndex(clamped);
    },
    [snap]
  );

  const goPrev = useCallback(() => scrollTo(index - 1), [index, scrollTo]);
  const goNext = useCallback(() => scrollTo(index + 1), [index, scrollTo]);

  const handleAdvanced = async () => {
    if (!imageUri || !scores) return;
    router.push({ pathname: "/loading", params: { mode: "advanced" } });
  };
  
  

  return (
    <ImageBackground
      source={require("../../assets/bg/score-bg.jpg")} // make sure file path is correct
      style={styles.page}
      resizeMode="cover"
    >
      {/* dark overlay so card pops */}
      <View style={styles.scrim} />

      <FlatList
        ref={listRef}
        horizontal
        data={metrics}
        keyExtractor={(m) => m.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        pagingEnabled={false}
        snapToInterval={snap}
        snapToAlignment="center"
        contentContainerStyle={{
          paddingHorizontal: (width - itemWidth) / 2,
          paddingBottom: 8,
          alignItems: "center",
        }}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / snap))
        }
        getItemLayout={getItemLayout}
        removeClippedSubviews={false}
      />

      {/* Pager dots */}
      <View style={styles.dotsRow}>
        {metrics.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Gumroad-style controls */}
      <View style={styles.controlsRow}>
        <GumButton
          label="Previous"
          onPress={goPrev}
          disabled={index === 0}
          variant="prev"
        />

        {index === metrics.length - 1 ? (
          <View style={[styles.gumShadowWrap, explLoading && { opacity: 0.7 }]}>
            <Pressable
              accessibilityRole="button"
              onPress={explLoading ? undefined : handleAdvanced}
              style={({ pressed }) => [
                styles.gumButton,
                { backgroundColor: COLORS.curveStart },
                pressed && { transform: [{ translateY: 1 }] },
              ]}
            >
              {explLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.gumLabel, { color: "#fff" }]}>
                  Advanced analysis
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <GumButton
            label="Next"
            onPress={goNext}
            disabled={index === metrics.length - 1}
            variant="next"
          />
        )}
      </View>

      {!!explError && (
        <Text
          style={{
            color: "#C0392B",
            marginTop: 8,
            textAlign: "center",
            fontFamily: POP,
          }}
        >
          {String(explError)}
        </Text>
      )}
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// Gumroad-style pill button with active glow
// ---------------------------------------------------------------------------
function GumButton({ label, onPress, disabled, variant }: { label: string; onPress: () => void; disabled?: boolean; variant?: 'prev' | 'next' }) {
  const [pressed, setPressed] = useState(false);

  // subtle glow loop on badge when enabled

  return (
    <View style={[styles.gumShadowWrap, disabled && { opacity: 0.55 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [styles.gumButton, pressed && styles.gumButtonPressed]}
      >
        {variant === 'prev' && (
          <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
            <Path d="M14 5l-7 7 7 7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        )}

        <Text style={styles.gumLabel}>{label}</Text>

        {variant === 'next' && (
          <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginLeft: 8 }}>
            <Path d="M1.5 12s3.5-6.5 10.5-6.5S22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z" fill="none" stroke="#FFFFFF" strokeWidth="1.8"/>
            <Circle cx="12" cy="12" r="3.2" fill="none" stroke="#FFFFFF" strokeWidth="1.8"/>
          </Svg>
        )}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    justifyContent: "center",
    alignItems: "center",
  },

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  cardOuter: {
    borderRadius: 24,
    overflow: "hidden",
    paddingTop: 10,
    paddingBottom: 18,   // back to original
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.04)", // subtle frosted layer
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },

  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  infoBtn: {
    marginLeft: "auto",
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  metricTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontFamily: POP,
    marginLeft: 6,
  },

  // Graph + ring
  ringWrap: {
    alignSelf: "center",
    width: 128,
    height: 128,
    marginTop: 8,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    // slightly deeper shadow so it sits “in” the glass
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 8,
  },

  ringText: { position: "absolute", fontSize: 26, color: COLORS.textDark, fontFamily: POP },

  // Score + Insight row
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 16,
  },

  insightCol: {
    flex: 1,
    marginTop: -6,     // lifts the whole block up a bit
    paddingBottom: 6,  // tiny breathing room above card edge
  },

  insightLead: { fontSize: 16, lineHeight: 22, color: COLORS.textDark, fontFamily: POP },

  bold: { fontFamily: POP },

  miniBar: {
    marginTop: 8,
    height: 10,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 999,
    overflow: "hidden",
  },
  miniFill: {
    height: 10,
    backgroundColor: COLORS.progressFill,
    borderRadius: 999,
  },
  miniLockWrap: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  miniLabel: { marginTop: 6, color: COLORS.textSubtle, fontSize: 13, fontFamily: POP },

  // Pager dots
  dotsRow: {
    position: 'absolute',
    bottom: 70,             // dots below buttons; tweak as needed
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dotActive: {
    backgroundColor: COLORS.curveEnd,
  },

  // Controls row
  controlsRow: {
    position: "absolute",
    bottom: 96,           // was 110; closer to the card
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 12,
    alignItems: "center",
  },

  gumShadowWrap: {
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  gumButton: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  gumButtonPressed: { transform: [{ translateY: 1 }] },
  gumLabel: { fontSize: 16, color: "#FFFFFF", fontFamily: POP },

  gumBadge: {
    marginLeft: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD8D0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00FFC2', // glow color modulated by Animated shadowOpacity/radius
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  gumBadgeCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0F0F0F',
  },
});
