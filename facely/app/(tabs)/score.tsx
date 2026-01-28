// C:\SS\facely\app\(tabs)\score.tsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import Screen from "@/components/layout/Screen";
import MetricCardShell from "@/components/layout/MetricCardShell";
import MetricPagerFooter from "@/components/layout/MetricPagerFooter";
import { SP } from "@/lib/tokens";
import useMetricSizing from "@/components/layout/useMetricSizing.ts";
import ScoresSummaryCard from "@/components/scores/ScoresSummaryCard";

// ƒo. default Text (Poppins)
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
   score.tsx ƒ?" Swipeable metric graphs with glassmorphism score ring,
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

 
  ringTrack: "rgba(255,255,255,0.16)",

  chipBg: "rgba(0,0,0,0.28)",
  divider: "rgba(255,255,255,0.08)",
  progressTrack: "rgba(255,255,255,0.12)",

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
  icon?: 'jaw' | 'sym' | 'cheek' | 'dimorph' | 'skin' | 'eyesym' | 'nose';
  locked?: boolean;      // future gating if needed
};

// Card type for FlatList - either summary or individual metric
type CardItem =
  | { type: "summary"; key: string }
  | { type: "metric"; key: string; item: MetricItem };

type MetricDefinition = {
  apiKey: string;
  label: string;
  icon: MetricItem['icon'];
  defaultScore: number;
  defaultPercentile?: number;
  locked?: boolean;
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    apiKey: "jawline",
    label: "Jawline",
    icon: "jaw",
    defaultScore: 64,
    defaultPercentile: 64,
  },
  {
    apiKey: "facial_symmetry",
    label: "Facial Symmetry",
    icon: "sym",
    defaultScore: 72,
    defaultPercentile: 72,
  },
  {
    apiKey: "cheekbones",
    label: "Cheekbones",
    icon: "cheek",
    defaultScore: 58,
    defaultPercentile: 58,
  },
  {
    apiKey: "sexual_dimorphism",
    label: "Masculinity/Femininity",
    icon: "dimorph",
    defaultScore: 81,
    defaultPercentile: 83,
  },
  {
    apiKey: "skin_quality",
    label: "Skin Quality",
    icon: "skin",
    defaultScore: 69,
    defaultPercentile: 71,
  },
  {
    apiKey: "eyes_symmetry",
    label: "Eye Symmetry",
    icon: "eyesym",
    defaultScore: 62,
    defaultPercentile: 60,
  },
  {
    apiKey: "nose_harmony",
    label: "Nose Balance",
    icon: "nose",
    defaultScore: 74,
    defaultPercentile: 76,
  },
];

// Full 8 metrics
const DEFAULT_METRICS: MetricItem[] = METRIC_DEFINITIONS.map(
  ({ label, icon, defaultScore, defaultPercentile, locked }) => ({
    key: label,
    icon,
    locked,
    score: defaultScore,
    percentile: defaultPercentile ?? defaultScore,
  })
);

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

// Score color bands - using app's lime green accent for positive scores
const ACCENT = "#B4F34D";
const SCORE_COLOR_BANDS = [
  { max: 39, color: "#EF4444" },  // Red - Needs Work
  { max: 54, color: "#F59E0B" },  // Orange - Developing
  { max: 69, color: "#A3E635" },  // Light lime - Good
  { max: 100, color: ACCENT },    // Full accent - Excellent
] as const;

type ScorePalette = {
  accent: string;
  accentLight: string;
  glow: string;
};

function hexToRgb(hex: string) {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const parsed = parseInt(normalized, 16);
  const int = Number.isNaN(parsed) ? 0 : parsed;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
}

function toHex(channel: number) {
  return Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, "0");
}

function lightenColor(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) => channel + (255 - channel) * amount;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getScorePalette(score: number): ScorePalette {
  const s = clamp(score, 0, 100);
  const band = SCORE_COLOR_BANDS.find(({ max }) => s <= max) ?? SCORE_COLOR_BANDS[SCORE_COLOR_BANDS.length - 1];
  const accent = band.color;
  return {
    accent,
    accentLight: lightenColor(accent, 0.25),
    glow: withAlpha(accent, 0.28),
  };
}

function tierIndexFor(score: number) {
  const s = clamp(score, 0, 100);
  if (s <= 30) return 0;
  if (s <= 60) return 1;
  if (s <= 80) return 2;
  return 3;
}

const ANCHORS: Record<string, [string, string, string, string]> = {
"Jawline": ["Soft", "Weak", "Sharp", "Elite"],
  "Cheekbones": ["Flat", "Visibly off", "Projected", "Sculpted"],
  "Facial Symmetry": ["Tilted", "Asymmetrical", "Balanced", "Mirror-clean"],
  "Eye Symmetry": ["Uneven", "Off-aligned", "Aligned", "Highly aligned"],
  "Skin Quality": ["Textured", "Dull", "Clear", "Glassy"],
  "Nose Balance": ["Off-scale", "Imbalance", "Proportionate", "Seamless"],
  "Masculinity/Femininity": ["Subtle", "Undefined", "Clear", "Strong"],
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
// Geometry helpers ƒ?" Catmullƒ?"Rom to Bezier
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
function GlassRing({ value, active, palette }: { value: number; active: boolean; palette: ScorePalette }) {

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
          <Stop offset="0%" stopColor={palette.accentLight} />
          <Stop offset="100%" stopColor={palette.accent} />
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
  palette,
}: {
  metricLabel: string;
  score: number;
  percentile?: number;
  active: boolean;
  palette: ScorePalette;
}) {
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
    // lifted up slightly so it doesnƒ?Tt collide with the card bottom
    <View style={styles.insightCol}>
      <Text style={styles.insightLead}>
        Your {metricLabel.toLowerCase()} is{" "}
        <Text style={styles.bold}>
          {tierLabelFor(metricLabel, score)} Aú {roundPct(percentile)}%
        </Text>
      </Text>

      {/* tiny milestone/progress bar */}
      <View style={styles.miniBar}>
      <Animated.View style={[styles.miniFill, { width, backgroundColor: palette.accent }]} />

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

  const palette = useMemo(() => getScorePalette(score), [score]);


  const graphH = 280;
  const leftPad = 36;
  const rightPad = 32;
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
  const drawAnim = useRef(new Animated.Value(0)).current; // 0 ƒ+' 1 draws the line
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
    outputRange: [pathLength || 0, 0], // start fully hidden at left ƒ+' fully drawn
  });

  return (
    <BlurView intensity={60} tint="dark" style={[styles.cardOuter, { width }]}>
      <View style={styles.cardOverlay} pointerEvents="none" />
      <HeaderRow title={title} icon={icon} onInfo={() => {}} />

      <Svg width={width} height={graphH}>
        <Defs>
          <LinearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={palette.accentLight} />
          <Stop offset="100%" stopColor={palette.accent} />
          </LinearGradient>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={palette.accent} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={palette.accent} stopOpacity={0} />
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
        <Line x1={markerX} y1={topPad} x2={markerX} y2={yBase} stroke={palette.accent} strokeWidth={1.2} strokeDasharray="6 6" opacity={0.9} />
        <AnimatedCircle cx={markerX} cy={markerY} r={glowR} fill={palette.glow} opacity={glowOp as any} />
        <Circle cx={markerX} cy={markerY} r={9} fill="#fff" />
        <Circle cx={markerX} cy={markerY} r={7} fill="#fff" stroke={palette.accent} strokeWidth={2.5} />


        {/* Labels under the graph */}
        {anchorsFor(title).map((label, i) => {
          const x = leftPad + (i / 3) * innerW;
          const rowOffset = i % 2 === 0 ? 14 : 30; // two rows
          const y = yBase + rowOffset;

          return (
            <SvgText
              key={label}
              x={x}
              y={y}
              fontSize={10}
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
      <GlassRing value={score} active={active} palette={palette} />

        <InsightBlock
          metricLabel={title}
          score={score}
          percentile={percentile}
          active={active}
          palette={palette}

        />
      </View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Main screen with FlatList + nav buttons
// ---------------------------------------------------------------------------
function applyApiScores(api: any): MetricItem[] {
  const scores = api?.scores ?? api;
  return METRIC_DEFINITIONS.map(({ apiKey, label, icon, locked, defaultScore, defaultPercentile }) => {
    const raw = Number(scores?.[apiKey]);
    const val = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
    const pct = defaultPercentile ?? defaultScore;
    return {
      key: label,
      icon,
      locked,
      score: val ?? defaultScore,
      percentile: val ?? pct,
    } as MetricItem;
  });
}

// Calculate total/average score from all metrics
function calculateTotalScore(metrics: MetricItem[]): number {
  if (!metrics.length) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.score, 0);
  return Math.round(sum / metrics.length);
}

export default function ScoreScreen() {
  const { imageUri, sideImageUri, scores, explLoading, explError } = useScores();
  const sizing = useMetricSizing();
  const { cardWidth, gutter, snap, pad } = sizing;

  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState<MetricItem[]>(DEFAULT_METRICS);

  // Build card items: summary card at index 0, then individual metric cards
  const cardItems = useMemo<CardItem[]>(() => {
    const items: CardItem[] = [{ type: "summary", key: "__summary__" }];
    metrics.forEach((m) => {
      items.push({ type: "metric", key: m.key, item: m });
    });
    return items;
  }, [metrics]);

  // Total score for summary card
  const totalScore = useMemo(() => calculateTotalScore(metrics), [metrics]);

  // For summary card, we need metrics in the format expected by ScoresSummaryCard
  const summaryMetrics = useMemo(
    () =>
      metrics.map((m) => ({
        key: m.key,
        label: m.key,
        score: m.score,
      })),
    [metrics]
  );

  const activePalette = useMemo(() => {
    if (index === 0) {
      // Summary card - use total score color
      return getScorePalette(totalScore);
    }
    const metricIndex = index - 1;
    return getScorePalette(metrics[metricIndex]?.score ?? DEFAULT_METRICS[0].score);
  }, [metrics, index, totalScore]);

  const params = useLocalSearchParams<{ scoresPayload?: string }>();

  useEffect(() => {
    if (!params.scoresPayload) return;
    try {
      const payload = JSON.parse(params.scoresPayload as string);
      setMetrics(applyApiScores(payload));
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      // ignore bad payloads
    }
  }, [params.scoresPayload]);

  const listRef = useRef<FlatList<CardItem>>(null);

  const getItemLayout = useCallback(
    (_: any, i: number) => ({ length: snap, offset: snap * i, index: i }),
    [snap]
  );

  const renderItem = useCallback(
    ({ item, index: i }: { item: CardItem; index: number }) => {
      if (item.type === "summary") {
        return (
          <View style={[styles.cardItemWrapper, { width: snap }]}>
            <MetricCardShell
              withOuterPadding={false}
              renderSurface={false}
              style={styles.cardShell}
              sizing={sizing}
            >
              {(usableWidth) => (
                <ScoresSummaryCard
                  metrics={summaryMetrics}
                  totalScore={totalScore}
                  width={usableWidth}
                  active={i === index}
                  imageUri={imageUri}
                />
              )}
            </MetricCardShell>
          </View>
        );
      }

      return (
        <View style={[styles.cardItemWrapper, { width: snap }]}>
          <MetricCardShell
            withOuterPadding={false}
            renderSurface={false}
            style={styles.cardShell}
            sizing={sizing}
          >
            {(usableWidth) => (
              <MetricCard item={item.item} width={usableWidth} active={i === index} />
            )}
          </MetricCardShell>
        </View>
      );
    },
    [index, sizing, snap, summaryMetrics, totalScore, imageUri]
  );

  const scrollTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(cardItems.length - 1, i));
      listRef.current?.scrollToOffset({ offset: clamped * snap, animated: true });
      setIndex(clamped);
    },
    [snap, cardItems.length]
  );

  const goPrev = useCallback(() => scrollTo(index - 1), [index, scrollTo]);
  const goNext = useCallback(() => scrollTo(index + 1), [index, scrollTo]);

  const handleAdvanced = useCallback(async () => {
    if (!scores || !imageUri || !sideImageUri) {
      Alert.alert(
        "Advanced analysis unavailable",
        "Advanced analysis needs a recent scan. Please run a new face scan first."
      );
      return;
    }
    router.push({ pathname: "/loading", params: { mode: "advanced", phase: "analysis" } });
  }, [scores, imageUri, sideImageUri]);

  const handleNextNav = useCallback(() => {
    if (index === cardItems.length - 1) {
      handleAdvanced();
      return;
    }
    goNext();
  }, [handleAdvanced, goNext, index, cardItems.length]);

  return (
    <Screen
      contentContainerStyle={styles.screenContent}
      footer={
        <View>
          <MetricPagerFooter
            index={index}
            total={cardItems.length}
            onPrev={goPrev}
            onNext={handleNextNav}
            isFirst={index === 0}
            isLast={index === cardItems.length - 1}
            nextLabel={index === cardItems.length - 1 ? "Advanced analysis" : "Next"}
            nextDisabled={explLoading}
            nextLoading={explLoading}
            helperText={cardItems.length > 1 ? "Swipe to view more metrics" : undefined}
            padX={0}
          />
          {!!explError && (
            <Text style={styles.errorText}>
              {String(explError)}
            </Text>
          )}
        </View>
      }
    >
      <ImageBackground
        source={require("../../assets/bg/score-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={styles.scrim} />
      </ImageBackground>

      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          horizontal
          data={cardItems}
          keyExtractor={(c) => c.key}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          pagingEnabled={false}
          snapToInterval={snap}
          snapToAlignment="center"
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingBottom: 8,
            alignItems: "center",
          }}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / snap))
          }
          getItemLayout={getItemLayout}
          removeClippedSubviews={false}
        />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    justifyContent: "center",
    paddingTop: SP[4],
  },

  listWrap: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
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
  cardItemWrapper: {
    alignItems: "center",
  },
  cardShell: {
    paddingTop: 0,
    paddingBottom: 0,
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
    // slightly deeper shadow so it sits ƒ?oinƒ?? the glass
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

  errorText: {
    color: "#C0392B",
    textAlign: "center",
    fontFamily: POP,
    marginTop: SP[2],
  },
});
